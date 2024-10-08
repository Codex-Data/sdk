import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

console.log(
  await sdk.queries.token({
    input: {
      address: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY",
      networkId: 1399811149,
    },
  }),
);
