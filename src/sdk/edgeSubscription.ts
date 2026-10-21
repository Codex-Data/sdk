import { getOperationAST, Kind, parse, valueFromASTUntyped } from "graphql";
import type { SubscribePayload } from "graphql-ws";

const SOLANA_NETWORK_ID = 1399811149;
export const ROBINHOOD_NETWORK_ID = 4663;
const SUPPORTED_OPERATIONS = new Set([
  "onEventsCreated",
  "onTokenEventsCreated",
  "onBarsUpdated",
  "onTokenBarsUpdated",
]);

/** Validate GraphQL arguments, including literals and defaults, and return the target network. */
export function assertEdgeSubscription(payload: SubscribePayload): number {
  function fail(): never {
    throw new Error(
      "useEdge requires a supported Solana or Robinhood subscription with commitmentLevel including Processed",
    );
  }
  const document = parse(payload.query);
  const operation = getOperationAST(document, payload.operationName);
  if (!operation || operation.operation !== "subscription") fail();
  // Edge executes a single root field; root fragments and conditional roots
  // are not supported by its current customer transport.
  const selections = operation.selectionSet.selections;
  if (selections.length !== 1) fail();
  const field = selections[0];
  if (field.kind !== Kind.FIELD || !SUPPORTED_OPERATIONS.has(field.name.value))
    fail();
  if (field.directives?.length) fail();

  const variables = { ...payload.variables };
  for (const definition of operation.variableDefinitions ?? []) {
    const name = definition.variable.name.value;
    if (
      variables[name] === undefined &&
      definition.defaultValue !== undefined
    ) {
      variables[name] = valueFromASTUntyped(definition.defaultValue);
    }
  }
  const args: Record<string, unknown> = Object.fromEntries(
    (field.arguments ?? []).map((argument) => [
      argument.name.value,
      valueFromASTUntyped(argument.value, variables),
    ]),
  );
  const levels = Array.isArray(args.commitmentLevel)
    ? args.commitmentLevel
    : [args.commitmentLevel];
  if (
    !levels.includes("Processed") ||
    [...levels].some(
      (level) =>
        level !== "Processed" &&
        level !== "Confirmed" &&
        level !== "Preprocessed",
    )
  )
    fail();

  const networks: unknown[] = [];
  const collect = (value: unknown): void => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [name, item] of Object.entries(value)) {
      if (name === "networkId" && item != null) networks.push(item);
      if (["id", "pairId", "tokenId"].includes(name) && item != null) {
        if (typeof item !== "string" || !/^[^:]+:\d+$/.test(item)) fail();
        networks.push(Number(item.slice(item.lastIndexOf(":") + 1)));
      }
      if (name === "input") collect(item);
    }
  };
  collect(args);
  const networkId = networks[0];
  if (
    (networkId !== SOLANA_NETWORK_ID && networkId !== ROBINHOOD_NETWORK_ID) ||
    networks.some((network) => network !== networkId)
  )
    fail();
  // Without an explicit quote, edge proxies this request back to Oregon.
  if (field.name.value === "onBarsUpdated" && args.quoteToken == null) {
    throw new Error("useEdge onBarsUpdated requires an explicit quoteToken");
  }
  return networkId;
}
