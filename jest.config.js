const merge = require("merge");
const tsPreset = require("ts-jest/jest-preset");

module.exports = merge.recursive(
  {
    verbose: false,
    testEnvironment: "node",
    moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
    modulePathIgnorePatterns: ["dist"],
    coverageProvider: "v8",
    collectCoverage: true,
    coveragePathIgnorePatterns: ["invariant.ts", "dist", "node_modules"],
  },
  tsPreset,
);
