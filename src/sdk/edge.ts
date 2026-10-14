import {
  type Client,
  type ClientOptions,
  createClient,
  type Event,
  type EventListener,
  type ExecutionResult,
  type Sink,
  type SubscribePayload,
} from "graphql-ws";

import { assertEdgeSubscription } from "./edgeSubscription";

export const DEFAULT_EDGE_URL = "wss://fra.edge.codex.io/graphql";

export interface SubscriptionOptions {
  /** Experimental: deliver supported Processed Solana streams directly from edge. */
  useEdge?: boolean;
}

export interface EdgeClient extends Client {
  /** Observe both transports, or select one with useEdge. */
  on<E extends Event>(
    event: E,
    listener: EventListener<E>,
    options?: SubscriptionOptions,
  ): () => void;
  subscribe<Data = Record<string, unknown>, Extensions = unknown>(
    payload: SubscribePayload,
    sink: Sink<ExecutionResult<Data, Extensions>>,
    options?: SubscriptionOptions,
  ): () => void;
}

export interface EdgeClientOptions extends ClientOptions {
  /** Optional infrastructure override; callers select the transport with useEdge. */
  edgeUrl?: string;
}

/** Lightweight transport shared by Codex and clients with their own GraphQL documents. */
export function createEdgeClient(options: EdgeClientOptions): EdgeClient {
  const { edgeUrl = DEFAULT_EDGE_URL, ...wsOptions } = options;
  type EventHandlers = NonNullable<ClientOptions["on"]>;
  const initialHandlers = wsOptions.on ? [wsOptions.on] : [];
  const mainHandlers = new Set<EventHandlers>(initialHandlers);
  const edgeHandlers = new Set<EventHandlers>(initialHandlers);
  const handlersFor = (useEdge: boolean): EventHandlers => {
    const handlers = () => Array.from(useEdge ? edgeHandlers : mainHandlers);
    // Install before createClient so even non-lazy connection events are observed.
    return {
      connecting: (...args) =>
        handlers().forEach((on) => on?.connecting?.(...args)),
      opened: (...args) => handlers().forEach((on) => on?.opened?.(...args)),
      connected: (...args) =>
        handlers().forEach((on) => on?.connected?.(...args)),
      ping: (...args) => handlers().forEach((on) => on?.ping?.(...args)),
      pong: (...args) => handlers().forEach((on) => on?.pong?.(...args)),
      message: (...args) => handlers().forEach((on) => on?.message?.(...args)),
      closed: (...args) => handlers().forEach((on) => on?.closed?.(...args)),
      error: (...args) => handlers().forEach((on) => on?.error?.(...args)),
    };
  };
  const main = createClient({ ...wsOptions, on: handlersFor(false) });
  let edge: Client | undefined;
  let disposed = false;
  return {
    ...main,
    on: (event, listener, subscriptionOptions = {}) => {
      const handlers = { [event]: listener };
      if (subscriptionOptions.useEdge !== true) mainHandlers.add(handlers);
      if (subscriptionOptions.useEdge !== false) edgeHandlers.add(handlers);
      return () => {
        mainHandlers.delete(handlers);
        edgeHandlers.delete(handlers);
      };
    },
    subscribe: (payload, sink, subscriptionOptions = {}) => {
      if (disposed) throw new Error("Edge client has been disposed");
      if (!subscriptionOptions.useEdge) return main.subscribe(payload, sink);
      // Reject before creating an edge client or opening any upstream operation.
      const snapshot: SubscribePayload = JSON.parse(
        JSON.stringify(payload, wsOptions.jsonMessageReplacer),
      );
      assertEdgeSubscription(snapshot);
      if (!edge) {
        // Edge payloads are serialized once, before validation. Preserve custom
        // serialization for handshakes without transforming subscriptions again.
        let subscriptionMessage = false;
        edge = createClient({
          ...wsOptions,
          url: edgeUrl,
          on: handlersFor(true),
          jsonMessageReplacer: function (key, value) {
            if (key === "") subscriptionMessage = value?.type === "subscribe";
            return subscriptionMessage
              ? value
              : wsOptions.jsonMessageReplacer
                ? wsOptions.jsonMessageReplacer.call(this, key, value)
                : value;
          },
        });
      }
      return edge.subscribe(snapshot, sink);
    },
    terminate: () => {
      main.terminate();
      edge?.terminate();
    },
    dispose: async () => {
      disposed = true;
      await Promise.all([main.dispose(), edge?.dispose()]);
    },
  };
}
