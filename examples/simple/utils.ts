import { Codex } from "@codex-data/sdk";

/**
 * Creates a Codex SDK instance with proper API key validation
 * @returns Configured Codex SDK instance
 * @throws Exits process if API key is not provided
 */
export function createCodexClient(): Codex {
  const apiKey = process.env.CODEX_API_KEY;

  if (!apiKey) {
    console.error("❌ CODEX_API_KEY environment variable is required!");
    console.log("💡 Set it with: export CODEX_API_KEY='your_api_key_here'");
    console.log("🔗 Get your API key at: https://docs.codex.io");
    process.exit(1);
  }

  return new Codex(apiKey);
}
