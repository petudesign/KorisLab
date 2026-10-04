import { defineArrayMember, defineField, defineType } from "sanity";

export const analysisArticle = defineType({
  name: "analysisArticle",
  title: "Analyysi",
  type: "document",
  groups: [
    { name: "story", title: "Juttu", default: true },
    { name: "classification", title: "Sarja ja kausi" },
    { name: "publishing", title: "Julkaisu" },
  ],
  orderings: [{ title: "Julkaisupäivä, uusin ensin", name: "publishedAtDesc", by: [{ field: "publishedAt", direction: "desc" }] }],
  fields: [
    defineField({ name: "title", title: "Otsikko", type: "string", group: "story", description: "Muotoile kiinnostava havainto tai kysymys.", validation: (rule) => rule.required().max(110) }),
    defineField({
      name: "slug", title: "Osoitteen tunniste", type: "slug", group: "publishing",
      options: { source: "title", maxLength: 96, slugify: (input) => input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96) },
      validation: (rule) => rule.required().custom((value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.current ?? "") ? true : "Käytä pienaakkosia, numeroita ja väliviivoja."),
    }),
    defineField({ name: "standfirst", title: "Ingressi", description: "Näkyy juttulistauksessa, artikkelin alussa ja jakokortissa.", type: "text", rows: 3, group: "story", validation: (rule) => rule.required().max(260) }),
    defineField({ name: "category", title: "Juttutyyppi", type: "string", group: "classification", options: { list: ["Otteluanalyysi", "Kausivertailu", "Joukkue", "Pelaaja", "Ilmiö"] }, validation: (rule) => rule.required() }),
    defineField({ name: "league", title: "Sarja", type: "string", group: "classification", options: { list: [{ title: "Naisten Korisliiga", value: "naisten-korisliiga" }, { title: "Korisliiga", value: "korisliiga" }], layout: "radio" }, initialValue: "naisten-korisliiga", validation: (rule) => rule.required() }),
    defineField({ name: "season", title: "Kausi", type: "string", group: "classification", options: { list: [{ title: "2026–27", value: "2026-27" }, { title: "2025–26", value: "2025-26" }, { title: "2024–25", value: "2024-25" }], layout: "dropdown" }, initialValue: "2026-27", validation: (rule) => rule.required() }),
    defineField({ name: "publishedAt", title: "Julkaisupäivä", type: "datetime", group: "publishing", initialValue: () => new Date().toISOString(), validation: (rule) => rule.required() }),
    defineField({ name: "readingMinutes", title: "Lukuaika (min)", type: "number", group: "publishing", initialValue: 4, validation: (rule) => rule.required().integer().min(1).max(60) }),
    defineField({ name: "coverImage", title: "Kansikuva", type: "image", group: "story", options: { hotspot: true } }),
    defineField({ name: "coverImageAlt", title: "Kansikuvan vaihtoehtoinen teksti", type: "string", group: "story", description: "Jätä tyhjäksi vain, jos kuva on koristeellinen." }),
    defineField({
      name: "body", title: "Jutun sisältö", description: "Rakenna havainto, vertailu ja johtopäätös. Lisää kaavio suoraan tekstin väliin.", type: "array", group: "story",
      of: [
        defineArrayMember({
          type: "block",
          styles: [{ title: "Leipäteksti", value: "normal" }, { title: "Väliotsikko", value: "h2" }, { title: "Pieni väliotsikko", value: "h3" }, { title: "Lainaus", value: "blockquote" }],
          lists: [{ title: "Luettelomerkit", value: "bullet" }, { title: "Numeroitu lista", value: "number" }],
          marks: {
            decorators: [{ title: "Lihavointi", value: "strong" }, { title: "Kursiivi", value: "em" }, { title: "Koodi", value: "code" }],
            annotations: [defineArrayMember({ name: "link", title: "Linkki", type: "object", fields: [defineField({ name: "href", title: "Osoite", type: "url", validation: (rule) => rule.required().uri({ scheme: ["http", "https", "mailto"] }) })] })],
          },
        }),
        defineArrayMember({ type: "image", fields: [defineField({ name: "alt", title: "Vaihtoehtoinen teksti", type: "string", validation: (rule) => rule.required() })] }),
        defineArrayMember({
          name: "matchQuarterChart", title: "Ottelun pistediagrammi", type: "object",
          fields: [
            defineField({ name: "matchId", title: "Ottelun ID", type: "string", description: "KorisLabin ottelusivun ID, esimerkiksi 968948.", validation: (rule) => rule.required().regex(/^\d+$/) }),
            defineField({ name: "title", title: "Kaavion otsikko", type: "string" }),
            defineField({ name: "caption", title: "Lähde tai selite", type: "text", rows: 2 }),
          ],
          preview: { select: { title: "title", matchId: "matchId" }, prepare: ({ title, matchId }) => ({ title: title || "Pisteet neljänneksittäin", subtitle: `Varmennettu ottelu · #${matchId ?? "—"}` }) },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({ name: "sourceNote", title: "Aineisto ja rajaukset", type: "text", rows: 3, group: "story", description: "Näytetään jutun lopussa. Kerro lähde ja olennainen rajoite.", validation: (rule) => rule.required() }),
  ],
  preview: { select: { title: "title", subtitle: "standfirst", media: "coverImage" } },
});
