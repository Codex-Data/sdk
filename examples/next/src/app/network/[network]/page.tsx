import {
  RankingDirection,
  TokenRankingAttribute,
} from "@codex-data/sdk/dist/sdk/generated/graphql";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import Link from "next/link";

import NetworkDetails from "@/components/NetworkDetails";
import TokenList from "@/components/TokenList";
import { Button } from "@/components/ui/button";
import { sdk } from "@/sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function NetworkPage({ params, searchParams }: any) {
  const networkId = parseInt(params.network);
  const stats = await sdk.queries.getNetworkStats({
    networkId,
  });
  const tokens = await sdk.queries.filterTokens({
    filters: {
      network: [networkId],
    },
    rankings: [
      {
        attribute: TokenRankingAttribute.TrendingScore,
        direction: RankingDirection.Desc,
      },
    ],
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4 p-4">
        <h2 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          <Link href="/">
            <Button className="mr-4" variant="ghost" size="icon">
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          {searchParams.networkName}
          <span className="font-normal text-muted-foreground">
            {" "}
            - {networkId}
          </span>
        </h2>
        <NetworkDetails networkStats={stats.getNetworkStats!} />
        <TokenList tokens={tokens} />
      </div>
    </div>
  );
}
