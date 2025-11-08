import { Codex } from "@codex-data/sdk";

const apiKey = process.env.CODEX_API_KEY;

if (!apiKey) {
  console.error("❌ CODEX_API_KEY environment variable is required!");
  console.log("💡 Set it with: export CODEX_API_KEY='your_api_key_here'");
  console.log("🔗 Get your API key at: https://docs.codex.io");
  process.exit(1);
}

const sdk = new Codex(apiKey);

console.log(
  await sdk.queries.token({
    input: {
      address: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY",
      networkId: 1399811149,
    },
  }),
);
