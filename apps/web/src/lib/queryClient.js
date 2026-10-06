import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./apiClient";

// 4xx answers are final (validation, permission, not found); retry only network/server errors, twice.
const isClientError = (error) => error instanceof ApiError && error.status >= 400 && error.status < 500;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
