import {
  type Client,
  createClient,
  type ExecutionResult,
  type Sink,
  type SubscribePayload,
} from "graphql-ws";

import {
  EventCommitmentGate,
  subscribeWithCommitments,
} from "./commitmentSubscription";
import { withEdge } from "./edge";
import { planEdgeSubscription } from "./edgeSubscription";
import { Codex } from "./index";

jest.mock("graphql-ws", () => ({ createClient: jest.fn() }));

const event = (commitmentLevel = "Processed", extra = {}) => ({
  networkId: 56,
  transactionHash: "tx",
  logIndex: 0,
  commitmentLevel,
  ...extra,
});

it("allows only increasing commitments for each event identity", () => {
  const gate = new EventCommitmentGate();
  expect([
    ...gate.acceptedIndices([
      event(),
      event("Preprocessed"),
      event("Confirmed"),
      event("Confirmed"),
    ]),
  ]).toEqual([0, 2]);
  expect([
    ...gate.acceptedIndices([event("Processed", { transactionIndex: 9 })]),
  ]).toEqual([]);
  expect([
    ...gate.acceptedIndices([
      event("Processed", { logIndex: 1 }),
      event("Processed", { networkId: 1 }),
      event("Processed", { transactionHash: "other" }),
    ]),
  ]).toEqual([0, 1, 2]);
});

it("keeps supplemental siblings distinct while strengthening the coarse identity", () => {
  const gate = new EventCommitmentGate();
  expect([
    ...gate.acceptedIndices([
      event("Processed", { supplementalIndex: 0 }),
      event("Preprocessed"),
      event("Processed", { supplementalIndex: 1 }),
    ]),
  ]).toEqual([0, 2]);
  expect([
    ...gate.acceptedIndices([
      event("Confirmed", { supplementalIndex: 0 }),
      event("Processed"),
      event("Processed", { supplementalIndex: 1 }),
    ]),
  ]).toEqual([0]);
});

it("expires identities after 10 seconds, refreshes expiry on upgrades, and clears state", () => {
  let now = 0;
  const gate = new EventCommitmentGate(() => now);
  gate.acceptedIndices([event("Preprocessed")]);
  now = 9000;
  gate.acceptedIndices([event("Confirmed")]);
  now = 10000;
  expect([...gate.acceptedIndices([event()])]).toEqual([]);
  now = 19000;
  expect([...gate.acceptedIndices([event()])]).toEqual([0]);
  gate.clear();
  expect([...gate.acceptedIndices([event("Preprocessed")])]).toEqual([0]);
});

it("bounds retained identities and passes incomplete identities and unknown levels through", () => {
  const gate = new EventCommitmentGate(() => 0, 2);
  gate.acceptedIndices([
    event(),
    event("Processed", { logIndex: 1 }),
    event("Processed", { logIndex: 2 }),
  ]);
  expect([...gate.acceptedIndices([event()])]).toEqual([0]);
  const unknown = [
    null,
    {},
    event("toString"),
    event("Unknown"),
    event("Confirmed", { transactionHash: "" }),
    event("Confirmed", { logIndex: null }),
    event("Confirmed", { networkId: null }),
  ];
  expect([...gate.acceptedIndices(unknown)]).toEqual(
    unknown.map((_, index) => index),
  );
  expect([...gate.acceptedIndices([event()])]).toEqual([]);
});

interface Operation {
  payload: SubscribePayload;
  sink: Sink<ExecutionResult>;
  cleanup: jest.Mock;
}
const transports: Array<{ client: Client; operations: Operation[] }> = [];

beforeEach(() => {
  transports.length = 0;
  jest.mocked(createClient).mockImplementation(() => {
    const operations: Operation[] = [];
    const client = {
      subscribe: jest.fn((payload, sink) => {
        const cleanup = jest.fn();
        operations.push({ payload, sink, cleanup });
        return cleanup;
      }),
      on: jest.fn(() => () => {}),
      terminate: jest.fn(),
      dispose: jest.fn(async () => {}),
      iterate: async function* () {},
    };
    transports.push({ client, operations });
    return client;
  });
});

const query = `subscription($show: Boolean! = true) { stream: onEventsCreated(id: "pair:56", commitmentLevel: [Processed, Confirmed]) { id ...Output } }
  fragment Output on AddEventsOutput { trades: events @include(if: $show) { maker } }`;

function resultFor(
  operation: Operation,
  events: unknown[],
  extra: Partial<ExecutionResult> = {},
): ExecutionResult {
  const metadataKey = operation.payload.query.includes(
    "_codexCommitmentEvents_",
  )
    ? "_codexCommitmentEvents_"
    : "_codexCommitmentEvents";
  return {
    ...extra,
    data: {
      stream: {
        id: "pair:56",
        trades: events.map((_, index) => ({ maker: `maker-${index}` })),
        [metadataKey]: events,
      },
    },
  };
}

