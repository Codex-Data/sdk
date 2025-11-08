import { createCodexClient } from "./utils";

const sdk = createCodexClient();

sdk.queries
  .filterTokens({
    filters: {
      liquidity: { gt: 100000 },
      txnCount24: { gt: 200 },
      network: [1],
    },
    limit: 1,
  })
  .then((t) => console.log(JSON.stringify(t, null, 2)));
