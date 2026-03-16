import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { AuthProvider } from "~/libs/AuthProvider";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { useLocation } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";
import Nav from "~/components/Nav";
import Footer from "~/components/Footer";
import PageTitle from "~/components/PageTitle";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,    // 30s before background refetch
      gcTime: 1000 * 60 * 5, // 5min in cache after unmount
      retry: 1,
    },
  },
});

// Nav visibility wrapper component that can use router hooks
function NavWrapper(props: { children: any }) {
  const location = useLocation();

  const shouldShowNav = () => {
    const pathname = location.pathname;
    // Match /play/game/[gameTitle]/play pattern
    const playGameMatch = pathname.match(/^\/play\/game\/[^/]+\/play$/);
    return !playGameMatch;
  };

  return (
    <>
      {shouldShowNav() && <Nav />}
      {props.children}
    </>
  );
}

// Footer visibility wrapper component that can use router hooks
function FooterWrapper(props: { children: any }) {
  const location = useLocation();

  const shouldShowFooter = () => {
    const pathname = location.pathname;
    // Match /play/game/[gameTitle]/play pattern
    const playGameMatch = pathname.match(/^\/play\/game\/[^/]+\/play$/);
    return !playGameMatch;
  };

  return (
    <>
      {props.children}
      {shouldShowFooter() && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MetaProvider>
          <Router
            root={props => (
              <Suspense>
                <PageTitle />
                <NavWrapper>
                  <FooterWrapper>{props.children}</FooterWrapper>
                </NavWrapper>
              </Suspense>
            )}
          >
            <FileRoutes />
          </Router>
        </MetaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
