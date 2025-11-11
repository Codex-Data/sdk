import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "./src/resources/schema.graphql",
  generates: {
    "src/sdk/generated/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      documents:
        "src/resources/generated/(queries|mutations|subscriptions)/**/*",
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
