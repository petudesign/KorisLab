# KorisLab

## Sarjat ja kaudet

Yhteinen sarjavalinta sisältää **Naisten Korisliigan** ja **Korisliigan**. Sivupalkin sarjan nimi on avattava valinta ilman sarjamerkkiä. Mobiilissa sama valinta on sivun yläosassa. Liiga ja kausi rajaavat myös hakua, pelaajaprofiileja, heittokarttoja ja Matchup Labia. Miesten linkit käyttävät `league=korisliiga`-parametria; vanhat naisten linkit säilyvät toimivina. Liigaa vaihtamalla avoin pelaaja tai ottelu palautuu listaan, jotta edellisen sarjan valinta ei jää näkyviin.

Korisliigan tuotu aineisto:

| Kausi | Runko- ja jatkosarjat | Pudotuspelit |
| --- | --- | --- |
| 2024–25 | 191/192 tarkistettua ottelua | 28/28 |
| 2025–26 | 192/192 | 43/43 |
| 2026–27 | Otteluohjelma ja tarkistetut pelatut ottelut | Kertyvät myöhemmin |

Kauden 2024–25 ottelussa `929674` (Kouvot–Kobrat) lähteen box score on puutteellinen, joten sitä ei sisällytetä tilastoihin. Johdetut pelitapahtuma-analyysit tarkistetaan erikseen ja näyttävät oman kattavuutensa. Korisliigan julkiset kuvaaja-aineistot ovat hakemistossa `web/public/korisliiga/`; naisten aineiston polut säilyvät ennallaan. Paikalliset lähdevälimuistit eivät kuulu uusiin committeihin.

Historialliset kaudet voi tuoda uudelleen samalla adapterilla:

```powershell
python -m ingestion.publish_historical_season --competition-id 2024-2025 --category-id 4 --regular-groups 301583 302073 302074 --playoff-groups 302096 --regular-out data/normalized/season_korisliiga_2024_2025.json --playoff-out data/normalized/season_korisliiga_playoffs_2024_2025.json
python -m ingestion.publish_historical_season --competition-id huki2526 --category-id 4 --regular-groups 39344 302807 302808 --playoff-groups 302880 --regular-out data/normalized/season_korisliiga_2025_2026.json --playoff-out data/normalized/season_korisliiga_playoffs_2025_2026.json
python -m ingestion.publish_derived --season-file data/normalized/season_korisliiga_2024_2025.json --season-id 2024-25 --out-dir web/public/korisliiga
python -m ingestion.publish_derived --season-file data/normalized/season_korisliiga_2025_2026.json --season-id 2025-26 --out-dir web/public/korisliiga
```

Pudotuspelien kuvaajille käytetään vastaavaa `season_korisliiga_playoffs_…json`-tiedostoa ja `--season-id 2024-25-playoffs` tai `2025-26-playoffs`. Nykykauden molemmat sarjat päivitetään olemassa olevassa GitHub Actions -työssä; miesten paikallinen päivitys:

```powershell
python -m ingestion.publish_season --category-id 4 --group-id 303022 --out web/public/korisliiga/season-2026-27.json
cd web
pnpm check:leagues
```

Alla oleva alkuperäinen lähdeauditin kuvaus koskee projektin ensimmäistä naisten sarjan aineistoa.

KorisLab is a small, evidence-first data foundation for Finnish basketball analysis.

The current Phase 1 deliverable is intentionally narrow:

- document what the public Basket.fi/TorneoPal data exposes for the 2026–27 Women’s Korisliiga;
- normalize match, team, player, event, and shot records without making names the primary key;
- provide a runnable ingestion path and validation checks;
- keep shot-coordinate support separate because the current feed has not been verified to expose it.

See [DATA_AUDIT.md](DATA_AUDIT.md) for the source audit, current-season evidence, legal/operational risks, and the v0.1 recommendation.

## Quick start

The runtime uses Python’s standard library only.

```powershell
python -m ingestion.cli --competition-id huki2627 --category-id 1 --match-id 1006239 --out data/normalized/current_fixture_1006239.json
python -m ingestion.cli --competition-id huki2526 --category-id 1 --match-id 968948 --out data/normalized/historical_womens_match_968948.json
python -m ingestion.cli --statistics-match-id 968948 --out data/normalized/basketfi_statistics_968948.json
python -m ingestion.cli --season --competition-id huki2526 --category-id 1 --group-id 302291 --out data/normalized/season_2025_2026_schedule.json
python -m ingestion.cli --season-statistics --competition-id huki2526 --category-id 1 --group-id 302291 --limit 1 --out data/normalized/season_2025_2026_statistics_smoke.json
python -m ingestion.cli --fiba-match-id 2701885 --out data/normalized/fibalivestats_match_2701885.json
python -m unittest discover -s tests -v
```

