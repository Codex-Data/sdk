import fs from "fs";
import * as gql from "gql-query-builder";
import VariableOptions from "gql-query-builder/build/VariableOptions";
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
};

type SchemaType = {
  name: string;
  description?: string | null;
  type: SchemaTypeDefinition;
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
  if (level > 8 || !type?.kind || type.kind === "UNION") return result;

  // If it's a scalar, return the name
  if (type.kind === "SCALAR" || type.kind === "ENUM")
    return [...result, currentName!];

  // If it's an object resolve it.
  if (type.kind === "OBJECT") {
    // For each of the fields of the subtype, resolve them
    const subType = allTypes.find((t) => t.name === type.name);
    const subTypeLeaves = (subType?.fields ?? [])
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
  console.log("Generating queries...");

  const res = await fetch(`https://graph.codex.io/schema/latest.json`, {
    method: "GET",
  });

  const schemaJson = await res.json();

  const types = schemaJson.__schema.types;

  const queryType = types.find((type: SchemaType) => type.name === "Query");

  for (const field of queryType.fields) {
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

    console.log(`Writing file: ${field.name}.graphql`);

    fs.writeFileSync(
      path.resolve(
        __dirname,
        "..",
        "resources",
        "generated_queries",
        `${capitalize(field.name)}.graphql`,
      ),
      `query ${capitalize(field.name)}${queryBuilderObject.query
        .toString()
        .slice(6)}`,
    );
  }
}

run().then(() => process.exit());
