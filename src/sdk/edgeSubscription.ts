import {
  type FragmentDefinitionNode,
  getOperationAST,
  Kind,
  parse,
  type SelectionSetNode,
  TokenKind,
  valueFromASTUntyped,
} from "graphql";
import type { SubscribePayload } from "graphql-ws";

const SOLANA_NETWORK_ID = 1399811149;
export const ROBINHOOD_NETWORK_ID = 4663;
export const BNB_NETWORK_ID = 56;
const SUPPORTED_OPERATIONS = new Set([
  "onEventsCreated",
  "onTokenEventsCreated",
  "onBarsUpdated",
  "onTokenBarsUpdated",
]);

/** Validate GraphQL arguments, including literals and defaults, and return the target network. */
function inspectEdgeSubscription(payload: SubscribePayload) {
  function fail(): never {
    throw new Error(
      "useEdge requires a supported Solana, Robinhood, or BNB subscription with commitmentLevel including Processed",
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
    [...levels].some((level) => level !== "Processed" && level !== "Confirmed")
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
    (networkId !== SOLANA_NETWORK_ID &&
      networkId !== ROBINHOOD_NETWORK_ID &&
      networkId !== BNB_NETWORK_ID) ||
    networks.some((network) => network !== networkId)
  )
    fail();
  // Without an explicit quote, edge proxies this request back to Oregon.
  if (field.name.value === "onBarsUpdated" && args.quoteToken == null) {
    throw new Error("useEdge onBarsUpdated requires an explicit quoteToken");
  }
  return { networkId, levels, document, operation, field };
}

export function assertEdgeSubscription(payload: SubscribePayload): number {
  return inspectEdgeSubscription(payload).networkId;
}

export interface EdgeSubscriptionPlan {
  payload: SubscribePayload;
  networkId: number;
  mainPayload?: SubscribePayload;
  events?: { rootKey: string; metadataKey: string; responseKeys: string[] };
}

/** Split mixed commitments without changing other argument or variable uses. */
export function planEdgeSubscription(
  payload: SubscribePayload,
): EdgeSubscriptionPlan {
  const { networkId, levels, document, operation, field } =
    inspectEdgeSubscription(payload);
  if (!levels.includes("Confirmed")) return { payload, networkId };

  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION)
      fragments.set(definition.name.value, definition);
  }
  const responseKeys = new Set<string>();
  const visited = new Set<string>();
  function collectFields(selectionSet: SelectionSetNode): void {
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        if (selection.name.value === "events")
          responseKeys.add(selection.alias?.value ?? selection.name.value);
      } else if (selection.kind === Kind.INLINE_FRAGMENT)
        collectFields(selection.selectionSet);
      else if (!visited.has(selection.name.value)) {
        visited.add(selection.name.value);
        const fragment = fragments.get(selection.name.value);
        if (fragment) collectFields(fragment.selectionSet);
      }
    }
  }
  const isEvents =
    field.name.value === "onEventsCreated" ||
    field.name.value === "onTokenEventsCreated";
  let metadataKey = "_codexCommitmentEvents";
  // GraphQL names cannot contain punctuation, so this cannot collide with any
  // existing field/alias/fragment name once absent from the source text.
  while (payload.query.includes(metadataKey)) metadataKey += "_";
  if (isEvents && field.selectionSet) collectFields(field.selectionSet);
  const usedVariables = new Set<string>();
  const usedFragments = new Set<string>();
  // Walk executable selections/directives, excluding the commitment argument
  // being replaced. Retain reachable fragments and their variable uses.
  function collect(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as { kind?: string; name?: { value: string } };
    if (node.kind === Kind.VARIABLE) usedVariables.add(node.name!.value);
    if (
      node.kind === Kind.FRAGMENT_SPREAD &&
      !usedFragments.has(node.name!.value)
    ) {
      usedFragments.add(node.name!.value);
      collect(fragments.get(node.name!.value));
    }
    for (const [key, child] of Object.entries(value))
      if (key !== "loc") collect(child);
  }
  collect({
    ...field,
    arguments: field.arguments?.filter(
      (argument) => argument.name.value !== "commitmentLevel",
    ),
  });
  collect(operation.directives);
  const sourceFor = (node: { loc?: { start: number; end: number } }) =>
    payload.query.slice(node.loc!.start, node.loc!.end);

  function forLevels(commitments: string[]): SubscribePayload {
    const argument = field.arguments!.find(
      (argument) => argument.name.value === "commitmentLevel",
    )!;
    const edits = [
      {
        start: argument.value.loc!.start,
        end: argument.value.loc!.end,
        text: `[${commitments.join(", ")}]`,
      },
    ];
    if (isEvents && field.selectionSet) {
      const start = field.selectionSet.loc!.start + 1;
      edits.push({
        start,
        end: start,
        text: ` ${metadataKey}: events { networkId transactionHash logIndex supplementalIndex commitmentLevel } `,
      });
    }
    const definitions = operation.variableDefinitions ?? [];
    if (definitions.length) {
      const retained = definitions.filter((definition) =>
        usedVariables.has(definition.variable.name.value),
      );
      // Parser tokens locate the parentheses even with comments/whitespace in
      // the header. Source edits avoid shipping GraphQL's printer in /edge.
      let open = definitions[0].loc!.startToken.prev!;
      while (open.kind === TokenKind.COMMENT) open = open.prev!;
      let close = definitions[definitions.length - 1].loc!.endToken.next!;
      while (close.kind === TokenKind.COMMENT) close = close.next!;
      edits.push({
        start: open.start,
        end: close.end,
        text: retained.length ? `(${retained.map(sourceFor).join(", ")})` : "",
      });
    }
    let query = sourceFor(operation);
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      const start = edit.start - operation.loc!.start;
      const end = edit.end - operation.loc!.start;
      query = query.slice(0, start) + edit.text + query.slice(end);
    }
    for (const name of usedFragments) {
      const fragment = fragments.get(name);
      if (fragment) query += `\n${sourceFor(fragment)}`;
    }
    return {
      ...payload,
      query,
      variables:
        payload.variables &&
        Object.fromEntries(
          Object.entries(payload.variables).filter(([name]) =>
            usedVariables.has(name),
          ),
        ),
    };
  }
  return {
    networkId,
    payload: forLevels(
      Array.from(new Set(levels.filter((level) => level !== "Confirmed"))),
    ),
    mainPayload: forLevels(["Confirmed"]),
    events: isEvents
      ? {
          rootKey: field.alias?.value ?? field.name.value,
          metadataKey,
          responseKeys: [...responseKeys],
        }
      : undefined,
  };
}
