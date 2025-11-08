"use client";

import React from "react"; // Removed useState
import Link from "next/link";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Keep Network type
type Network = {
  id: number;
  name: string;
};

// Update props to accept partitioned lists
interface NetworkListProps {
  topNetworks: Network[];
  restNetworks: Network[];
  initialError: string | null;
}

export default function NetworkList({
  topNetworks,
  restNetworks,
  initialError,
}: NetworkListProps) {
  // If there's an initial error, display it instead of the command list
  if (initialError) {
    return (
      <div className="w-full h-full border border-border p-4 flex flex-col items-center justify-center">
        <p className="text-destructive">{initialError}</p>
      </div>
    );
  }

  // If no networks loaded at all (e.g., API issue but no specific error string)
  if (topNetworks.length === 0 && restNetworks.length === 0) {
    return (
      <div className="w-full h-full border border-border p-4 flex flex-col items-center justify-center">
        <p>No networks available.</p>
      </div>
    );
  }

  return (
    // Command component takes full height and uses flex column layout internally
    <Command className="border h-full">
      <CommandInput placeholder="Search networks..." />
      <CommandList className="h-full">
        {" "}
        {/* Ensure list itself can take height */}
        <CommandEmpty>No networks found.</CommandEmpty>
        {/* Top Networks Group */}
        {topNetworks.length > 0 && (
          <CommandGroup heading="Top">
            {topNetworks.map((network) => (
              <Link href={`/networks/${network.id}`} key={network.id} passHref>
                <CommandItem
                  value={network.name} // Value used for searching/filtering
                  className="cursor-pointer" // Make it look clickable
                >
                  {network.name}
                </CommandItem>
              </Link>
            ))}
          </CommandGroup>
        )}
        {/* Rest Networks Group */}
        {restNetworks.length > 0 && (
          <CommandGroup heading="Rest">
            {restNetworks.map((network) => (
              <Link href={`/networks/${network.id}`} key={network.id} passHref>
                <CommandItem
                  value={network.name} // Value used for searching/filtering
                  className="cursor-pointer" // Make it look clickable
                >
                  {network.name}
                </CommandItem>
              </Link>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
