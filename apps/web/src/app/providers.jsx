import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/queryClient";

import { AuthProvider } from "./AuthProvider";

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        {/* Success toasts ~6 s; error toasts pass duration: Infinity (UI_GUIDELINES §3). */}
        <Toaster position="top-right" closeButton duration={6000} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
