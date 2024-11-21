import { Codex } from "@codex-data/sdk";

const sdk = new Codex(
  process.env.CODEX_API_KEY || "",
  process.env.CODEX_API_URL ?? undefined,
);

sdk.queries
  .getTokenEvents({
    query: {
      address: "0x6f36111198af4ea37ee02979feca11ee81611e83",
      networkId: 1,
    },
  })
  .then((r) => console.log(JSON.stringify(r, null, 2)));
