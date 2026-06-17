import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

sdk.queries
  .detailedWalletStats({
    input: {
      walletAddress: "0x126D47e76B100E075F9b9f51fA7A7444DF5611D8",
      includeNetworkBreakdown: true,
    },
  })
  .then((t) => console.log(JSON.stringify(t, null, 2)));
