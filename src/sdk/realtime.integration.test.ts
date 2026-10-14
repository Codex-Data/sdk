import type { AddressInfo } from "node:net";

import WebSocket from "isomorphic-ws";

import { createRealtimeClient } from "./realtime";

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
  const client = createRealtimeClient({
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
