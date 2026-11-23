import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildSchema, parse, print, validate, visit } from "graphql";

const SCHEMA = `
  enum TokenBriefVoice { DEGEN STANDARD }
  type TokenBriefSection { title: String! text: String! }
  type TokenBrief { tagline: String! overview: TokenBriefSection! }
  type TokenBriefResponse { brief: TokenBrief }
  type EnhancedToken {
    id: ID!
    name: String
    brief(voice: TokenBriefVoice! = DEGEN): TokenBrief
  }
  type Other { brief: String }
  union Asset = EnhancedToken | Other
  type TokenFilterResult { token: EnhancedToken }
  type TokenFilterConnection { results: [TokenFilterResult] }
  type AssetRecord { asset: Asset }
  type EnhancedEvent { token: EnhancedToken }
  type Query {
    filterTokens(limit: Int): TokenFilterConnection
    tokens: [EnhancedToken!]!
    events: [EnhancedEvent!]
    assets: [AssetRecord!]
    getTokenBrief: TokenBriefResponse!
  }
  type Mutation { ping: Boolean }
  type Subscription { onTokens: [EnhancedToken!]! }
`;

describe("GraphQL generation", () => {
  let generated: string;

  beforeAll(() => {
    const root = mkdtempSync(path.join(tmpdir(), "sdk-brief-selection-"));
    const scripts = path.join(root, "src/scripts");
    const resources = path.join(root, "src/resources");
    mkdirSync(scripts, { recursive: true });
    mkdirSync(resources, { recursive: true });
    symlinkSync(
      path.resolve(__dirname, "../../node_modules"),
      path.join(root, "node_modules"),
    );
    copyFileSync(
      path.join(__dirname, "generateGraphql.ts"),
      path.join(scripts, "generateGraphql.ts"),
    );
    writeFileSync(path.join(resources, "schema.graphql"), SCHEMA);
    execFileSync(
      process.execPath,
      [require.resolve("tsx/cli"), path.join(scripts, "generateGraphql.ts")],
      {
        cwd: root,
        timeout: 15000,
        stdio: "pipe",
      },
    );
    generated = path.join(resources, "generated");
  });

  const operation = (filename: string): string => {
    return readFileSync(path.join(generated, filename), "utf8");
  };

  it.each([
    "queries/FilterTokens.graphql",
    "queries/Tokens.graphql",
    "queries/Events.graphql",
    "subscriptions/OnTokens.graphql",
  ])("omits cached briefs from %s while keeping token fields", (filename) => {
    const document = parse(operation(filename));
    const fields: string[] = [];
    visit(document, {
      Field: (node) => {
        fields.push(node.name.value);
      },
    });

    expect(validate(buildSchema(SCHEMA), document)).toEqual([]);
    expect(fields).toContain("id");
    expect(fields).toContain("name");
    expect(fields).not.toContain("brief");
    expect(fields).not.toContain("tagline");
    expect(fields).not.toContain("overview");
  });

  it("omits briefs from EnhancedToken union members only", () => {
    const query = print(parse(operation("queries/Assets.graphql")));

    expect(validate(buildSchema(SCHEMA), parse(query))).toEqual([]);
    expect(query).toMatch(/\.\.\. on EnhancedToken\s*\{\s*id\s+name\s*\}/);
    expect(query).toMatch(/\.\.\. on Other\s*\{\s*brief\s*\}/);
  });

  it("keeps the dedicated brief query intact", () => {
    const query = operation("queries/GetTokenBrief.graphql");

    expect(validate(buildSchema(SCHEMA), parse(query))).toEqual([]);
    expect(query).toContain("tagline");
    expect(query).toContain("overview");
    expect(query).toContain("text");
  });

  it("allows a custom query to explicitly select the tagline", () => {
    const query = parse(
      "{ filterTokens(limit: 200) { results { token { id brief { tagline } } } } }",
    );

    expect(validate(buildSchema(SCHEMA), query)).toEqual([]);
  });
});
