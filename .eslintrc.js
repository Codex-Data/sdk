module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  plugins: ["@typescript-eslint", "simple-import-sort", "prettier"],
  overrides: [
    {
      files: ["*.graphql"],
      parser: "@graphql-eslint/eslint-plugin",
      plugins: ["@graphql-eslint"],
      parserOptions: {
        schema: "src/resources/schema.graphql",
      },
      rules: {
        "@graphql-eslint/known-type-names": "error",
      },
    },
  ],
  rules: {
    semi: ["error", "always"],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": 1,
    "prettier/prettier": ["error", { quote: false }],
    "@typescript-eslint/no-inferrable-types": [
      "warn",
      {
        ignoreParameters: true,
      },
    ],
    "simple-import-sort/imports": "error",
    "@typescript-eslint/no-use-before-define": [
      "error",
      { functions: false, classes: true },
    ],
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-var-requires": 0,
  },
};