The fixture command should produce an honest empty-stats result before tip-off. The match command is a completed Women’s Korisliiga match from the prior season. The FIBA command is a historical example used only to prove that structured shot coordinates existed in an older feed; it is not evidence that the current Women’s feed has the same capability.

The season command extracts a compact schedule snapshot. `--group-id 302291` limits the 2025–26 result to the 108-game regular season instead of including playoffs. It does not claim that schedule metadata contains the full player box score; that enrichment remains a separate statistics-page adapter.

The `--statistics-match-id` command now performs that enrichment: it resolves Torneo's public `match_external_id`, calls Basket.fi's embedded Sportradar fixture endpoint, and normalizes the full player/team box score. The adapter is read-only and source-specific; it intentionally does not infer shot coordinates or positions that the public response does not provide.

The `--season-statistics` command is the opt-in batch path. It first filters the Torneo schedule to played games, then hydrates each game through the same single-game adapter while preserving per-game failures. Use `--limit 1` for a smoke test and add a small `--delay-seconds` value before any larger run.

The API client sends the public request headers used by the existing [KorisAPI](https://github.com/apmnt/koris-api) project. Network calls are read-only. Do not commit raw payloads or personal data without confirming the source’s reuse terms.

## Local web app

### Kentällä / penkillä -vertailun menetelmä

Kenttäjaksot lasketaan aloitusviisikoista ja pelitapahtumalokin vaihdoista.
Box scoren peliminuutit ovat tarkistus, eivät kenttäjaksojen ajoituksen lähde.
Sallittu kokonaispeliajan ero on oletuksena 30 sekuntia pelaajaa ja ottelua kohti;
desimaaliminuuttien pyöristys huomioidaan ennen vertailua. Raja ei takaa yksittäisen
vaihdon ajoituksen tarkkuutta. Joukkueiden pistetilastojen ja pelaajien plus/miinusten
pitää edelleen täsmätä.

Saman pelikellon ajan tapahtumien lähdejärjestys säilytetään, koska esimerkiksi
vapaaheittojen välissä voi olla vaihto. Jos tapahtuman pelaaja on jo vaihtunut ulos,
sen kohdistukseen käytetään saman kellonajan aiempaa täydellistä kentällistä vain,
kun vaihtoehtoja on yksi. Epäselvä syöttö-, torjunta-, riisto- tai puolustuslevypallotieto
merkitään on/off-vertailussa puuttuvaksi (`null`, näkymässä —), eikä se yksin hylkää
muuten tarkistettua pistevertailua. Epäselvät heitto-, hyökkäyslevypallo- ja
menetystapahtumat hylkäävät edelleen ottelun. Menetelmä on lähdelokin tulkinta,
ei videolta vahvistettu kentällinen.

Julkaistu JSON sisältää menetelmän sekä hyväksyttyjen otteluiden diagnostiikan:
uudelleen kohdistetut tapahtumat, yli kahden sekunnin peliaikaerot ja puuttuvat
lisätilastot. Käyttöliittymä näyttää toleranssin ja menetelmän vertailun yhteydessä.
Päivitä naisten runkosarjan aineisto paikallisesta tapahtumavälimuistista:

```powershell
python -m ingestion.publish_onoff --playing-time-tolerance-seconds 30
```

The 2025–26 regular season is now loaded: 108 validated games, nine teams,
24 games per team. `Joukkueet` compares each team's shooting profile, estimated
offensive/defensive efficiency, rebounds, turnovers and possessions with the
league. The frontend imports only `season_verified.summary.json` (aggregate
statistics, no player records). Regenerate with
`python -m analytics.export_web data/normalized/season_verified.json` after
updating a season snapshot. Season CLI runs also export this compact summary.

The first visible prototype lives in `web/` and uses React, TypeScript, and Vite. Start it on port 5173 (port 4180 is intentionally not used):

```powershell
cd web
pnpm install
pnpm run dev -- --port 5173
```

The app presents verified 2025–26 regular-season analysis and a 2026–27 schedule. Derived eFG%, TS%, ORtg, DRtg, Net Rating, and other efficiency values are labeled as box-score estimates where exact possession data is not available. `Kausitrendit` includes verified regular-season statistics and the 2025–26 playoff comparison. Historical multi-season trend lines still require more complete seasons.

The current-season publisher reuses the validated single-game adapter, with caching and per-game failure reporting. Its scheduled job is prepared locally; deployment and remote activation remain separate from the local prototype. See the 2026–27 section below.

## Layout

```text
DATA_AUDIT.md
ingestion/       public-source clients and CLI
normalization/   source-specific to KorisLab schema mapping
validation/      small data-quality checks
analytics/       deterministic metric helpers
data/normalized/ compact, redacted source snapshots
tests/           standard-library regression tests
```
## Pudotuspelivertailu (2025–26)

Kausitrendit vertaa joukkueen runkosarjan ja pudotuspelien keskiarvoja. Runkosarja sisältää 108 ja pudotuspelit 30 tarkistettua ottelua, myös pronssiottelun. Joukkueet yhdistetään lähteen joukkue-ID:llä. FG% perustuu osumien ja yritysten summiin, muutoksen yksikkö on prosenttiyksikkö; laskettavat tapahtumat esitetään per joukkueen ottelu. Ottelusarjojen koontirivit (`match_type: series`, esimerkiksi 3–0) rajataan pois tuonnissa.

Pudotuspelit voi päivittää samalla adapterilla (ryhmä `302874`):

```powershell
python -m ingestion.cli --season-statistics --competition-id huki2526 --category-id 1 --group-id 302874 --out data/normalized/season_playoffs_2025_2026.json
```

Tuonti tuottaa tarkistetun aineiston ja kompaktin `.summary.json`-tiedoston. Käyttöliittymä lataa vain yhteenvedon. Pääkortit kuvaavat yhden joukkueen keskimääräistä runkosarjaottelua (liigan tapahtumasummat / 2 / ottelut). Vastustajien vaihtuminen ja pienet pudotuspeliotokset on huomioitava vertailua tulkittaessa.

## Kausi 2026–27 ja päivitykset

Yhteinen kausivalinta vaihtaa ottelut ja analyysit valittuun kauteen. Oletus on 2026–27, ja valinta muistetaan selaimessa. Etusivun esimerkkianalyysi on erikseen merkitty kaudelle 2025–26; sen linkki valitsee kyseisen kauden. Ennen ensimmäisiä tarkistettuja box scoreja analyysinäkymät näyttävät otteluohjelman tilanteen, eivät edellisen kauden lukuja.

Päivitä paikallinen ohjelma, tulokset ja tarkistetut tilastot:

```powershell
python -m ingestion.publish_season
```

Komento hakee sarjan `huki2627`, kategorian `1`, runkosarjaryhmän `303031` ja kirjoittaa atomisesti `web/public/season-2026-27.json`. Mukana ovat ohjelma ja ajat Suomen paikallisaikana, pelattujen otteluiden tulokset, tarkistetut box scoret, kausiaggregaatit ja virheiden kattavuus. Tulevan ottelun puuttuvaa tulosta ei korvata nollalla. Ohjelmahakuvirhe säilyttää edellisen tiedoston; epäonnistunut tilastohaku säilyttää aiemman tarkistetun box scoren ja yrittää uudelleen seuraavassa ajossa. Välimuisti päivitetään 24 tunnin jälkeen myös jälkikorjauksia varten. Muuttumaton aineisto säilyttää päivitysajan, jolloin ajastus ei tuota turhia committeja. Yksittäisen ottelun välimuistin voi poistaa sen lähde-ID:n SHA-256-tiedoston perusteella, jos korjaus tarvitaan heti.

Selain lukee julkaistua tiedostoa viiden minuutin välein näkyvällä sivulla sekä **Lataa päivitykset** -painikkeesta. Tämä ei itsessään hae Basket.fi:n tietoja: yllä oleva komento pitää ajaa paikallisesti tai palvelimella.

`.github/workflows/update-season.yml` päivittää Korisliigan ja Naisten Korisliigan nykykauden ohjelman ja tarkistetut tilastot kahden tunnin välein UTC-ajassa sekä käsin `workflow_dispatch`-ajolla. Muuttuneet julkiset snapshotit commitoidaan `main`-haaraan. Ingestion-, normalisointi-, validointi-, testaus- ja workflow-muutokset käynnistävät päivityksen myös heti. Ensimmäinen ajastus epäonnistui, koska yksi historiadataa tarkistava testi vaati `data/cache/pbp`-välimuistin, jota GitHub-ajossa ei ollut. Testi ohitetaan nyt, jos sen tarvitsemat paikalliset lähdetiedostot puuttuvat. Workflowlla on `contents: write` -oikeus. Sivuston julkaisu on kytkettävä datamuutokseen erikseen; `GITHUB_TOKEN`-tokenilla tehty push ei käynnistä tavallisia muita GitHub Actions -push-workfloweja. Paikallinen localhost ei päivity etäkoneen commitista automaattisesti.

CMS kannattaa lisätä vasta itse kirjoitettaville analyyseille ja artikkeleille. Ottelutulosten ja tilastojen lähde on Basket.fi, joten niiden ylläpito pysyy saman tarkistetun tuonnin kautta. Julkisen palvelun datan käyttöehdot ja automaattisen haun ehdot on käsitelty lähdeauditissa; ajastus ei muuta niitä.

## Pelaajat, profiilit ja sivuosoitteet

Pelaajat-sivu näyttää piste-, syöttö-, levypallo- ja riistokeskiarvojen kärjet sekä Eff/40- ja peliminuuttikärjet. Keskiarvot ja Eff/40 edellyttävät vähintään 8 pelattua ottelua ja 120 minuuttia; peliminuuttikortti käyttää kauden kokonaissummaa. Kortit koskevat koko liigaa, listan haku ja joukkuevalinta rajaavat pelaajataulukkoa ja syöttövertailua. Nimestä tai kortista avautuu pelaajaprofiili, jossa ovat runkosarjan keskiarvot, syöttöjen pistearvo ja otteluloki. DNP-rivejä ei lasketa peleihin tai summiin. Puuttuvat riisto- ja torjuntatilastot näkyvät puuttuvina, eivät nollina.

Pääsivut avautuvat osoitteissa `/overview/`, `/matches/`, `/teams/`, `/players/` ja `/season/`. Pelaajan osoite on `/players/<source_player_id>/`, ottelun `/matches/<source_match_id>/`. Kausi kulkee query-parametrina, esimerkiksi `/players/?season=2025-26`; sama linkki avaa saman kauden myös toisessa selaimessa. Navigaatio käyttää tavallisia linkkejä ja History API:a, joten suorat avaukset, päivitys sekä selaimen takaisin/eteenpäin toimivat. Pelaajatunnisteet ovat lähteen tunnisteita: eri kausien eri tunnisteita ei yhdistetä pelkän nimen perusteella.

Hakukonenäkyvyyttä ja GEO-löydettävyyttä varten build esirenderöi joukkueprofiilien lisäksi pelaaja- ja ottelusivuille tekstiyhteenvedot, sivukohtaiset metatiedot sekä `ProfilePage`-, `Person`- ja `SportsEvent`-rakennetiedot. Pelaajayhteenvedot käyttävät pelattuja otteluita; otteluyhteenvedot näyttävät lopputuloksen ja saatavilla olevat neljännespisteet. Ottelun data-alasivu merkitään `noindex`-tilaan ja kanonisoidaan ottelusivulle. Esirenderöidyt pelaaja- ja ottelusivut lisätään sitemap-tiedostoon. Canonical-osoitteiden domain tulee `VITE_SITE_URL`-muuttujasta tai Vercelin `VERCEL_PROJECT_PRODUCTION_URL`-build-muuttujasta.

Käyttöliittymä on yhä SPA ja korvaa esirenderöidyn varasisällön käynnistyessään. Staattinen HTML tarjoaa sivun aiheen ja varmennetut avainluvut myös indeksoijille, jotka eivät suorita käyttöliittymää. `web/public/robots.txt` sallii `OAI-SearchBot`-indeksoijan ja muut yleiset botit, mutta estää `/studio`-reitit. robots.txt:n sallinta ei takaa indeksointia. Julkaisun tuntemattomien osoitteiden HTTP 404 -käyttäytyminen on erillinen hosting-määritys.

Pelaajalaskennan ja reittien pieni tarkistus (Node 22.14+):

```powershell
cd web
pnpm run check:players
pnpm run build
```
# Shot charts

The Game story now loads a per-match field-goal chart from `web/public/shots/<match-id>.json`.
The source's full-court percentage coordinates, player IDs, periods (including overtime),
clock and made/missed outcome are preserved. Free throws are excluded. Missing coordinates
remain missing and still count in the attempt totals. Each published chart compares 2P/3P
attempts and makes against the verified box score; differences are labelled in the UI.

Team, player, period and 2P/3P filters update the chart, totals and accessible table together.
Filters persist in the URL for reload and sharing. The canonical URL remains the game page.
The existing current-season publisher also refreshes charts, retaining previous data on errors.
The prepared GitHub workflow includes these files; it still needs activation/deployment.

Publish historical charts with `python -m ingestion.publish_shots`; use `--match-id` for one game
or `--season-file` for another verified dataset. Check with `pnpm run check:shots` in `web`
and `python -m unittest tests.test_basketfi_shots tests.test_publish_season`.

Play-by-play is now imported for the quarter-level analysis question. Its raw events remain
in the ingestion cache; a compact season summary is published for the frontend. Future analyses
should answer a concrete question (shot-location changes, assisted scoring, or changes with
a player on court), display attempt counts and scope, and distinguish association from causation.
Season zone charts and reconstructed lineup statistics are not part of this first chart release.

## Quarter-level analysis questions

The Overview question builder supports quarters 1–4 for points, steals, turnovers, 3PA and FTA.
`python -m ingestion.publish_quarters` imports historical play-by-play through the public
`fixture_detail?sub=pbp` response and publishes `web/public/quarters-2025-26.json`.
Fixture identity, team identities, unique events, completed periods and each period's points
are checked against the verified box score. Each metric's complete-game totals must also
match both teams' box scores before that game contributes to the metric's quarter sample.
Team events count even without a player ID. Quarter four excludes overtime; full-game values
continue to include overtime. Missing coverage is displayed as missing, with the verified
game count beside the result, rather than converted to zero.

The current-season publisher also refreshes `quarters-2026-27.json`; the prepared workflow
caches raw events and includes the quarter summary. Raw event responses are not shipped to
the browser. Failed refreshes use validated cached responses and retain a more complete
published summary. Check with `pnpm run check:quarters` in `web` and
`python -m unittest tests.test_basketfi_pbp`.

## Syöttöjen pistearvo

Pelaajat-sivun "Mitä syötöistä syntyy?" näyttää syöttöjen kokonaissumman, syötöistä tehdyt 2P/3P-korit, niiden pisteet, pisteet per tunnistettu pelitilannekorisyöttö sekä kolmosten osuuden. Vertailu on järjestettävä ja seuraa sivun hakua ja joukkuevalintaa. Osuuksien ja keskiarvojen järjestys edellyttää vähintään 10 tunnistettua korisyöttöä. Pelaajaprofiili näyttää saman pelaajan pistearvon ja jakauman.

Syöttö yhdistetään onnistuneeseen pelitilanneheittoon pelaaja- ja joukkue-ID:n, erän ja kellon avulla. Jos samassa kellonajassa on useita koreja, tulostilanteen on erotettava yksi kori. Tapahtumajärjestys voi olla syöttö ennen koria. Yhtä koria ei käytetä kahdesti. Lähteen vapaaheittotilanteisiin kirjaamat syötöt eritellään, eikä niiden pisteitä lasketa 2P/3P-vertailuun. Epäselvä yhteys jää kohdistamatta; puutteellinen pistesumma merkitään ≥-merkillä. Ottelu otetaan mukaan vasta, kun tapahtumien syöttösummat täsmäävät sekä pelaajien että joukkueiden box scoreen ja PBP:n eräpisteet on tarkistettu. Näytettävä ottelukattavuus ei muutu puuttuvasta datasta nollatilastoiksi.

`python -m ingestion.publish_assists` julkaisee historiallisen yhteenvedon olemassa olevasta `data/cache/pbp`-välimuistista tiedostoon `web/public/assists-2025-26.json` ilman verkkohakuja. Kausi 2026–27 päivittyy `ingestion.publish_season`-komennossa neljännesdatan jälkeen. Selain lataa syöttöyhteenvedon uudelleen nykykauden julkisen snapshotin päivittyessä. Valmisteltu GitHub-workflow sisältää myös syöttöyhteenvedon; ajastuksen käyttöönotto on yhä erillinen vaihe.

Tarkistukset: `python -m unittest tests.test_basketfi_assists`, `pnpm run check:assists` ja `pnpm run build` (`web`-hakemistossa). Julkaistu 2025–26-aineisto kattaa 108 ottelua ja 3 763 syöttöä: 3 355 tunnistettua pelitilannekoria ja 408 erikseen kirjattua vapaaheittotilannetta, ei kohdistamattomia syöttöjä.
