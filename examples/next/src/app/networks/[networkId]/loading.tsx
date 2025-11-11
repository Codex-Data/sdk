import React from "react";
import { GlitchText } from "@/components/GlitchText";

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
      {/* Mimic the title/back link layout */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-muted-foreground">
          <GlitchText text="Loading Network..." />
        </h1>
        <span className="text-muted-foreground">&lt; Back to Networks</span>
      </div>

      <div className="w-full max-w-4xl">
        <p className="text-muted-foreground">Fetching token data...</p>
        {/* Optional: Add a skeleton loader for the table here */}
      </div>
    </main>
  );
}
