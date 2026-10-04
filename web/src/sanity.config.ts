import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { analysisArticle } from "./sanity/schemaTypes/analysisArticle";

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID?.trim();
const dataset = import.meta.env.VITE_SANITY_DATASET?.trim() || "production";

export const sanityConfig = projectId ? defineConfig({
  name: "korislab",
  title: "KorisLab · Analyysit",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [structureTool()],
  schema: { types: [analysisArticle] },
}) : null;
