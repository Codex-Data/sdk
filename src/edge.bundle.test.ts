import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { build, type Metafile } from "esbuild";

const packageRoot = resolve(__dirname, "..");
let fixture: string;
let bundleBytes: number;
let metafile: Metafile;

beforeAll(async () => {
  fixture = mkdtempSync(join(tmpdir(), "codex-sdk-edge-package-"));
  const archive = join(fixture, "sdk.tgz");
  execFileSync(
    "pnpm",
    ["--config.ignore-scripts=true", "pack", "--out", archive],
    { cwd: packageRoot, stdio: "pipe" },
  );
  const packageDir = join(fixture, "node_modules", "@codex-data", "sdk");
  mkdirSync(packageDir, { recursive: true });
  execFileSync("tar", [
    "-xzf",
    archive,
    "--strip-components=1",
    "-C",
    packageDir,
  ]);
  for (const dependency of ["graphql", "graphql-ws"]) {
    symlinkSync(
      join(packageRoot, "node_modules", dependency),
      join(fixture, "node_modules", dependency),
      "junction",
    );
  }
  const result = await build({
    stdin: {
      contents: `export { createClient, createEdgeClient, DEFAULT_EDGE_URL, ROBINHOOD_EDGE_URL, withEdge } from "@codex-data/sdk/edge";`,
      resolveDir: fixture,
      sourcefile: "consumer.js",
    },
    bundle: true,
    minify: true,
    platform: "browser",
    format: "esm",
    write: false,
    metafile: true,
  });
  bundleBytes = result.outputFiles[0].contents.byteLength;
  metafile = result.metafile;
}, 30_000);

afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

it("keeps the packed edge browser bundle below 60 KiB", () => {
  expect(bundleBytes).toBeLessThan(60 * 1024);
});

it("excludes GraphQL server code and generated SDK documents from the bundle", () => {
  const retained = Object.values(metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, input]) => input.bytesInOutput > 0)
      .map(([file]) => file.replace(/\\/g, "/")),
  );
  expect(
    retained.filter(
      (file) =>
        /\/graphql\/(execution|validation|type)\//.test(file) ||
        /\/graphql-ws\/lib\/server\./.test(file) ||
        file.includes("/sdk/generated/"),
    ),
  ).toEqual([]);
});

it.each(["import", "require"])(
  "loads the packed public edge export with Node %s",
  (mode) => {
    const imports =
      mode === "import"
        ? `import assert from "node:assert/strict";
           import * as sdk from "@codex-data/sdk/edge";
           import { createClient } from "graphql-ws";`
        : `const assert = require("node:assert/strict");
           const sdk = require("@codex-data/sdk/edge");
           const { createClient } = require("graphql-ws");`;
    execFileSync(
      process.execPath,
      [
        `--input-type=${mode === "import" ? "module" : "commonjs"}`,
        "--eval",
        `${imports}
         assert.equal(sdk.createClient, createClient);
         assert.equal(typeof sdk.createEdgeClient, "function");
         assert.equal(typeof sdk.withEdge, "function");
         assert.equal(sdk.DEFAULT_EDGE_URL, "wss://fra.edge.codex.io/graphql");
         assert.equal(sdk.ROBINHOOD_EDGE_URL, "wss://iad.edge.codex.io/graphql");`,
      ],
      { cwd: fixture, stdio: "pipe" },
    );
  },
);
