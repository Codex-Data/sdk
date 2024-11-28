import fs from "fs";
import * as gql from "gql-query-builder";
import VariableOptions from "gql-query-builder/build/VariableOptions";
import { mkdirp } from "mkdirp";
import path from "path";

type SchemaTypeDefinition = {
  kind:
    | "NON_NULL"
    | "SCALAR"
    | "LIST"
    | "OBJECT"
    | "INPUT_OBJECT"
    | "ENUM"
    | "UNION"
    | undefined
    | null;
  name?: string | null;
  ofType?: SchemaTypeDefinition | null;
  isDeprecated?: boolean | null;
};

type SchemaType = {
  name: string;
  description?: string | null;
  type: SchemaTypeDefinition;
  isDeprecated?: boolean | null;
  possibleTypes?: SchemaType[];
  fields?: SchemaType[];
};

type Fields = Array<string | { [key: string]: Fields }>;

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const getLeafType = (
  type: SchemaTypeDefinition,
  allTypes: SchemaType[],
  result: Fields,
  currentName: string,
  level = 0,
): Fields => {
  if (level > 8 || !type?.kind || type.isDeprecated) return result;

  // If it's a scalar, return the name
  if (type.kind === "SCALAR" || type.kind === "ENUM")
    return [...result, currentName!];

  if (type.kind === "UNION") {
    // Find all the possible types
    const possibleTypes = allTypes.find((t) => t.name === type.name)
      ?.possibleTypes;

    // For each of the possible types, treat it as a sub object with a set of fields
    const possibleTypeLeaves = possibleTypes
      ?.map((f: SchemaType) => {
        const resolvedType = allTypes.find(
          (t) => t.name === f.name,
        ) as unknown as SchemaTypeDefinition;
        return getLeafType(
          resolvedType,
          allTypes,
          [],
          `... on ${f.name}`,
          level + 1,
        );
      })
      .flat();

    if (!possibleTypeLeaves?.length) {
      console.log("No possible types for union", type);
      throw new Error(`No possible types for union type ${currentName}`);
    }

    return [...result, ...[{ [currentName]: possibleTypeLeaves }]];
  }

  // If it's an object resolve it.
  if (type.kind === "OBJECT") {
    // For each of the fields of the subtype, resolve them
    const subType = allTypes.find((t) => t.name === type.name);
    const subTypeLeaves = (subType?.fields ?? [])
      .filter((t) => !t.isDeprecated)
      .map((f: SchemaType) =>
        getLeafType(f.type, allTypes, [], f.name, level + 1),
      )
      .flat();
    return [
      ...result,
      ...(level === 0 ? subTypeLeaves : [{ [currentName]: subTypeLeaves }]),
    ];
  }

  // If it's a list, resolve the first object type
  if (type.kind === "LIST")
    return getLeafType(type.ofType!, allTypes, [...result], currentName, level);

  // If it's required, resolve the first object type
  if (type.kind === "NON_NULL")
    return getLeafType(type.ofType!, allTypes, [...result], currentName, level);

  throw new Error(`Unknown type ${type.name} ${type.kind}`);
};

export const getLeafArgs = (
  type: SchemaTypeDefinition,
  result: VariableOptions,
): VariableOptions => {
  if (
    type.kind === "NON_NULL" &&
    ["INPUT_OBJECT", "SCALAR", "OBJECT", "ENUM"].includes(
      type.ofType?.kind as string,
    )
  )
    return { ...result, type: `${type.ofType!.name!}!` };

  // If it's a scalar, return the name
  if (
    type.kind === "SCALAR" ||
    type.kind === "OBJECT" ||
    type.kind === "ENUM" ||
    type.kind === "INPUT_OBJECT"
  )
    return { ...result, type: type.name!, value: null };

  // If it's a list, resolve the first object type
  if (type.kind === "LIST")
    return getLeafArgs(type.ofType!, { ...result, list: true });

  // If it's required, resolve the first object type
  if (type.kind === "NON_NULL")
    return getLeafArgs(type.ofType!, { ...result, required: true });

  throw new Error(`Unknown type ${type.name} ${type.kind}`);
};

export function parseVariables(args: SchemaType[]) {
  const parsedVariables = args.reduce(
    (acc: VariableOptions, arg: SchemaType) => {
      return {
        ...acc,
        [arg.name]: getLeafArgs(arg.type, {}),
      };
    },
    {},
  );
  return parsedVariables;
}

/**
 * Runs a query against the currently published graphql schema,
 * and generates a query ts file for query.
 */
