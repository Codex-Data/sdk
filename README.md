# Codex SDK

This package exists to help you develop on top of the Codex API (https://docs.codex.io).

It provides generated TypeScript types and convenient methods to access the GraphQL API with full type safety.

> [!NOTE]
> We've changed our name from Defined to Codex.
>
> You will see references to our previous company name, Defined, while we make the switch to Codex.

## Features

- 🚀 **Fully Typed**: Generated TypeScript types for all GraphQL operations
- 📦 **Tree Shakeable**: ESM support with optimized bundle size
- 🔄 **Real-time**: WebSocket subscriptions support
- 🛠 **Developer Friendly**: Comprehensive examples and documentation

## Installation

| Package Manager               | Command                       |
| ----------------------------- | ----------------------------- |
| [npm](https://www.npmjs.com/) | `npm install @codex-data/sdk` |
| [yarn](https://yarnpkg.com/)  | `yarn add @codex-data/sdk`    |
| [pnpm](https://pnpm.io/)      | `pnpm add @codex-data/sdk`    |

## Usage

Follow one of the examples in the [examples](/examples) directory, or simply run.

Fetch a token.

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(MY_API_KEY);

sdk.queries
  .token({
    input: {
      address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      networkId: 56,
    },
  })
  .then(console.log);
```

Use your own GraphQL selections

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

// Using the raw GraphQL client
sdk
  .send<{ getNetworks: Array<{ id: string; name: string }> }>(
    `
  query GetNetworks {
    getNetworks { id name }
  }
`,
    {},
  )
  .then((res) => {
    console.log("Networks: ", res.getNetworks);
  });
```

Subscribe to real-time data

```typescript
import { Codex } from "@codex-data/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

// Subscribe to price updates
sdk.subscriptions.onPriceUpdated(
  {
    address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    networkId: 56,
  },
  (result) => {
    if (result.data) {
      console.log("Price updated:", result.data.onPriceUpdated);
    }
  },
);
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 17.5.0
- [pnpm](https://pnpm.io/) (recommended) or npm/yarn
- [`curl`](https://curl.se/) for fetching the GraphQL schema

### Building from Source

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm run build
```

### Running Examples

All examples require a Codex API key. Get your API key at [docs.codex.io](https://docs.codex.io).

#### Simple Example

Basic usage with inline GraphQL queries:

```bash
cd examples/simple
pnpm install
CODEX_API_KEY=your_api_key pnpm run dev
```

#### Codegen Example

Shows how to use GraphQL Code Generator for fully typed queries:

```bash
cd examples/codegen
pnpm install
pnpm run codegen
CODEX_API_KEY=your_api_key pnpm run dev
```

#### Next.js Example

Full-stack example with a Next.js application:

```bash
cd examples/next
pnpm install
NEXT_PUBLIC_CODEX_API_KEY=your_api_key pnpm run dev
```

## Package Structure

The SDK is built with modern tooling and provides both CommonJS and ESM builds:

```
@codex-data/sdk/
├── dist/
│   ├── index.js      # CommonJS entry point
│   ├── index.mjs     # ESM entry point
│   ├── index.d.ts    # TypeScript definitions
│   └── sdk/          # SDK implementation
├── README.md
└── package.json
```

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

### Development Scripts

- `pnpm run build` - Build the SDK for production
- `pnpm run test` - Run the test suite
- `pnpm run lint` - Lint the codebase
- `pnpm run clean` - Clean build artifacts

## Releasing

### Publishing Beta Versions

For testing releases before making them public:

1. Update the version in `package.json` to a beta version:

   ```json
   "version": "2.0.0-beta.0"
   ```

2. Publish to the beta tag:

   ```bash
   pnpm run publish:beta
   ```

3. Test the beta version:
   ```bash
   npm install @codex-data/sdk@beta
   ```

Users installing without the `@beta` tag will continue to receive the latest stable version.

### Publishing Production Releases

1. Update the version in `package.json` to a production version:

   ```json
   "version": "2.0.0"
   ```

2. Publish to the latest tag:
   ```bash
   pnpm run publish:latest
   ```

> **Note:** The `prepublishOnly` script automatically runs the full build before publishing, ensuring the package is always built before release.
