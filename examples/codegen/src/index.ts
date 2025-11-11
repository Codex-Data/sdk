import { Codex } from "@codex-data/sdk";
import { graphql } from "./gql/gql";
import { NetworksQuery, NetworksQueryVariables } from "./gql/graphql";

const doc = graphql(`
  query Networks {
    getNetworks {
      id
      name
    }
  }
`);

const sdk = new Codex(process.env.CODEX_API_KEY || "");

sdk.query<NetworksQuery, NetworksQueryVariables>(doc).then((res) => {
  console.log("Fetched res", res);
});
