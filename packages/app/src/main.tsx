import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { AppShell } from "@/app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
