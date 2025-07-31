import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";

export function AnonymousSessionProvider() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("credentials", { redirect: false });
    }
  }, [status]);

  return null;
}