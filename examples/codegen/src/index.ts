import { Codex } from "@codex-data/sdk";
import { graphql } from "./gql";

// The result type is inferred from exactly the fields selected here —
// and you're only billed for the fields you request.
const doc = graphql(`
  query Networks {
    getNetworks {
      id
      name
    }
  }
`);

const sdk = new Codex(process.env.CODEX_API_KEY || "");

sdk.query(doc).then((res) => {
  console.log("Fetched res", res.getNetworks);
});
