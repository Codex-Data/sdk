import "dotenv/config";

import * as fs from "fs";
import { gql } from "graphql-tag";
import * as path from "path";

import { Codex } from "../sdk";

const apiKey = process.env.CODEX_API_KEY;

if (!apiKey) throw new Error("CODEX_API_KEY env variable not found");

const sdk = new Codex(apiKey);

const getNetworkConfigsQuery = gql`
  query networkConfigs {
    getNetworkConfigs {
      ... on EvmNetworkConfig {
        __typename
        id
        networkType
        networkId
        name
        enabled
        newTokensEnabled
        mainnet
        wrappedBaseTokenSymbol
        baseTokenSymbol
        baseTokenAddress
        defaultPairAddress
        defaultPairQuoteToken
        stableCoinAddresses
        networkIconUrl
        color
        networkShortName
        networkName
        explorer {
          name
          url
          checksummed
          icon
        }
      }
      ... on SolanaNetworkConfig {
        __typename
        # --- Common fields
        id
        networkType
        networkId
        name
        enabled
        newTokensEnabled
        mainnet
        wrappedBaseTokenSymbol
        baseTokenSymbol
        baseTokenAddress
        defaultPairAddress
        defaultPairQuoteToken
        stableCoinAddresses
        networkIconUrl
        color
        networkShortName
        networkName
        explorer {
          name
          url
          checksummed
          icon
        }
      }
      ... on SuiNetworkConfig {
        __typename
        # --- Common fields
        id
        networkType
        networkId
        name
        enabled
        newTokensEnabled
        mainnet
        wrappedBaseTokenSymbol
        baseTokenSymbol
        baseTokenAddress
        defaultPairAddress
        defaultPairQuoteToken
        stableCoinAddresses
        networkIconUrl
        color
        networkShortName
        networkName
        explorer {
          name
          url
          checksummed
          icon
        }
      }
      ... on AptosNetworkConfig {
        __typename
        # --- Common fields
        id
        networkType
        networkId
        name
        enabled
        newTokensEnabled
        mainnet
        wrappedBaseTokenSymbol
        baseTokenSymbol
        baseTokenAddress
        defaultPairAddress
        defaultPairQuoteToken
        stableCoinAddresses
        networkIconUrl
        color
        networkShortName
        networkName
        explorer {
          name
          url
          checksummed
          icon
        }
      }
      ... on StarknetNetworkConfig {
        __typename
        # --- Common fields
        id
        networkType
        networkId
        name
        enabled
        newTokensEnabled
        mainnet
        wrappedBaseTokenSymbol
        baseTokenSymbol
        baseTokenAddress
        defaultPairAddress
        defaultPairQuoteToken
        stableCoinAddresses
        networkIconUrl
        color
        networkShortName
        networkName
        explorer {
          name
          url
          checksummed
          icon
        }
      }
    }
  }
`;

const getTokensQuery = gql`
  query getTokens($tokens: [String!]!) {
    filterTokens(tokens: $tokens) {
      results {
        token {
          name
          id
          decimals
        }
      }
    }
  }
`;

const EXCLUDED_NETWORK_IDS = [
  150607357, // FOGO
  6343, // megaeth
  143, // monad
];

async function main() {
  // eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
  const data = await sdk.query<{ getNetworkConfigs: any }, {}>(
    getNetworkConfigsQuery,
  );
  const networkConfigs = data.getNetworkConfigs.filter(
    (config: { networkId: number }) =>
      !EXCLUDED_NETWORK_IDS.includes(config.networkId),
  );

  // Get all base token addresses with their network IDs
  const tokenIds: string[] = networkConfigs.map(
    (config: { baseTokenAddress: string; networkId: number }) =>
      `${config.baseTokenAddress}:${config.networkId}`,
  );

  // Fetch base token names
  const tokenData = await sdk.query<
    {
      filterTokens: {
        results: {
          token: { id: string; name: string; decimals: number };
        }[];
      };
    },
    { tokens: string[] }
  >(getTokensQuery, {
    tokens: tokenIds,
  });

  // Create a map of address:networkId -> name
  const tokenNameMap = new Map(
    tokenData.filterTokens.results
      .filter((result) => result !== null)
      .map((result) => [result.token.id, result.token.name]),
  );
  // Create a map of address:networkId -> decimals
  const tokenDecimalsMap = new Map(
    tokenData.filterTokens.results
      .filter((result) => result !== null)
      .map((result) => [result.token.id, result.token.decimals]),
  );

  // Add baseTokenName to each network config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedConfigs = networkConfigs
    .map((config: any) => ({
      ...config,
      baseTokenName:
        tokenNameMap.get(`${config.baseTokenAddress}:${config.networkId}`) ||
        config.baseTokenSymbol,
      baseTokenDecimals:
        tokenDecimalsMap.get(
          `${config.baseTokenAddress}:${config.networkId}`,
        ) || config.baseTokenDecimals,
    }))
    .sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name),
    );
  console.log(
    `Fetched ${networkConfigs.length} network configs, writing them to generated files`,
  );

  const filePath = path.resolve(__dirname, "../resources/networkConfigs.json");

  // Ensure the directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(enrichedConfigs, null, 2));
}

main().catch(console.error);
