import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

const subscribe = () => {
  sdk.subscriptions.onTokenEventsCreated(
    {
      input: {
        tokenAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        networkId: 56,
      },
    },
    {
      next(value) {
        console.log("Token event: ", value);
      },
      complete() {
        console.log("Token event subscription completed");
      },
      error(error) {
        console.error("Token event subscription error: ", error);
      },
    },
  );
};

subscribe();

setTimeout(async () => {
  console.log("Updating config...");

  const { createApiTokens } = await sdk.mutations.createApiTokens({
    input: {
      count: 1,
    },
  });

  const token = createApiTokens[0].token;

  console.log("Updating config with new token", token);

  sdk.updateConfig({
    wsHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  subscribe();
}, 5000);
