# KorisLab Analyysit ja CMS

Analyysiartikkelit kirjoitetaan Sanity Studiossa. KorisLabin julkinen sivu lukee vain julkaistuja juttuja. Studio käyttää Sanityn kirjautumista, eikä KorisLabin frontendissä ole kirjoitustokenia tai julkaisun APIa.

## Kertaluonteinen käyttöönotto

1. Luo Sanity-projekti osoitteessa [sanity.io/manage](https://www.sanity.io/manage) ja valitse datasetiksi `production` (tai päätä toinen nimi ja käytä sitä joka kohdassa). Datasetin täytyy olla julkisesti luettava, jotta julkaisut näkyvät ilman KorisLab-tiliä.
2. Lisää projektin jäseneksi vain kirjoittajat, joiden kuuluu saada muokata tai julkaista juttuja. Studio pyytää kirjautumaan sisään Sanity-tunnuksella; sivuston lukijat eivät pääse muokkaamaan julkaisuja.
3. Kopioi `web/.env.example` tiedostoksi `web/.env.local` ja täytä Sanityn project ID sekä dataset. `VITE_SITE_URL` on paikallisesti `http://127.0.0.1:5173` ja tuotannossa KorisLabin julkinen pääosoite.
4. Lisää Sanity-projektin API-asetuksista CORS-origineihin `http://127.0.0.1:5173` sekä tuotantodomain. Ota kirjautumistiedot salliva asetus käyttöön, jotta Studio voi kirjautua näistä osoitteista.
5. Lisää samat kolme arvoa Vercelin Production-, Preview- ja Development-ympäristöihin. Vercelissä `VITE_SITE_URL` asetetaan tuotannon kanoniseen osoitteeseen.
6. Tee ensimmäinen uusi deploy. CMS avautuu osoitteessa `/studio/` (paikallisesti `http://127.0.0.1:5173/studio/`).

Sanity-projektin project ID ja dataset ovat julkisia tunnisteita; niihin ei pidä liittää kirjoitustokenia. CORS- ja jäsenyysasetukset sekä Sanityn roolit rajaavat kirjautuneen muokkauksen.

## X-jakokortit

Selainpuolen React-sisältö ei yksin riitä X:n linkkikorttiin. Build luo siksi artikkelikohtaisen HTML-kuoren, jossa otsikko, ingressi, kansikuva ja canonical-osoite ovat valmiina HTML-metatiedoissa. Uusi julkaisu näkyy KorisLabin listauksessa API:n kautta; jakokortin päivittyminen tarvitsee uuden buildin.

Luo Vercelissä Deploy Hook tuotannon branchille. Lisää Sanityyn webhook, joka lähettää POST-pyynnön hookin URLiin, kun `analysisArticle`-dokumentti julkaistaan, sitä päivitetään tai se poistetaan. Hookin osoite pidetään Sanityn webhook-asetuksissa eikä koskaan laiteta frontendin ympäristömuuttujaksi.

## Julkaisun tekeminen

1. Avaa `/studio/` ja kirjaudu omalla Sanity-tunnuksellasi.
2. Luo **Analyysi**. Täytä otsikko ja luo siitä osoitteen tunniste.
3. Kirjoita ingressi, joka kertoo väitteen tai kiinnostavan havainnon. Valitse sarja, kausi ja juttutyyppi.
4. Lisää juttu sisältöeditoriin. Käytössä ovat leipäteksti, väliotsikot, lainaukset, listat, linkit ja kuvat.
5. Lisää **Ottelun pistediagrammi** -lohko, kun haluat näyttää varmennetun KorisLab-ottelun neljännespisteet. Anna ottelun ID; kaavio hakee luvut kausi-indeksistä.
6. Täytä **Aineisto ja rajaukset** -kenttä: mistä luvut tulevat ja mitä havainnosta ei vielä voi päätellä.
7. Tarkista esikatselusta sisältö ja julkaise. Tulevaisuuteen asetettu julkaisupäivä pitää jutun poissa julkisesta listasta päivään asti.

## Paikallinen käyttö

Vaihda ympäristömuuttujia `.env.local`-tiedostossa ja käynnistä Vite uudelleen, jotta se lukee uudet arvot. Jos `VITE_SANITY_PROJECT_ID` puuttuu, analyysisivu näyttää tyhjän tilan ja `/studio/` näyttää käyttöönotto-ohjeen.
