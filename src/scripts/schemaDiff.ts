import { Change, CriticalityLevel, diff } from "@graphql-inspector/core";
import fs from "fs";
import { buildSchema } from "graphql";

// Diffs two schema SDL files and prints a markdown summary to stdout,
// grouped by criticality. Used by the bump workflow to generate release
// notes and to pick the version bump level.
//
// Usage: tsx src/scripts/schemaDiff.ts <old.graphql> <new.graphql>
//
// When $GITHUB_OUTPUT is set, also writes:
//   changed=true|false
//   level=breaking|nonbreaking|none

const SECTIONS: Array<{ level: CriticalityLevel; heading: string }> = [
  { level: CriticalityLevel.Breaking, heading: "⚠️ Breaking schema changes" },
  {
    level: CriticalityLevel.Dangerous,
    heading: "Potentially dangerous schema changes",
  },
  { level: CriticalityLevel.NonBreaking, heading: "Schema additions" },
];

// Bullets per section before truncating with an "…and N more" line.
const MAX_BULLETS_PER_SECTION = 100;

const pathRoot = (change: Change) => change.path?.split(".")[0] ?? "";

// Collapses the raw change list for readability:
// - a member change on a type that was itself added/removed is folded into
//   the type's own bullet (with a member count)
// - directive-usage changes are dropped (they duplicate e.g. deprecations)
// - description-only changes are rolled up into a single count
const summarize = (changes: Change[]) => {
  const addedOrRemovedTypes = new Set(
    changes
      .filter((c) => c.type === "TYPE_ADDED" || c.type === "TYPE_REMOVED")
      .map(pathRoot),
  );
  const memberCounts = new Map<string, number>();
  let descriptionChanges = 0;

  const kept = changes.filter((change) => {
    if (change.type.includes("DIRECTIVE_USAGE")) return false;
    if (change.type.includes("DESCRIPTION")) {
      descriptionChanges += 1;
      return false;
    }
    const root = pathRoot(change);
    if (
      addedOrRemovedTypes.has(root) &&
      change.type !== "TYPE_ADDED" &&
      change.type !== "TYPE_REMOVED"
    ) {
      memberCounts.set(root, (memberCounts.get(root) ?? 0) + 1);
      return false;
    }
    return true;
  });

  const bullet = (change: Change) => {
    const members = memberCounts.get(pathRoot(change));
    return members &&
      (change.type === "TYPE_ADDED" || change.type === "TYPE_REMOVED")
      ? `- ${change.message} (${members} members)`
      : `- ${change.message}`;
  };

  return { kept, bullet, descriptionChanges };
};

const main = async () => {
  const [oldPath, newPath] = process.argv.slice(2);
  if (!oldPath || !newPath) {
    console.error("Usage: schemaDiff <old.graphql> <new.graphql>");
    process.exit(1);
  }

  const loadSchema = (filePath: string) =>
    buildSchema(fs.readFileSync(filePath, "utf8"), { assumeValid: true });

  const changes = await diff(loadSchema(oldPath), loadSchema(newPath));
  const { kept, bullet, descriptionChanges } = summarize(changes);

  const lines: string[] = [];
  for (const { level, heading } of SECTIONS) {
    const group = kept.filter((c) => c.criticality.level === level);
    if (group.length === 0) continue;
    lines.push(`### ${heading}`, "");
    lines.push(...group.slice(0, MAX_BULLETS_PER_SECTION).map(bullet));
    if (group.length > MAX_BULLETS_PER_SECTION) {
      lines.push(`- …and ${group.length - MAX_BULLETS_PER_SECTION} more`);
    }
    lines.push("");
  }
  if (descriptionChanges > 0) {
    lines.push(
      `_${descriptionChanges} description/documentation change(s)._`,
      "",
    );
  }

  if (kept.length > 0 || descriptionChanges > 0) {
    console.log(["## Supergraph schema changes", "", ...lines].join("\n"));
  }

  const hasBreaking = changes.some(
    (c) => c.criticality.level === CriticalityLevel.Breaking,
  );
  const level =
    changes.length === 0 ? "none" : hasBreaking ? "breaking" : "nonbreaking";
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `changed=${changes.length > 0}\nlevel=${level}\n`,
    );
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
