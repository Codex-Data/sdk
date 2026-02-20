# Upgrading to v2

There are a few breaking changes in v2 that you need to be aware of.

## Imports

All types are now exported directly from the main package.

**Before:**

```typescript
import { Codex } from "@codex-data/sdk";
import { TokenRankingAttribute, RankingDirection } from "@codex-data/sdk/dist/sdk/generated/graphql";
```

**After:**

```typescript
import { Codex, TokenRankingAttribute, RankingDirection } from "@codex-data/sdk";
```

The `GraphQL` namespace has also been removed:

**Before:**

```typescript
import { Codex, GraphQL } from "@codex-data/sdk";

const [quoteToken, setQuoteToken] = useState<GraphQL.QuoteToken>(GraphQL.QuoteToken.Token0);
```

**After:**

```typescript
import { Codex, QuoteToken } from "@codex-data/sdk";

const [quoteToken, setQuoteToken] = useState<QuoteToken>(QuoteToken.Token0);
```

## onLaunchpadTokenEventBatch

The subscription input is now wrapped in an `input` object.

**Before:**

```typescript
const unsubscribeFn = codex.subscriptions.onLaunchpadTokenEventBatch({
  networkId: networkId,
});
```

**After:**

```typescript
const unsubscribeFn = codex.subscriptions.onLaunchpadTokenEventBatch({
  input: {
    networkId: networkId,
  },
});
```
