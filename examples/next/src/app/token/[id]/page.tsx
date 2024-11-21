import { ChevronLeftIcon } from "@radix-ui/react-icons";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { sdk } from "@/sdk";

import { TokenChartContainer } from "../../../components/TokenChartContainer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function TokenPage({ params }: any) {
  const id = decodeURIComponent((await params).id);

  const [address, networkId] = id.split(":");

  const tokenInfo = await sdk.queries.token({
    input: {
      address,
      networkId: parseInt(networkId),
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4 p-4">
        <h2 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          <Link href={`/network/${networkId}`}>
            <Button className="mr-4" variant="ghost" size="icon">
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          {tokenInfo.token.symbol}
          <span className="font-normal text-muted-foreground">
            {" "}
            - {tokenInfo.token.name}
          </span>
        </h2>
        <TokenChartContainer id={id} />
        {/* <NetworkDetails networkStats={stats.getNetworkStats!} /> */}
        {/* <TokenList tokens={tokens} /> */}
      </div>
    </div>
  );
}
