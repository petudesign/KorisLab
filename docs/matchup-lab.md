# Matchup Lab

Vertailut käyttävät varmennettuja box score -otteluita. Kausien vertailussa kukin puoli valitaan erikseen; pelaaja tunnistetaan lähteen pelaaja-ID:llä, ei nimellä. Aiempien kausien yhteistulos sisältää vain saatavilla olevat runkosarjat ennen valittua B-kautta. Kaudelta 2024–25 on 129/130 runko- ja jatkosarjaottelua sekä 27/27 pudotuspeliottelua; puutteellista box scorea ei käytetä. Kaudelta 2025–26 on 108/108 runkosarja- ja 30/30 pudotuspeliottelua. Kauden 2026–27 tiedot päivittyvät olemassa olevan kausijulkaisijan kautta.

- Viimeiset 5: joukkueen viisi viimeistä ottelua tai pelaajan viisi viimeistä kentällä käytyä ottelua. Päivämäärättömät ottelut jätetään pois ja ilmoitetaan.
- Runkosarja / pudotuspelit: vain pelaajille Matchup Labissa.
- Pelasi / ei pelannut: koko joukkueen ottelutilastot pelaajan box score -peliminuuttien perusteella. Epäselvä osallistuminen jätetään pois. Ei kuvaa kentällä / penkillä -jaksoja.
- Kentällä / penkillä: joukkueen tapahtumat kyseisissä jaksoissa, määrät per 40 minuuttia jaksoa. Penkkijakso sisältää myös tarkistetut ottelut, joissa pelaaja ei pelannut. Ei syy-seurausmittari.

Prosentit ja AST/TO lasketaan yhteismääristä. ORtg ja DRtg = tehdyt tai päästetyt pisteet / joukkueiden arvioitujen pallonhallintojen keskiarvo × 100. Pallonhallinta-arvio = FGA + 0,44 × FTA − ORB + TOV. Net Rating = ORtg − DRtg. On/off-pallonhallinnat ovat tapahtumajaksojen arvioita, eivät seurattuja pallonhallintoja. Puuttuva tilastokenttä säilyy puuttuvana myös yhteenlaskussa; nollan nimittäjälle näytetään viiva.

## On/off-julkaisu

`python -m ingestion.publish_onoff` muodostaa `web/public/onoff-2025-26.json`-tiedoston paikallisista PBP-välimuisteista. Ottelu hyväksytään vain, kun molempien avausviisikot, vaihdot, täydet erät, keskeiset joukkuetilastot, jokaisen pelaajan peliaika (2 sekunnin toleranssi) ja saatavilla oleva +/- täsmäävät. Epäonnistunut ottelu jätetään kokonaan pois. Muut poikkeavat tai puuttuvat tilastokentät ovat null.

Nykyinen tarkistettu otos on 26/108 ottelua. Ottelut eivät ole satunnaisotos; lukuja ei pidä esittää koko kauden vaikutusarviona. UI näyttää sekä sarjan kattavuuden että valitun joukkueen ottelumäärän ja jaksojen minuutit.

Tarkistukset: `python -m unittest tests.test_basketfi_onoff`, `pnpm --dir web run check:matchup` ja `pnpm --dir web run build`.

## Kauden 2024–25 tuonti

`python -m ingestion.publish_historical_season` hakee Basket.fin arkistosta runkosarjan ja ylemmän/alemman jatkosarjan ryhmät `301604`, `302075` ja `302076` sekä pudotuspelit ryhmästä `302097`. Tuonti säilyttää ottelupäivän ja vaiheen, validoi jokaisen box scoren ja julkaisee kauden yhteenvedot. Yksi 130 runko- ja jatkosarjaottelusta jätettiin pois, koska molempien joukkueiden pelaajatilastot olivat puutteelliset.

## Kelattavat ottelutarinat

`python -m ingestion.publish_replays` julkaisee täydellisiin PBP-välimuisteihin perustuvat aikajanat hakemistoon `web/public/replays/`. Ennen julkaisua tapahtumaloki tarkistetaan neljännes- ja lopputuloksia vasten. Puuttuva tai ristiriitainen tapahtumaloki jätetään julkaisematta. Tarina näyttää pelikellon ja piste-eron; lähde ei sisällä pelaajien liikeratoja.
