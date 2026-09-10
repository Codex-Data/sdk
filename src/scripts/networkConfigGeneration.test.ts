import { createHash } from "crypto";

import {
  internalGenerationManifest,
  networkConfigsOutputFile,
  networkConfigsQueryName,
  resolveInternalEndpoints,
  resolveNetworkConfigGenerationMode,
  selectNetworkConfigsForGeneration,
  verifyInternalGenerationManifest,
} from "./networkConfigGeneration";

describe("network config generation modes", () => {
  it("defaults to public and reads the internal switch strictly", () => {
    expect(resolveNetworkConfigGenerationMode({})).toBe("public");
    expect(
      resolveNetworkConfigGenerationMode({
        CODEX_INTERNAL_NETWORK_CONFIGS: "0",
      }),
    ).toBe("public");
    expect(
      resolveNetworkConfigGenerationMode({
        CODEX_INTERNAL_NETWORK_CONFIGS: "1",
      }),
    ).toBe("internal");
    expect(
      resolveNetworkConfigGenerationMode({
        CODEX_INTERNAL_NETWORK_CONFIGS: "true",
      }),
    ).toBe("internal");
    expect(() =>
      resolveNetworkConfigGenerationMode({
        CODEX_INTERNAL_NETWORK_CONFIGS: "yes",
      }),
    ).toThrow(/CODEX_INTERNAL_NETWORK_CONFIGS/);
    // The build never runs an internal generation.
    expect(() =>
      resolveNetworkConfigGenerationMode({
        CODEX_INTERNAL_NETWORK_CONFIGS: "1",
        npm_lifecycle_event: "prebuild",
      }),
    ).toThrow(/during the build/);
  });

  it("maps each mode to its query field and its own output file", () => {
    expect(networkConfigsQueryName("public")).toBe("getNetworkConfigs");
    expect(networkConfigsQueryName("internal")).toBe(
      "getNetworkConfigsInternal",
    );
    expect(networkConfigsOutputFile("public")).toBe("networkConfigs.json");
    expect(networkConfigsOutputFile("internal")).toBe(
      "networkConfigs.internal.json",
    );
  });

  it("never emits a hidden or native-descriptor network in public generation", () => {
    const rows = [
      { networkId: 1, hidden: false },
      { networkId: 2, hidden: true },
      {
        networkId: 3,
        hidden: true,
        nativeCurrency: { decimals: 18, erc20AliasAddress: null },
      },
      { networkId: 4 },
    ];
    expect(
      selectNetworkConfigsForGeneration(rows, "public").map((r) => r.networkId),
    ).toEqual([1, 4]);
  });

  it("keeps hidden rows with a valid descriptor in internal generation and refuses an unhidden or malformed one", () => {
    const alias = "0x1111111111111111111111111111111111111111";
    const emitter = "0x2222222222222222222222222222222222222222";
    const valid = {
      networkId: 3,
      hidden: true,
      nativeCurrency: {
        decimals: 18,
        erc20AliasAddress: alias,
        transferEventEmitter: emitter,
      },
    };
    expect(
      selectNetworkConfigsForGeneration([{ networkId: 1 }, valid], "internal"),
    ).toHaveLength(2);
    expect(() =>
      selectNetworkConfigsForGeneration(
        [{ ...valid, hidden: false }],
        "internal",
      ),
    ).toThrow(/not hidden/);
    expect(() =>
      selectNetworkConfigsForGeneration(
        [
          {
            ...valid,
            nativeCurrency: { ...valid.nativeCurrency, decimals: 300 },
          },
        ],
        "internal",
      ),
    ).toThrow(/decimals/);
    expect(() =>
      selectNetworkConfigsForGeneration(
        [
          {
            ...valid,
            nativeCurrency: {
              ...valid.nativeCurrency,
              erc20AliasAddress: "not-an-address",
            },
          },
        ],
        "internal",
      ),
    ).toThrow(/malformed/);
    expect(() =>
      selectNetworkConfigsForGeneration(
        [
          {
            ...valid,
            nativeCurrency: {
              ...valid.nativeCurrency,
              transferEventEmitter: alias,
            },
          },
        ],
        "internal",
      ),
    ).toThrow(/must differ/);
  });

  it("ties an internal generation's schema, endpoint, network set and version together", () => {
    const schemaText = "type Query { ok: Boolean }";
    const manifest = internalGenerationManifest({
      sdkVersion: "1.2.3",
      apiUrl: "https://staged.example/graphql",
      schemaText,
      networkIds: [3, 1, 3],
      generatedAt: new Date("2026-09-10T00:00:00.000Z"),
    });
    expect(manifest).toEqual({
      sdkVersion: "1.2.3",
      apiUrl: "https://staged.example/graphql",
      wsUrl: null,
      schemaUrl: null,
      schemaSha256: createHash("sha256").update(schemaText).digest("hex"),
      networkIds: [1, 3],
      generatedAt: "2026-09-10T00:00:00.000Z",
    });
    // A consumer verifies the bundle by comparing, never by file presence.
    expect(
      verifyInternalGenerationManifest(manifest, {
        sdkVersion: "1.2.3",
        apiUrl: "https://staged.example/graphql",
        wsUrl: null,
        schemaText,
      }),
    ).toEqual([]);
    expect(
      verifyInternalGenerationManifest(manifest, {
        sdkVersion: "1.2.4",
        apiUrl: "https://other.example/graphql",
        wsUrl: "wss://staged.example/graphql",
        schemaText: schemaText + " ",
      }),
    ).toHaveLength(4);
    expect(verifyInternalGenerationManifest(manifest, {})).toEqual([]);
    // A different staged schema is a different bundle.
    expect(
      internalGenerationManifest({
        sdkVersion: "1.2.3",
        apiUrl: "https://staged.example/graphql",
        schemaText: schemaText + " ",
        networkIds: [1],
        generatedAt: new Date(0),
      }).schemaSha256,
    ).not.toBe(manifest.schemaSha256);
  });

  it("requires the staged HTTP endpoint for an internal generation and records the WS/schema endpoints when given", () => {
    expect(() => resolveInternalEndpoints({})).toThrow(/CODEX_API_URL/);
    expect(
      resolveInternalEndpoints({
        CODEX_API_URL: "https://staged.example/graphql",
      }),
    ).toEqual({
      apiUrl: "https://staged.example/graphql",
      wsUrl: null,
      schemaUrl: null,
    });
    expect(
      resolveInternalEndpoints({
        CODEX_API_URL: "https://staged.example/graphql",
        CODEX_WS_URL: "wss://staged.example/graphql",
        CODEX_SCHEMA_URL: "https://staged.example/schema/latest.graphql",
      }),
    ).toEqual({
      apiUrl: "https://staged.example/graphql",
      wsUrl: "wss://staged.example/graphql",
      schemaUrl: "https://staged.example/schema/latest.graphql",
    });
    expect(
      internalGenerationManifest({
        sdkVersion: "1.0.0",
        apiUrl: "https://staged.example/graphql",
        wsUrl: "wss://staged.example/graphql",
        schemaUrl: "https://staged.example/schema/latest.graphql",
        schemaText: "x",
        networkIds: [],
        generatedAt: new Date(0),
      }),
    ).toMatchObject({
      wsUrl: "wss://staged.example/graphql",
      schemaUrl: "https://staged.example/schema/latest.graphql",
    });
  });
});
