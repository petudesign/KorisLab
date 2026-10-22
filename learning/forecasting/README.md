# Ennustemallin Python-harjoitukset

## Uusien tulosten tarkistaminen

`13_review_archived.py --league men --fetch` ja vastaavasti `--league women --fetch`
hakevat arkistoitujen, jo alkaneiden otteluiden puuttuvat viralliset box scoret.
Ilman `--fetch`-valintaa käytetään vain paikallisia tiedostoja. Komennot ajetaan
projektin juuresta Python-ympäristöllä, joka tukee projektin Python-versiota.

Raportit ovat `results/men-review-current.md` ja `results/women-review-current.md`.
Varmennetut tilastot tallennetaan `results/verified/`-kansioon. Ennusteiden historiaa
ja mallien painoja ei muuteta. Arvioinnissa käytetään ensimmäistä arkistoitua
arviota seitsemän päivän ikkunasta; puuttuvat tai vahvistamattomat tulokset näkyvät
tarkistettavina. Jos box scoresta puuttuu alkamisaika, vanhan kausiohjelman aika
säilytetään ja rajoitus kerrotaan raportissa.

Tämä tarkistus ei päivitä kausikoostetta tai tulevien otteluiden ennusteita.
13.10. arkistoidut arviot käyttävät silloista aineistoa. Uusien tulosten
huomioiminen seuraavissa ennusteissa vaatii erillisen aineiston päivityksen ja
uuden ennusteajon; alkuperäiset arviot säilytetään vertailua varten.

Rakennamme KorisLabin otteluennustetta pienissä, yhdessä läpikäytävissä vaiheissa.
Käyttäjä ennakoi koodin toimintaa ennen selitystä, ja vertaamme arvausta oikeaan
tulokseen. Emme rakenna koko mallia ennen yhteistä läpikäyntiä.

## Harjoitus 1 — tiedoston lukeminen

`01_read_matches.py` käyttää vain Pythonin standardikirjastoa. Se lukee paikallisen
Naisten Korisliigan 2025–26 ottelutiedoston ja tulostaa tietueiden määrän sekä
ensimmäisen tietueen päivämäärän, joukkueet ja pisteet. Tiedoston ensimmäinen
tietue ei välttämättä ole kauden ajallisesti ensimmäinen ottelu. Aineiston
järjestykseen ei saa myöhemmässä ennustetestauksessa luottaa tarkistamatta.

Tämä on aineiston tutkimista, ei koulutettu malli eikä arvio sen luotettavuudesta.
Riippuvuuksia tai ajastusta ei vielä asenneta.

## Harjoitus 2 — joukkueiden tulokset

`02_team_results.py` kerää jokaiselle joukkueelle voitot, tappiot sekä tehdyt ja
päästetyt pisteet. Joukkue tunnistetaan aineiston ID:llä. Yhteenveto tulostetaan
nimen mukaisessa järjestyksessä, ei virallisena sarjataulukkona.

Ensimmäinen pysähdys: `team_results`-sanakirja ja uuden joukkueen nollalukujen
alustus tehdään vain kerran. Sen jälkeen päivitetään samaa tietuetta.
Seuraava pysähdys: koko kauden keskiarvo ei kelpaa kauden aiemman ottelun
ennustamiseen, koska se sisältää myös kyseisen ottelun jälkeistä tietoa.

Skripti on tarkoitettu varmennetuille päättyneille otteluille. Puuttuvat pisteet,
tasatulokset tai virheelliset joukkueparit pysäyttävät sen tarkistusta varten;
niistä ei tehdä tappioita tai nollatuloksia. Ennustevaiheen otteluohjelma käsitellään
myöhemmin erikseen. Lopussa tarkistetaan voittojen, tappioiden ja pisteiden
kokonaissummien tasapaino.

## Harjoitus 3 — tieto ennen ottelua

`03_before_match.py` käyttää Peli-Karhujen aineiston kuudetta ottelua
historiallisena esimerkkinä. Ensin aiemmat ottelut suodatetaan, sitten järjestetään
ja lopuksi valitaan viisi viimeistä. Kohdeottelun tulosta ei lueta laskentaan.
Pythonin `datetime` käsittelee aineiston aikavyöhyke-erot oikein; merkkijonojen
järjestykseen ei luoteta.

Esimerkki koskee varmennettua historiallista ottelutiedostoa, ei live-dataa.
Tuotannon historiatestissä pitää erottaa ottelun alkuaika, päättyminen ja tiedon
saatavuushetki: nykyinen jälkikäteen korjattu aineisto ei todista, mitä tietoa
olisi ollut julkaistuna kyseisenä päivänä. Tämä rajoitus pitää dokumentoida.

