import { Codex } from "@codex-data/sdk";
import Link from "next/link";
import React, { Suspense } from "react";
import { TokenChart, ChartDataPoint } from "@/components/TokenChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import { TokenTransactions } from "@/components/TokenTransactions";

// --- Type Definitions ---
// Add nested info object for icon URL
type TokenDetails = {
  id: string;
  address: string;
  name?: string | null;
  symbol?: string | null;
  networkId?: number | null;
  description?: string | null;
  decimals?: number | null; // Keep decimals for event calculation
  info?: { // Add nested info object
    imageThumbUrl?: string | null;
    // Add other fields from info if needed
  } | null;
};

// Structure for events from 'getTokenEvents' query
type TokenEvent = {
  id: string; // Event ID
  timestamp: number;
  transactionHash: string;
  eventDisplayType?: string | null; // Changed from type
  amountUsd?: number | null;
  uniqueId?: string; // Keep uniqueId for key
  // Add other relevant event fields
};

// Combined data structure for the page (remove bars)
interface TokenPageData {
  details: TokenDetails | null;
  bars: ChartDataPoint[];
  events: TokenEvent[];
}

// --- Page Props ---
interface TokenPageProps {
  params: Promise<{
    networkId: string;
    tokenId: string; // Token address is used as ID here
  }>;
}

// --- Helper: Data Fetching Function ---
async function getTokenPageData(networkIdNum: number, tokenId: string): Promise<TokenPageData> {
  const apiKey = process.env.CODEX_API_KEY;
  if (!apiKey) {
    console.warn("CODEX_API_KEY not set.");
  }
  const codexClient = new Codex(apiKey || '');

  // Calculate timestamps (in seconds)
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 1 * 24 * 60 * 60;
  // Construct symbol identifier
  const symbolId = `${tokenId}:${networkIdNum}`;

  // Fetch details, bars, and events
  const results = await Promise.allSettled([
    codexClient.queries.token({ input: { networkId: networkIdNum, address: tokenId } }),
    codexClient.queries.getBars({
        symbol: symbolId,
        from: oneDayAgo,
        to: now,
        resolution: '30'
    }),
    codexClient.queries.getTokenEvents({ query: { networkId: networkIdNum, address: tokenId }, limit: 50 }),
  ]);

  const detailsResult = results[0];
  const barsResult = results[1];
  const eventsResult = results[2];

  const details: TokenDetails | null = detailsResult.status === 'fulfilled' ? detailsResult.value.token as TokenDetails : null;

  let bars: ChartDataPoint[] = [];
  if (barsResult.status === 'fulfilled') {
    // Access arrays via barsResult.value.getBars
    const b = barsResult.value.getBars;
    // Add null check for b itself before accessing properties
    if (b?.t && b?.c) {
        bars = b.t.map((time: number, index: number) => ({
            time: time,
            open: b.o?.[index],
            high: b.h?.[index],
            low: b.l?.[index],
            close: b.c?.[index],
        }));
    }
  }

  // Format events data - Simple filter, direct access in map
  let events: TokenEvent[] = [];
  if (eventsResult.status === 'fulfilled' && eventsResult.value.getTokenEvents?.items) {
      events = eventsResult.value.getTokenEvents.items
          .filter(ev => ev != null) // Simple non-null check
          .map((ev) => { // Let TS infer ev type (should be non-null SDK Event)
            // Perform calculation safely
            const decimals = details?.decimals ?? 18;
            const swapValue = parseFloat(ev.token0SwapValueUsd || '0');
            const amount0 = parseFloat(ev.data?.amount0 || '0');
            const calculatedAmountUsd = swapValue * Math.abs(amount0 / (10 ** decimals));

            return { // Map to TokenEvent
              id: ev.id,
              timestamp: ev.timestamp,
              uniqueId: `${ev.id}-${ev.blockNumber}-${ev.transactionIndex}-${ev.logIndex}`,
              transactionHash: ev.transactionHash,
              eventDisplayType: ev.eventDisplayType,
              amountUsd: calculatedAmountUsd,
            }
          });
  }

  if (detailsResult.status === 'rejected') console.error("Error fetching token details:", detailsResult.reason);
  if (barsResult.status === 'rejected') console.error("Error fetching chart bars:", barsResult.reason);
  if (eventsResult.status === 'rejected') console.error("Error fetching token events:", eventsResult.reason);

  // Return all data including bars
  return { details, bars, events };
}

// --- Page Component ---
export default async function TokenPage({ params }: TokenPageProps) {
  // Extract raw params
  const { networkId: rawNetworkId, tokenId: rawTokenId } = await params;

  // Parse networkId
  const networkIdNum = parseInt(rawNetworkId, 10);

  // Validate networkId and rawTokenId presence
  if (isNaN(networkIdNum) || !rawTokenId) {
    return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        <h1 className="text-2xl font-bold text-destructive">Invalid Network or Token ID</h1>
        <Link href="/" className="mt-4 hover:underline">Go back home</Link>
      </main>
    );
  }

  // Decode the token ID
  const tokenId = decodeURIComponent(rawTokenId);

  // Fetch data using the decoded token ID
  const { details, bars, events } = await getTokenPageData(networkIdNum, tokenId);

  // Use the decoded tokenId for display if name is missing
  const tokenName = details?.name || tokenId;
  const tokenSymbol = details?.symbol ? `(${details.symbol})` : '';

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 space-y-6">
      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold truncate pr-4">
          {tokenName} {tokenSymbol}
        </h1>
        <Link href={`/networks/${rawNetworkId}`} className="text-sm hover:underline whitespace-nowrap">
          &lt; Back to Network
        </Link>
      </div>

      {/* Main Content Area (Grid Layout - adjusted) */}
      {/* Now using 2 columns: Transactions | Info */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Center Area (Chart and Transactions) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Re-add Chart with Suspense */}
          <Suspense fallback={<Card><CardHeader><CardTitle>Price Chart</CardTitle></CardHeader><CardContent><p>Loading chart...</p></CardContent></Card>}>
             <TokenChart data={bars} title={`${tokenSymbol || 'Token'} Price Chart`} />
          </Suspense>

          {/* Transactions Table - Replace with Client Component */}
          <TokenTransactions
              networkId={networkIdNum}
              tokenId={tokenId}
              initialEvents={events}
          />
        </div>

        {/* Right Area (Info Panel) - Takes 1 column */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center space-x-4">
              {details?.info?.imageThumbUrl ? (
                 <Image
                    src={details.info.imageThumbUrl}
                    alt={`${details.name || 'Token'} icon`}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
              ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                    {details?.symbol ? details.symbol[0] : 'T'}
                  </div>
              )}
              <div>
                <CardTitle>Information</CardTitle>
                {details?.symbol && <CardDescription>{details.symbol}</CardDescription>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {details ? (
                <>
                  <p className="text-sm">
                    <strong className="text-muted-foreground">Address:</strong>
                    <span className="font-mono block break-all" title={tokenId}>{tokenId}</span>
                  </p>
                  {details.description && (
                     <p className="text-sm">
                        <strong className="text-muted-foreground">Description:</strong> {details.description}
                     </p>
                  )}
                  {/* Add more details fields here */}
                </>
              ) : (
                <p className="text-muted-foreground">Token details could not be loaded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}