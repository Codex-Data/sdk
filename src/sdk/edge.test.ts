import { type ClientOptions, createClient } from "graphql-ws";

import {
  BASE_EDGE_URL,
  createEdgeClient,
  DEFAULT_EDGE_URL,
  ROBINHOOD_EDGE_URL,
  withEdge,
} from "./edge";
import * as edgeModule from "./edge";
import { assertEdgeSubscription } from "./edgeSubscription";
import { EventCommitmentLevel } from "./generated/graphql";
import { Codex } from "./index";

jest.mock("graphql-ws", () => ({ createClient: jest.fn() }));

function createClientWithEdge(options: ClientOptions & { edgeUrl?: string }) {
  return withEdge(createClient(options), options);
}

const transports: Array<{
  options: ClientOptions;
  subscribe: jest.Mock;
  dispose: jest.Mock;
  terminate: jest.Mock;
}> = [];
const sink = { next: jest.fn(), error: jest.fn(), complete: jest.fn() };
const events = `subscription Events($input: OnTokenEventsCreatedInput!, $levels: [EventCommitmentLevel!]) {
  onTokenEventsCreated(input: $input, commitmentLevel: $levels) { events { transactionHash } }
}`;
const variables = {
  input: { networkId: 1399811149, tokenAddress: "token" },
  levels: ["Processed"],
};
const robinhoodVariables = {
  ...variables,
  input: { ...variables.input, networkId: 4663 },
};

