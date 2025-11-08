import { Codex } from "@codex-data/sdk";
import React from "react";
import NetworkList from "@/components/NetworkList"; // Import the new client component

// Define the Network type for data fetched on the server
type Network = {
  id: number;
  name: string;
};

// Define the names for the "Top" networks in the desired order
const topNetworkNames = [
  "Solana",
  "Ethereum",
  "BNB Chain", // Assuming API returns "BNB", adjust if it's different (e.g., "BNB Smart Chain")
  "Base",
  "Arbitrum",
  "Unichain", // Check if this name matches API exactly
  "Sui",
  "Tron",
  "Polygon",
  "Sonic", // Check if this name matches API exactly
  "Aptos"
];

// Keep this as an async Server Component
export default async function Home() {
  // Fetch data on the server using NEXT_PUBLIC_CODEX_API_KEY
  const apiKey = process.env.NEXT_PUBLIC_CODEX_API_KEY;

  let allNetworks: Network[] = [];
  let error: string | null = null;

  // Only attempt to fetch if API key exists
  if (apiKey) {
    try {
      const codexClient = new Codex(apiKey);
      const result = await codexClient.queries.getNetworks({});
      // Ensure we have an array, even if result.getNetworks is null/undefined
      allNetworks = result.getNetworks?.filter(net => net != null) as Network[] || [];
    } catch (err) {
      console.error("Error fetching networks on server:", err);
      error = "Failed to load networks.";
    }
  } else {
    console.warn("NEXT_PUBLIC_CODEX_API_KEY environment variable is not set. Using demo data.");
    error = "API key not configured. Please set NEXT_PUBLIC_CODEX_API_KEY environment variable.";
  }

  // Partition the networks
  const topNetworksMap = new Map<string, Network>();
  const restNetworks: Network[] = [];

  allNetworks.forEach(network => {
    if (topNetworkNames.includes(network.name)) {
      topNetworksMap.set(network.name, network);
    } else {
      restNetworks.push(network);
    }
  });

  // Create the topNetworks array in the desired order
  const topNetworks = topNetworkNames
    .map(name => topNetworksMap.get(name))
    .filter((network): network is Network => network !== undefined);

  // Sort the networks alphabetically by name
  restNetworks.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="flex min-h-screen flex-col p-12 md:p-24">
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center">Tokedex</h1>
        <p className="text-lg text-center mb-8">
          Welcome to Tokedex! Your terminal-inspired crypto token screener.
          <br />
          Discover, analyze, and track tokens across various networks.
        </p>
      </div>

      <div className="w-full max-w-md mx-auto flex-grow flex flex-col">
        <NetworkList
          topNetworks={topNetworks}
          restNetworks={restNetworks}
          initialError={error}
        />
      </div>

      {/* More content can go here */}
    </main>
  );
}
