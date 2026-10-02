import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { LanguageProvider } from "./i18n";
import { SeasonProvider } from "./SeasonContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <SeasonProvider><App /></SeasonProvider>
    </LanguageProvider>
  </StrictMode>,
);