Oppimistapa: käyttäjä toivoo kolmea uskottavaa ratkaisuvaihtoehtoa itse kirjoittamisen
sijaan. Vaihtoehtojen pituus tai kommentit eivät saa paljastaa vastausta.
Keskustelussa käydään läpi oikeellisuus, luettavuus ja tehokkuus erikseen.

## Harjoitus 4 — Elo pienessä esimerkissä

`04_elo_example.py` erottaa ennen ottelua lasketun odotuksen ja ottelun jälkeen
tehtävän päivityksen. Kaksi vaihtoehtoista tulosta aloittavat samoista
kuvitteellisista vahvuusluvuista 1600 ja 1400. Päivitys on
`K * (toteutunut tulos - odotus)`, missä voitto on 1 ja tappio 0.
Odotus lasketaan logistisella Elo-kaavalla, jonka asteikko on tässä 400.
K=32 on opetusesimerkin valinta. Arvoja ei ole sovitettu koripalloon.

Elo-päivityksen periaatteen lähde:
https://handbook.fide.com/chapter/B022024 (kohta 8.3.2).
FIDE käyttää omaa odotustaulukkoaan ja sääntöjään; tämä ei toteuta FIDEn
rating-sääntöjä vaan havainnollistaa tuloksen ja odotuksen erotusta.

Ensimmäinen pysähdys: miksi odotus vähennetään toteutuneesta tuloksesta?
Seuraava vaihe vasta yhteisen läpikäynnin jälkeen: päivitetään joukkueiden
vahvuudet aidosta otteluhistoriasta aikajärjestyksessä, tallentaen kunkin
ottelun arvio ennen tuloksen käsittelyä.

## Harjoitus 5 — historiallinen koe

`python3 learning/forecasting/05_season_backtest.py` kirjoittaa raportin ja
erilliset ennusteet/toteumat kansioon `results/`. `elo_backtest.py` sisältää
aikajärjestyksen, ennusteen ja vasta sen jälkeen tehtävän päivityksen.
Kokeessa ei asenneta kirjastoja, muuteta sivustoa tai julkaista ennusteita.

Käytetään kauden kaikkia 108 ottelua lähtöluvulla 1500 ja K=32. Seitsemän eri
ottelua kattaa yhdeksän joukkueen kuudennet pelit. Molemmilla vähintään viisi
aiempaa peliä -otos sisältää 84 ottelua. Raportti vertaa Brier-arvoa 50–50-arvioon
sekä ennen ennustepäivää havaittuun kotivoitto-osuuteen (yhden voiton ja yhden
tappion tasoituksella). Parametreja ei haeta jälkikäteen parhaan tuloksen saamiseksi.

Päättymisaikojen puuttuessa saman päivän tulokset rajataan pois kaikista sen
päivän ennusteista. Tämä on konservatiivisempi kuin pelkkä alkuaikarajaus.
Historiadatan korjausten alkuperäisiä saatavuushetkiä ei edelleenkään tunneta.

Tarkista: `python3 -m unittest discover -s learning/forecasting -p 'test_*.py' -v`.
Testit muuttavat kohdeottelun ja tulevien pelien tuloksia: ennen niitä tehdyn
ennusteen pitää pysyä samana. Lisäksi testataan saman päivän rajaus,
otteluiden järjestys, kaksinkertaisten pelien hylkäys ja tasavahva ennuste.

Seuraava yhteinen pysähdys: 5/7 suosikkiosumaa ei tarkoita 71 % luotettavuutta
eikä todennäköisyyksien kalibrointia. Katsotaan yhtä lähes tasavahvaa ennustetta
ja sitä, miten arviointi eroaa varman voittajan nimeämisestä.

## Harjoitus 6 — ennusteen vahvuusryhmät

`python3 learning/forecasting/06_confidence_groups.py` luo raportin
`results/confidence-groups.md` sekä ryhmien ottelutunnisteet sisältävän JSONin.
Rajat ovat yli 50–alle 55 %, 55–alle 65 % ja vähintään 65 %. Ne valittiin
tarkasteluun, eivät mallin jälkikäteisiksi korjauskertoimiksi. Tasavahvalle 50–50
arviolle ei nimetä suosikkia. Myös vierassuosikit lasketaan oikein.

