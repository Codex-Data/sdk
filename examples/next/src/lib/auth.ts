import CredentialsProvider from "next-auth/providers/credentials";
import { type NextAuthOptions, type DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { sdk } from "./sdk";
import { CreateApiTokensMutation } from "@codex-data/sdk/dist/sdk/generated/graphql";

// --- Short-Lived Token Config ---
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

// --- Short-Lived Token Interface ---
interface ShortLivedToken {
  value: string;
  expiresAt: number;
}

// --- Type Augmentations ---
declare module "next-auth/jwt" {
  interface JWT {
    shortLivedToken?: ShortLivedToken;
    id?: string; // Keep existing ID property
    // isGuest?: boolean; // Can add if needed
  }
}

declare module "next-auth" {
  // Augment User to include id and potentially isGuest
  interface User {
    id: string; // Ensure id is present
    isGuest?: boolean;
  }
  // Augment Session
  interface Session {
    shortLivedToken?: ShortLivedToken;
    user: {
      id?: string | null; // Keep this structure
      isGuest?: boolean | null;
    } & DefaultSession["user"]; // Use DefaultSession here
  }
}

// --- Refresh Function ---
async function refreshShortLivedToken(token: JWT): Promise<JWT> {
  const now = Date.now();

  if (token.shortLivedToken && token.shortLivedToken.expiresAt > now + REFRESH_BUFFER_MS) {
    console.log("[refreshShortLivedToken] Using existing token.");
    return token;
  }

  console.log("[refreshShortLivedToken] Generating new token...");
  try {
    const result: CreateApiTokensMutation = await sdk.mutations.createApiTokens({
      input: { expiresIn: TOKEN_EXPIRY_MS  },
    });

    if (!result.createApiTokens || !Array.isArray(result.createApiTokens) || result.createApiTokens.length === 0 || !result.createApiTokens[0]?.token) {
      console.error("[refreshShortLivedToken] Failed to obtain valid token string from mutation:", result);
      delete token.shortLivedToken;
      return token;
    }

    const apiToken = result.createApiTokens[0];
    token.shortLivedToken = {
      value: `Bearer ${apiToken.token}`,
      expiresAt: now + TOKEN_EXPIRY_MS,
    };
    console.log("[refreshShortLivedToken] Successfully refreshed token in JWT object.");

  } catch (error) {
    console.error("[refreshShortLivedToken] Error calling mutation:", error);
    delete token.shortLivedToken;
  }
  console.log("[refreshShortLivedToken] Returning token object:", JSON.stringify(token));
  return token;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Anonymous",
      credentials: {},
      async authorize() {
        return {
          id: crypto.randomUUID(),
          name: "Guest",
          email: null,
          isGuest: true,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // token.isGuest = user.isGuest;
      }
      const updatedToken = await refreshShortLivedToken(token);
      return updatedToken;
    },
    async session({ session, token }) {
      // Transfer short-lived token
      session.shortLivedToken = token.shortLivedToken;

      // Transfer user ID (ensure user object exists)
      if (token.id && session.user) {
        session.user.id = token.id;
      }
      return session;
    },
  },
};