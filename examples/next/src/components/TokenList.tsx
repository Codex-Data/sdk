import { FilterTokensQuery } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { GlobeIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "./ui/card";

export default function TokenList({ tokens }: { tokens: FilterTokensQuery }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <h2 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Tokens
        </h2>
        <span className="text-muted-foreground">
          Trending over the last 24 hours
        </span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {tokens.filterTokens?.results?.map((t) => (
          <div
            key={t?.token?.id}
            className="flex gap-2 hover:bg-slate-800 p-2 rounded-lg hover:transition-all duration:100 w-fit"
          >
            <div className="h-24px w-24px rounded-lg overflow-hidden flex">
              {t?.token?.info?.imageThumbUrl ? (
                <Image
                  alt=""
                  height="24"
                  width="24"
                  src={t?.token?.info?.imageThumbUrl as string}
                />
              ) : (
                <GlobeIcon className="p-1" height={24} width={24} />
              )}
            </div>
            <Link className="flex" href={`/token/${t?.token?.id}`}>
              {t?.token?.name}
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
