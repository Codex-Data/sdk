import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  // The SDK ships its schema, so codegen runs offline against the exact
  // schema version you have installed.
  schema: "./node_modules/@codex-data/sdk/schema.graphql",
  documents: "src/**/*.ts",
  generates: {
    "src/gql/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
};

export default config;
