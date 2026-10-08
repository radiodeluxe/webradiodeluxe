import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./motion.css";
import { LoadingState } from "./Motion";
const Admin = lazy(() => import("./Admin"));
const adminRoute = /^\/admin(?:\/|$)/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {adminRoute ? (
      <Suspense
        fallback={<LoadingState fullscreen label="Carregando painel…" />}
      >
        <Admin />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
