"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "../src/components/AuthProvider";
import { DocumentLocale } from "../src/components/DocumentLocale";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DocumentLocale />
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
