import { once } from "node:events";
import type { AddressInfo } from "node:net";

import {
  buildSchema,
  execute,
  getOperationAST,
  Kind,
  parse,
  valueFromASTUntyped,
} from "graphql";
import {
  type ClientOptions,
  createClient,
  parseMessage,
  type SubscribePayload,
} from "graphql-ws";
import WebSocket from "isomorphic-ws";

import { DEFAULT_EDGE_URL, ROBINHOOD_EDGE_URL, withEdge } from "./edge";
import { planEdgeSubscription } from "./edgeSubscription";
import { Codex } from "./index";

function createClientWithEdge(options: ClientOptions & { edgeUrl?: string }) {
  return withEdge(createClient(options), options);
}

it("delivers main, Solana edge, and Robinhood edge results over separate authenticated sockets", async () => {
  const requests: Array<{ source: string; type: string; payload: unknown }> =
    [];
  const servers = ["main", "solana", "robinhood"].map((source) => {
    const server = new WebSocket.Server({ host: "127.0.0.1", port: 0 });
    server.on("connection", (socket) => {
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString());
        requests.push({ source, type: message.type, payload: message.payload });
        if (message.type === "connection_init") {
          socket.send(JSON.stringify({ type: "connection_ack" }));
        } else if (message.type === "subscribe") {
          socket.send(
            JSON.stringify({
              id: message.id,
              type: "next",
              payload: { data: { source } },
            }),
          );
          socket.send(JSON.stringify({ id: message.id, type: "complete" }));
        }
      });
    });
    return server;
  });
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.once("listening", resolve);
          server.once("error", reject);
        }),
    ),
  );
  const urls = servers.map(
    (server) => `ws://127.0.0.1:${(server.address() as AddressInfo).port}`,
  );
  const configuredConnected = jest.fn();
  const client = createClientWithEdge({
    url: urls[0],
    webSocketImpl: class extends WebSocket {
      constructor(url: string, protocols: string | string[]) {
        // Exercise default routing using local servers for each regional URL.
        super(
          url === DEFAULT_EDGE_URL
            ? urls[1]
            : url === ROBINHOOD_EDGE_URL
              ? urls[2]
              : url,
          protocols,
        );
      }
    },
    connectionParams: { Authorization: "test-customer" },
    on: { connected: configuredConnected },
  });
  const connected = jest.fn();
  const mainConnected = jest.fn();
  const edgeConnected = jest.fn();
  client.on("connected", connected);
  client.on("connected", mainConnected, { useEdge: false });
  client.on("connected", edgeConnected, { useEdge: true });
  const query = `subscription { onEventsCreated(id: "pair:1399811149", commitmentLevel: [Processed]) { events { transactionHash } } }`;
  const robinhoodQuery = query.replace("1399811149", "4663");
  try {
    expect(() =>
      client.subscribe(
        {
          query: `subscription { onPriceUpdated(networkId: 1) { priceUsd } }`,
        },
        { next: () => {}, error: () => {}, complete: () => {} },
        { useEdge: true },
      ),
    ).toThrow();
    expect(requests).toEqual([]);
    const receive = (useEdge: boolean, query: string) =>
      new Promise<string>((resolve, reject) => {
        client.subscribe<{ source: string }>(
          { query },
          {
            next: (result) => resolve(result.data!.source),
            error: reject,
            complete: () => {},
          },
          { useEdge },
        );
      });
    await expect(
      Promise.all([
        receive(false, query),
        receive(true, query),
        receive(true, robinhoodQuery),
      ]),
    ).resolves.toEqual(["main", "solana", "robinhood"]);
    expect(configuredConnected).toHaveBeenCalledTimes(3);
    expect(connected).toHaveBeenCalledTimes(3);
    expect(mainConnected).toHaveBeenCalledTimes(1);
    expect(edgeConnected).toHaveBeenCalledTimes(2);
    expect(
      requests
        .filter(({ type }) => type === "connection_init")
        .map(({ payload }) => payload),
    ).toEqual([
      { Authorization: "test-customer" },
      { Authorization: "test-customer" },
      { Authorization: "test-customer" },
    ]);
    expect(
      requests
        .filter(({ type }) => type === "subscribe")
        .sort((a, b) => a.source.localeCompare(b.source))
        .map(({ payload }) => payload),
    ).toEqual([{ query }, { query: robinhoodQuery }, { query }]);
  } finally {
    await client.dispose();
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  }
});

