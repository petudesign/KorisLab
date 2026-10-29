# KorisLab

Suomalaisen koripallon tilastot ja analyysit Naisten Korisliigasta ja Korisliigasta. Sivusto: **https://korislab.vercel.app**

KorisLab hakee Basket.fi:n julkiset ottelutiedot, tarkistaa ne virallisia pöytäkirjoja vasten ja julkaisee niistä selattavan analyysisivuston. Mukana on myös Sim Studio, joka simuloi tulevat ottelut pelaajatasolla.

## Rakenne

| Kansio | Sisältö |
| --- | --- |
| `prototypes/paper-home/` | **Sivusto** (React + Vite). Tämä julkaistaan Verceliin. |
| `ingestion/` | Basket.fi-asiakkaat ja julkaisuskriptit (kausi, heittokartat, pelitapahtumat, syötöt, on/off, hallinnat) |
| `normalization/` | Lähdedatan muunnos KorisLabin skeemaan (pöytäkirjat, pelitapahtumat, kentälliset, hallinnat, peliajat) |
| `validation/` | Datan laatutarkistukset |
| `analytics/` | Deterministiset mittarit ja kausikoosteet |
| `simulation/` | Pelaajatason ottelusimulaattori ja Sim Studion simulaatiopakettien vienti |
| `learning/forecasting/` | Ennustekokeet (Elo, piste-eromalli, simulaattorit) ja niiden lukitut tulokset |
| `data/normalized/` | Tarkistetut kausiaineistot |
| `data/history/` | Aiempien kausien pakatut hallinnat simulaattorin historiaksi |
| `web/` | Alkuperäinen käyttöliittymä. Käytöstä poistuva; `web/public/` toimii vielä datan välivarastona. |
| `docs/` | Menetelmä-, lähde- ja case-muistiinpanot |
| `motion/` | Casen video- ja animaatiomateriaali |
| `tests/` | Python-testit (standardikirjasto) |

## Datan päivitys

GitHub Actions -työ [`update-season.yml`](.github/workflows/update-season.yml) ajetaan otteluiltoina puolen tunnin välein (klo 12–23 Suomen aikaa) ja tarvittaessa käsin. Se:

1. ajaa testit
2. hakee molempien sarjojen nykykauden ohjelman, pöytäkirjat, heittokartat ja pelitapahtumat (`ingestion.publish_season`)
3. ajaa tulevien otteluiden simulaatiot (`simulation.refresh`)
4. synkronoi datan sivustolle (`prototypes/paper-home/scripts/sync-data.py`)
5. rakentaa ja testaa sivuston
6. commitoi muuttuneen datan `main`-haaraan.

Vercel julkaisee jokaisen `main`-haaran muutoksen automaattisesti. Pull requesteista syntyy esikatseluversio.

Saman voi ajaa paikallisesti:

```bash
python -m ingestion.publish_season
```

```bash
python -m ingestion.publish_season --category-id 4 --group-id 303022 --out web/public/korisliiga/season-2026-27.json
```

```bash
python -m simulation.refresh
```

```bash
python prototypes/paper-home/scripts/sync-data.py
```

Ensimmäinen komento hakee Naisten Korisliigan ja toinen Korisliigan. Haku on hidas tarkoituksella, koska jokaisen ottelun välillä on sekunnin viive. Raakadata tallentuu `data/cache/`-kansioon, jota ei commitoida.

Aiempien kausien aineistot haetaan uudelleen samalla adapterilla, esimerkiksi:

```bash
python -m ingestion.publish_historical_season --competition-id huki2526 --category-id 4 --regular-groups 39344 302807 302808 --playoff-groups 302880 --regular-out data/normalized/season_korisliiga_2025_2026.json --playoff-out data/normalized/season_korisliiga_playoffs_2025_2026.json
```

## Sivuston kehitys

Vaatii Node 22.18+ ja pnpm.

```bash
cd prototypes/paper-home && pnpm install && pnpm dev
```

```bash
cd prototypes/paper-home && pnpm build && pnpm test
```

Sivuston käyttöliittymälinjaukset ja design-päätökset ovat tiedostossa [`prototypes/paper-home/AGENTS.md`](prototypes/paper-home/AGENTS.md), ja design system tiedostossa [`DESIGN-SYSTEM.md`](prototypes/paper-home/DESIGN-SYSTEM.md).

