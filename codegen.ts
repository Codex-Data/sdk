import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "./src/resources/schema.graphql",
  generates: {
    "src/sdk/generated/": {
      preset: "client",
      documents:
        "src/resources/(generated_queries|generated_mutations|generated_subscriptions)/**/*",
    },
    "src/resources/graphql.ts": {
      plugins: ["typescript"],
    },
    "src/resources/graphql.schema.json": {
      plugins: ["introspection"],
    },
  },
};

export default config;