84 ottelun otoksessa suurempi ennustettu etu liittyy suurempaan voitto-osuuteen,
mutta pienet ryhmät ja yhden kauden aineisto rajoittavat päätelmiä. Erottelukyky
ja kalibrointi ovat eri asioita: korkeamman arvion pelit voivat osua useammin,
vaikka prosentit eivät vielä vastaisi todellisia toistuvia osuuksia.

Kausisijoituksen ennuste ja pelaajien rooli-/suoritusennusteet ovat seuraavia
mahdollisia suuntia, eivät tämän kokeen toteutettuja ominaisuuksia.

## Harjoitus 7 — edellisen kauden lähtöarvio

`python3 learning/forecasting/07_previous_season.py` muodostaa 2024–25 aineiston
Elo-luvut ja vertaa uuden kauden kertoimia 0, 0,25, 0,5, 0,75 ja 1. Raportti on
`results/previous-season-comparison.md`. Kertoimet määräävät uuden kauden
lähtöluvut, eivät muuta K:ta. Aikavyöhykkeettömät suomalaisen lähteen ajat
tulkitaan Europe/Helsinki-ajaksi näkyvästi.

Vanha kausi paransi seitsemän kuudennen ottelun Brier-lukua, mutta heikensi
21 alkukauden ottelun ja koko 108 ottelun tulosta. Pienen valikoidun otoksen
parannus ei riitä mallin valintaan. Parasta kerrointa ei oteta automaattisesti
käyttöön. Edellisessä lähteessä on 129 ottelua ja epätasaiset ottelumäärät;
kattavuus pitää tarkistaa ennen vahvoja päätelmiä.

## Harjoitus 8 — piste-ero ja kotipaikka

`python3 learning/forecasting/08_compare_models.py` tarkistaa lähdekoosteen
ottelumäärät, sovittaa piste-erolähtötason ja kotipaikkakorjaukset 2024–25
aineistoon ja vertaa niitä 2025–26 peleissä. Kauden tuloksia ei käytetä
parametrien sovittamiseen. Molempien mallien ottelukohtaiset lähtötiedot
päivittyvät vain aiemmista päivistä. Raportti: `results/model-comparison.md`.

Kattavuus: 2024–25 lähteen 130 pelistä yksi haku epäonnistui (129 käytössä).
2025–26 kaikki lähdekoosteen 108 peliä ovat mukana. Tämä ei ole riippumaton
varmennus kilpailun kaikista vaiheista: pudotuspelit ovat erillään.

Ensimmäisessä vertailussa piste-erolähtötaso antoi koko kaudelle Brierin 0,194
vs Elon 0,209. Kotipaikkakorjaukset eivät parantaneet tätä vertailukautta.
Erot eivät vielä osoita tilastollista varmuutta tai tulevan kauden tarkkuutta.
Uusia malleja ei oteta käyttöön automaattisesti.

Pysähdys: `fit_logistic` oppii muunnoksen vain vanhemmasta aineistosta;
arviointikauden tuloksilla mitataan sitä. Sama asia on eri kuin `run_backtest`in
ottelun jälkeen tekemä tilapäivitys seuraavaa ottelua varten.

## Harjoitus 9 — sama otos ja eron epävarmuus

`python3 learning/forecasting/09_compare_uncertainty.py` vertaa piste-eromalleja
niissä samoissa 103 ottelussa, joissa molemmat nimesivät suosikin. Osumat 75 vs 76;
kotipaikkamallin viidestä lisävalinnasta vain yksi osui. Tasan 50–50 ei ole automaattisesti
huonompi kuin suosikin nimeävä arvio.

Parittainen viikkolohko-bootstrap pitää saman viikon pelit yhdessä ja vertaa
kiinteiden mallien Brier-eroa 5000 uudelleenotoksessa. Molempien vertailujen
suuntaa-antava 95 % vaihteluväli sisältää nollan. Viikkojen riippuvuus ja
kehitysaineiston valintaharha jäävät rajoitteiksi; tulosta ei esitetä lopullisena
tilastollisena näyttönä. Raportti on `results/model-uncertainty.md`.

Tämä tutkii mallien tulosten eron epävarmuutta, ei yksittäisen pelin ±prosenttia.
Kalibrointi, sovitusparametrien epävarmuus sekä kokoonpanoskenaariot vaativat omat
tarkastelunsa. Tulevan kauden ennusteet pitää arkistoida ennen tulosten saamista.

## Harjoitus 10 — ennalta tallennettu seuranta

`python3 learning/forecasting/10_track_forecasts.py` lukee paikallisen naisten
2026–27 aineiston ja lukitut parametrit `model-lock-v1.json`-tiedostosta. Se ei
suorita mallin sovitusta uudelleen, hae aineistoa tai julkaise sivustolle.
Lukon muuttamisen sijaan uudelle mallille tehdään myöhemmin uusi versio.