## Testit

```bash
python -m unittest discover -s tests -t .
```

```bash
cd learning/forecasting && python -m unittest discover -p 'test_*.py'
```

Python-koodi käyttää vain standardikirjastoa (Python 3.11+).

## Datan laatu

KorisLabin periaate on, että julkaistu luku on joko tarkistettu tai merkitty puuttuvaksi.

- **Pöytäkirjatäsmäytys:** ottelu hyväksytään tilastoihin vasta, kun sen tiedot täsmäävät viralliseen pöytäkirjaan. Pelitapahtumista johdettujen analyysien (neljännekset, syötöt, kentälliset, hallinnat) pitää täsmätä samaan pöytäkirjaan, muuten ottelu jätetään analyysin ulkopuolelle ja syy kirjataan.
- **Puuttuva ei ole nolla:** puuttuvat arvot näytetään viivana, eikä tulevan ottelun tulosta korvata nollalla.
- **Heittokartat:** heittokartta verrataan pöytäkirjan 2P- ja 3P-yrityksiin ja -osumiin. Jos tuoreen ottelun heittoloki on vielä jäljessä, kartta julkaistaan merkinnällä "Heittoloki poikkeaa box scoresta" ja haetaan uudelleen seuraavalla ajolla.
- **Kentälliset (on/off):** kentälliset lasketaan aloitusviisikoista ja vaihdoista. Pöytäkirjan peliminuutit ovat tarkistus, joka sallii 30 sekunnin eron pelaajaa kohden, ja pisteiden sekä plus/miinusten pitää täsmätä. Tämä on lähdelokin tulkinta, ei videolta vahvistettu kentällinen.
- **Peliaikojen korjaus:** osassa kauden 2025–26 lähdedataa minuutit oli tallennettu väärässä yksikössä. Ne palautettiin vaihtotapahtumista ([`docs/playing-time-repair-2026-10-21.md`](docs/playing-time-repair-2026-10-21.md)).
- **Tunnisteet:** pelaajat ja ottelut tunnistetaan lähteen tunnisteilla, ei nimillä.
- **Tunnettu puute:** kauden 2024–25 ottelun `929674` (Kouvot–Kobrat) lähteen pöytäkirja on puutteellinen, joten ottelu ei ole mukana tilastoissa.

Lähteen sisältö, käyttöehdot ja riskit on kuvattu tiedostossa [`DATA_AUDIT.md`](DATA_AUDIT.md).

## Sim Studio ja ennusteet

[Sim Studio](https://korislab.vercel.app/sim/) simuloi seuraavan kahden viikon ottelut 1 000 kertaa per ottelu. Ottelu pelataan hallinta kerrallaan oikeilla pelaajilla: data määrää, kuka toimii, mistä hän heittää, millä onnistumisella ja kenelle syöttää. Pienet otokset kutistetaan kohti sarjan keskitasoa.

Mallien luotettavuus mitataan ajallisesti oikeilla testeillä, eli ennuste tehdään vain sitä edeltäneellä datalla. Parametrit lukitaan ennen vertailua. Kaudella 2025–26 (161 ottelua) miesten simulaattorin Brier oli 0,2382, Elon 0,2386 ja lukitun piste-eromallin 0,2329. Simulaattori on siis hyvin kalibroitu, mutta ei vielä ennusta voittajaa muita paremmin. Kokeet, tulokset ja päätökset on kirjattu tiedostoon [`docs/forecasting-case-notes.md`](docs/forecasting-case-notes.md). Naisten Korisliigan samassa testissä (2025–26, 83 ottelua) simulaattorin Brier oli 0,210, Elon 0,203 ja naisten lukitun piste-eromallin 0,195.

Pelaajien liike kentällä on havainnollistus, joka perustuu pelaajien omiin heittopaikkoihin, ei seurantadataa. Oikea liike on tarkoitus tuoda myöhemmin [Vire](https://github.com/petudesign/Vire)-videoanalyysimoottorista.

## Työnhallinta

Jatkotyöt ovat Linearissa, KorisLab-tiimissä (`KOR`). Vireen liittyvät tiketit on merkitty Vire-labelilla.
