import {
  type Client,
  type ClientOptions,
  createClient,
  type ExecutionResult,
  type Sink,
  type SubscribePayload,
} from "graphql-ws";

import { assertEdgeSubscription } from "./edgeSubscription";

export const DEFAULT_EDGE_REALTIME_URL = "wss://fra.edge.codex.io/graphql";

export interface SubscriptionOptions {
  /** Experimental: deliver supported Processed Solana streams directly from edge. */
  useEdge?: boolean;
}

export interface RealtimeClient extends Client {
  subscribe<Data = Record<string, unknown>, Extensions = unknown>(
    payload: SubscribePayload,
    sink: Sink<ExecutionResult<Data, Extensions>>,
    options?: SubscriptionOptions,
  ): () => void;
}

export interface RealtimeClientOptions extends ClientOptions {
  /** Optional infrastructure override; callers select the transport with useEdge. */
  edgeUrl?: string;
}

/** Lightweight transport shared by Codex and clients with their own GraphQL documents. */
export function createRealtimeClient(
  options: RealtimeClientOptions,
): RealtimeClient {
  const { edgeUrl = DEFAULT_EDGE_REALTIME_URL, ...wsOptions } = options;
  const main = createClient(wsOptions);
  let edge: Client | undefined;
  let disposed = false;
  return {
    ...main,
    subscribe: (payload, sink, subscriptionOptions = {}) => {
      if (disposed) throw new Error("Realtime client has been disposed");
      if (!subscriptionOptions.useEdge) return main.subscribe(payload, sink);
      // Reject before creating an edge client or opening any upstream operation.
      assertEdgeSubscription(payload);
      edge ??= createClient({ ...wsOptions, url: edgeUrl, on: undefined });
      return edge.subscribe(payload, sink);
    },
    dispose: async () => {
      disposed = true;
      await Promise.all([main.dispose(), edge?.dispose()]);
    },
  };
}
