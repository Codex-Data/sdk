import type { Client, ExecutionResult, Sink } from "graphql-ws";

import type { EdgeSubscriptionPlan } from "./edgeSubscription";

const ranks = new Map([
  ["Processed", 1],
  ["Confirmed", 2],
]);
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Same identity, ordering and 10-second TTL as graph-commitment-policy. */
export class EventCommitmentGate {
  private entries = new Map<string, { rank: number; expires: number }>();
  private expirations = new Map<number, Set<string>>();

  constructor(
    private now = Date.now,
    private capacity = 10_000,
  ) {}

  clear(): void {
    this.entries.clear();
    this.expirations.clear();
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    const bucket = this.expirations.get(entry.expires);
    bucket?.delete(key);
    if (!bucket?.size) this.expirations.delete(entry.expires);
    this.entries.delete(key);
  }

  private write(key: string, rank: number, expires: number): void {
    this.remove(key);
    if (this.entries.size >= this.capacity) {
      const oldest = Math.min(...this.expirations.keys());
      const keyToEvict = this.expirations.get(oldest)?.values().next().value;
      if (keyToEvict !== undefined) this.remove(keyToEvict);
    }
    this.entries.set(key, { rank, expires });
    let bucket = this.expirations.get(expires);
    if (!bucket) this.expirations.set(expires, (bucket = new Set()));
    bucket.add(key);
  }

  acceptedIndices(events: readonly unknown[]): Set<number> {
    const second = Math.floor(this.now() / 1000);
    for (const [expires, keys] of this.expirations) {
      if (expires <= second) for (const key of keys) this.remove(key);
    }
    const indices = new Set<number>();
    events.forEach((event, index) => {
      const record = asRecord(event);
      const rank =
        typeof record?.commitmentLevel === "string"
          ? ranks.get(record.commitmentLevel)
          : undefined;
      if (
        !record ||
        !rank ||
        record.networkId == null ||
        record.logIndex == null ||
        record.transactionHash == null ||
        String(record.transactionHash).length === 0
      ) {
        indices.add(index);
        return;
      }
      const baseKey = [
        record.networkId,
        record.transactionHash,
        record.logIndex,
      ]
        .map(String)
        .join(":");
      const key =
        record.supplementalIndex == null
          ? baseKey
          : `${baseKey}:${String(record.supplementalIndex)}`;
      if ((this.entries.get(key)?.rank ?? 0) >= rank) return;
      this.write(key, rank, second + 10);
      if (baseKey !== key && (this.entries.get(baseKey)?.rank ?? 0) < rank)
        this.write(baseKey, rank, second + 10);
      indices.add(index);
    });
    return indices;
  }
}

/** Merge split operations into one subscription with shared gating and cleanup. */
export function subscribeWithCommitments<
  Data = Record<string, unknown>,
  Extensions = unknown,
>(
  main: Client,
  edge: Client,
  plan: EdgeSubscriptionPlan,
  sink: Sink<ExecutionResult<Data, Extensions>>,
): () => void {
  if (!plan.mainPayload) return edge.subscribe(plan.payload, sink);
  const gate = new EventCommitmentGate();
  const cleanups: Array<() => void> = [];
  let stopped = false;
  let remaining = 2;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    gate.clear();
    cleanups.splice(0).forEach((cleanup) => cleanup());
  };
  const merged: Sink<ExecutionResult<Data, Extensions>> = {
    next: (result) => {
      if (stopped) return;
      const { events } = plan;
      const data = asRecord(result.data);
      const root = events && data && asRecord(data[events.rootKey]);
      if (!events || !root) {
        sink.next(result);
        return;
      }
      const metadata = root[events.metadataKey];
      const projected = { ...root };
      delete projected[events.metadataKey];
      let suppressed = false;
      if (Array.isArray(metadata)) {
        const accepted = gate.acceptedIndices(metadata);
        suppressed =
          metadata.some((event) => event != null) &&
          !metadata.some(
            (event, index) => event != null && accepted.has(index),
          );
        for (const key of events.responseKeys) {
          const selected = projected[key];
          if (Array.isArray(selected))
            projected[key] = selected.filter((_, index) => accepted.has(index));
        }
      }
      // GraphQL errors still need to reach the caller even for a duplicate batch.
      if (!suppressed || result.errors?.length)
        sink.next({
          ...result,
          data: { ...data, [events.rootKey]: projected } as Data,
        });
    },
    error: (error) => {
      if (stopped) return;
      stop();
      sink.error(error);
    },
    complete: () => {
      if (stopped || --remaining > 0) return;
      stop();
      sink.complete();
    },
  };
  try {
    for (const [client, payload] of [
      [main, plan.mainPayload],
      [edge, plan.payload],
    ] as const) {
      if (stopped) break;
      let completed = false;
      const cleanup = client.subscribe<Data, Extensions>(payload, {
        next: (result) => {
          if (!completed) merged.next(result);
        },
        error: (error) => {
          if (completed) return;
          completed = true;
          merged.error(error);
        },
        complete: () => {
          if (completed) return;
          completed = true;
          merged.complete();
        },
      });
      if (stopped) cleanup();
      else cleanups.push(cleanup);
    }
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}
