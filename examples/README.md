# Codex SDK Examples

This directory contains comprehensive examples demonstrating how to use the Codex SDK in various scenarios. Each example is self-contained and showcases different aspects of the SDK functionality.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 17.5.0
- [pnpm](https://pnpm.io/) (recommended)
- A Codex API key from [docs.codex.io](https://docs.codex.io)

## Quick Start

1. **Install dependencies** (from the root directory):

   ```bash
   pnpm install
   ```

2. **Set your API key**:

   ```bash
   export CODEX_API_KEY="your_api_key_here"
   ```

3. **Run any example**:
   ```bash
   cd examples/simple
   pnpm run dev
   ```

## Examples Directory

### 📁 [simple/](./simple/)

**Basic SDK Usage Examples**

A collection of focused examples demonstrating core SDK functionality:

| File                                                        | Description             | Key Features                                |
| ----------------------------------------------------------- | ----------------------- | ------------------------------------------- |
| [`index.ts`](./simple/index.ts)                             | Complete SDK overview   | Queries, mutations, subscriptions, webhooks |
| [`token.ts`](./simple/token.ts)                             | Token data queries      | Custom headers, GraphQL queries             |
| [`filterTest.ts`](./simple/filterTest.ts)                   | Token filtering         | Advanced filtering, liquidity checks        |
| [`realtime.ts`](./simple/realtime.ts)                       | Real-time price updates | WebSocket subscriptions, custom sink        |
| [`simpleSubscription.ts`](./simple/simpleSubscription.ts)   | Basic subscriptions     | Built-in subscription methods               |
| [`apiKeys.ts`](./simple/apiKeys.ts)                         | API token management    | Token creation, short-lived tokens          |
| [`apiKeysSubscription.ts`](./simple/apiKeysSubscription.ts) | Token + subscriptions   | Token auth with real-time data              |
| [`updateConfig.ts`](./simple/updateConfig.ts)               | Dynamic configuration   | Runtime config updates                      |
| [`profile.ts`](./simple/profile.ts)                         | Event profiling         | Unconfirmed events, timing analysis         |
| [`auto.ts`](./simple/auto.ts)                               | Automated queries       | Simple token lookups                        |

**Usage:**

```bash
cd examples/simple
pnpm run dev                    # Run index.ts
tsx token.ts                    # Run specific example
CODEX_API_KEY=xyz tsx auto.ts   # With inline API key
```

### 📁 [codegen/](./codegen/)

**GraphQL Code Generation**

Shows how to use GraphQL Code Generator for fully typed queries and mutations.

**Features:**

- Type-safe GraphQL operations
- Generated TypeScript types
- Custom document nodes
- Full IntelliSense support

**Usage:**

```bash
cd examples/codegen
pnpm run codegen    # Generate types
pnpm run dev        # Run example
```

**Key Files:**

- [`codegen.ts`](./codegen/codegen.ts) - Code generation configuration
- [`src/index.ts`](./codegen/src/index.ts) - Typed query example
- `src/gql/` - Generated types and utilities

### 📁 [next/](./next/)

**Next.js Integration**

A complete Next.js application demonstrating SDK usage in a React environment.

**Features:**

- Server-side rendering with SDK
- Client-side data fetching
- Real-time updates
- Modern UI components
- Network and token exploration

**Usage:**

```bash
cd examples/next
pnpm run dev    # Start development server
pnpm run build  # Build for production
```

**Key Features:**

- 🌐 Network browsing
- 🪙 Token exploration
- 📊 Price charts
- 🔄 Real-time updates
- 📱 Responsive design

## TypeScript Support

The Codex SDK provides full TypeScript support with generated types for all GraphQL operations:

```typescript
import {
  Codex,
  TokenQuery,
  OnPriceUpdatedSubscription,
  CreateWebhooksMutation,
} from "@codex-data/sdk";

// All operations are fully typed
const token: TokenQuery = await sdk.queries.token({
  input: { address, networkId },
});
```

### Available Type Categories

- **Query Types**: `TokenQuery`, `GetNetworksQuery`, etc.
- **Mutation Types**: `CreateWebhooksMutation`, `DeleteWebhooksMutation`, etc.
- **Subscription Types**: `OnPriceUpdatedSubscription`, `OnTokenEventsCreatedSubscription`, etc.
- **Input Types**: `TokenInput`, `CreateWebhooksInput`, etc.
- **Scalar Types**: All GraphQL scalars and custom types

## Common Patterns

### Basic Query

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

const token = await sdk.queries.token({
  input: {
    address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    networkId: 56,
  },
});
```

### Real-time Subscription

```typescript
sdk.subscriptions.onPriceUpdated(
  {
    address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    networkId: 56,
  },
  {
    next: (data) => console.log("Price update:", data),
    error: (err) => console.error("Error:", err),
    complete: () => console.log("Subscription complete"),
  },
);
```

### Custom GraphQL Query

```typescript
import { GetNetworksQuery } from "@codex-data/sdk";

const result = await sdk.send<GetNetworksQuery>(
  `query GetNetworks { getNetworks { id name } }`,
  {},
);
```

### Mutation Example

```typescript
const webhook = await sdk.mutations.createWebhooks({
  input: {
    priceWebhooksInput: {
      webhooks: [
        {
          name: "Price Alert",
          callbackUrl: "https://your-webhook-url.com",
          conditions: {
            priceUsd: { gt: "100" },
            networkId: { eq: 1 },
          },
        },
      ],
    },
  },
});
```

## Environment Variables

All examples support these environment variables:

| Variable        | Description               | Default                          |
| --------------- | ------------------------- | -------------------------------- |
| `CODEX_API_KEY` | Your Codex API key        | Required                         |
| `CODEX_API_URL` | Custom API endpoint       | `https://graph.codex.io/graphql` |
| `CODEX_WS_URL`  | Custom WebSocket endpoint | `wss://graph.codex.io/graphql`   |

## Development Scripts

Each example directory includes these scripts:

- `pnpm run dev` - Run the main example file
- `pnpm run codegen` - Generate GraphQL types (codegen example only)
- `pnpm run build` - Build for production (Next.js example only)

## Tips & Best Practices

### 🔑 **API Key Management**

- Store API keys in environment variables
- Use `.env.local` files for local development
- Never commit API keys to version control

### 🚀 **Performance**

- Use subscriptions for real-time data
- Implement proper error handling
- Consider rate limiting for production use

### 🛠 **Development**

- Use TypeScript for better development experience
- Leverage code generation for type safety
- Test with different network configurations

### 🔄 **Real-time Data**

- Handle subscription lifecycle properly
- Implement reconnection logic for production
- Use appropriate cleanup mechanisms

## Troubleshooting

### Common Issues

**"API key not found"**

```bash
export CODEX_API_KEY="your_api_key_here"
```

**"Module not found"**

```bash
pnpm install  # From project root
```

**"WebSocket connection failed"**

- Check your network connection
- Verify WebSocket URL is correct
- Ensure API key has subscription permissions

### Getting Help

- 📖 [Official Documentation](https://docs.codex.io)
- 🐛 [Report Issues](https://github.com/codex-data/sdk/issues)
- 💬 [Community Support](https://discord.gg/codex)

## Contributing

Found a bug or want to add an example? We welcome contributions!

1. Fork the repository
2. Create your feature branch
3. Add your example with proper documentation
4. Submit a pull request

---

**Happy coding with Codex SDK!** 🚀
