# Codex SDK

The TypeScript SDK for the [Codex API](https://www.codex.io) — real-time blockchain data, token prices, OHLCV charts, wallet balances, and holder analytics for 60M+ tokens across 80+ networks including Ethereum, Solana, Base, Arbitrum, BSC, and Polygon.

Codex is a GraphQL API used by teams like Coinbase, TradingView, Uniswap, Rainbow, FOMO, Farcaster, and hundreds of others.

- **[Documentation](https://docs.codex.io)**
- **[Get an API Key](https://dashboard.codex.io)**
- **[GraphQL Explorer](https://explorer.codex.io)**

## Installation

```bash
npm install @codex-data/sdk
```

```bash
yarn add @codex-data/sdk
```

```bash
pnpm add @codex-data/sdk
```

## Quick Start

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const networks = await sdk.queries.getNetworks({});
console.log(networks.getNetworks); // [{ id: 1, name: "ethereum" }, { id: 1399811149, name: "solana" }, ...]
```

## Get Token Prices

Get the current USD price of any token. Supports up to 25 tokens per request. Prices are liquidity-weighted across all valid pools.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const prices = await sdk.queries.getTokenPrices({
  inputs: [
    { address: "So11111111111111111111111111111111111111112", networkId: 1399811149 }, // SOL
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", networkId: 1 },         // WETH
  ],
});

prices.getTokenPrices?.forEach((price) => {
  console.log(`${price?.address}: $${price?.priceUsd}`);
});
```

To get a historical price, pass a `timestamp`:

```typescript
const historicalPrice = await sdk.queries.getTokenPrices({
  inputs: [
    {
      address: "So11111111111111111111111111111111111111112",
      networkId: 1399811149,
      timestamp: 1704067200, // Unix timestamp
    },
  ],
});
```

## Get OHLCV Chart Data

Get candlestick data for any token or trading pair. Supports resolutions from 1-second to 7-day.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const bars = await sdk.queries.getBars({
  symbol: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2:1", // WETH on Ethereum
  from: 1704067200,
  to: 1704153600,
  resolution: "60", // 1-hour candles
  removeEmptyBars: true,
});

bars.getBars?.o?.forEach((open, i) => {
  console.log({
    open,
    high: bars.getBars?.h?.[i],
    low: bars.getBars?.l?.[i],
    close: bars.getBars?.c?.[i],
    volume: bars.getBars?.volume?.[i],
    timestamp: bars.getBars?.t?.[i],
  });
});
```

Available resolutions: `1S`, `5S`, `15S`, `30S`, `1`, `5`, `15`, `30`, `60`, `240`, `720`, `1D`, `7D`

## Discover and Filter Tokens

Search and filter tokens by price, volume, market cap, liquidity, holder count, trading activity, and more.

```typescript
import { Codex, TokenRankingAttribute, RankingDirection } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const result = await sdk.queries.filterTokens({
  filters: {
    network: [1],                         // Ethereum
    liquidity: { gte: "100000" },         // $100k+ liquidity
    marketCap: { gte: "1000000" },        // $1M+ market cap
    txnCount24: { gte: "500" },           // 500+ transactions in 24h
  },
  rankings: [
    {
      attribute: TokenRankingAttribute.TrendingScore24,
      direction: RankingDirection.Desc,
    },
  ],
  limit: 20,
});

result.filterTokens?.results?.forEach((token) => {
  console.log(`${token?.token?.name} (${token?.token?.symbol}): $${token?.priceUSD}`);
});
```

## Get Wallet Balances

Get all token balances for a wallet address with USD values.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const balances = await sdk.queries.balances({
  input: {
    walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
    networks: [1],
    includeNative: true,
    removeScams: true,
    limit: 50,
  },
});

balances.balances?.items?.forEach((item) => {
  console.log(`${item?.token?.symbol}: ${item?.shiftedBalance} ($${item?.balanceUsd})`);
});
```

## Get Token Holders

Get the list of wallets holding a specific token, sorted by balance.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const holders = await sdk.queries.holders({
  input: {
    tokenId: "So11111111111111111111111111111111111111112:1399811149", // SOL
    limit: 50,
  },
});

console.log(`Total holders: ${holders.holders?.count}`);
console.log(`Top 10 hold: ${holders.holders?.top10HoldersPercent}%`);

holders.holders?.items?.forEach((holder) => {
  console.log(`${holder?.address}: ${holder?.shiftedBalance} ($${holder?.balanceUsd})`);
});
```

## Get Token Trade History

Get buy, sell, mint, and burn events for any token or pair.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const events = await sdk.queries.getTokenEvents({
  query: {
    address: "So11111111111111111111111111111111111111112",
    networkId: 1399811149,
    eventDisplayType: ["Buy", "Sell"],
  },
  limit: 25,
});

events.getTokenEvents?.items?.forEach((event) => {
  console.log(`${event?.eventDisplayType} by ${event?.maker} — $${event?.token0SwapValueUsd}`);
});
```

## Stream Real-Time Prices

> **Note:** WebSocket subscriptions require a [paid plan](https://dashboard.codex.io/dashboard/billing).

Subscribe to live price updates via WebSocket. Fires on every on-chain swap.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const unsubscribe = sdk.subscriptions.onPriceUpdated(
  {
    address: "So11111111111111111111111111111111111111112",
    networkId: 1399811149,
  },
  {
    next: (result) => {
      console.log("Price:", result.data?.onPriceUpdated?.priceUsd);
    },
    error: (err) => console.error(err),
    complete: () => console.log("Stream ended"),
  },
);

// Call unsubscribe() to clean up
```

## Stream Real-Time OHLCV Bars

> **Note:** WebSocket subscriptions require a [paid plan](https://dashboard.codex.io/dashboard/billing).

Get live candlestick updates across all resolutions simultaneously.

```typescript
import { Codex, QuoteToken } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const unsubscribe = sdk.subscriptions.onBarsUpdated(
  {
    pairId: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640:1", // USDC/WETH on Ethereum
    quoteToken: QuoteToken.Token1,
  },
  {
    next: (result) => {
      const bar = result.data?.onBarsUpdated;
      const oneMin = bar?.aggregates?.r1?.usd;
      console.log(`1min candle — O: ${oneMin?.o} H: ${oneMin?.h} L: ${oneMin?.l} C: ${oneMin?.c}`);
    },
    error: (err) => console.error(err),
    complete: () => console.log("Stream ended"),
  },
);
```

## Stream Live Trades

> **Note:** WebSocket subscriptions require a [paid plan](https://dashboard.codex.io/dashboard/billing).

Watch buy/sell events as they happen on any trading pair.

```typescript
import { Codex, QuoteToken } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const unsubscribe = sdk.subscriptions.onEventsCreated(
  {
    id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640:1",
    quoteToken: QuoteToken.Token0,
  },
  {
    next: (result) => {
      result.data?.onEventsCreated?.events?.forEach((event) => {
        console.log(`${event?.eventDisplayType} by ${event?.maker} — $${event?.token0SwapValueUsd}`);
      });
    },
    error: (err) => console.error(err),
    complete: () => console.log("Stream ended"),
  },
);
```

## Raw GraphQL Queries

Use `sdk.send()` to execute any GraphQL query directly.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY!);

const result = await sdk.send<{
  getNetworks: Array<{ id: number; name: string }>;
}>(
  `query GetNetworks {
    getNetworks { id name }
  }`,
  {},
);

console.log("Networks:", result.getNetworks);
```

## Common Network IDs

| Network | ID |
| --- | --- |
| Ethereum | `1` |
| BSC | `56` |
| Polygon | `137` |
| Arbitrum | `42161` |
| Base | `8453` |
| Avalanche | `43114` |
| Solana | `1399811149` |

Use `sdk.queries.getNetworks({})` for the full list of 80+ supported networks.

## ID Format Convention

IDs in the Codex API follow the pattern `address:networkId`:

- **Token ID:** `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2:1` (WETH on Ethereum)
- **Pair ID:** `0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640:1` (USDC/WETH on Ethereum)
- **Wallet ID:** `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045:1`

## All Available Methods

### Queries (`sdk.queries.*`)

| Method | Description |
| --- | --- |
| [`filterTokens`](https://docs.codex.io/api-reference/queries/filtertokens) | Search and filter tokens by price, volume, market cap, liquidity |
| [`getTokenPrices`](https://docs.codex.io/api-reference/queries/gettokenprices) | Get current or historical USD prices for up to 25 tokens |
| [`getBars`](https://docs.codex.io/api-reference/queries/getbars) | Get OHLCV candlestick data for a trading pair |
| [`holders`](https://docs.codex.io/api-reference/queries/holders) | Get token holder list sorted by balance ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`filterPairs`](https://docs.codex.io/api-reference/queries/filterpairs) | Search and filter trading pairs |
| [`balances`](https://docs.codex.io/api-reference/queries/balances) | Get wallet token balances with USD values ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`getTokenEvents`](https://docs.codex.io/api-reference/queries/gettokenevents) | Get buy/sell/mint/burn trade events |
| [`pairMetadata`](https://docs.codex.io/api-reference/queries/pairmetadata) | Get trading pair stats and metadata |
| [`token`](https://docs.codex.io/api-reference/queries/token) | Get metadata for a single token |
| [`listPairsWithMetadataForToken`](https://docs.codex.io/api-reference/queries/listpairswithmetadatafortoken) | List pairs with full metadata |
| [`getTokenEventsForMaker`](https://docs.codex.io/api-reference/queries/gettokeneventsformaker) | Get trade events for a specific wallet |
| [`getDetailedPairStats`](https://docs.codex.io/api-reference/queries/getdetailedpairstats) | Get detailed bucketed stats for a pair |
| [`listPairsForToken`](https://docs.codex.io/api-reference/queries/listpairsfortoken) | List all trading pairs for a token |
| [`tokenTopTraders`](https://docs.codex.io/api-reference/queries/tokentoptraders) | Get top traders for a token |
| [`tokens`](https://docs.codex.io/api-reference/queries/tokens) | Get metadata for multiple tokens |
| [`top10HoldersPercent`](https://docs.codex.io/api-reference/queries/top10holderspercent) | Get percentage held by top 10 wallets |
| [`getDetailedPairsStats`](https://docs.codex.io/api-reference/queries/getdetailedpairsstats) | Get detailed stats for multiple pairs |
| [`filterTokenWallets`](https://docs.codex.io/api-reference/queries/filtertokenwallets) | Get per-wallet trading stats (profit/loss, buy/sell counts) ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`liquidityMetadata`](https://docs.codex.io/api-reference/queries/liquiditymetadata) | Get liquidity pool metadata ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`tokenSparklines`](https://docs.codex.io/api-reference/queries/tokensparklines) | Get sparkline price data for tokens |
| [`filterWallets`](https://docs.codex.io/api-reference/queries/filterwallets) | Filter wallets by trading statistics ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`detailedWalletStats`](https://docs.codex.io/api-reference/queries/detailedwalletstats) | Get comprehensive wallet analytics ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`getExchanges`](https://docs.codex.io/api-reference/queries/getexchanges) | Get DEX information |
| [`getNetworks`](https://docs.codex.io/api-reference/queries/getnetworks) | List all 80+ supported networks |
| [`getTokenBars`](https://docs.codex.io/api-reference/queries/gettokenbars) | Get OHLCV data for a token across all pairs |
| [`chartUrls`](https://docs.codex.io/api-reference/queries/charturls) | Get pre-rendered chart image URLs ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`walletChart`](https://docs.codex.io/api-reference/queries/walletchart) | Get wallet portfolio chart data ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`filterExchanges`](https://docs.codex.io/api-reference/queries/filterexchanges) | Filter decentralized exchanges |
| [`liquidityLocks`](https://docs.codex.io/api-reference/queries/liquiditylocks) | Get liquidity lock information ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`getNetworkConfigs`](https://docs.codex.io/api-reference/queries/getnetworkconfigs) | Get network configuration details |
| [`getNetworkStats`](https://docs.codex.io/api-reference/queries/getnetworkstats) | Get network-level statistics |
| [`getNetworkStatus`](https://docs.codex.io/api-reference/queries/getnetworkstatus) | Get network sync status |
| [`tokenLifecycleEvents`](https://docs.codex.io/api-reference/queries/tokenlifecycleevents) | Get token creation and migration events |
| [`blocks`](https://docs.codex.io/api-reference/queries/blocks) | Get block data by number or timestamp |

### Subscriptions (`sdk.subscriptions.*`) — [paid plan](https://dashboard.codex.io/dashboard/billing) required

| Method | Description |
| --- | --- |
| [`onPairMetadataUpdated`](https://docs.codex.io/api-reference/subscriptions/onpairmetadataupdated) | Live pair stat updates |
| [`onLaunchpadTokenEventBatch`](https://docs.codex.io/api-reference/subscriptions/onlaunchpadtokeneventbatch) | Batched launchpad events |
| [`onBarsUpdated`](https://docs.codex.io/api-reference/subscriptions/onbarsupdated) | Real-time OHLCV bars for a trading pair |
| [`onPriceUpdated`](https://docs.codex.io/api-reference/subscriptions/onpriceupdated) | Real-time price for a single token |
| [`onHoldersUpdated`](https://docs.codex.io/api-reference/subscriptions/onholdersupdated) | Live holder count and balance changes |
| [`onDetailedStatsUpdated`](https://docs.codex.io/api-reference/subscriptions/ondetailedstatsupdated) | Live detailed stats updates |
| [`onEventsCreated`](https://docs.codex.io/api-reference/subscriptions/oneventscreated) | Live buy/sell events for a pair |
| [`onPricesUpdated`](https://docs.codex.io/api-reference/subscriptions/onpricesupdated) | Real-time prices for multiple tokens |
| [`onUnconfirmedEventsCreated`](https://docs.codex.io/api-reference/subscriptions/onunconfirmedeventscreated) | Unconfirmed (mempool) trade events |
| [`onTokenEventsCreated`](https://docs.codex.io/api-reference/subscriptions/ontokeneventscreated) | Live events across all pools for a token |
| [`onLaunchpadTokenEvent`](https://docs.codex.io/api-reference/subscriptions/onlaunchpadtokenevent) | Individual launchpad events (Pump.fun, etc.) |
| [`onTokenBarsUpdated`](https://docs.codex.io/api-reference/subscriptions/ontokenbarsupdated) | Real-time OHLCV bars for a token |
| [`onLatestPairUpdated`](https://docs.codex.io/api-reference/subscriptions/onlatestpairupdated) | New trading pair creation events |
| [`onUnconfirmedBarsUpdated`](https://docs.codex.io/api-reference/subscriptions/onunconfirmedbarsupdated) | Unconfirmed bar updates |
| [`onEventsCreatedByMaker`](https://docs.codex.io/api-reference/subscriptions/oneventscreatedbymaker) | Live events for a specific wallet |
| [`onBalanceUpdated`](https://docs.codex.io/api-reference/subscriptions/onbalanceupdated) | Live wallet balance updates |
| [`onTokenLifecycleEventsCreated`](https://docs.codex.io/api-reference/subscriptions/ontokenlifecycleeventscreated) | Token lifecycle events |
| [`onLatestTokens`](https://docs.codex.io/api-reference/subscriptions/onlatesttokens) | New token creation events |
| [`onNftEventsCreated`](https://docs.codex.io/api-reference/subscriptions/onnfteventscreated) | NFT trade events |

### Mutations (`sdk.mutations.*`)

| Method | Description |
| --- | --- |
| [`createWebhooks`](https://docs.codex.io/api-reference/mutations/createwebhooks) | Create webhook alerts ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`deleteWebhooks`](https://docs.codex.io/api-reference/mutations/deletewebhooks) | Delete webhook alerts ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`backfillWalletAggregates`](https://docs.codex.io/api-reference/mutations/backfillwalletaggregates) | Trigger wallet data backfill ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`createApiTokens`](https://docs.codex.io/api-reference/mutations/createapitokens) | Create short-lived API tokens for client-side use ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`deleteApiToken`](https://docs.codex.io/api-reference/mutations/deleteapitoken) | Delete an API token ([paid](https://dashboard.codex.io/dashboard/billing)) |
| [`refreshBalances`](https://docs.codex.io/api-reference/mutations/refreshbalances) | Refresh wallet balances |

## Configuration

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex("YOUR_API_KEY", {
  apiUrl: "https://graph.codex.io/graphql",         // default
  apiRealtimeUrl: "wss://graph.codex.io/graphql",   // default
  ws: true,                                          // enable WebSocket (default: true)
});

// Update config at runtime
sdk.updateConfig({ ws: false });

// Clean up WebSocket connection
sdk.dispose();
```

## Examples

See the [examples](./examples) directory for full working projects:

- **[Simple](./examples/simple)** — Basic queries, filtering, and subscriptions
- **[Codegen](./examples/codegen)** — Using GraphQL Code Generator for fully typed custom queries
- **[Next.js](./examples/next)** — Full-stack web application

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

```bash
pnpm install    # Install dependencies
pnpm run build  # Build the SDK
pnpm run test   # Run tests
pnpm run lint   # Lint the codebase
```

## Upgrading to v2

See [UPGRADING.md](./UPGRADING.md) for migration instructions from v1 to v2.

## Links

- [Codex API Documentation](https://docs.codex.io)
- [Popular Endpoints](https://docs.codex.io/api-reference/popular-endpoints)
- [GraphQL Explorer](https://explorer.codex.io)
- [Get an API Key](https://dashboard.codex.io)
- [Codex MCP Server](https://github.com/Codex-Data/codex-mcp)
- [Discord](https://discord.com/invite/mFpUhT3vAq)
- [Twitter](https://x.com/trycodex)

## License

MIT
