// Main SDK exports
export { Codex } from "./sdk";
export type { ApiConfig, CleanupFunction } from "./sdk";

// Export GraphQL types for use in applications
export * from "./sdk/generated/graphql";

/**
 * Recursively marks every field of a type as optional.
 *
 * Useful with `sdk.send()` when your query selects a subset of a type's
 * fields: the exported query types (e.g. `FilterTokensQuery`) describe the
 * full selection, so wrapping them in `DeepPartial` keeps the compiler honest
 * about fields your query didn't ask for.
 *
 * @example
 * const result = await sdk.send<DeepPartial<FilterTokensQuery>>(
 *   `query { filterTokens(limit: 10) { results { priceUSD } } }`,
 * );
 */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
