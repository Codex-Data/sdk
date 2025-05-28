import { Codex } from "@codex-data/sdk";
import graphql from "graphql-tag";

const doc = graphql`
  query {
    getNetworks {
      id
      name
    }
  }
`

const sdk = new Codex(
  process.env.CODEX_API_KEY || "",
  {
    applyHeaders: async () => {
      return {
        "x-test-header": "TestHeader",
      }
    },
  }
);

sdk.query(doc).then((r) => console.log(JSON.stringify(r, null, 2)));
