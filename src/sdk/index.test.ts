import { DocumentNode } from "graphql";

import { ApiConfig, Codex } from "./index";

const getNetworksDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Networks" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getNetworks" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

const getNetworksString = `query GetNetworks { getNetworks { id } }`;
const subscribePriceUpdatedString = `subscription onPriceUpdated($address: String!, $networkId: Int!) { onPriceUpdated(address: $address, networkId: $networkId) { address networkId priceUsd timestamp } }`;

describe("Codex", () => {
  let sdk: Codex;

  beforeEach(() => {
    sdk = new Codex("dummy-key");
  });

  describe("constructor", () => {
    it("should initialize with default config when no apiConfig provided", () => {
      const sdkInstance = new Codex("test-key");
      expect(sdkInstance).toBeInstanceOf(Codex);
      expect(sdkInstance.queries).toBeDefined();
      expect(sdkInstance.mutations).toBeDefined();
      expect(sdkInstance.subscriptions).toBeDefined();
    });

    it("should throw error when apiKey is not provided", () => {
      expect(() => new Codex("")).toThrow("apiKey must be defined");
      expect(() => new Codex(null as any)).toThrow("apiKey must be defined");
      expect(() => new Codex(undefined as any)).toThrow(
        "apiKey must be defined",
      );
    });

    it("should initialize with custom apiConfig", () => {
      const customConfig: Partial<ApiConfig> = {
        apiUrl: "https://custom.api.com/graphql",
        apiRealtimeUrl: "wss://custom.api.com/graphql",
        headers: { "Custom-Header": "value" },
        wsHeaders: { "WS-Header": "ws-value" },
        ws: false,
      };

      const sdkInstance = new Codex("test-key", customConfig);
      expect(sdkInstance).toBeInstanceOf(Codex);
    });

    it("should merge custom config with default config", () => {
      const customConfig: Partial<ApiConfig> = {
        headers: { "Custom-Header": "value" },
        ws: false,
      };

      // Mock the createGraphQLClient and createWebsocketClient to verify they're called with merged config
      const createGraphQLClientSpy = jest.spyOn(
        Codex.prototype as any,
        "createGraphQLClient",
      );
      const createWebsocketClientSpy = jest.spyOn(
        Codex.prototype as any,
        "createWebsocketClient",
      );

      new Codex("test-key", customConfig);

      // Verify the merged config was used
      expect(createGraphQLClientSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: "https://graph.codex.io/graphql", // default
          apiRealtimeUrl: "wss://graph.codex.io/graphql", // default
          headers: { "Custom-Header": "value" }, // custom
          ws: false, // custom
        }),
      );

      createGraphQLClientSpy.mockRestore();
      createWebsocketClientSpy.mockRestore();
    });
  });

  describe("updateConfig", () => {
    it("should update configuration and recreate clients", () => {
      const disposeSpy = jest.spyOn(sdk, "dispose");
      const createGraphQLClientSpy = jest.spyOn(
        sdk as any,
        "createGraphQLClient",
      );
      const createWebsocketClientSpy = jest.spyOn(
        sdk as any,
        "createWebsocketClient",
      );

      const newConfig: Partial<ApiConfig> = {
        apiUrl: "https://new-api.com/graphql",
        headers: { "New-Header": "new-value" },
      };

      sdk.updateConfig(newConfig);

      expect(disposeSpy).toHaveBeenCalled();
      expect(createGraphQLClientSpy).toHaveBeenCalled();
      expect(createWebsocketClientSpy).toHaveBeenCalled();

      disposeSpy.mockRestore();
      createGraphQLClientSpy.mockRestore();
      createWebsocketClientSpy.mockRestore();
    });

    it("should merge new config with existing config", () => {
      const initialConfig: Partial<ApiConfig> = {
        headers: { "Initial-Header": "initial-value" },
        ws: true,
      };

      const sdkWithConfig = new Codex("test-key", initialConfig);
      const parseConfigSpy = jest.spyOn(sdkWithConfig as any, "parseConfig");

      const updateConfig: Partial<ApiConfig> = {
        headers: { "Updated-Header": "updated-value" },
        apiUrl: "https://updated-api.com/graphql",
      };

      sdkWithConfig.updateConfig(updateConfig);

      // Verify parseConfig was called with merged configuration
      expect(parseConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "Updated-Header": "updated-value" },
          apiUrl: "https://updated-api.com/graphql",
          ws: true, // from initial config
        }),
      );

      parseConfigSpy.mockRestore();
    });

    it("should dispose existing websocket connection before creating new one", () => {
      // Mock wsClient
      const mockDispose = jest.fn();
      (sdk as any).wsClient = { dispose: mockDispose };

      const disposeSpy = jest.spyOn(sdk, "dispose");

      sdk.updateConfig({ headers: { "New-Header": "value" } });

      expect(disposeSpy).toHaveBeenCalled();
      disposeSpy.mockRestore();
    });
  });

  describe("getRequestHeaders", () => {
    it("should return static headers when no dynamic headers are configured", async () => {
      const staticHeaders = { "Static-Header": "static-value" };
      const sdkWithHeaders = new Codex("test-key", { headers: staticHeaders });

      const headers = await (sdkWithHeaders as any).getRequestHeaders();

      expect(headers).toEqual(staticHeaders);
    });

    it("should return dynamic headers when applyHeaders is configured", async () => {
      const dynamicHeaders = { "Dynamic-Header": "dynamic-value" };
      const applyHeaders = jest.fn().mockResolvedValue(dynamicHeaders);

      const sdkWithDynamicHeaders = new Codex("test-key", { applyHeaders });

      const headers = await (sdkWithDynamicHeaders as any).getRequestHeaders();

      expect(applyHeaders).toHaveBeenCalled();
      expect(headers).toEqual(dynamicHeaders);
    });

    it("should merge static and dynamic headers with dynamic taking precedence", async () => {
      const staticHeaders = { "Header-1": "static", "Header-2": "static" };
      const dynamicHeaders = { "Header-2": "dynamic", "Header-3": "dynamic" };
      const applyHeaders = jest.fn().mockResolvedValue(dynamicHeaders);

      const sdkWithBothHeaders = new Codex("test-key", {
        headers: staticHeaders,
        applyHeaders,
      });

      const headers = await (sdkWithBothHeaders as any).getRequestHeaders();

      expect(headers).toEqual({
        "Header-1": "static",
        "Header-2": "dynamic", // dynamic overrides static
        "Header-3": "dynamic",
      });
    });

    it("should handle applyHeaders returning undefined", async () => {
      const staticHeaders = { "Static-Header": "static-value" };
      const applyHeaders = jest.fn().mockResolvedValue(undefined);

      const sdkWithUndefinedDynamic = new Codex("test-key", {
        headers: staticHeaders,
        applyHeaders,
      });

      const headers = await (
        sdkWithUndefinedDynamic as any
      ).getRequestHeaders();

      expect(headers).toEqual(staticHeaders);
    });
  });

  describe("dispose", () => {
    it("should dispose websocket client when it exists", async () => {
      const mockDispose = jest.fn();
      (sdk as any).wsClient = { dispose: mockDispose };

      await sdk.dispose();

      expect(mockDispose).toHaveBeenCalled();
    });

    it("should not throw error when websocket client is undefined", async () => {
      (sdk as any).wsClient = undefined;

      await expect(sdk.dispose()).resolves.not.toThrow();
    });
  });

  describe("websocket configuration", () => {
    it("should create websocket client when ws is true (default)", () => {
      const createWebsocketClientSpy = jest.spyOn(
        Codex.prototype as any,
        "createWebsocketClient",
      );

      new Codex("test-key");

      expect(createWebsocketClientSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ws: true }),
      );

      createWebsocketClientSpy.mockRestore();
    });

    it("should not create websocket client when ws is false", () => {
      const createWebsocketClientSpy = jest.spyOn(
        Codex.prototype as any,
        "createWebsocketClient",
      );

      new Codex("test-key", { ws: false });

      expect(createWebsocketClientSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ws: false }),
      );

      createWebsocketClientSpy.mockRestore();
    });

    it("should throw error when trying to subscribe without websocket enabled", () => {
      const sdkWithoutWs = new Codex("test-key", { ws: false });

      expect(() => {
        sdkWithoutWs.subscribe(
          subscribePriceUpdatedString,
          { address: "0xtoken", networkId: 1 },
          { next: jest.fn(), error: jest.fn(), complete: jest.fn() },
        );
      }).toThrow("Websocket is not enabled in the config");
    });
  });

  describe("query", () => {
    it("should send a fetch request with the correct params", async () => {
      const fetchSpy = jest
        .spyOn(sdk["client"], "request")
        .mockResolvedValue({} as unknown);

      await sdk.query(getNetworksDocument, {});

      expect(fetchSpy).toHaveBeenCalledWith(getNetworksDocument, {}, {});
    });

    it("should include request headers in the request", async () => {
      const mockHeaders = { "Test-Header": "test-value" };
      const getRequestHeadersSpy = jest
        .spyOn(sdk as any, "getRequestHeaders")
        .mockResolvedValue(mockHeaders);
      const fetchSpy = jest
        .spyOn(sdk["client"], "request")
        .mockResolvedValue({} as unknown);

      await sdk.query(getNetworksDocument, {});

      expect(getRequestHeadersSpy).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(
        getNetworksDocument,
        {},
        mockHeaders,
      );

      getRequestHeadersSpy.mockRestore();
    });
  });

  describe("mutation", () => {
    it("should send a request with the correct params", async () => {
      const fetchSpy = jest
        .spyOn(sdk["client"], "request")
        .mockResolvedValue({} as unknown);

      await sdk.mutation(getNetworksDocument, {});

      expect(fetchSpy).toHaveBeenCalledWith(getNetworksDocument, {}, {});
    });

    it("should include request headers in the request", async () => {
      const mockHeaders = { "Test-Header": "test-value" };
      const getRequestHeadersSpy = jest
        .spyOn(sdk as any, "getRequestHeaders")
        .mockResolvedValue(mockHeaders);
      const fetchSpy = jest
        .spyOn(sdk["client"], "request")
        .mockResolvedValue({} as unknown);

      await sdk.mutation(getNetworksDocument, {});

      expect(getRequestHeadersSpy).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(
        getNetworksDocument,
        {},
        mockHeaders,
      );

      getRequestHeadersSpy.mockRestore();
    });
  });

  describe("send", () => {
    it("should return the results of the query", async () => {
      const fetchSpy = jest
        .spyOn(sdk["client"], "request")
        .mockResolvedValue({} as unknown);

      await sdk.send(getNetworksString, {});

      expect(fetchSpy).toHaveBeenCalledWith(getNetworksString, {}, {});
    });

    it("should include request headers in the request", async () => {
      const mockHeaders = { "Test-Header": "test-value" };
      const getRequestHeadersSpy = jest
        .spyOn(sdk as any, "getRequestHeaders")
        .mockResolvedValue(mockHeaders);
      const fetchSpy = jest
        .spyOn(sdk["client"], "request")
        .mockResolvedValue({} as unknown);

      await sdk.send(getNetworksString, {});

      expect(getRequestHeadersSpy).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(getNetworksString, {}, mockHeaders);

      getRequestHeadersSpy.mockRestore();
    });
  });

  describe("subscribe", () => {
    it("should return a cleanup function", () => {
      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();
      const sink = { next, error, complete };

      jest.spyOn(sdk["wsClient"] as any, "subscribe").mockReturnValue(() => {});

      const cleanup = sdk.subscribe(
        subscribePriceUpdatedString,
        { address: "0xtoken", networkId: 1 },
        sink,
      );

      expect(typeof cleanup).toBe("function");
    });

    it("should call wsClient.subscribe with correct parameters", () => {
      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();
      const sink = { next, error, complete };
      const variables = { address: "0xtoken", networkId: 1 };

      const subscribeSpy = jest
        .spyOn(sdk["wsClient"] as any, "subscribe")
        .mockReturnValue(() => {});

      sdk.subscribe(subscribePriceUpdatedString, variables, sink);

      expect(subscribeSpy).toHaveBeenCalledWith(
        {
          query: subscribePriceUpdatedString,
          variables,
        },
        sink,
      );
    });
  });
});
