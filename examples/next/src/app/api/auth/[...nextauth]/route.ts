import NextAuth from "next-auth"
import { authOptions } from "../../../../lib/auth" // Use correct relative path to rule out alias issues

let handler;

try {
  handler = NextAuth(authOptions);
} catch (error) {
  console.error("--- [...nextauth]/route.ts --- ERROR initializing NextAuth handler:", error);
}

export { handler as GET, handler as POST }