`history/forecasts-v1.jsonl` on lisäävä historia. Uusi lähtötilanne saa uuden rivin;
vanhoja rivejä ei korvata. `results/latest-forecasts.json` ja `forecast-tracker.md`
ovat päivittyviä näkymiä samasta historiasta. Rivit säilyttävät aikaleiman,
ottelutunnisteen, joukkueet, alkamisen, lähteen tarkistussumman, mallin version
sekä laskentaan käytetyt aiemmat ottelut. Tarkistussummat tunnistavat paikallisen
historian muuttamisen, mutta eivät ole riippumaton julkinen todiste.

Seurannan arviointisääntö lukittiin ennakkoon: ensimmäinen tallennettu arvio
seitsemän päivän sisällä ennen kyseisen ottelun alkua. Joukkueiden ja ajan tulee
täsmätä toteumaan. Siirretty ottelu tarvitsee uuden kelpoisen arvion.
Seitsemän päivän ikkunaan siirtyminen arkistoidaan myös silloin, kun luvut eivät muutu.
Jo pelatuille otteluille ei luoda tämän seurannan ennusteita jälkikäteen.

Saman päivän tuloksia ei vielä käytetä puuttuvien päättymisaikojen takia.
Otteluohjelman `time` yhdistetään päivämäärään: `date` voi sisältää teknisen
keskipäivän kellonajan. Aineiston päivitys, työajastus ja verkkosivun julkaisu
ovat erillisiä seuraavia vaiheita. Paikallista skriptiä ajetaan uudelleen uuden
aineiston saavuttua. Ensimmäinen katselmus 20 seurattavan ottelun jälkeen.

## Miesten Korisliigan rinnakkainen seuranta

`11_lock_men_models.py` sovitti miesten omat parametrit 2024–25 aineistoon ja
lukitsi ne `model-lock-men-v1.json`-tiedostoon. Tätä alustusvaihetta ei ajeta
uudelleen seurantapäivityksessä. Sovitusotteluita oli 161 (molemmilla vähintään
viisi aiempaa); lähteessä 191/192 ottelua ja yksi epäonnistunut haku.
2025–26 aineiston 192 ottelua käytettiin vain laskentapolun vertailuun,
ei parametrien optimointiin. Naisten parametreja ei kopioitu miehille.

`python3 learning/forecasting/10_track_forecasts.py --league men` päivittää
miesten seurannan. `--league women` tai oletus päivittää naisten seurannan.
Liigoilla on erilliset mallilukot ja historiat. Miesten tiedostot alkavat
`men-`-etuliitteellä: `results/men-forecast-tracker.md` ja
`history/men-forecasts-v1.jsonl`. Sama seitsemän päivän arviointisääntö pätee.

13.10.2026 paikallinen miesten lähde sisälsi 21 varmennettua ja 183 tulevaa
ottelua; viisi tulevaa ennen naisten seuraavaa peliä 17.10. Kaikki tulevat
arviot tallennettiin. Kumpikaan seuranta ei vielä hae tai julkaise dataa
automaattisesti. Toteutuneita uusia seurantaotteluita ei vielä ollut.

## Harjoitus 12 — paikallinen ennakkokortti

`12_preview_card.py` valmistelee Vilpas–KTP-ottelun 1005937 kortin aiemmin
arkistoidusta miesten ennusteesta. Se ei muuta mallia tai ennustehistoriaa.
Kortti on erillisessä `preview/`-kansiossa, ei sovelluksen tuotantobuildissa.
Paikallinen esikatselu: http://127.0.0.1:5190/.

Kortissa vaihdetaan kahden mallin välillä, avataan piste-erojen laskentapohja
ja lähdeottelut sekä näytetään pieni otos ja huomioimatta jäävä konteksti.
Kotipaikkaversio käyttää myös hieman eri piste-erokerrointa, joten koko
malliversioiden prosenttieroa ei selitetä pelkän kotiedun vaikutukseksi.
Ottelun jälkeen varmennettu toteuma ja alkuperäinen seuranta-arvio näytetään
erikseen. Tällä hetkellä toteumaa ei ole, ja kortti näyttää odotustilan.

Päivitä kortin aineisto seurannan päivittämisen jälkeen ajamalla
`python3 learning/forecasting/12_preview_card.py`. Esikatselupalvelin palvelee
vain preview-kansiota localhostissa. Ei ajastusta, julkaisua tai live-hakua.
