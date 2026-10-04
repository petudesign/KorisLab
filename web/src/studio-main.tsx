import { createRoot } from "react-dom/client";
import { Studio } from "sanity";
import { sanityConfig } from "./sanity.config";
import "./studio.css";

function MissingSanityConfiguration() {
  return <main className="studio-setup-message" lang="fi">
    <span>KORISLAB · JULKAISUJÄRJESTELMÄ</span>
    <h1>CMS-yhteys ei ole vielä määritetty.</h1>
    <p>Lisää Sanity-projektin tunniste ja dataset projektin ympäristömuuttujiin. Ohje löytyy tiedostosta <code>docs/analyses-cms.md</code>.</p>
    <a href="/analyysit/">Palaa Analyyseihin</a>
  </main>;
}

export function mountSanityStudio(element: HTMLElement) {
  document.title = "KorisLab CMS";
  document.documentElement.lang = "fi";
  document.documentElement.classList.add("sanity-studio-route");
  const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.head.appendChild(Object.assign(document.createElement("meta"), { name: "robots" }));
  robots.content = "noindex,nofollow";
  createRoot(element).render(sanityConfig ? <Studio config={sanityConfig} /> : <MissingSanityConfiguration />);
}
