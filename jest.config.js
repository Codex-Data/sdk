const merge = require("merge");
const tsPreset = require("ts-jest/jest-preset");

module.exports = merge.recursive(
  {
    verbose: false,
    testEnvironment: "node",
    modulePathIgnorePatterns: ["dist"],
    coverageProvider: "v8",
    collectCoverage: true,
    coveragePathIgnorePatterns: ["invariant.ts", "dist", "node_modules"],
  },
  tsPreset,
);
