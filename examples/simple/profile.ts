import { Codex, OnUnconfirmedEventsCreatedSubscription } from "@codex-data/sdk";
import { gql } from "graphql-request";

const codex = new Codex(process.env.CODEX_API_KEY!);

const unconfirmedEvents = gql`
  subscription OnEventsCreated($id: String!) {
    onUnconfirmedEventsCreated(id: $id) {
      events {
        timestamp
        eventDisplayType
        data {
          ... on UnconfirmedSwapEventData {
            amountNonLiquidityToken
            priceUsd
            priceUsdTotal
          }
        }
        transactionHash
      }
    }
  }
`;

codex.subscribe<OnUnconfirmedEventsCreatedSubscription, { id: string }>(
  unconfirmedEvents,
  { id: "H66r4cb3LrvEZowN6eJZxMVbjrzxmRzPRT7Z6aMEXunb:1399811149" },
  {
    next: ({ data }) => {
      const currentTime = Date.now();

      if (data?.onUnconfirmedEventsCreated?.events) {
        data.onUnconfirmedEventsCreated.events.forEach((event, index) => {
          if (!event) return;

          const eventTimestamp =
            typeof event.timestamp === "string"
              ? parseInt(event.timestamp)
              : event.timestamp;
          const timeDifference = currentTime - eventTimestamp;

          console.log(`Event ${index + 1}:`);
          console.log(`  Current Time: ${new Date(currentTime).toISOString()}`);
          console.log(
            `  Event Timestamp: ${new Date(eventTimestamp).toISOString()}`,
          );
          console.log(
            `  Time Difference: ${timeDifference}ms (${(
              timeDifference / 1000
            ).toFixed(2)}s)`,
          );
          console.log(`  Event Type: ${event.eventDisplayType}`);
          console.log(`  Transaction Hash: ${event.transactionHash}`);
          console.log("---");
        });
      }
    },
    error: (error) => {
      console.error(error);
    },
    complete: () => {
      console.log("complete");
    },
  },
);