async function subscriptionServer() {
  const server = new WebSocket.Server({ host: "127.0.0.1", port: 0 });
  server.on("connection", (socket) => {
    socket.on("message", (data) => {
      const message = parseMessage(data.toString());
      if (message.type === "connection_init") {
        server.emit("init", message.payload);
        socket.send(JSON.stringify({ type: "connection_ack" }));
      } else if (message.type === "subscribe") {
        server.emit("subscription", message.payload, socket, message.id);
      } else if (message.type === "pong") {
        server.emit("pong", message.payload);
      }
    });
  });
  await once(server, "listening");
  return {
    server,
    url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const edgeQuery = `subscription Events($input: OnTokenEventsCreatedInput!, $levels: [EventCommitmentLevel!]) {
  onTokenEventsCreated(input: $input, commitmentLevel: $levels) { events { transactionHash } }
}`;

it("keeps SDK subscriptions on main until a valid edge opt-in and disposes both sockets", async () => {
  const main = await subscriptionServer();
  const edge = await subscriptionServer();
  const sdk = new Codex("customer", {
    apiRealtimeUrl: main.url,
    apiEdgeUrl: edge.url,
  });
  const variables = {
    input: { networkId: 1399811149 },
    levels: ["Processed", "Confirmed"],
  };
  const expected = JSON.parse(JSON.stringify({ query: edgeQuery, variables }));
  const sink = { next: () => {}, error: () => {}, complete: () => {} };
  try {
    const mainInit = once(main.server, "init");
    const mainRequest = once(main.server, "subscription");
    sdk.subscribe(edgeQuery, variables, sink);
    expect((await mainInit)[0]).toEqual({ Authorization: "customer" });
    expect((await mainRequest)[0]).toEqual(expected);
    expect(edge.server.clients.size).toBe(0);
    expect(() =>
      sdk.subscribe(edgeQuery, { ...variables, levels: ["Confirmed"] }, sink, {
        useEdge: true,
      }),
    ).toThrow("useEdge requires");
    expect(edge.server.clients.size).toBe(0);
    const edgeInit = once(edge.server, "init");
    const edgeRequest = once(edge.server, "subscription");
    const confirmedRequest = once(main.server, "subscription");
    const plan = planEdgeSubscription(expected);
    sdk.subscribe(edgeQuery, variables, sink, { useEdge: true });
    variables.input.networkId = 1;
    variables.levels[0] = "Confirmed";
    expect((await edgeInit)[0]).toEqual({ Authorization: "customer" });
    expect((await edgeRequest)[0]).toEqual(plan.payload);
    expect((await confirmedRequest)[0]).toEqual(plan.mainPayload);
  } finally {
    await sdk.dispose();
    await Promise.all([main.close(), edge.close()]);
  }
});

it("preserves both split payloads through delayed authentication and retries", async () => {
  const main = await subscriptionServer();
  const edge = await subscriptionServer();
  let authenticate!: () => void;
  const authentication = new Promise<void>((resolve) => {
    authenticate = resolve;
  });
  let serializedLevels = 0;
  const client = createClientWithEdge({
    url: main.url,
    edgeUrl: edge.url,
    webSocketImpl: WebSocket,
    connectionParams: async () => {
      await authentication;
      return { Authorization: "customer", omit: "remove" };
    },
    jsonMessageReplacer: (key, value) => {
      if (key === "levels") {
        serializedLevels++;
        return serializedLevels === 1 ? value : ["Confirmed"];
      }
      return key === "omit" ? undefined : value;
    },
    retryWait: async () => {},
  });
  const variables = {
    input: { networkId: 1399811149, tokenAddress: "original" },
    levels: ["Preprocessed", "Processed", "Confirmed"],
  };
  const payload = { query: edgeQuery, variables };
  const expected = planEdgeSubscription(JSON.parse(JSON.stringify(payload)));
  try {
    const init = once(edge.server, "init");
    const first = once(edge.server, "subscription");
    const confirmed = once(main.server, "subscription");
    client.subscribe(
      payload,
      { next: () => {}, error: () => {}, complete: () => {} },
      { useEdge: true },
    );
    variables.levels.splice(0, variables.levels.length, "Confirmed");
    variables.input.networkId = 1;
    variables.input.tokenAddress = "changed";
    payload.query = "subscription { onPriceUpdated { priceUsd } }";
    authenticate();
    expect((await init)[0]).toEqual({ Authorization: "customer" });
    expect((await first)[0]).toEqual(expected.payload);
    expect((await confirmed)[0]).toEqual(expected.mainPayload);
    const retry = once(edge.server, "subscription");
    const confirmedRetry = once(main.server, "subscription");
    client.terminate();
    expect((await retry)[0]).toEqual(expected.payload);
    expect((await confirmedRetry)[0]).toEqual(expected.mainPayload);
    expect(serializedLevels).toBe(1);
  } finally {
    authenticate();
    await client.dispose();
    await Promise.all([main.close(), edge.close()]);
  }
});

it("forwards edge events, supports custom pong handling, and terminates both sockets", async () => {
  const main = await subscriptionServer();
  const edge = await subscriptionServer();
  const configuredConnected = jest.fn();
  let activeSocket: WebSocket;
  const client = createClientWithEdge({
    url: main.url,
    edgeUrl: edge.url,
    webSocketImpl: WebSocket,
    disablePong: true,
    retryWait: async () => {},
    on: {
      connected: configuredConnected,
      ping: (received) => {
        if (received) activeSocket.send(JSON.stringify({ type: "pong" }));
      },
    },
  });
  const connected = jest.fn();
  const mainConnected = jest.fn();
  const edgeConnected = jest.fn((socket) => {
    activeSocket = socket as WebSocket;
  });
  const closed = jest.fn();
  client.on("connected", connected);
  client.on("connected", mainConnected, { useEdge: false });
  const removeEdge = client.on("connected", edgeConnected, { useEdge: true });
  client.on("closed", closed);
  const payload = {
    query: edgeQuery,
    variables: { input: { networkId: 1399811149 }, levels: ["Processed"] },
  };
  const sink = { next: () => {}, error: () => {}, complete: () => {} };
  try {
    const mainFirst = once(main.server, "subscription");
    const edgeFirst = once(edge.server, "subscription");
    client.subscribe(payload, sink);
    client.subscribe(payload, sink, { useEdge: true });
    await mainFirst;
    const [, edgeSocket] = await edgeFirst;
    expect(configuredConnected).toHaveBeenCalledTimes(2);
    expect(connected).toHaveBeenCalledTimes(2);
    expect(mainConnected).toHaveBeenCalledTimes(1);
    expect(edgeConnected).toHaveBeenCalledTimes(1);
    const pong = once(edge.server, "pong");
    edgeSocket.send(JSON.stringify({ type: "ping" }));
    await pong;
    removeEdge();
    const mainRetry = once(main.server, "subscription");
    const edgeRetry = once(edge.server, "subscription");
    client.terminate();
    await Promise.all([mainRetry, edgeRetry]);
    expect(closed).toHaveBeenCalledTimes(2);
    expect(connected).toHaveBeenCalledTimes(4);
    expect(mainConnected).toHaveBeenCalledTimes(2);
    expect(edgeConnected).toHaveBeenCalledTimes(1);
  } finally {
    await client.dispose();
    await Promise.all([main.close(), edge.close()]);
  }
});

it.each(["sdk", "withEdge"])(
  "%s merges split event results over real sockets and unsubscribes both legs",
  async (api) => {
    const main = await subscriptionServer();
    const edge = await subscriptionServer();
    const schema = buildSchema(`
    enum EventCommitmentLevel { Preprocessed Processed Confirmed }
    input OnTokenEventsCreatedInput { networkId: Int! }
    type Event { networkId: Int!, transactionHash: String!, logIndex: Int!, supplementalIndex: Int, commitmentLevel: EventCommitmentLevel! }
    type Output { events: [Event!]! }
    type Query { noop: Boolean }
    type Subscription { onTokenEventsCreated(input: OnTokenEventsCreatedInput!, commitmentLevel: [EventCommitmentLevel!]): Output! }
  `);
    const client =
      api === "sdk"
        ? new Codex("customer", {
            apiRealtimeUrl: main.url,
            apiEdgeUrl: edge.url,
          })
        : createClientWithEdge({
            url: main.url,
            edgeUrl: edge.url,
            webSocketImpl: WebSocket,
            connectionParams: { Authorization: "customer" },
          });
    const query = `subscription Events($input: OnTokenEventsCreatedInput!, $levels: [EventCommitmentLevel!]) {
    trades: onTokenEventsCreated(input: $input, commitmentLevel: $levels) { items: events { transactionHash } }
  }`;
    const payload = {
      query,
      variables: {
        input: { networkId: 56 },
        levels: ["Processed", "Confirmed"],
      },
    };
    const received: unknown[] = [];
    const sink = {
      next: (result: unknown) => received.push(result),
      error: jest.fn(),
      complete: jest.fn(),
    };
    try {
      const mainRequest = once(main.server, "subscription");
      const edgeRequest = once(edge.server, "subscription");
      const unsubscribe =
        client instanceof Codex
          ? client.subscribe(query, payload.variables, sink, { useEdge: true })
          : client.subscribe(payload, sink, { useEdge: true });
      const mainOperation = await mainRequest;
      const edgeOperation = await edgeRequest;
      for (const [index, operation] of [
        mainOperation,
        edgeOperation,
      ].entries()) {
        const request: SubscribePayload = operation[0];
        const document = parse(request.query);
        const field = getOperationAST(document)!.selectionSet.selections[0];
        if (field.kind !== Kind.FIELD) throw new Error("Expected root field");
        const level = valueFromASTUntyped(
          field.arguments!.find(
            (argument) => argument.name.value === "commitmentLevel",
          )!.value,
        );
        expect(level).toEqual(index === 0 ? ["Confirmed"] : ["Processed"]);
      }
      const send = async (
        operation: unknown[],
        commitmentLevel: string,
        transactionHash = "tx",
      ) => {
        const [request, socket, id] = operation as [
          SubscribePayload,
          WebSocket,
          string,
        ];
        const result = await execute({
          schema,
          document: parse(request.query),
          variableValues: request.variables,
          rootValue: {
            onTokenEventsCreated: {
              events: [
                {
                  networkId: 56,
                  transactionHash,
                  logIndex: 0,
                  supplementalIndex: null,
                  commitmentLevel,
                },
              ],
            },
          },
        });
        expect(result.errors).toBeUndefined();
        socket.send(JSON.stringify({ id, type: "next", payload: result }));
        // A pong on the same socket establishes that the preceding result was handled.
        const pong = once(
          (socket === mainOperation[1] ? main : edge).server,
          "pong",
        );
        socket.send(JSON.stringify({ type: "ping" }));
        await pong;
      };
      await send(edgeOperation, "Processed");
      await send(mainOperation, "Confirmed");
      await send(edgeOperation, "Processed");
      await send(mainOperation, "Confirmed");
      await send(mainOperation, "Confirmed", "other");
      expect(received).toEqual(
        ["tx", "tx", "other"].map((transactionHash) => ({
          data: { trades: { items: [{ transactionHash }] } },
        })),
      );
      expect(sink.error).not.toHaveBeenCalled();
      const completions = [mainOperation, edgeOperation].map(
        ([, socket, id]) =>
          new Promise<void>((resolve) => {
            (socket as WebSocket).on("message", (data) => {
              const message = parseMessage(data.toString());
              if (message.type === "complete" && message.id === id) resolve();
            });
          }),
      );
      unsubscribe();
      await Promise.all(completions);
      expect(sink.complete).not.toHaveBeenCalled();
    } finally {
      await client.dispose();
      await Promise.all([main.close(), edge.close()]);
    }
  },
);
