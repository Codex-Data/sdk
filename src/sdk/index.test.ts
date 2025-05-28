import { DocumentNode } from "graphql";

import { Codex } from "./index";

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

  describe("query", () => {
    it("send a fetch request with the correct params", async () => {
      const fetchSpy = jest
        .spyOn(sdk["client"], "request")
        .mockResolvedValue({} as unknown);
      await sdk.query(getNetworksDocument, {});
      expect(fetchSpy).toHaveBeenCalledWith(getNetworksDocument, {}, {});
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
  });
  describe("subscribe", () => {
    it("should return a cleanup function", () => {
      const next = jest.fn(),
        error = jest.fn(),
        complete = jest.fn();
      const sink = {
        next,
        error,
        complete,
      };
      jest.spyOn(sdk["wsClient"] as any, "subscribe").mockReturnValue(() => {});
      const cleanup = sdk.subscribe(
        subscribePriceUpdatedString,
        { address: "0xtoken", networkId: 1 },
        sink,
      );
      expect(typeof cleanup).toBe("function");
    });
  });
});
