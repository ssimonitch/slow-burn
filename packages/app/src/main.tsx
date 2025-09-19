import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { AppProviders, AppShell } from "@/app";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Hydration root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <AppShell />
    </AppProviders>
  </StrictMode>,
);
