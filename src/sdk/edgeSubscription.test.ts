import {
  buildSchema,
  getOperationAST,
  Kind,
  parse,
  validate,
  valueFromASTUntyped,
} from "graphql";

import { planEdgeSubscription } from "./edgeSubscription";

const schema = buildSchema(`
  enum EventCommitmentLevel { Processed Confirmed }
  enum BarCommitmentLevel { Processed Confirmed }
  enum QuoteToken { token0 token1 }
  input OnTokenEventsCreatedInput { networkId: Int!, tokenAddress: String }
  type Event { networkId: Int!, transactionHash: String!, logIndex: Int!, supplementalIndex: Int, commitmentLevel: EventCommitmentLevel!, maker: String }
  type AddEventsOutput { id: String!, events: [Event]! }
  type AddTokenEventsOutput { id: String!, events: [Event!]! }
  type Bar { timestamp: Int!, commitmentLevel: BarCommitmentLevel! }
  type Query { noop: Boolean }
  type Subscription {
    onEventsCreated(networkId: Int, id: String, commitmentLevel: [EventCommitmentLevel!]): AddEventsOutput
    onTokenEventsCreated(input: OnTokenEventsCreatedInput!, commitmentLevel: [EventCommitmentLevel!]): AddTokenEventsOutput!
    onBarsUpdated(pairId: String, quoteToken: QuoteToken, commitmentLevel: [BarCommitmentLevel!]): Bar
    onTokenBarsUpdated(tokenId: String, commitmentLevel: [BarCommitmentLevel!]): Bar
  }
`);

it.each([
  `subscription { onEventsCreated(id: "pair:1399811149", commitmentLevel: [Processed, Confirmed]) { events { maker } } }`,
  `subscription($levels: [EventCommitmentLevel!] = [Processed, Confirmed]) { onEventsCreated(networkId: 4663, commitmentLevel: $levels) { events { maker } } }`,
  `subscription($input: OnTokenEventsCreatedInput!, $levels: [EventCommitmentLevel!]) { trades: onTokenEventsCreated(input: $input, commitmentLevel: $levels) { ...Output } } fragment Output on AddTokenEventsOutput { selected: events { maker } ... on AddTokenEventsOutput { other: events { transactionHash } } }`,
  `subscription { onBarsUpdated(pairId: "pair:56", quoteToken: token0, commitmentLevel: [Confirmed, Processed]) { timestamp } }`,
  `subscription { onTokenBarsUpdated(tokenId: "token:56", commitmentLevel: [Processed, Confirmed]) { timestamp } }`,
])(
  "rewrites valid literals, defaults, aliases, fragments and bars: %s",
  (query) => {
    const variables = {
      input: { networkId: 1399811149 },
      levels: ["Processed", "Confirmed", "Processed"],
    };
    const original = JSON.stringify({ query, variables });
    const plan = planEdgeSubscription({ query, variables });
    expect(JSON.stringify({ query, variables })).toBe(original);
    for (const [index, payload] of [
      plan.mainPayload!,
      plan.payload,
    ].entries()) {
      const document = parse(payload.query);
      expect(validate(schema, document)).toEqual([]);
      const operation = getOperationAST(document)!;
      const field = operation.selectionSet.selections[0];
      if (field.kind !== Kind.FIELD) throw new Error("Expected root field");
      const levels = valueFromASTUntyped(
        field.arguments!.find((arg) => arg.name.value === "commitmentLevel")!
          .value,
      );
      expect(levels).toEqual(index === 0 ? ["Confirmed"] : ["Processed"]);
      expect(payload.variables).not.toHaveProperty("levels");
    }
  },
);

it("keeps variables used outside the commitment argument, including nested fragments", () => {
  const query = `subscription Events($id: String = "pair:56", $levels: [EventCommitmentLevel!] = [Processed, Confirmed], $show: Boolean! = true) {
    onEventsCreated(id: $id, commitmentLevel: $levels) { ...One }
  }
  fragment One on AddEventsOutput { ...Two }
  fragment Two on AddEventsOutput { events @include(if: $show) { transactionHash } }
  subscription Other { onEventsCreated(id: "pair:56") { id } }`;
  const plan = planEdgeSubscription({ query, operationName: "Events" });
  for (const payload of [plan.mainPayload!, plan.payload]) {
    const document = parse(payload.query);
    expect(validate(schema, document)).toEqual([]);
    expect(payload.operationName).toBe("Events");
    expect(payload.query).not.toContain("Other");
    expect(
      getOperationAST(document, "Events")!.variableDefinitions!.map(
        (definition) => definition.variable.name.value,
      ),
    ).toEqual(["id", "show"]);
  }
  expect(plan.events?.responseKeys).toEqual(["events"]);
});

it("avoids colliding with caller metadata aliases", () => {
  const plan = planEdgeSubscription({
    query: `subscription { onEventsCreated(id: "pair:56", commitmentLevel: [Processed, Confirmed]) { _codexCommitmentEvents: events { maker } } }`,
  });
  expect(plan.events?.metadataKey).toBe("_codexCommitmentEvents_");
  expect(plan.events?.responseKeys).toEqual(["_codexCommitmentEvents"]);
  expect(validate(schema, parse(plan.payload.query))).toEqual([]);
});

it("preserves processed-only payloads verbatim", () => {
  const payload = {
    query: `subscription { onEventsCreated(id: "pair:56", commitmentLevel: [Processed]) { id } }`,
    extensions: { trace: true },
  };
  const plan = planEdgeSubscription(payload);
  expect(plan.payload).toBe(payload);
  expect(plan.mainPayload).toBeUndefined();
});

it("rewrites variable lists containing comments around the parentheses", () => {
  const query = `subscription Events # an opening ( in a comment
  (
    # before variables
    $id: String = "pair:56"
    $levels: [EventCommitmentLevel!] = [Processed, Confirmed]
    # before closing )
  ) { onEventsCreated(id: $id, commitmentLevel: $levels) { events { maker } } }`;
  const plan = planEdgeSubscription({ query });
  for (const payload of [plan.mainPayload!, plan.payload]) {
    expect(validate(schema, parse(payload.query))).toEqual([]);
    expect(payload.query).toContain('$id: String = "pair:56"');
    expect(payload.query).not.toContain("$levels");
  }
});
