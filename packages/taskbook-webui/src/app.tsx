import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth";
import { BoardPage } from "./routes/board";
import { LoginPage } from "./routes/login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function Router() {
  const { isAuthenticated } = useAuth();

  // Simple hash-based routing for login callback
  const path = window.location.pathname;

  if (path === "/login" || !isAuthenticated) {
    return <LoginPage />;
  }

  return <BoardPage />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryClientProvider>
  );
}
