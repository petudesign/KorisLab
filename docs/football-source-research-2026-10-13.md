# Jalkapalloversio KorisLabista: lähdekartoitus

Päiväys: 13.10.2026. Tämä on julkisten sivujen ja dokumentaation tutkimus, ei varmennettu koko kauden datatuonti. API-avaimia ei hankittu, tilauksia ei tehty eikä kausia kerätty. Osa Veikkausliigan sivuista palautti tutkimustyökalulle hakuvaiheessa 502-virheen; hakukoneindeksin sisältö ei osoita reaaliaikaista päivittymistä.

## Suositus

**Tarkennus käyttäjän vaatimuksiin:** Laukausten lähtöpaikat ovat pakollinen osa tuotetta. Lisäksi tavoitellaan onnistuneiden ja epäonnistuneiden syöttöjen sekä ottelun sisäisten pallonhallintajaksojen analyysiä. Alla oleva alkuperäinen perusversion suositus ei yksin täytä tätä tavoitetta. Sarjavalinta on tehtävä vasta koordinaatillisen tapahtumadatan saatavuuden perusteella.

Aloita Veikkausliigasta, jos tavoite on suomalaiselle yleisölle tarkoitettu, kauden mukana päivittyvä FutisLab. Eliteserien on vahva vaihtoehto syvempien pelaajamittareiden näkökulmasta, mutta tutkimus ei osoittanut sen olevan helpompi avoimen datan lähde. Sarjavalintaa tärkeämpi valinta on datataso: perustilastot, ottelu- ja pelaajakohtaiset lisätilastot vai koordinaatillinen tapahtumadata.

Jos tärkeintä on laukauskarttojen ja syöttöverkostojen kehittäminen ilman datatilausta, tee erillinen historiallinen laboratorio StatsBomb Open Datan yhdelle kilpailulle ja kaudelle. Tämä ei korvaa nykykauden Veikkausliiga-palvelua.

## KorisLabin nykyinen lähtökohta

Projektin README ja sovelluksen ohjeet kuvaavat pelaaja- ja joukkueprofiilit, ottelut, kausivertailut, heittokartat, tapahtuma-analyysit, kentällä/penkillä-vertailut, pelaajanostot, Mikä muuttui? -analyysit ja kontekstihaun. Jalkapalloversiossa käyttöliittymän rakennetta ja lähteiden varmennusperiaatteita voi käyttää uudelleen. Koripallon mittareita ja tapahtumien tulkintaa ei voi siirtää sellaisinaan.

## Lähteet ja todettu saatavuus

### Veikkausliigan viralliset tilastot

