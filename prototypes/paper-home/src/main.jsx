import React from "react";
import {AppErrorBoundary} from "./PageStates";
import {LanguageProvider,loadLanguage} from "./i18n";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./design-tokens.css";
import "./styles.css";
import "./elevation.css";
import "./controls.css";

// If the English catalogue cannot load, the Finnish source text still works.
loadLanguage().catch(()=>{}).then(()=>createRoot(document.getElementById("root")).render(
  <LanguageProvider><AppErrorBoundary><App /></AppErrorBoundary></LanguageProvider>,
));
