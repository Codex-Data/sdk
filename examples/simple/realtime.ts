import { Codex, OnPriceUpdatedSubscription } from "@codex-data/sdk";
import { ExecutionResult, Sink } from "graphql-ws";

const sdk = new Codex(
  process.env.CODEX_API_KEY || "",
  process.env.CODEX_API_URL ?? undefined,
  process.env.CODEX_WS_URL ?? undefined,
);

const sink: Sink<ExecutionResult<OnPriceUpdatedSubscription>> = {
  next: ({ data }) => {
    // Note that data is correctly typed as OnPriceUpdatedSubscription
    console.log("Got subscription data", data);
  },
  error: (err) => {
    console.log("Got subscription error", err);
  },
  complete: () => {
    console.log("Got subscription complete");
  },
};

const address =
  process.argv[2] ?? "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv";
const networkId = process.argv[3] ?? "1399811149";

console.log(`subscribing to ${address}:${networkId}`);

// Subscribes to the onPriceUpdated event and just logs out the value to the console
const cleanup = sdk.subscribe<
  OnPriceUpdatedSubscription,
  { address: string; networkId: number }
>(
  `
  subscription onPriceUpdated($address: String!, $networkId: Int!) {
    onPriceUpdated(address: $address, networkId: $networkId) {
      address
      networkId
      priceUsd
      timestamp
    }
  }
`,
  {
    address,
    networkId: parseInt(networkId),
  },
  sink,
);

setTimeout(() => {
  console.log("Calling cleanup function to unsubscribe");
  cleanup();
}, 5000);
