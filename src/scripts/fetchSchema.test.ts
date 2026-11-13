import { buildSchema } from "graphql";

import { supportedCommitmentSchema } from "./fetchSchema";

it("publishes only supported commitments and removes obsolete descriptions", () => {
  const schema = supportedCommitmentSchema(`
    "Legacy event stages."
    enum EventCommitmentLevel { Legacy @deprecated(reason: "Retired") Processed Confirmed }
    "Legacy bar stages."
    enum BarCommitmentLevel { Legacy Processed Confirmed }
    enum Other { Legacy @deprecated(reason: "Still available") Current }
    type Query {
      events("Legacy levels." commitmentLevel: [EventCommitmentLevel!]): EventCommitmentLevel
      bars("Legacy levels." commitmentLevel: BarCommitmentLevel): BarCommitmentLevel
      other: Other
    }
  `);
  const parsed = buildSchema(schema);
  for (const name of ["EventCommitmentLevel", "BarCommitmentLevel"]) {
    expect(String(parsed.getType(name))).toBe(name);
    expect(schema).toContain(`enum ${name} {\n  Processed\n  Confirmed\n}`);
  }
  expect(schema).not.toContain("Legacy levels");
  expect(schema).not.toContain("Legacy event stages");
  expect(schema).not.toContain("Legacy bar stages");
  expect(schema).toContain('Legacy @deprecated(reason: "Still available")');
  expect(schema).toContain(
    "The commitment levels to subscribe to: Processed, Confirmed.",
  );
});