beforeEach(() => {
  transports.length = 0;
  jest.mocked(createClient).mockImplementation((options) => {
    const transport = {
      options,
      subscribe: jest.fn(() => jest.fn()),
      dispose: jest.fn(async () => {}),
      on: jest.fn(() => () => {}),
      terminate: jest.fn(),
      iterate: async function* () {},
    };
    transports.push(transport);
    return transport;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("creates a standalone edge transport without creating a main transport", () => {
  createEdgeClient({ connectionParams: { Authorization: "customer" } });
  expect(transports).toHaveLength(1);
  expect(transports[0].options.url).toBe(DEFAULT_EDGE_URL);
});

it.each(["sdk", "withEdge"])(
  "%s routes each chain to its own reusable edge transport and disposes all transports",
  async (api) => {
    const sdk = api === "sdk" ? new Codex("customer") : undefined;
    const client =
      sdk ??
      createClientWithEdge({
        url: "wss://main.example/graphql",
        connectionParams: { Authorization: "customer" },
      });
    const subscribe = (values: typeof variables, useEdge = true) =>
      client instanceof Codex
        ? client.subscribe(events, values, sink, { useEdge })
        : client.subscribe({ query: events, variables: values }, sink, {
            useEdge,
          });
    subscribe(robinhoodVariables, false);
    subscribe(variables);
    subscribe(robinhoodVariables);
    subscribe(variables);
    subscribe(robinhoodVariables);
    expect(transports.map(({ options }) => options.url)).toEqual([
      sdk ? "wss://graph.codex.io/graphql" : "wss://main.example/graphql",
      DEFAULT_EDGE_URL,
      ROBINHOOD_EDGE_URL,
    ]);
    expect(
      transports.map(({ subscribe }) => subscribe.mock.calls.length),
    ).toEqual([1, 2, 2]);
    expect(transports[2].subscribe).toHaveBeenCalledWith(
      { query: events, variables: robinhoodVariables },
      sink,
    );
    for (const { options } of transports) {
      expect(options.connectionParams).toEqual({ Authorization: "customer" });
    }
    if (!(client instanceof Codex)) {
      client.terminate();
      expect(
        transports.every(({ terminate }) => terminate.mock.calls.length === 1),
      ).toBe(true);
    }
    await client.dispose();
    expect(
      transports.every(({ dispose }) => dispose.mock.calls.length === 1),
    ).toBe(true);
    expect(() => subscribe(robinhoodVariables)).toThrow("disposed");
  },
);

it.each(["sdk", "withEdge"])(
  "%s honors endpoint overrides for both chains",
  async (api) => {
    const url = "wss://edge.staging.example/graphql";
    const sdk =
      api === "sdk" ? new Codex("customer", { apiEdgeUrl: url }) : undefined;
    const client =
      sdk ??
      createClientWithEdge({ url: "wss://main.example/graphql", edgeUrl: url });
    for (const values of [variables, robinhoodVariables]) {
      if (client instanceof Codex)
        client.subscribe(events, values, sink, { useEdge: true });
      else
        client.subscribe({ query: events, variables: values }, sink, {
          useEdge: true,
        });
    }
    expect(transports).toHaveLength(2);
    expect(transports[1].options.url).toBe(url);
    expect(transports[1].subscribe).toHaveBeenCalledTimes(2);
    await client.dispose();
  },
);

it("routes generated Robinhood subscriptions and recreates both edge clients after config updates", async () => {
  const sdk = new Codex("customer");
  const subscribe = () => {
    for (const { input } of [variables, robinhoodVariables]) {
      sdk.subscriptions.onTokenEventsCreated(
        { input, commitmentLevel: [EventCommitmentLevel.Processed] },
        sink,
        { useEdge: true },
      );
    }
  };
  subscribe();
  expect(transports[2].options.url).toBe(ROBINHOOD_EDGE_URL);
  expect(transports[2].subscribe.mock.calls[0][0].variables.input).toEqual(
    robinhoodVariables.input,
  );
  sdk.updateConfig({ wsHeaders: { Authorization: "refreshed" } });
  expect(
    transports
      .slice(0, 3)
      .every(({ dispose }) => dispose.mock.calls.length === 1),
  ).toBe(true);
  subscribe();
  expect(transports.slice(4).map(({ options }) => options.url)).toEqual([
    DEFAULT_EDGE_URL,
    ROBINHOOD_EDGE_URL,
  ]);
  for (const { options } of transports.slice(3)) {
    expect(options.connectionParams).toEqual({ Authorization: "refreshed" });
  }
  await sdk.dispose();
  expect(
    transports.every(({ dispose }) => dispose.mock.calls.length === 1),
  ).toBe(true);
});

it("uses the serialized network to select the edge endpoint", () => {
  const client = createClientWithEdge({
    url: "wss://main.example/graphql",
    jsonMessageReplacer: (key, value) => (key === "networkId" ? 4663 : value),
  });
  client.subscribe({ query: events, variables }, sink, { useEdge: true });
  expect(transports[1].options.url).toBe(ROBINHOOD_EDGE_URL);
  expect(transports[1].subscribe).toHaveBeenCalledWith(
    { query: events, variables: robinhoodVariables },
    sink,
  );
});

it("creates the SDK edge client only for a valid opt-in and reuses it", async () => {
  const createEdge = jest.spyOn(edgeModule, "createEdgeClient");
  const sdk = new Codex("customer", {
    apiEdgeUrl: "wss://edge.staging.example/graphql",
  });
  sdk.subscribe(events, variables, sink);
  expect(createEdge).not.toHaveBeenCalled();
  expect(() =>
    sdk.subscribe(events, { ...variables, levels: ["Confirmed"] }, sink, {
      useEdge: true,
    }),
  ).toThrow("useEdge requires");
  expect(createEdge).not.toHaveBeenCalled();
  sdk.subscribe(events, variables, sink, { useEdge: true });
  sdk.subscribe(events, variables, sink, { useEdge: true });
  expect(createEdge).toHaveBeenCalledTimes(1);
  expect(transports[1].options.url).toBe("wss://edge.staging.example/graphql");
  await sdk.dispose();
  expect(() =>
    sdk.subscribe(events, variables, sink, { useEdge: true }),
  ).toThrow("disposed");
  expect(createEdge).toHaveBeenCalledTimes(1);
});

it("reuses one edge transport while keeping ordinary subscriptions on the main transport", () => {
  const client = createClientWithEdge({
    url: "wss://main.example/graphql",
    connectionParams: { Authorization: "customer" },
  });
  expect(transports).toHaveLength(1);
  const payload = { query: events, variables };
  client.subscribe(payload, sink);
  const unsubscribe = client.subscribe(payload, sink, { useEdge: true });
  client.subscribe(payload, sink, { useEdge: true });
  client.subscribe(payload, sink, { useEdge: false });
  expect(transports).toHaveLength(2);
  expect(transports[0].subscribe).toHaveBeenCalledTimes(2);
  expect(transports[1].subscribe).toHaveBeenCalledTimes(2);
  expect(transports[1].options.url).toBe(DEFAULT_EDGE_URL);
  expect(transports[1].options.connectionParams).toEqual({
    Authorization: "customer",
  });
  expect(transports[1].subscribe).toHaveBeenCalledWith(payload, sink);
  unsubscribe();
  expect(transports[1].subscribe.mock.results[0].value).toHaveBeenCalledTimes(
    1,
  );
});

it("uses current connection credentials and infrastructure options on both transports", async () => {
  let token = "first";
  const connectionParams = async () => ({ Authorization: token });
  const client = createClientWithEdge({
    url: "wss://main.example/graphql",
    edgeUrl: "wss://edge.staging.example/graphql",
    connectionParams,
    keepAlive: 10000,
    lazyCloseTimeout: 5000,
  });
  client.subscribe({ query: events, variables }, sink, { useEdge: true });
  token = "refreshed";
  for (const transport of transports) {
    expect(transport.options.connectionParams).toBe(connectionParams);
    await expect(connectionParams()).resolves.toEqual({
      Authorization: "refreshed",
    });
    expect(transport.options.keepAlive).toBe(10000);
    expect(transport.options.lazyCloseTimeout).toBe(5000);
  }
  expect(transports[1].options.url).toBe("wss://edge.staging.example/graphql");
});

it.each([
  `subscription { onEventsCreated(id: "pair:1399811149", commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(address: "pair", networkId: 1399811149, commitmentLevel: Processed) { events { transactionHash } } }`,
  `subscription { alias: onTokenEventsCreated(input: {networkId: 1399811149}, commitmentLevel: Processed) { events { transactionHash } } }`,
  `subscription { onBarsUpdated(pairId: "pair:1399811149", quoteToken: token0, commitmentLevel: [Processed]) { timestamp } }`,
  `subscription { onTokenBarsUpdated(tokenId: "token:1399811149", commitmentLevel: [Processed]) { timestamp } }`,
  `subscription { onTokenBarsUpdated(networkId: 1399811149, commitmentLevel: [Processed]) { timestamp } }`,
  `subscription($network: Int = 1399811149, $levels: [EventCommitmentLevel!] = [Processed]) { onEventsCreated(networkId: $network, commitmentLevel: $levels) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:1399811149", commitmentLevel: [Confirmed, Processed]) { events { transactionHash } } }`,
  `subscription { onTokenEventsCreated(input: {networkId: 1399811149}, commitmentLevel: [Preprocessed, Processed, Confirmed]) { events { transactionHash } } }`,
  `subscription { onBarsUpdated(pairId: "pair:1399811149", quoteToken: token0, commitmentLevel: [Processed, Confirmed]) { timestamp } }`,
  `subscription { onTokenBarsUpdated(tokenId: "token:1399811149", commitmentLevel: [Preprocessed, Processed]) { timestamp } }`,
  `subscription($network: Int = 1399811149, $levels: [EventCommitmentLevel!] = [Confirmed, Processed]) { onEventsCreated(networkId: $network, commitmentLevel: $levels) { events { transactionHash } } }`,
])(
  "accepts eligible literal and default-variable subscriptions: %s",
  (query) => {
    for (const [networkId, url] of [
      [1399811149, DEFAULT_EDGE_URL],
      [4663, ROBINHOOD_EDGE_URL],
      [8453, BASE_EDGE_URL],
    ]) {
      const client = createClientWithEdge({
        url: "wss://main.example/graphql",
      });
      client.subscribe(
        { query: query.replace(/1399811149/g, String(networkId)) },
        sink,
        { useEdge: true },
      );
      const edge = transports[transports.length - 1];
      expect(edge.subscribe).toHaveBeenCalledTimes(1);
      expect(edge.options.url).toBe(url);
    }
  },
);

it.each([
  {},
  { levels: undefined },
  { levels: null },
  { levels: [] },
  { levels: new Array(1) },
  { levels: Object.assign(new Array(2), { 0: "Processed" }) },
  { levels: ["Confirmed"] },
  { levels: ["Preprocessed"] },
  { levels: ["Preprocessed", "Confirmed"] },
  { levels: ["Processed", "Finalized"] },
  { levels: ["Processed", null] },
  { levels: ["Processed", 1] },
  { input: { networkId: 1 } },
  { input: { networkId: "1399811149" } },
  { input: { tokenAddress: "token" } },
])(
  "rejects ineligible variables without sending an operation: %j",
  (override) => {
    const client = createClientWithEdge({ url: "wss://main.example/graphql" });
    // An empty override exercises missing variables rather than the valid base.
    const values = Object.keys(override).length
      ? { ...variables, ...override }
      : {};
    expect(() =>
      client.subscribe({ query: events, variables: values }, sink, {
        useEdge: true,
      }),
    ).toThrow("useEdge requires");
    expect(transports).toHaveLength(1);
    expect(transports[0].subscribe).not.toHaveBeenCalled();
  },
);

it.each([
  `query { onEventsCreated(networkId: 1399811149, commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onPriceUpdated(networkId: 1399811149, commitmentLevel: [Processed]) { priceUsd } }`,
  `subscription { onEventsCreatedByMaker(input: {networkId: 1399811149}, commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:1", commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:1399811149", networkId: 1, commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:4663", networkId: 1399811149, commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:1399811149", networkId: 4663, commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:46630", commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:4663", commitmentLevel: [Confirmed]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(id: "pair:4663", commitmentLevel: [Processed, Finalized]) { events { transactionHash } } }`,
  `subscription { onEventsCreated(commitmentLevel: [Processed]) { events { transactionHash } } }`,
  `subscription { onTokenBarsUpdated(tokenId: "token", commitmentLevel: [Processed]) { timestamp } }`,
  `subscription { a: onEventsCreated(networkId: 1399811149, commitmentLevel: [Processed]) { id } b: onEventsCreated(networkId: 1399811149, commitmentLevel: [Processed]) { id } }`,
  `subscription { onEventsCreated(networkId: 1399811149, commitmentLevel: [Processed]) @skip(if: true) { id } }`,
  `subscription { ...Root } fragment Root on Subscription { onEventsCreated(networkId: 1399811149, commitmentLevel: [Processed]) { id } }`,
])("rejects ineligible documents: %s", (query) => {
  const client = createClientWithEdge({ url: "wss://main.example/graphql" });
  expect(() => client.subscribe({ query }, sink, { useEdge: true })).toThrow(
    "useEdge requires",
  );
  expect(transports).toHaveLength(1);
});

it.each([1399811149, 4663, 8453])(
  "rejects implicit pair quote selection for network %s instead of letting edge relay it through Oregon",
  (networkId) => {
    const client = createClientWithEdge({ url: "wss://main.example/graphql" });
    expect(() =>
      client.subscribe(
        {
          query: `subscription { onBarsUpdated(pairId: "pair:${networkId}", commitmentLevel: [Processed]) { timestamp } }`,
        },
        sink,
        { useEdge: true },
      ),
    ).toThrow("explicit quoteToken");
    expect(transports).toHaveLength(1);
  },
);

it("validates the selected operation in a multi-operation document", () => {
  const client = createClientWithEdge({ url: "wss://main.example/graphql" });
  const query = `${events}\nsubscription Other { onPriceUpdated(networkId: 1) { priceUsd } }`;
  client.subscribe({ query, variables, operationName: "Events" }, sink, {
    useEdge: true,
  });
  expect(() =>
    client.subscribe({ query, variables }, sink, { useEdge: true }),
  ).toThrow();
});

it("disposes both transports and prevents subscriptions from recreating them", async () => {
  const client = createClientWithEdge({ url: "wss://main.example/graphql" });
  client.subscribe({ query: events, variables }, sink, { useEdge: true });
  await client.dispose();
  expect(transports.map(({ dispose }) => dispose.mock.calls.length)).toEqual([
    1, 1,
  ]);
  expect(() =>
    client.subscribe({ query: events, variables }, sink, { useEdge: true }),
  ).toThrow("disposed");
});

it("routes raw and generated mixed SDK subscriptions through useEdge without dropping commitments", async () => {
  const sdk = new Codex("customer");
  const levels = [
    EventCommitmentLevel.Preprocessed,
    EventCommitmentLevel.Processed,
    EventCommitmentLevel.Confirmed,
  ];
  const mixedVariables = { ...variables, levels };
  sdk.subscribe(events, mixedVariables, sink, { useEdge: true });
  sdk.subscriptions.onTokenEventsCreated(
    {
      input: variables.input,
      commitmentLevel: levels,
    },
    sink,
    { useEdge: true },
  );
  expect(transports).toHaveLength(2);
  expect(transports[1].subscribe).toHaveBeenCalledTimes(2);
  expect(transports[1].subscribe.mock.calls[0][0].variables).toEqual(
    mixedVariables,
  );
  expect(transports[1].subscribe.mock.calls[1][0].variables).toEqual({
    input: variables.input,
    commitmentLevel: levels,
  });
  sdk.updateConfig({ wsHeaders: { Authorization: "new-customer" } });
  sdk.subscribe(events, variables, sink, { useEdge: true });
  expect(transports[3].options.connectionParams).toEqual({
    Authorization: "new-customer",
  });
  expect(transports[1].dispose).toHaveBeenCalledTimes(1);
  await sdk.dispose();
  expect(transports[3].dispose).toHaveBeenCalledTimes(1);
});

it("rejects sparse commitment arrays even before wire serialization", () => {
  expect(() =>
    assertEdgeSubscription({
      query: events,
      variables: { ...variables, levels: new Array(1) },
    }),
  ).toThrow("useEdge requires");
});

it("validates serialized variables rather than a misleading toJSON value", () => {
  const client = createClientWithEdge({ url: "wss://main.example/graphql" });
  expect(() =>
    client.subscribe(
      {
        query: events,
        variables: {
          ...variables,
          toJSON: () => ({ ...variables, levels: ["Confirmed"] }),
        },
      },
      sink,
      { useEdge: true },
    ),
  ).toThrow("useEdge requires");
  expect(transports).toHaveLength(1);
});

it("reuses the Virginia transport for separate Base and Robinhood operations", async () => {
  const client = createClientWithEdge({ url: "wss://main.example/graphql" });
  for (const networkId of [4663, 8453]) {
    client.subscribe(
      {
        query: events,
        variables: { ...variables, input: { ...variables.input, networkId } },
      },
      sink,
      { useEdge: true },
    );
  }
  expect(transports).toHaveLength(2);
  expect(transports[1].options.url).toBe(BASE_EDGE_URL);
  expect(transports[1].subscribe).toHaveBeenCalledTimes(2);
  await client.dispose();
});
