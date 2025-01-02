# Codex SDK

This package exists to help you develop on top of the Codex API (https://docs.codex.io).

It provides the public schema SDL for you to use. You can use graphql-codegen to generate types and queries for example.

> [!NOTE]
> We've changed our name from Defined to Codex.
>
> You will see references to our previous company name, Defined, while we make the switch to Codex.

## Installation

| packager                      | command                   |
| ----------------------------- | ------------------------- |
| [npm](https://www.npmjs.com/) | `npm add @codex-data/sdk`  |
| [yarn](https://yarnpkg.com/)  | `yarn add @codex-data/sdk` |
| [bun](https://bun.sh/)        | `bun add @codex-data/sdk`  |

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
import { Network } from "../../src/resources/graphql";
import { Codex } from "@codex-data/sdk/dist/sdk";

const sdk = new Codex(process.env.CODEX_API_KEY || "");

sdk
  .send<{ getNetworks: Network[] }>(
    `
  query GetNetworks {
    getNetworks { id name }
  }
`,
    {}
  )
  .then((res) => {
    console.log("Networks: ", res.getNetworks);
  });
```

## Running the examples

You'll need to have [`curl`](https://curl.se/) installed in order to build this locally, as it fetches the schema from the Codex API.

You need to provide an API key in order for the examples to work. We have [bun](https://bun.sh) in use for development here.

After installing [bun](https://bun.sh), from the project root.

- `bun i`
- `bun run build`

### Simple

This performs a simple inline graphql request, and uses a user-provided query and selection set.

- `cd examples/simple`
- `bun i`
- `CODEX_API_KEY=xyz bun run index.ts`

You can define your own GraphQL queries and use those with codegen (see next section). The pre-defined queries we provide in the
examples do not include all of the fields for every query.

### Codegen

This shows how to use graphql-codegen to generate query types and get a fully typed end-to-end experience.

- `cd examples/codegen`
- `bun i`
- `bun run codegen`
- `CODEX_API_KEY=xyz bun run src/index.ts`

### Next

This shows how you could use it in a NextJS project.

- `cd examples/next`
- `bun i`
- `NEXT_PUBLIC_CODEX_API_KEY=xyz bun run dev`

## Releasing a new version

- Increase version number to what you want in package.json on a branch.
- Merge that Pr to main
- Release it with the right version number. 

## Contributing

Prs open!
