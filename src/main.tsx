import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
const Admin = lazy(() => import("./Admin"));
const adminRoute = /^\/admin(?:\/|$)/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {adminRoute ? (
      <Suspense
        fallback={
          <p className="admin-loading" role="status">
            Carregando painel…
          </p>
        }
      >
        <Admin />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
