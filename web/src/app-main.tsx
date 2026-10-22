import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./i18n";
import { SeasonProvider } from "./SeasonContext";

export function mountApp(element: HTMLElement) {
  const root: Root = createRoot(element);
  root.render(
    <StrictMode>
      <LanguageProvider>
        <SeasonProvider><App /></SeasonProvider>
      </LanguageProvider>
    </StrictMode>,
  );
}
