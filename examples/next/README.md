# Codex SDK + Next.js Example

A comprehensive Next.js application demonstrating how to integrate the Codex SDK in a modern React environment. This example showcases real-time crypto data visualization, network exploration, and token analysis.

## Features

- 🌐 **Network Explorer**: Browse and explore different blockchain networks
- 🪙 **Token Discovery**: Search and analyze tokens across networks
- 📊 **Real-time Charts**: Live price data and trading metrics
- 🔄 **WebSocket Integration**: Real-time updates using Codex subscriptions
- 📱 **Responsive Design**: Mobile-first, modern UI components
- ⚡ **Server-Side Rendering**: Fast initial page loads with SSR
- 🎨 **Modern UI**: Built with Tailwind CSS and Radix UI components

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 17.5.0
- [pnpm](https://pnpm.io/) (recommended)
- A Codex API key from [docs.codex.io](https://docs.codex.io)

### Setup

1. **Set your API key**:

   ```bash
   export NEXT_PUBLIC_CODEX_API_KEY="your_api_key_here"
   ```

2. **Install dependencies** (from the root directory):

   ```bash
   pnpm install
   ```

3. **Start the development server**:

   ```bash
   cd examples/next
   pnpm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env.local` file in this directory:

```bash
# Required: Your Codex API key
NEXT_PUBLIC_CODEX_API_KEY=your_api_key_here

# Optional: Custom API endpoints
NEXT_PUBLIC_CODEX_API_URL=https://graph.codex.io/graphql
NEXT_PUBLIC_CODEX_WS_URL=wss://graph.codex.io/graphql
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Home page with network list
│   ├── networks/          # Network exploration
│   │   └── [networkId]/   # Dynamic network pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── NetworkList.tsx    # Network browsing component
│   ├── TokenChart.tsx     # Token price visualization
│   ├── GlitchText.tsx     # Animated text effects
│   └── ui/               # Reusable UI components
└── lib/
    └── utils.ts          # Utility functions
```

## Key Components

### NetworkList Component

Displays available blockchain networks with real-time data:

```typescript
// Fetches networks using the Codex SDK
const networks = await sdk.queries.getNetworks({});
```

### TokenChart Component

Renders interactive price charts for tokens:

```typescript
// Real-time price updates via WebSocket
sdk.subscriptions.onPriceUpdated(params, {
  next: (data) => updateChart(data),
});
```

### Dynamic Routing

- `/` - Network overview
- `/networks/[networkId]` - Network details
- `/networks/[networkId]/tokens/[tokenId]` - Token analysis

## SDK Integration Patterns

### Server-Side Data Fetching

```typescript
// app/page.tsx
export default async function HomePage() {
  const sdk = new Codex(process.env.NEXT_PUBLIC_CODEX_API_KEY!);
  const networks = await sdk.queries.getNetworks({});

  return <NetworkList networks={networks} />;
}
```

### Client-Side Real-time Updates

```typescript
// components/TokenChart.tsx
useEffect(() => {
  const cleanup = sdk.subscriptions.onPriceUpdated(
    { address, networkId },
    {
      next: (data) => setPriceData(data),
      error: (err) => console.error(err),
    },
  );

  return cleanup;
}, [address, networkId]);
```

### Error Handling

```typescript
try {
  const token = await sdk.queries.token({ input: { address, networkId } });
  setTokenData(token);
} catch (error) {
  setError("Failed to fetch token data");
}
```

## Available Scripts

| Command          | Description              |
| ---------------- | ------------------------ |
| `pnpm run dev`   | Start development server |
| `pnpm run build` | Build for production     |
| `pnpm run start` | Start production server  |
| `pnpm run lint`  | Run ESLint               |

## Troubleshooting

**"API key not found"**

- Ensure `NEXT_PUBLIC_CODEX_API_KEY` is set in your environment
- Check that the environment variable starts with `NEXT_PUBLIC_`

**"WebSocket connection failed"**

- Verify your network allows WebSocket connections
- Check that the WebSocket URL is correct
- Ensure your API key has subscription permissions

**"Build fails"**

```bash
# Clear Next.js cache
rm -rf .next
pnpm run build
```

## Learn More

### Codex SDK

- 📖 [Codex SDK Documentation](https://docs.codex.io)
- 🚀 [SDK Examples](../README.md)
- 🐛 [Report Issues](https://github.com/codex-data/sdk/issues)

### Next.js

- 📚 [Next.js Documentation](https://nextjs.org/docs)
- 🎓 [Learn Next.js](https://nextjs.org/learn)
- 💬 [Next.js GitHub](https://github.com/vercel/next.js)

### UI Components

- 🎨 [Tailwind CSS](https://tailwindcss.com)
- ♿ [Radix UI](https://radix-ui.com)
- 📊 [Recharts](https://recharts.org)
