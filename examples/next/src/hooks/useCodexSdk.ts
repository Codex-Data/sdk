'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Codex } from '@codex-data/sdk'; // Adjust this import path if necessary

// Store the previous token value outside the component rendering lifecycle
// This helps avoid unnecessary SDK re-initializations if the session object reference changes but the token value remains the same.
let previousTokenValue: string | undefined = undefined;

export function useCodexSdk() {
  const { data: session, status } = useSession();
  const [sdkInstance, setSdkInstance] = useState<Codex | null>(null);

  const tokenValue = session?.shortLivedToken?.value;
  const tokenExpiresAt = session?.shortLivedToken?.expiresAt;

  useEffect(() => {
    if (status === 'authenticated' && tokenValue) {
      // Only create a new instance if the token value has actually changed since the last successful creation.
      if (tokenValue !== previousTokenValue) {
          console.log('Token value changed. Creating new Codex instance with token:', tokenValue.substring(0, 10) + '...'); // Log prefix for security
          setSdkInstance(new Codex(tokenValue)); // Pass token directly
          previousTokenValue = tokenValue; // Update the stored previous token
      } else if (!sdkInstance) {
           // Handle case where component re-mounts but token is the same - re-initialize if needed
           console.log('Re-initializing Codex instance with existing token value.');
           setSdkInstance(new Codex(tokenValue));
      }
    } else if (status !== 'loading') {
      // If not authenticated or no token, ensure SDK instance is cleared
      console.log('Session status:', status, 'Clearing SDK instance.');
      setSdkInstance(null);
      previousTokenValue = undefined; // Clear previous token when unauthenticated
    }
    // Depend only on status and tokenValue. If the session object reference changes
    // but tokenValue remains the same, this effect won't re-run unnecessarily.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tokenValue]); // sdkInstance removed from dependency array

  return {
      sdk: sdkInstance,
      isLoading: status === 'loading' || (status === 'authenticated' && !sdkInstance),
      isAuthenticated: status === 'authenticated' && !!sdkInstance,
      tokenExpiresAt: tokenExpiresAt
  };
}