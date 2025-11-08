import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "", {
  apiUrl: process.env.CODEX_API_URL,
});

const res = await sdk.mutations.createApiTokens({
  input: { expiresIn: 3600 * 1000 },
});

const token = res.createApiTokens[0].token;

const shortLivedSdk = new Codex(`Bearer ${token}`);

shortLivedSdk.queries
  .token({
    input: {
      address: "0xc56c7a0eaa804f854b536a5f3d5f49d2ec4b12b8",
      networkId: 1,
    },
  })
  .then(console.log);

shortLivedSdk.subscriptions.onTokenEventsCreated(
  {
    input: {
      networkId: 1399811149,
      tokenAddress: "C3DwDjT17gDvvCYC2nsdGHxDHVmQRdhKfpAdqQ29pump",
    },
  },
  {
    complete() {
      console.log("Complete");
    },
    error(error) {
      console.log("Erorr", error);
    },
    next(value) {
      console.log("Got value from sub", value);
    },
  },
);
