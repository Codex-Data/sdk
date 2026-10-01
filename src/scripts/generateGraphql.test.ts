import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import * as gql from "gql-query-builder";
import {
  buildSchema,
  DocumentNode,
  introspectionFromSchema,
  parse,
  TypeInfo,
  validate,
  visit,
  visitWithTypeInfo,
} from "graphql";
import path from "path";

import * as generated from "../sdk/generated/graphql";
import { getLeafType, parseVariables } from "./generateGraphql";

const schema = buildSchema(
  fs.readFileSync(path.join(__dirname, "../resources/schema.graphql"), "utf8"),
);
// Use the same JSON introspection representation consumed by the generator.
const types: Parameters<typeof getLeafType>[1] = JSON.parse(
  JSON.stringify(introspectionFromSchema(schema)),
).__schema.types;

function operation(name: string) {
  const field = schema.getQueryType()!.getFields()[name];
  const root = JSON.parse(
    JSON.stringify(introspectionFromSchema(schema)),
  ).__schema.types.find((type: { name: string }) => type.name === "Query");
  const definition = root.fields.find(
    (candidate: { name: string }) => candidate.name === name,
  );
  expect(field).toBeDefined();
  return parse(
    gql.query({
      operation: name,
      variables: parseVariables(definition.args),
      fields: getLeafType(definition.type, types, [], ""),
    }).query,
  );
}

function deploymentPaths(document: ReturnType<typeof parse>) {
  const typeInfo = new TypeInfo(schema);
  const stack: string[] = [];
  const paths: string[][] = [];
  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Field: {
        enter(node) {
          const coordinate = `${typeInfo.getParentType()?.name}.${node.name.value}`;
          stack.push(coordinate);
          if (coordinate === "Asset.assetDeployments") paths.push([...stack]);
        },
        leave() {
          stack.pop();
        },
      },
    }),
  );
  return paths;
}

describe("generated asset deployment selections", () => {
  it.each(["token", "listPairsForToken"])(
    "%s keeps independent deployments and emits valid bounded selections",
    (name) => {
      const document = operation(name);
      expect(validate(schema, document)).toEqual([]);
      const paths = deploymentPaths(document);
      expect(paths.length).toBeGreaterThanOrEqual(2);
      for (const selectionPath of paths) {
        expect(
          selectionPath.filter((field) => field === "Asset.assetDeployments"),
        ).toHaveLength(1);
      }
      // Do not solve recursion by removing useful deployment token metadata.
      const text = JSON.stringify(document);
      expect(text).toContain('"value":"token"');
      expect(text).toContain('"value":"symbol"');
    },
  );

  it("retains metadata directly beneath a deployment and stops organization cycles", () => {
    const fields = getLeafType(
      { kind: "OBJECT", name: "Asset" },
      types,
      [],
      "",
    );
    const deployments = fields.find(
      (field) => typeof field !== "string" && "assetDeployments" in field,
    );
    expect(deployments).toBeDefined();
    const text = JSON.stringify(deployments);
    expect(text.match(/"assetDeployments"/g)).toHaveLength(1);
    expect(text).toContain('"token":');
    expect(text).toContain('"symbol"');
    expect(text).toContain('"organization":');
  });
});

// Exercise shipped documents as well as the generator, including overrides.
it("all shipped SDK operations respect the deployment and depth limits", () => {
  const documents = Object.entries(generated).filter(([name]) =>
    name.endsWith("Document"),
  );
  expect(documents.length).toBeGreaterThan(0);
  for (const [name, value] of documents) {
    const document = value as DocumentNode;
    for (const selectionPath of deploymentPaths(document)) {
      expect({
        operation: name,
        repetitions: selectionPath.filter(
          (field) => field === "Asset.assetDeployments",
        ).length,
      }).toEqual({ operation: name, repetitions: 1 });
    }
    let depth = 0;
    let maxDepth = 0;
    visit(document, {
      Field: {
        enter() {
          maxDepth = Math.max(maxDepth, ++depth);
        },
        leave() {
          depth--;
        },
      },
    });
    expect({ operation: name, withinLimit: maxDepth <= 12 }).toEqual({
      operation: name,
      withinLimit: true,
    });
  }
});
