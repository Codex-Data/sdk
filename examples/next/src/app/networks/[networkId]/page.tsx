import {
  Codex,
  TokenRankingAttribute,
  RankingDirection,
} from "@codex-data/sdk";
import Link from "next/link";
import React from "react";
import Image from "next/image";

interface NetworkPageProps {
  // Revert params type if it was changed
  params: Promise<{
    networkId: string;
  }>;
}

export default async function NetworkPage({ params }: NetworkPageProps) {
  const { networkId } = await params;
  const networkIdNum = parseInt(networkId, 10);

  if (isNaN(networkIdNum)) {
    return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        <h1 className="text-2xl font-bold text-destructive">
          Invalid Network ID
        </h1>
        <Link href="/" className="mt-4 hover:underline">
          Go back home
        </Link>
      </main>
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_CODEX_API_KEY;
  if (!apiKey) {
    console.warn(
      "CODEX_API_KEY environment variable is not set. Codex SDK might not work.",
    );
  }
  const codexClient = new Codex(apiKey || "");

  // Use any[] for tokenListItems to bypass complex type checks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tokenListItems: any[] = [];
  let networkName: string | null = null;
  let fetchError: string | null = null;

  try {
    const [networksResult, tokensResponse] = await Promise.all([
      codexClient.queries.getNetworks({}).catch((err: Error) => {
        console.error(`Error fetching all networks:`, err);
        return null;
      }),
      codexClient.queries
        .filterTokens({
          filters: { network: [networkIdNum] },
          rankings: [
            {
              attribute: TokenRankingAttribute.TrendingScore,
              direction: RankingDirection.Desc,
            },
          ],
          limit: 50,
        })
        .catch((err: Error) => {
          console.error(
            `Error fetching tokens for network ${networkIdNum}:`,
            err,
          );
          throw new Error(`Failed to load tokens for network ${networkIdNum}.`);
        }),
    ]);

    if (networksResult?.getNetworks) {
      const currentNetwork = networksResult.getNetworks.find(
        (net) => net.id === networkIdNum,
      );
      networkName = currentNetwork?.name || null;
    }
    if (!networkName) {
      console.warn(`Could not find network name for ID ${networkIdNum}`);
      networkName = `Network ${networkId}`;
    }

    const resultsArray = tokensResponse.filterTokens?.results;
    if (resultsArray) {
      const filteredItems = resultsArray
        .filter((item) => item != null) // Now Array<{ token?: EnhancedToken | null, ... }>
        .filter((item) => item.token != null); // Now Array<{ token: EnhancedToken, ... }>

      // Assign the filtered result to any[] type
      tokenListItems = filteredItems;
    } else {
      tokenListItems = [];
    }
  } catch (err: unknown) {
    console.error("Error loading network page data:", err);
    if (err instanceof Error) {
      fetchError = err.message;
    } else {
      fetchError = "An unknown error occurred while loading page data.";
    }
    if (!networkName) networkName = `Network ${networkId}`;
  }

  const pageTitle =
    fetchError && !tokenListItems.length
      ? `Error loading tokens for ${networkName}`
      : networkName || `Tokens on Network ${networkId}`;

  return (
    <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{pageTitle}</h1>
        <Link href="/" className="hover:underline">
          &lt; Back to Networks
        </Link>
      </div>

      <div className="w-full max-w-4xl">
        {fetchError && <p className="text-destructive mb-4">{fetchError}</p>}

        {!fetchError || tokenListItems.length > 0 ? (
          <>
            {tokenListItems.length === 0 && !fetchError && (
              <p>Loading tokens or no tokens found...</p>
            )}
            {tokenListItems.length > 0 && (
              <table className="w-full table-fixed border-collapse border border-border">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-2 text-left font-semibold w-[60px]">
                      Icon
                    </th>
                    <th className="p-2 text-left font-semibold flex-1">Name</th>
                    <th className="p-2 text-left font-semibold w-1/5">
                      Symbol
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tokenListItems.map((item) => (
                    <tr
                      key={item.token.address}
                      className="border-b border-dashed border-border/30 hover:bg-muted/30"
                    >
                      <td className="p-2 flex items-center justify-center">
                        {item.token.info?.imageThumbUrl ? (
                          <Image
                            src={item.token.info.imageThumbUrl}
                            alt={`${item.token.name || "Token"} icon`}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                            {item.token.symbol ? item.token.symbol[0] : "T"}
                          </div>
                        )}
                      </td>
                      <td className="p-2 truncate">
                        <Link
                          href={`/networks/${networkId}/tokens/${item.token.address}`}
                          className="block w-full h-full"
                        >
                          {item.token.name || "Unknown Name"}
                        </Link>
                      </td>
                      <td className="p-2 truncate">
                        <Link
                          href={`/networks/${networkId}/tokens/${item.token.address}`}
                          className="block w-full h-full"
                        >
                          {item.token.symbol || "-"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