it.each(["sdk", "withEdge"])(
  "%s gates both streams, strips metadata, and cancels both operations once",
  (api) => {
    const client =
      api === "sdk"
        ? new Codex("customer")
        : withEdge(createClient({ url: "ws://main" }), { url: "ws://main" });
    const sink = { next: jest.fn(), error: jest.fn(), complete: jest.fn() };
    const unsubscribe =
      client instanceof Codex
        ? client.subscribe(query, {}, sink, { useEdge: true })
        : client.subscribe({ query }, sink, { useEdge: true });
    const main = transports[0].operations[0];
    const edge = transports[1].operations[0];
    edge.sink.next(resultFor(edge, [event()]));
    main.sink.next(resultFor(main, [event("Confirmed")]));
    edge.sink.next(resultFor(edge, [event()]));
    main.sink.next(resultFor(main, [event("Confirmed")]));
    main.sink.next(
      resultFor(
        main,
        [event("Confirmed"), event("Confirmed", { logIndex: 1 })],
        { extensions: { trace: "kept" } },
      ),
    );
    expect(sink.next.mock.calls.map(([result]) => result)).toEqual([
      { data: { stream: { id: "pair:56", trades: [{ maker: "maker-0" }] } } },
      { data: { stream: { id: "pair:56", trades: [{ maker: "maker-0" }] } } },
      {
        data: { stream: { id: "pair:56", trades: [{ maker: "maker-1" }] } },
        extensions: { trace: "kept" },
      },
    ]);
    unsubscribe();
    unsubscribe();
    expect(main.cleanup).toHaveBeenCalledTimes(1);
    expect(edge.cleanup).toHaveBeenCalledTimes(1);
    main.sink.next(resultFor(main, [event("Confirmed", { logIndex: 2 })]));
    edge.sink.error(new Error("late error"));
    expect(sink.next).toHaveBeenCalledTimes(3);
    expect(sink.error).not.toHaveBeenCalled();
    expect(sink.complete).not.toHaveBeenCalled();
  },
);

function splitSubscription() {
  const main = createClient({ url: "ws://main" });
  const edge = createClient({ url: "ws://edge" });
  const sink = { next: jest.fn(), error: jest.fn(), complete: jest.fn() };
  const plan = planEdgeSubscription({ query });
  return { main, edge, sink, plan };
}

it("preserves null/empty payloads and GraphQL errors even for duplicate batches", () => {
  const { main, edge, sink, plan } = splitSubscription();
  subscribeWithCommitments(main, edge, plan, sink);
  const operation = transports[0].operations[0];
  const errors = [{ message: "partial error" }];
  operation.sink.next(resultFor(operation, [event("Confirmed")]));
  operation.sink.next(resultFor(operation, [null, event("Confirmed")]));
  expect(sink.next).toHaveBeenCalledTimes(1);
  operation.sink.next(resultFor(operation, [event("Confirmed")], { errors }));
  expect(sink.next).toHaveBeenLastCalledWith({
    errors,
    data: { stream: { id: "pair:56", trades: [] } },
  });
  operation.sink.next(resultFor(operation, [null]));
  operation.sink.next(resultFor(operation, []));
  operation.sink.next({ data: { stream: null } });
  operation.sink.next({ errors });
  expect(sink.next).toHaveBeenCalledTimes(6);
});

it("waits for both completions and reports completion once", () => {
  const { main, edge, sink, plan } = splitSubscription();
  subscribeWithCommitments(main, edge, plan, sink);
  transports[0].operations[0].sink.complete();
  transports[0].operations[0].sink.complete();
  transports[0].operations[0].sink.next(
    resultFor(transports[0].operations[0], [event("Confirmed")]),
  );
  expect(sink.next).not.toHaveBeenCalled();
  expect(sink.complete).not.toHaveBeenCalled();
  transports[1].operations[0].sink.next(
    resultFor(transports[1].operations[0], [event()]),
  );
  expect(sink.next).toHaveBeenCalledTimes(1);
  transports[1].operations[0].sink.complete();
  transports[1].operations[0].sink.complete();
  expect(sink.complete).toHaveBeenCalledTimes(1);
  expect(
    transports.every(
      ({ operations }) => operations[0].cleanup.mock.calls.length === 1,
    ),
  ).toBe(true);
});

it.each([0, 1])(
  "cancels both legs after a terminal error on leg %s",
  (index) => {
    const { main, edge, sink, plan } = splitSubscription();
    subscribeWithCommitments(main, edge, plan, sink);
    const error = new Error("failed");
    transports[index].operations[0].sink.error(error);
    transports[1 - index].operations[0].sink.error(error);
    expect(sink.error).toHaveBeenCalledTimes(1);
    expect(sink.error).toHaveBeenCalledWith(error);
    expect(
      transports.every(
        ({ operations }) => operations[0].cleanup.mock.calls.length === 1,
      ),
    ).toBe(true);
  },
);

it("cleans up an opened leg if starting its peer throws", () => {
  const { main, edge, sink, plan } = splitSubscription();
  jest.mocked(edge.subscribe).mockImplementation(() => {
    throw new Error("subscribe failed");
  });
  expect(() => subscribeWithCommitments(main, edge, plan, sink)).toThrow(
    "subscribe failed",
  );
  expect(transports[0].operations[0].cleanup).toHaveBeenCalledTimes(1);
});

it("cleans up when a transport synchronously terminates during subscribe", () => {
  const { main, edge, sink, plan } = splitSubscription();
  const cleanup = jest.fn();
  jest.mocked(main.subscribe).mockImplementation((_, upstream) => {
    upstream.error(new Error("immediate failure"));
    return cleanup;
  });
  subscribeWithCommitments(main, edge, plan, sink);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(edge.subscribe).not.toHaveBeenCalled();
  expect(sink.error).toHaveBeenCalledTimes(1);
});