async function run() {
  console.log("Generating...");

  // Fetch schema from remote
  const res = await fetch(`https://graph.codex.io/schema/latest.json`, {
    method: "GET",
  });
  const schemaJson = await res.json();

  const types = schemaJson.__schema.types;
  const mutationType = types.find(
    (type: SchemaType) => type.name === "Mutation",
  );
  const queryType = types.find((type: SchemaType) => type.name === "Query");
  const subscriptionType = types.find(
    (type: SchemaType) => type.name === "Subscription",
  );

  for (const field of mutationType.fields) {
    const args = field.args;
    const parsedVariables = parseVariables(args);
    const parsedFields = getLeafType(field.type, types, [], "").filter(Boolean);

    const mutationBuilderObject = gql.mutation({
      operation: field.name,
      variables: Object.keys(parsedVariables).length
        ? parsedVariables
        : undefined,
      fields: parsedFields.length ? parsedFields : undefined,
    });
    console.log(`Writing mutation: ${field.name}.graphql`);
    const mutationsFolderPath = path.join(
      __dirname,
      "..",
      "resources",
      "generated_mutations",
    );
    await mkdirp(mutationsFolderPath);

    const overridePath = path.join(
      __dirname,
      "..",
      "resources",
      "mutations_override",
    );
    const filename = `${capitalize(field.name)}.graphql`;
    const filePath = path.join(mutationsFolderPath, filename);

    // If we have an override, use it.
    if (fs.existsSync(path.join(overridePath, filename)))
      fs.copyFileSync(path.join(overridePath, filename), filePath);
    else
      fs.writeFileSync(
        filePath,
        `mutation ${capitalize(field.name)}${mutationBuilderObject.query
          .toString()
          .slice("mutation ".length)}`,
      );
  }

  for (const field of subscriptionType.fields) {
    const args = field.args;
    const parsedVariables = parseVariables(args);
    const parsedFields = getLeafType(field.type, types, [], "").filter(Boolean);

    const subscriptionBuilderObject = gql.subscription({
      operation: field.name,
      variables: Object.keys(parsedVariables).length
        ? parsedVariables
        : undefined,
      fields: parsedFields.length ? parsedFields : undefined,
    });
    console.log(`Writing subscription: ${field.name}.graphql`);
    const subscriptionsFolderPath = path.join(
      __dirname,
      "..",
      "resources",
      "generated_subscriptions",
    );
    await mkdirp(subscriptionsFolderPath);

    const overridePath = path.join(
      __dirname,
      "..",
      "resources",
      "subscriptions_override",
    );
    const filename = `${capitalize(field.name)}.graphql`;
    const subPath = path.join(subscriptionsFolderPath, filename);
    // If we have an override, use it.
    if (fs.existsSync(path.join(overridePath, filename)))
      fs.copyFileSync(path.join(overridePath, filename), subPath);
    else
      fs.writeFileSync(
        subPath,
        `subscription ${capitalize(field.name)}${subscriptionBuilderObject.query
          .toString()
          .slice("subscription ".length)}`,
      );
  }

  // Write queries
  for (const field of queryType.fields) {
    if (field.isDeprecated) {
      console.log("Skipping deprecated field", field.name);
      continue;
    }

    const args = field.args;
    const parsedVariables = parseVariables(args);
    const parsedFields = getLeafType(field.type, types, [], "").filter(Boolean);

    const queryBuilderObject = gql.query({
      operation: field.name,
      variables: Object.keys(parsedVariables).length
        ? parsedVariables
        : undefined,
      fields: parsedFields.length ? parsedFields : undefined,
    });
    console.log(`Writing query: ${field.name}.graphql`);

    const queriesFolderPath = path.join(
      __dirname,
      "..",
      "resources",
      "generated_queries",
    );
    await mkdirp(queriesFolderPath);

    const overridePath = path.join(
      __dirname,
      "..",
      "resources",
      "queries_override",
    );
    const queryFileName = `${capitalize(field.name)}.graphql`;
    const queryPath = path.join(queriesFolderPath, queryFileName);
    // If we have an override, use it.
    if (fs.existsSync(path.join(overridePath, queryFileName)))
      fs.copyFileSync(path.join(overridePath, queryFileName), queryPath);
    else
      fs.writeFileSync(
        queryPath,
        `query ${capitalize(field.name)}${queryBuilderObject.query
          .toString()
          .slice("query ".length)}`,
      );
  }
}

run().then(() => process.exit());
