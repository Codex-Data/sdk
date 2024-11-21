"use client";
import { GetNetworkStatsResponse } from "@codex-data/sdk/dist/resources/graphql";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

const Stat = ({
  label,
  suffix,
  value,
}: {
  label: string;
  suffix: string;
  value: string;
}) => (
  <div>
    <CardDescription>{label}</CardDescription>
    <CardTitle className="flex items-baseline gap-1 text-4xl tabular-nums">
      {value}
      <span className="text-sm font-normal tracking-normal text-muted-foreground">
        {suffix}
      </span>
    </CardTitle>
  </div>
);

export default function NetworkDetails({
  networkStats,
}: {
  networkStats: GetNetworkStatsResponse;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <h2 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Stats
        </h2>
        <span className="text-muted-foreground">Over the last 24 hours</span>
      </CardHeader>
      <CardContent className="flex flex-1 items-center gap-4">
        <Stat
          label="Liquidity"
          value={networkStats.liquidity.toLocaleString()}
          suffix="USD"
        />
        <Stat
          label="Swaps"
          value={networkStats.transactions24.toLocaleString()}
          suffix="tx"
        />
        <Stat
          label="Volume"
          value={networkStats.volume24.toLocaleString()}
          suffix="USD"
        />
      </CardContent>
    </Card>
  );
}
