import React from "react";
import {AppErrorBoundary} from "./PageStates";
import {LanguageProvider} from "./i18n";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./design-tokens.css";
import "./styles.css";
import "./elevation.css";
import "./controls.css";

createRoot(document.getElementById("root")).render(
  <LanguageProvider><AppErrorBoundary><App /></AppErrorBoundary></LanguageProvider>,
);
