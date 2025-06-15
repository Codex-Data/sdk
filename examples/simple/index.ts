import { Codex } from "@codex-data/sdk";

import { AlertRecurrence, Network } from "../../dist/sdk/generated/graphql";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

sdk
  .send<{ getNetworks: Network[] }>(
    `query GetNetworks { getNetworks { id name } }`,
    {},
  )
  .then((res) => {
    console.log("Networks: ", res.getNetworks);
  });
sdk.queries
  .getTokenPrices({
    inputs: [
      { address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", networkId: 56 },
    ],
  })
  .then(console.log);
sdk.queries
  .getTokenEvents({
    query: {
      address: "0xd99c7f6c65857ac913a8f880a4cb84032ab2fc5b",
      networkId: 56,
    },
  })
  .then(console.log);
sdk.queries
  .tokenSparklines({
    input: { ids: ["0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c:56"] },
  })
  .then(console.log);
sdk.queries
  .token({
    input: {
      address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      networkId: 56,
    },
  })
  .then(console.log);
sdk.queries
  .getSymbol({ symbol: "0xd99c7f6c65857ac913a8f880a4cb84032ab2fc5b:56" })
  .then(console.log);
sdk.queries.getNetworks({}).then(console.log);
sdk.queries.getNetworkStatus({ networkIds: [1, 56, 137] }).then(console.log);
sdk.queries
  .filterTokens({
    tokens: [
      "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c:56",
      "0xb2e539a77f0d50d49e750bf44b3602641e9b9859",
    ],
  })
  .then(console.log);
sdk.queries.filterPairs({ filters: { sellCount1: { gt: 1 } } }).then((res) => {
  console.log();
  return res;
});
sdk.queries
  .listPairsForToken({
    networkId: 1,
    tokenAddress: "0x51a59a02ba906194285e81eb1f98ffa28e7cf4c9",
    limit: 1,
  })
  .then(console.log);

sdk.queries
  .getDetailedPairStats({
    networkId: 1,
    pairAddress: "0x34b1e73807cfac2bf77eae6d8630797dd8f924bf",
  })
  .then(console.log);

sdk.queries
  .getWebhooks({
    webhookId: "802cda45-5cc4-4bec-b456-5bec5a08cec4",
  })
  .then(console.log);

// Mutations

// Example showing how to create a webhook and how to delete it.
sdk.mutations
  .createWebhooks({
    input: {
      priceWebhooksInput: {
        webhooks: [
          {
            name: "SDK test webhook",
            callbackUrl:
              "https://webhook.site/#!/697da597-6f40-4bec-b59a-3b6dc2e680b8",
            securityToken: "1234567890",
            alertRecurrence: AlertRecurrence.Once,
            conditions: {
              priceUsd: {
                gt: "100",
              },
              networkId: {
                eq: 1,
              },
              tokenAddress: {
                eq: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              },
            },
          },
        ],
      },
    },
  })
  .then((data) => {
    console.log(data);
    const webhookId = data?.createWebhooks?.priceWebhooks?.[0]?.id;
    if (webhookId) {
      sdk.mutations
        .deleteWebhooks({
          input: {
            webhookIds: [webhookId],
          },
        })
        .then(console.log);
    }
  });
