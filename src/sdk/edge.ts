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

import {
  assertEdgeSubscription,
  BASE_NETWORK_ID,
  ROBINHOOD_NETWORK_ID,
} from "./edgeSubscription";

export { createClient };

export const DEFAULT_EDGE_URL = "wss://fra.edge.codex.io/graphql";
export const ROBINHOOD_EDGE_URL = "wss://iad.edge.codex.io/graphql";
export const BASE_EDGE_URL = ROBINHOOD_EDGE_URL;

export function edgeUrlForNetwork(networkId: number): string {
  return networkId === ROBINHOOD_NETWORK_ID || networkId === BASE_NETWORK_ID
    ? ROBINHOOD_EDGE_URL
    : DEFAULT_EDGE_URL;
}

export interface SubscriptionOptions {
  /** Experimental: use edge for supported Solana, Robinhood or Base streams whose commitments include Processed. */
  useEdge?: boolean;
}

export interface ClientWithEdge extends Client {
  /** Observe all transports, or select main/edge transports with useEdge. */
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

export interface EdgeClientOptions extends Omit<ClientOptions, "url"> {
  /** Defaults to the Solana edge endpoint. Use ROBINHOOD_EDGE_URL or BASE_EDGE_URL for Virginia. */
  url?: ClientOptions["url"];
}

/** Create a transport that connects only to edge. */
export function createEdgeClient(options: EdgeClientOptions): Client {
  return createClient({ ...options, url: options.url ?? DEFAULT_EDGE_URL });
}

/** Snapshot and validate the arguments that will actually be sent to edge. */
export function prepareEdgeSubscription(
  payload: SubscribePayload,
  replacer?: ClientOptions["jsonMessageReplacer"],
): { payload: SubscribePayload; networkId: number } {
  const snapshot: SubscribePayload = JSON.parse(
    JSON.stringify(payload, replacer),
  );
  return { payload: snapshot, networkId: assertEdgeSubscription(snapshot) };
}

/** Add per-subscription edge routing to an existing GraphQL client. */
export function withEdge(
  main: Client,
  options: ClientOptions & { edgeUrl?: string },
): ClientWithEdge {
  const { edgeUrl, ...wsOptions } = options;
  type EventHandlers = NonNullable<ClientOptions["on"]>;
  const mainHandlers = new Set<EventHandlers>();
  const edgeHandlers = new Set<EventHandlers>(
    wsOptions.on ? [wsOptions.on] : [],
  );
  const handlersFor = (useEdge: boolean): Required<EventHandlers> => {
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
  const mainEvents = handlersFor(false);
  main.on("connecting", mainEvents.connecting);
  main.on("opened", mainEvents.opened);
  main.on("connected", mainEvents.connected);
  main.on("ping", mainEvents.ping);
  main.on("pong", mainEvents.pong);
  main.on("message", mainEvents.message);
  main.on("closed", mainEvents.closed);
  main.on("error", mainEvents.error);
  const edges = new Map<string, Client>();
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
      const { payload: snapshot, networkId } = prepareEdgeSubscription(
        payload,
        wsOptions.jsonMessageReplacer,
      );
      const url = edgeUrl ?? edgeUrlForNetwork(networkId);
      let edge = edges.get(url);
      if (!edge) {
        // Edge payloads are serialized once, before validation. Preserve custom
        // serialization for handshakes without transforming subscriptions again.
        let subscriptionMessage = false;
        edge = createEdgeClient({
          ...wsOptions,
          url,
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
        edges.set(url, edge);
      }
      return edge.subscribe(snapshot, sink);
    },
    terminate: () => {
      main.terminate();
      edges.forEach((edge) => edge.terminate());
    },
    dispose: async () => {
      disposed = true;
      await Promise.all([
        main.dispose(),
        ...Array.from(edges.values(), (edge) => edge.dispose()),
      ]);
    },
  };
}
