import "dotenv/config";

import chalk from "chalk";
import * as fs from "fs";
import { gql } from "graphql-tag";
import ora from "ora";
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

const EXCLUDED_NETWORK_IDS = [150607357, 6343, 143];

async function main() {
  const brand = chalk.hex("#EAFE77");
  console.log(brand.bold("\n🌐 Generating Network Configs\n"));

  if (!apiKey) {
    console.error(chalk.red("❌ CODEX_API_KEY env variable not found"));
    throw new Error("CODEX_API_KEY env variable not found");
  }

  // eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
  const fetchSpinner = ora("Fetching network configs").start();
  const data = await sdk.query<{ getNetworkConfigs: any }, object>(
    getNetworkConfigsQuery,
  );
  const networkConfigs = data.getNetworkConfigs.filter(
    (config: { networkId: number }) =>
      !EXCLUDED_NETWORK_IDS.includes(config.networkId),
  );
  fetchSpinner.succeed(
    `Fetched ${brand(networkConfigs.length)} network configs`,
  );

  // Get all base token addresses with their network IDs
  const tokenSpinner = ora("Preparing token IDs").start();
  const tokenIds: string[] = networkConfigs.map(
    (config: { baseTokenAddress: string; networkId: number }) =>
      `${config.baseTokenAddress}:${config.networkId}`,
  );
  tokenSpinner.succeed(`Prepared ${brand(tokenIds.length)} token IDs`);

  // Fetch base token names
  const tokenDataSpinner = ora("Fetching base token metadata").start();
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
  tokenDataSpinner.succeed(
    `Fetched metadata for ${brand(tokenData.filterTokens.results.length)} tokens`,
  );

  // Create a map of address:networkId -> name
  const enrichSpinner = ora("Enriching network configs").start();
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
  enrichSpinner.succeed(
    `Enriched ${brand(enrichedConfigs.length)} network configs`,
  );

  const writeSpinner = ora("Writing to file").start();
  const filePath = path.resolve(__dirname, "../resources/networkConfigs.json");

  // Ensure the directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(enrichedConfigs, null, 2));
  writeSpinner.succeed(
    `Wrote network configs to ${brand("networkConfigs.json")}`,
  );

  console.log(brand.bold("\n✅ Network configs generation complete!\n"));

  // Show summary
  const mainnetCount = enrichedConfigs.filter((c: any) => c.mainnet).length;
  const testnetCount = enrichedConfigs.length - mainnetCount;
  console.log(chalk.dim(`  Networks: ${brand(enrichedConfigs.length)} total`));
  console.log(
    chalk.dim(`    ${chalk.green("●")} ${brand(mainnetCount)} mainnet`),
  );
  console.log(
    chalk.dim(`    ${chalk.yellow("●")} ${brand(testnetCount)} testnet\n`),
  );
}

main().catch(console.error);
