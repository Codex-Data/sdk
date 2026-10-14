import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { parseMessage } from "graphql-ws";
import WebSocket from "isomorphic-ws";

import { createEdgeClient } from "./edge";

it("delivers edge and normal results over separate authenticated sockets", async () => {
  const requests: Array<{ source: string; type: string; payload: unknown }> =
    [];
  const servers = ["main", "edge"].map((source) => {
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
  const client = createEdgeClient({
    url: urls[0],
    edgeUrl: urls[1],
    webSocketImpl: WebSocket,
    connectionParams: { Authorization: "test-customer" },
  });
  const query = `subscription { onEventsCreated(id: "pair:1399811149", commitmentLevel: [Processed]) { events { transactionHash } } }`;
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
    const receive = (useEdge: boolean) =>
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
    await expect(Promise.all([receive(false), receive(true)])).resolves.toEqual(
      ["main", "edge"],
    );
    expect(
      requests
        .filter(({ type }) => type === "connection_init")
        .map(({ payload }) => payload),
    ).toEqual([
      { Authorization: "test-customer" },
      { Authorization: "test-customer" },
    ]);
    expect(
      requests
        .filter(({ type }) => type === "subscribe")
        .map(({ payload }) => payload),
    ).toEqual([{ query }, { query }]);
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
        server.emit("subscription", message.payload, socket);
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

it("preserves the validated payload through delayed authentication and retries", async () => {
  const edge = await subscriptionServer();
  let authenticate!: () => void;
  const authentication = new Promise<void>((resolve) => {
    authenticate = resolve;
  });
  let serializedLevels = 0;
  const client = createEdgeClient({
    url: "ws://main.example/graphql",
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
    levels: ["Processed"],
  };
  const payload = { query: edgeQuery, variables };
  const expected = JSON.parse(JSON.stringify(payload));
  try {
    const init = once(edge.server, "init");
    const first = once(edge.server, "subscription");
    client.subscribe(
      payload,
      { next: () => {}, error: () => {}, complete: () => {} },
      { useEdge: true },
    );
    variables.levels[0] = "Confirmed";
    variables.input.networkId = 1;
    variables.input.tokenAddress = "changed";
    payload.query = "subscription { onPriceUpdated { priceUsd } }";
    authenticate();
    expect((await init)[0]).toEqual({ Authorization: "customer" });
    expect((await first)[0]).toEqual(expected);
    const retry = once(edge.server, "subscription");
    client.terminate();
    expect((await retry)[0]).toEqual(expected);
    expect(serializedLevels).toBe(1);
  } finally {
    authenticate();
    await client.dispose();
    await edge.close();
  }
});

it("forwards edge events, supports custom pong handling, and terminates both sockets", async () => {
  const main = await subscriptionServer();
  const edge = await subscriptionServer();
  const configuredConnected = jest.fn();
  let activeSocket: WebSocket;
  const client = createEdgeClient({
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
