import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RadioApp from "./RadioApp";
import "./radio-app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RadioApp />
  </StrictMode>,
);
