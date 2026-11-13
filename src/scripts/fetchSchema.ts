import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { Kind, parse, print, visit } from "graphql";

const commitmentTypes = new Set(["EventCommitmentLevel", "BarCommitmentLevel"]);
const supportedLevels = new Set(["Processed", "Confirmed"]);

/** Keep the SDK's published schema and generated types on supported commitments. */
export function supportedCommitmentSchema(source: string): string {
  return (
    print(
      visit(parse(source), {
        EnumTypeDefinition: (node) => {
          if (!commitmentTypes.has(node.name.value)) return;
          return {
            ...node,
            description: {
              kind: Kind.STRING,
              value:
                "The commitment level of a streamed update: Processed or Confirmed.",
              block: true,
            },
            values: node.values?.filter((value) =>
              supportedLevels.has(value.name.value),
            ),
          };
        },
        InputValueDefinition: (node) => {
          let type = node.type;
          while (type.kind !== Kind.NAMED_TYPE) type = type.type;
          if (!commitmentTypes.has(type.name.value)) return;
          return {
            ...node,
            description: {
              kind: Kind.STRING,
              value:
                "The commitment levels to subscribe to: Processed, Confirmed.",
              block: true,
            },
          };
        },
      }),
    ) + "\n"
  );
}

async function run(): Promise<void> {
  const response = await fetch("https://graph.codex.io/schema/latest.graphql");
  if (!response.ok)
    throw new Error(
      `Schema fetch failed: ${response.status} ${response.statusText}`,
    );
  const schema = supportedCommitmentSchema(await response.text());
  const root = path.resolve(__dirname, "../..");
  const resources = path.join(root, "src/resources");
  await mkdir(resources, { recursive: true });
  await Promise.all([
    writeFile(path.join(resources, "schema.graphql"), schema),
    writeFile(path.join(root, "schema.graphql"), schema),
  ]);
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
