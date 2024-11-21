import Link from "next/link";

import { sdk } from "@/sdk";

import { Card, CardContent, CardHeader } from "./ui/card";

export default async function Networks() {
  const nets = (await sdk.queries.getNetworks({})).getNetworks;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <h2 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Networks
        </h2>
        <span className="text-muted-foreground">Sorted alphabetically</span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {nets
          .sort((n, n1) => (n.name > n1.name ? 1 : -1))
          .map((n) => (
            <div
              className="flex gap-2 hover:bg-slate-800 p-2 rounded-lg hover:transition-all duration:100 w-fit"
              key={n.id}
            >
              <Link href={`/network/${n.id}?networkName=${n.name}`}>
                {n.name}
              </Link>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
