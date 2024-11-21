import { Codex } from "@codex-data/sdk";

export const sdk = new Codex(process.env.NEXT_PUBLIC_CODEX_API_KEY as string);
