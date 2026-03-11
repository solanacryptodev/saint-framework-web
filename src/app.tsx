import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, createSignal, createEffect } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import Nav from "~/components/Nav";
import "./app.css";

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

export default function App() {
  return (
    <Router
      root={props => (
        <Suspense>
          <NavWrapper>{props.children}</NavWrapper>
        </Suspense>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
