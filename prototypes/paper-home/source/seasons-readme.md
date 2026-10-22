# Sarja- ja kausiaineistot

seasons.json sisältää projektin kuuden runkosarja-aineiston aggregaatit, yhteenvetotiedot ja neljä viimeistä tiedostossa olevaa ottelua. Lähdetiedoston polku ja mahdollinen päivitysaika on tallennettu kuhunkin aineistoon. Otteluvalikoima ei ole reaaliaikainen otteluohjelma.

2024–25 naiset: 129 tilastoitua ottelua (130 pyydettyä, yksi puuttuu).
2024–25 miehet: 191 tilastoitua ottelua.
2025–26 naiset: 108 tilastoitua ottelua.
2025–26 miehet: 192 tilastoitua ottelua.
2026–27: kopio alkuperäisen sovelluksen tallennetusta kausitilannekuvasta; määrä ja päivitysaika näytetään valitsimessa.

Puuttuville seuratunnuksille käytetään nimikirjaimia; miesten sarjavalitsin on toistaiseksi tekstimuotoinen, ei virallinen logotiedosto.

Ottelulista ja ottelun analyysi käyttävät public/data/{sarja}-{kausi}-matches.json-tiedostoja. Generointi: scripts/build-match-data.py; lähde on kunkin tilannekuvan sourceFile. Pelaajatilastot ja neljänneksittäiset pisteet kopioidaan lähteestä. Historiallisen naisten 2025–26 kauden päivät tulevat schedule.ts:stä. Tapahtumalokeja tai heittokoordinaatteja ei sisällytetä tähän vientiin.