[Joukkuetilastot 2026](https://www.veikkausliiga.com/tilastot/2026/veikkausliiga/joukkueet/) näyttävät tulosmittarit, maalit, laukaukset, kulmat ja kortit. [Pelaajien historialliset perustilastot](https://www.veikkausliiga.com/tilastot/Kaikki/veikkausliiga/ottelut/) sisältävät muun muassa ottelut, minuutit, maalit, syötöt ja avauskokoonpanojen määrät. Historiallisessa taulukossa olevia nollia ei pidä olettaa kaikissa kentissä aidoksi nollasuoritukseksi ilman kausikohtaisen kattavuuden tarkistusta.

Vuoden 2026 pelaajataulukko oli luettavissa myös [nidos.fi-aliverkkotunnuksessa](https://veikkausliiga.nidos.fi/tilastot/2026/veikkausliiga/pelaajat/). Sen suhdetta tuotantopalveluun tai ajantasaisuutta ei varmennettu, joten sitä ei valittu tuotantolähteeksi.

Julkisesta taulukosta ei tässä kartoituksessa vahvistettu dokumentoitua avointa koko sarjan JSON-rajapintaa, laukauskoordinaatteja tai xG:tä. Tämä on selvityksen raja, ei väite siitä, ettei näitä olisi muualla saatavilla.

### Palloliiton Taso

[Palloliiton rajapintaohje](https://tuki.palloliitto.fi/fi/support/solutions/articles/103000036813-tason-rajapinta) ohjaa kirjautumaan seuran tai joukkueen tunnuksilla rajapintatietojen ja avaimen saamiseksi. Ohjeessa on myös valmista HTML:ää tuottavia ottelu- ja sarjataulukkowidgettejä. Ohje ei osoita vapaata pääsyä koko Veikkausliigan analyysiaineistoon.

### Eliteserien: FotMob ja NFF

[FotMobin Eliteserien-tilastot](https://www.fotmob.com/en-GB/leagues/59/stats/teams/teams) näyttävät pelaajien xG:tä, xG/90:tä, xA:ta, xA/90:tä ja muita lisämittareita. Tämä vahvistaa syvemmän julkisesti katseltavan analytiikan saatavuuden. Ottelukohtaista laukauskoordinaattien kattavuutta ei testattu.

FotMobin [sivuston alatunniste](https://www.fotmob.com/) kieltää automaattiset palvelut sekä järjestelmällisen tai säännöllisen käytön. Sitä ei tämän perusteella voi valita automaattisesti päivittyvän tuotteen syötteeksi ilman sovittua pääsyä.

[NFF:n 13.8.2026 julkaisema ohje](https://www.fotball.no/klubb-og-leder/fiks-info-og-support/eps-tilgang/) sanoo, ettei EPS-API:a tai taustalla olevaa fotballdataa pääsääntöisesti anneta ulkopuolisille. Se ohjaa organisaatioita Fotballdata.no:hon ja mediaa NTB:hen. Norjan virallinen rajapinta ei siis ole yleisesti avoin.

### API-Football

[Kattavuusluettelo](https://www.api-football.com/coverage) sisältää sekä Veikkausliigan että Eliteserienin. Tarjoaja muistuttaa kattavuuden vaihtelevan kauden ja ottelun mukaan. Sarjan löytyminen luettelosta ei vahvista jokaista pelaajatilastoa, xG:tä tai laukauskarttaa.

[Hinnasto](https://www.api-football.com/pricing): ilmainen taso 100 kutsua päivässä, kausirajoituksin; Pro 19 USD/kk, 7 500 kutsua päivässä. Mahdollinen ensimmäisen teknisen testin lähde. Julkaisu-, tallennus- ja edelleenjakeluehdot sekä tarvitut kentät on tarkistettava valitulle käytölle.

### Sportmonks

[Veikkausliiga-tuotesivu](https://www.sportmonks.com/football-api/veikkaus-liiga-api/) ilmoittaa tarjoavansa ottelut, kokoonpanot, tilastot sekä xG:n lisäpalveluna. Perustaso alkaa 29 eurosta kuukaudessa; xG-palvelu hinnoitellaan erikseen. Tämä on tarjoajan dokumentoitu lupaus. Tässä tutkimuksessa ei varmennettu API-vastauksista xG:n ottelu- tai historiakattavuutta eikä laukauskoordinaatteja.

### StatsBomb Open Data

[Virallinen repository](https://github.com/hudl/open-data) tarjoaa JSON-muotoisia kilpailuja, otteluita, tapahtumia ja kokoonpanoja sekä valikoiduille otteluille 360-aineistoa. Julkaistuun analyysiin pyydetään StatsBomb-lähdemaininta ja logo; käyttötarkoituksen pitää sopia lisenssiin.

[Kilpailuluettelo](https://raw.githubusercontent.com/statsbomb/open-data/master/data/competitions.json) ei sisältänyt Suomea tai Norjaa tutkimushetkellä. Siinä oli esimerkiksi miesten MM 2022 ja EM 2024 sekä naisten MM 2023 ja EM 2025. Sopii historiallisen analyysituotteen pohjaksi; ei osoita jatkuvaa nykykauden syötettä.

### Muut löydetyt lähteet

[Football-Data.co.uk](https://www.football-data.co.uk/data.php) tarjoaa Suomen ja Norjan tulos- ja kerroinaineistoja. Lisäliigojen aineistoa ei pidä sekoittaa suurten liigojen tarkempiin ottelutilastoihin. Sivusto rajoittaa ilmaisen aineiston yksityishenkilöiden käyttöön ja sulkee pois kaupallisia sekä automaattista keruuta/AI:ta käyttäviä käyttötarkoituksia. Ei valittu julkisen sivun oletuslähteeksi.

[PitchAPI](https://pitchapi.dev/) dokumentoi ilmaiseksi laajan tapahtuma- ja analyysirajapinnan. Sen dokumentaatiosta ei vahvistettu Veikkausliigan tai Eliteserienin nimettyä kattavuutta eikä uudelleenjulkaisuoikeuksia. Se jää tutkittavaksi ehdokkaaksi, ei varmennetuksi lähteeksi.

## Kolme toteutettavaa versiota

| Versio | Sisältö | Ratkaiseva datavaatimus |
| --- | --- | --- |
| Veikkausliiga-perusversio | Joukkueet, pelaajat, minuuttiroolit, maalit ja syötöt /90, kausivertailu, koti/vieras, otteluennakko | Ottelut, pelaajaminuutit, perustilastot ja historian kattavuus |
| Veikkausliiga tai Eliteserien, syvempi versio | xG/xGA, xG-ero, pelaajien xG/90 ja xA/90, tuloksen ja maalipaikkojen vertailu | Lisensoitu ja testattu ottelu-/pelaajakohtainen analyysidata |
| Historiallinen FutisLab | Laukauskartat, xG-aikajana, syöttöverkostot, tapahtumapohjaiset vertailut | Koordinaatillinen tapahtumadata, esimerkiksi valittu StatsBomb-kausi |

## KorisLabin toimintojen sovitus

- Pelaajaprofiili: kokonaismäärät ja /90-lukemat, minuuttiotos ja pelipaikkakohtainen vertailu. Älä valitse pieniä otoksia automaattisesti kauden parhaiksi.
- Mikä muuttui?: viimeiset ottelut vastaan erillinen aiempi jakso; ensimmäiseksi minuutit, avausrooli ja laukaukset, xG vain varmennetusta lähteestä.
- Matchup Lab: joukkueiden viimeaikainen suoritus, koti/vieras ja hyökkäys-/puolustusluvut. Vastustajien taso ja sarjavaihe näkyviin.
- Heittokartta: laukauskartta vain todellisista koordinaateista. Joukkueen xG-summa ei riitä.
- Kentällä/penkillä: myöhempi kokeilu. Maalien vähäinen määrä ja pelaajien yhteinen peliaika tekevät suorasta koripallotulkinnasta harhaanjohtavan.
- Syöttöverkosto ja prässi: vaativat tarkempaa tapahtumadataa. Pallonhallintaprosentti ei yksin riitä.
- Siirtokonteksti: pidä eri sarjojen /90-lukemat ja vertailuryhmät erillään; älä oleta liigojen mittareita samanarvoisiksi.

## Seuraava tekninen tutkimus

### Jatkoselvityksen vahvistamat havainnot

[Palloliiton teknistaktinen Veikkausliiga-raportti 2015–2024](https://www-assets.palloliitto.fi/62562/1759833974-teknistaktisten-datamuuttujien-kehitys-veikkausliigassa-2015-2024-1.pdf) nimeää lähteeksi Wyscoutin datarajapinnan. Menetelmäkuvaus kertoo aikaleimatuista syöttö-, laukaus- ja kuljetustapahtumista, joihin voi sisältyä kenttäkoordinaatit. Raportti esittää laukausten lähtöpaikkojen lämpökartat, syöttöjen onnistumisprosentit ja suunnat sekä pallonhallintajaksojen kestot. Tämä vahvistaa yksityiskohtaisen Veikkausliiga-aineiston olemassaolon kyseiseltä historialliselta ajalta. Se ei vahvista omaa pääsyä, nykykauden kattavuutta tai julkaisulupaa.

[Hudl Wyscout Data](https://zendesk.hudl.com/products/wyscout/data-api) erottaa Stats Packin ja sijaintitietoa tarjoavan Events Packin. Käyttäjän tavoitteeseen relevantti selvityskohde on Events Pack. Veikkausliigan nykykausi, kaikki laukaukset, syöttöjen tulokset, tapahtumaluokitukset, hinta ja verkkopalvelussa julkaisemisen oikeudet pitää vahvistaa erikseen. Tavallisen katselutilauksen ei pidä olettaa sisältävän tätä rajapintapakettia.

[Sportmonksin xG-artikkeli](https://www.sportmonks.com/blogs/modeling-expected-goals-xg-from-match-event-data/) sanoo suoraan, ettei events-rajapinta sisällä laukauskohtaisia x/y-koordinaatteja. Erillinen ballCoordinates on vain valituille otteluille eikä ole suoraan kytketty yksittäisiin laukauksiin. Sitä ei voi pitää varmennettuna laukauskartan lähteenä Veikkausliigaan.

Onnistuneiden syöttöjen osuus on eri kysymys kuin epäonnistuneen syötön tapahtumakohtainen sijainti, ajankohta ja seuraukset. Vastaavasti live-palvelun kumulatiivinen pallonhallintaprosentti ja ottelun tietyn aikajakson pallonhallinta ovat eri mittareita. Pressure Index ei korvaa pallonhallintaa.

Ennen toteutuspäätöstä testaa samoilla kriteereillä kummastakin sarjasta noin 10 ottelua vähintään kahdelta kaudelta. Valitse tavallisia otteluita, punaisen kortin ottelu, maaliton ottelu sekä eri sarjavaiheita silloin kun niitä on. Otos ei todista koko kauden kattavuutta, mutta paljastaa nopeasti puuttuvat kentät ja skeemaerot.

Tarkista ottelu-, joukkue- ja pelaajatunnisteet, minuutit, kokoonpanot, vaihdot, laukaukset, xG, xA, koordinaatit, päivitysviive, korjausten käsittely, kausivaihe ja käyttöehdot. Sen jälkeen laske koko valitun kauden kattavuus ennen kuin ominaisuus luvataan käyttöliittymässä. Näytä puuttuva tieto puuttuvana, älä nollana.

Päätössääntö: Veikkausliiga ensin, jos tarvittu lähde voidaan päivittää ja julkaista luotettavasti. Valitse Norja, jos juuri tarvittava analyysiaineisto osoittautuu siellä olennaisesti kattavammaksi tai edullisemmaksi. Jos budjetti on nolla ja syvät kartat ovat tärkeimmät, aloita historiallisesta tapahtumalaboratoriosta.
