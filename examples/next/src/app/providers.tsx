'use client';

import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { AnonymousSessionProvider } from '../components/AnonymousSessionProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // You can add other client-side providers here if needed (e.g., ThemeProvider, QueryClientProvider)
  return <SessionProvider>
          <AnonymousSessionProvider />

    {children}
    </SessionProvider>;
}