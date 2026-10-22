# Nykyisen KorisLabin toimintojen siirto uuteen UI:hin

Uusi toteutus on erillinen `prototypes/paper-home`-sovellus. Alkuperäinen `web` on toiminnallinen vertailukohta; sitä ei korvata ennen toiminnallisen vastaavuuden tarkistusta.

## Ensimmäinen siirto tehty

- Oikeat polut: /overview/, /matches/, /matches/ID/, /players/, /players/ID/, /teams/, /teams/naisten-korisliiga/NIMI/, /teams/korisliiga/NIMI/.
- Kausi ja sarja kulkevat linkeissä, selaimen back/forward ja suora avaus toimivat. Vanhoille hash-linkeille siirtymä.
- Ottelulista: koko nykyisen kauden otteluohjelma, tulevat/pelatut-suodatus, haku, joukkue, päiväjärjestys. Tulevan ottelun perustiedot ja pelatun box score -analyysi.
- Pelaajat: aidot tunnisteet, kausitilastot alkuperäisellä laskennalla, haku/joukkue/otos/mittari, profiilin 16 alkuperäistä mittaria, siluettikuva-alue, henkilötiedot, lähteistetty palkintokaappi mestaruuksineen, liigan vertailut, viiden ottelun hehkukäyrät ottelutooltipeilla, heittomäärät, henkilökohtainen suodatettava heittokartta, syöttöjen tulosanalyysi sekä otteluloki voitto/tappio-erottelulla.
- Joukkueet: oma haettava joukkuekorttinäkymä, jokaisen seuran logo, uudistettu profiilikehys, kahdeksan mittaria liigan vertailuineen (ylimmissä neljässä viimeisen viiden ottelun käyrät), viime otteluiden tulokset, seuraava ottelu, pelaajat ja ottelut. Yleiskatsauksen sarjataulukko/tehokkuus säilyy yleiskatsauksessa.
- Yhteinen haku löytää nyt myös pelaajia; osumat avaavat oikean profiilin.
- SEO:n ensimmäinen perusta: title, description, canonical, OG ja Twitter. Prototyyppi on noindex,follow.
- Automaattinen vertailu: kuuden kauden ohjelmamäärät sekä pelaaja-aggregaatit alkuperäiseen. Reittitestit ja olemassa olevat Sites worker -testit.

## Seuraavat siirrettävät kokonaisuudet

1. Ottelun tapahtuma-aikajana ja tarinahavainnot (`MatchReplay`, `MatchStory`), heittokartta (`ShotChart`), tulevan ottelun varsinainen `MatchPreview`-vertailu.
2. Pelaajaprofiilin koko toiminnallisuus: oikeat kuvat, henkilötietojen puuttuvan kattavuuden täydennys, heittokartan ja syöttöanalyysin puuttuvan aineistokattavuuden täydennys, strengths, kausivertailu, vanhempi palkinto-/mestaruushistoria, sample/qualification-logiikka.
3. Joukkueprofiilin kaikki analyysit: pelitapa, jaksovertailu, heittojakauma, pelaajat, vastustaja-/otteluvertailut.
4. Overview'n kaikki alkuperäiset graafit, TeamStyleMap/TeamGameSplit ja kausitrendit (ThreePointStory/SeasonPhaseComparison).
5. Playoff-aineistot ja sarjavalinnan koko laajuus sekä nykyisen kauden päivitysputken yhdistäminen. Nyt käytössä erilliset tallennetut runkosarjakopiot.
6. Custom import, Datan tila, asetukset/kieli, analyysiartikkelit/Sanity, kysymyshaku. Näitä ei merkitä valmiiksi pelkän reitin olemassaolon perusteella.
7. Tuotannon SEO: esirenderöidyt/SSR-metat, JSON-LD, sitemap/robots, analyysien metat, 404/redirectit, kaikkien vanhojen URLien vastaavuus. Indexointi vasta julkaisun yhteydessä.
8. Alkuperäisen web-sovelluksen toiminnalliset vertailut/testit, hakukone-/mobiilitarkistukset ja julkaisumuutos erillisenä päätöksenä.

## Aineistot ja tarkistus

`python3 scripts/build-match-data.py` kopioi alkuperäisistä projektiaineistoista ottelut/ohjelman. `node --experimental-strip-types --test tests/migration-data.test.mjs tests/routing.test.mjs` vertaa tilastoja ja polkuja. Kopioitujen `src/lib/playerStats.ts`/`playerName.ts`-moduulien lähde on `web/src`; muutokset pidetään vertailutestillä yhtenevinä.

Match analysis now includes the original verified match shot charts and event timelines, lazily loaded from source-backed assets. Rebuilt controls, margin chart, turning points, team/player/period/result shot filtering. Box score tab is labelled Ottelutilastot; existing /players/ URLs remain valid. Missing source files remain explicit missing states.

## Matchup Lab siirretty

`/matchup/` sisältää joukkue-/pelaajavertailun, eri kaudet ja aiempien kausien yhdistetyn otoksen, viimeiset viisi vs aiemmat, pelaajan runkosarja vs pudotuspelit, joukkueen kokonaiset ottelut pelasi/poissa sekä tarkistetun kentällä/penkillä-vertailun. Per ottelu / per 40 min ja heittoprofiili. Alkuperäinen `matchupStats.ts` säilyttää painotetut prosentit, puuttuvat arvot, otokset ja on/off-validoinnin. Uusi käyttöliittymä: identiteetit logoineen/siluetteineen, A/B-palkit, arvojen erot ja puolen vaihto; mobiilissa myös taulukon molemmat puolet näkyvät ilman vaakavieritystä. Kaudet uusimmasta vanhimpaan. Suomen- ja englanninkielinen esitys.

Keskinäiset ottelut sisältävät enintään viisi kohtaamista runkosarjoista ja pudotuspeleistä. Runkosarjalinkki avaa uuden ottelusivun oikealla kaudella; pudotuspelilinkki avaa lähteen uudessa välilehdessä, sillä uuden ottelusivun playoff-reititys ei vielä kuulu tähän siirtoon. Kentällä/penkillä-data: naiset 2025–26, miehet 2024–25 ja 2025–26. Muille kausille selkeä puuttuvan aineiston tila. Aineisto on tallennettu tilannekuva, ei ennustemalli.

`python3 scripts/build-matchup-data.py` kopioi playoff/onoff-aineistot alkuperäisestä projektista. Tavalliset ottelut ladataan olemassa olevista kausikopioista. Matchup Labin koodi ladataan vasta reitin avaamisessa. `tests/matchup.test.mjs` varmistaa alkuperäisen laskennan sekä kuuden sarja/kausi-yhdistelmän aggregaatit, viimeisten viiden otokset ja on/off-lähdevastaavuuden.
