/**
 * Network config generation modes.
 *
 * Public generation (the default, used by `pnpm build`) queries the public
 * `getNetworkConfigs` field and never includes a hidden network. Internal
 * generation (`CODEX_INTERNAL_NETWORK_CONFIGS=1`) queries the internal
 * `getNetworkConfigsInternal` field against a staged endpoint with an
 * internal API key, keeps hidden rows with their native-currency descriptor,
 * and writes a separate file, so a hidden network is never unhidden for the
 * public SDK by mistake.
 */

import { createHash } from "crypto";

export type NetworkConfigGenerationMode = "public" | "internal";

export const INTERNAL_NETWORK_CONFIGS_ENV = "CODEX_INTERNAL_NETWORK_CONFIGS";
export const API_URL_ENV = "CODEX_API_URL";

export type GeneratedNetworkConfigInput = {
  networkId: number;
  hidden?: boolean | null;
  nativeCurrency?: {
    decimals: number;
    erc20AliasAddress?: string | null;
    transferEventEmitter?: string | null;
  } | null;
};

export function resolveNetworkConfigGenerationMode(
  env: Record<string, string | undefined> = process.env,
): NetworkConfigGenerationMode {
  const value = env[INTERNAL_NETWORK_CONFIGS_ENV];
  if (value === undefined || value === "" || value === "0" || value === "false")
    return "public";
  if (value === "1" || value === "true") {
    // The build's prebuild hook must always produce the public file; an
    // internal switch left in the shell cannot silently skip it.
    if (env.npm_lifecycle_event === "prebuild") {
      throw new Error(
        `${INTERNAL_NETWORK_CONFIGS_ENV} cannot be set during the build; run generate:configs directly for internal generation`,
      );
    }
    return "internal";
  }
  throw new Error(
    `${INTERNAL_NETWORK_CONFIGS_ENV} must be unset, 0/false or 1/true (got "${value}")`,
  );
}

export function networkConfigsQueryName(
  mode: NetworkConfigGenerationMode,
): "getNetworkConfigs" | "getNetworkConfigsInternal" {
  return mode === "internal"
    ? "getNetworkConfigsInternal"
    : "getNetworkConfigs";
}

/** Output file per mode: the internal file is never read by the build. */
export function networkConfigsOutputFile(
  mode: NetworkConfigGenerationMode,
): "networkConfigs.json" | "networkConfigs.internal.json" {
  return mode === "internal"
    ? "networkConfigs.internal.json"
    : "networkConfigs.json";
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Manifest file written next to the internal network configs. */
export const INTERNAL_MANIFEST_FILE = "networkConfigs.internal.manifest.json";

export type InternalGenerationManifest = {
  /** The SDK version the artifacts were generated for. */
  sdkVersion: string;
  /** The staged endpoint the configs were read from. */
  apiUrl: string;
  /** SHA-256 of the staged `schema.graphql` the SDK was generated from. */
  schemaSha256: string;
  /** Network ids in the internal config file, ascending. */
  networkIds: number[];
  /** ISO-8601 generation time. */
  generatedAt: string;
};

/**
 * Ties one internal generation's artifacts together: the staged schema the
 * SDK/GraphQL documents were generated from, the endpoint and the hidden
 * network set that produced the internal config file, and the SDK version.
 * A consumer verifying a staged HTTP/WS/SDK bundle compares these values,
 * never a file's presence.
 */
export function internalGenerationManifest(input: {
  sdkVersion: string;
  apiUrl: string;
  schemaText: string;
  networkIds: readonly number[];
  generatedAt: Date;
}): InternalGenerationManifest {
  return {
    sdkVersion: input.sdkVersion,
    apiUrl: input.apiUrl,
    schemaSha256: createHash("sha256").update(input.schemaText).digest("hex"),
    networkIds: [...new Set(input.networkIds)].sort((a, b) => a - b),
    generatedAt: input.generatedAt.toISOString(),
  };
}

/**
 * The rows a generation may emit. Public: no hidden or descriptor-bearing row,
 * ever, whatever the endpoint returned (the public field selects neither, so
 * this is a belt-and-braces filter over the response). Internal: hidden rows
 * are kept; a row carrying a native-currency descriptor must be hidden and its
 * descriptor well-formed (integer decimals 0..255, well-formed alias/emitter
 * addresses that differ).
 */
export function selectNetworkConfigsForGeneration<
  T extends GeneratedNetworkConfigInput,
>(configs: readonly T[], mode: NetworkConfigGenerationMode): T[] {
  if (mode === "public") {
    return configs.filter(
      (config) => config.hidden !== true && config.nativeCurrency == null,
    );
  }
  for (const config of configs) {
    const descriptor = config.nativeCurrency;
    if (!descriptor) continue;
    if (config.hidden !== true) {
      throw new Error(
        `Network ${config.networkId} carries a native descriptor but is not hidden; refusing internal generation`,
      );
    }
    if (
      !Number.isInteger(descriptor.decimals) ||
      descriptor.decimals < 0 ||
      descriptor.decimals > 255
    ) {
      throw new Error(
        `Network ${config.networkId} has invalid native decimals ${descriptor.decimals}`,
      );
    }
    for (const address of [
      descriptor.erc20AliasAddress,
      descriptor.transferEventEmitter,
    ]) {
      if (address != null && !EVM_ADDRESS.test(address)) {
        throw new Error(
          `Network ${config.networkId} has a malformed native descriptor address`,
        );
      }
    }
    if (
      descriptor.erc20AliasAddress &&
      descriptor.erc20AliasAddress.toLowerCase() ===
        descriptor.transferEventEmitter?.toLowerCase()
    ) {
      throw new Error(
        `Network ${config.networkId} native descriptor alias and emitter must differ`,
      );
    }
  }
  return [...configs];
}
