# KorisLab — ennustaminen ja Pythonin oppiminen

## Lähtötavoite, 13.10.2026

Käyttäjä haluaa syventää Python-osaamistaan rakentamalla otteluennustetta yhdessä
koodausagentin kanssa. Työ tehdään pienissä vaiheissa: käyttäjä saa ennakoida
koodin toimintaa, minkä jälkeen tarkastellaan tuloksia ja laskennan perusteita.
Oppiminen ja toimivuus ovat alkuvaiheessa tärkeämpiä kuin tehokkuus.

## Suunniteltu tuotesuunta

- Paikallinen laskenta ilmaisilla työkaluilla, ilman maksullista AI-palvelua.
- Tulevien otteluiden arviot päivitetään lähtötietojen muuttuessa.
- Poissaolot vaativat lähteen ja voimassaolon; puuttuva ottelumerkintä ei ole
  todiste loukkaantumisesta. Vaikutusta prosenttiin ei keksitä.
- Käyttöliittymä sanoo ”Mallin arvio”, näyttää tiedon rajat ja päivitysajan.
- Ei absoluuttisia voittajaväitteitä, panostussuosituksia tai vedonlyöntikertoimia.
- Ennusteiden historia ja ajallisesti oikein tehtävä testaus kuuluvat suunnitelmaan.

## Toteutettu ensimmäinen vaihe

`learning/forecasting/01_read_matches.py` lukee olemassa olevan paikallisen
otteluaineiston Pythonin standardikirjastolla. Koodi on tarkistettu suorittamalla.
Yhteisessä läpikäynnissä käsiteltiin listan indeksejä, `len()`-funktiota,
sisäkkäisiä silmukoita, ehtoja ja Pythonin sisennyksiä. Käyttäjä tunnisti
tasatuloksen puuttuvan käsittelyn ja ehdotti joukkueiden läpikäyntiin silmukkaa.
Käyttäjällä on ICT-insinöörin koulutus ja aiempaa web- ja mobiiliohjelmointitaustaa;
jatkossa perusasioista edetään reippaammin ja pysähdytään tärkeimpiin kohtiin.

Seuraava toteutus `02_team_results.py` muodostaa joukkueiden tulosyhteenvedon.
Se tarkistetaan oikealla paikallisella aineistolla ja kokonaissummien
tasapainotarkistuksilla. Mallia, automaatiota tai julkista ennustekomponenttia
ei ole tässä vaiheessa toteutettu.

Kirjaa jatkossa todelliset oppimishetket, mallikokeilut, virheet ja päätökset.
Case ei saa väittää ennusteen toimivuutta ennen testituloksia.

## Oppimistavan tarkennus

Käyttäjä haluaa vertailla kolmea uskottavaa koodivaihtoehtoa, ei harjoitella
välttämättä koodin kirjoittamista. Ajallisen suodatuksen harjoituksessa huomattiin,
että viiden ottelun valinta ennen lajittelua voi jättää uudemman ottelun pois:
lajittelu ei korjaa jo rajattua joukkoa. Tämä vietiin oikeaan aineistoon
`03_before_match.py`-esimerkissä. Samalla erotetaan kauden yhteenveto ja
ennustettavan ottelun hetkellä käytettävä historia.

Elo-periaatetta havainnollistetaan seuraavaksi kahdella kuvitteellisella
joukkueella ja kahdella vaihtoehtoisella tuloksella samasta lähtötilanteesta.
Harjoituksen vahvuusluvut, asteikko 400 ja K=32 eivät ole opittuja parametreja.
Esimerkin prosentti on kaavan tulos, ei validoitu arvio oikeasta ottelusta.

## Ensimmäinen historiallinen koe, 13.10.2026

Naisten 2025–26 kauden 108 ottelua käsiteltiin päivittäin aikajärjestyksessä.
Kaikille lähtöluku 1500, K=32 ja asteikko 400, ilman parametrien jälkikäteistä
optimointia. Saman päivän tuloksia ei käytetä, koska päättymisaikoja ei ole.
Ennusteet tallennetaan ennen päivän tulosten käsittelyä ja arviointi yhdistää
ne tuloksiin vasta jälkikäteen.

Yhdeksän joukkueen kuudennet ottelut muodostivat seitsemän eri peliä: suosikki
voitti viisi. Elo Brier 0,216, 50–50 Brier 0,250. Kun molemmilla oli vähintään
viisi aiempaa ottelua, 84 pelin Brier oli 0,203. Tämä on yhden historiallisen
kehitysaineiston havainto, ei osoitus tulevien ennusteiden luotettavuudesta.
Kohde- ja tulevien tulosten muuttamista sekä saman päivän rajausta testattiin
automaattisesti: viisi testiä läpäisi. Raportti ja lähdetiedoston SHA256 ovat
`learning/forecasting/results/`-kansiossa.

BC Nokia–ToPo on havainnollistava tapaus: 52,1 % kotivoittoarvio, toteuma 44–75.
Kapea suosikkiasema ei tarkoita varmaa voittoa eikä malli ennusta piste-eroa.
Poissaolojen tai lepuutuksen syytä ei voi päätellä tästä tuloksesta.

## Ennusteen vahvuus ja jatkosuunnat

Käyttäjä huomautti, että 52–54 % suosikin tappio ei ole vahvasti väärä ennuste,
ja kysyi kausivoittajan, viimeisen sijan sekä pelaajien arvioimisen mahdollisuuksia.
Tämän jälkeen tehtiin vahvuusryhmät samaan kehitysaineistoon ilman parametrimuutoksia.
84 ottelussa: yli 50–alle 55 % suosikit 8/19, 55–alle 65 % suosikit 18/26,
vähintään 65 % suosikit 31/39. Ryhmien arvioiden KA:t 52,4 %, 59,2 % ja 73,2 %.
Erottelukykyä näyttää olevan tässä aineistossa; kalibrointia tai yleistymistä
ei vielä ole osoitettu. Seitsemän testiä läpäisi, mukaan lukien ryhmärajat ja vierassuosikit.

Mahdollinen jatko: kauden jäljellä olevien otteluiden toistuva simulointi ja
sijoitusjakaumat. Runkosarjan ykkönen, mestaruus ja viimeinen sija ovat eri kohteita;
mestaruus vaatii kausikohtaisten pudotuspeli- ja tasapistesääntöjen toteutuksen.
Simulaatio ei paranna heikkoa ottelumallia, vaan perii sen oletukset.

Pelaajapuolella ensimmäiset kohteet voisivat olla rooli, minuuttimäärä ja
osa-aluekohtainen suoritus suhteessa omaan historiaan, vastustajiin ja
pelimahdollisuuksiin. Ei suoraa joukkue-Eloa yksilöihin eikä yleistä paremmuuslukua
pelkästä PPG:stä. MVP on myös palkintopäätös, ei suoraan tilastosta havaittava totuus.

## Edellisen kauden painotuksen koe

2024–25 lähteen 129 ottelusta muodostettiin Elo-lähtöluvut 2025–26 kaudelle.
Kertoimet 0, 0,25, 0,5, 0,75 ja 1 valittiin ennakkoon eikä mallia vaihdettu.
Tasavahvan aloituksen koko kauden Brier 0,209; puolikas historiapaino 0,225 ja
täysi 0,253. Alkukauden 21 ottelussa arvot 0,231 / 0,263 / 0,310.
Kuudensien seitsemässä pelissä järjestys oli päinvastainen: 0,216 / 0,171 / 0,150.
Pienen otoksen parannus olisi ohjannut eri valintaan kuin laajempi otos.

Tämä ei osoita, ettei historiasta koskaan olisi hyötyä. Kokoonpanoja ei huomioida,
lähteen koko kauden kattavuutta ei ole varmennettu ja malli on yksinkertainen.
Oppimisen kannalta tärkeä tulos: järkevä oletus ei automaattisesti paranna
ennustetta. Yhdeksän testiä läpäisi myös lähtöarvojen tarkistukset.

## Piste-erolähtötaso ja kotipaikka

Lähdekoosteen tarkistus paikansi kattavuuspuutteen: 2024–25 ilmoittaa 130
pelattua peliä, 129 haettua ja yhden epäonnistumisen. Uudemman kauden 108/108
täsmäävät. Pudotuspelit jätettiin tästä runkosarjakokeesta erilleen.

2024–25 aineistolla sovitettiin logistinen piste-erolähtötaso sekä kotipaikan
bias-korjaukset, ja arvioitiin ne 2025–26 aineistossa. Koko kauden Brier:
Elo 0,209; Elo + kotipaikka 0,211; piste-ero ilman kotipaikkaa 0,194;
piste-ero + kotipaikka 0,198. Mallia ei vaihdettu tai julkaistu.
2025–26 on edelleen kehitysaineisto, koska sitä on jo tutkittu.

Piste-eromalli kuvaa aiempien pelien keskimääräistä piste-eroa, ei ennusta
ottelun loppupisteitä. Vastustajien vahvuus ja kokoonpanot puuttuvat siitä.
Kotipaikkakorjaus ei osoita kotiedun kausaalivaikutusta. Erot vaativat uuden
testiaineiston ja epävarmuuden arvioinnin ennen vahvoja väitteitä.

Vertailumallien ja aiempien kokeiden 15 testiä läpäisi. Kotipaikattoman mallin
peilatuille harjoitusotteluille annetaan puolikas paino, jotta sama aineisto ei
saa vahingossa kaksinkertaista painoa suhteessa L2-säännöllistykseen.

## Ensimmäinen epävarmuustarkastelu

Piste-eromallit nimesivät suosikin samoihin 103 otteluun: kotipaikaton osui 75,
kotipaikkamalli 76 kertaa. Kotipaikkamalli osui viidestä lisävalinnastaan vain kerran.
Useamman voittajan nimeäminen ei siis automaattisesti lisää luotettavuutta.

Viikkolohko-bootstrap, 5000 toistoa ja 21 viikkoa: piste-ero miinus Elo Brier-ero
-0,0146, vaihteluväli -0,0322…+0,0038; kotipaikka miinus kotipaikaton +0,0040,
vaihteluväli -0,0051…+0,0126. Molemmat sisältävät nollan. Tätä pidetään
suuntaa-antavana yhden kehitysaineiston tarkasteluna, ei lopullisena näyttönä.
Viikkojen välinen riippuvuus ja mallien sovitusepävarmuus eivät sisälly siihen.

Oppimisen kannalta erotettiin mallien paremmuuden epävarmuus, prosenttien
kalibrointi ja yksittäisen ottelun arvion herkkyys. Jälkimmäiselle ei keksitä
esimerkiksi ±5 % virhemarginaalia. Testikokonaisuus: 18 läpäisevää testiä.

## Ennusteseurannan aloitus, 13.10.2026

Kaksi piste-eromallia lukittiin versioon women-margin-v1 käyttäen aiemmassa kokeessa
vain 2024–25 aineistolla sovitettuja parametreja. Uusia parametreja ei haettu.
Paikallinen 2026–27 lähde sisälsi 12 varmennettua ottelua ja 96 tulevaa ottelua.
Kaikille tuleville peleille arkistoitiin aidot ennen ottelua tehtävät arviot,
ja neljä peliä oli ensimmäisellä ajolla seitsemän päivän arviointi-ikkunassa.
Toteumia oli seurannassa vielä nolla. Lähdekoosteen päivitys oli 12.10.2026;
skripti ei itse hae tuoretta aineistoa.

Oppimistavoitteen konkreettinen esimerkki: muuttumaton lisäävä ennustehistoria
ja erikseen päivittyvä uusinäkymä. Ensimmäinen kelpoinen seitsemän päivän ennuste
valitaan arviointiin ennalta, ei jälkikäteen parasta ennustetta. Kellonaika
yhdistetään otteluohjelman erillisestä time-kentästä, eikä teknisestä date-ajasta.
Muuttuneelle alkamisaikataululle tarvitaan uusi kelpoinen arvio.

24 testiä läpäisi, mukaan lukien historian säilyminen, saman lähtötilanteen
deduplikointi, ikkunaan siirtyminen, siirtynyt ottelu, ennen tuloksia syntyneen
ensimmäisen arvion valinta ja muutetun historian hylkäys. Ennusteita ei julkaistu
sivustolle eikä tausta-ajastusta tehty. Virhemarginaalia ei esitetä.

## Miesten seuranta mukaan

Käyttäjä pyysi saman seurannan miesten Korisliigaan, koska paikallisessa
ohjelmassa oli viisi peliä ennen naisten seuraavaa ottelua. Miesten omat
parametrit sovitettiin 2024–25 kauden 161 kelpoiseen harjoitusotteluun
(lähteessä 191/192 ottelua); lukko men-margin-v1 luotiin ennen tulevien arvioita.
Naisten parametreja ei käytetty miesten malleissa.

Miesten 2025–26 aineiston laskentapolun vertailussa piste-eromallin Brier oli
0,240 ja kotipaikkaversion 0,233; parametreja ei muutettu tämän tuloksen mukaan.
13.10.2026 lähde sisälsi 21 varmennettua ja 183 tulevaa ottelua. Niiden arviot
arkistoitiin erilliseen historiaan, mukaan lukien 14.10 ja 16.10 viisi peliä
ennen naisten seuraavaa ottelua. Toteutuneet seurantaottelut: vielä nolla.
Lähdekoosteen päivitys 12.10.2026. Liigojen päivitys on manuaalinen paikallinen
skriptiajo uuden aineiston saavuttua. Ei tausta-ajastusta tai sivustojulkaisua.

## Ennusteen esittäminen ymmärrettävästi

Vilpas–KTP-ottelulle tehtiin erillinen paikallinen ennakkokortti (preview/, portti 5190).
Käyttöliittymä erottaa mallin arviot, laskennan lähtötiedot, pienet otokset,
huomioimatta jäävän kontekstin ja ottelun jälkeisen arvioinnin.
Kaksi mallia vaihtaa niukkaa suosikkia: piste-eromalli 47/53 ja kotipaikkaversio
55/45. Nämä ovat arkistoituja arvoja, eivät käyttöliittymään keksittyjä numeroita.
Kotipaikkaversion koko eroa ei väitetä kotiedun kausaalivaikutukseksi.

Desktop- ja 390 px mobiiliesikatselu tarkistettiin selaimessa. Mallinvaihto,
lähdeotteluiden avaus sekä odottaa ottelua -tila toimivat, konsolissa ei ollut
virheitä. Toteuman oikean aineiston tila voidaan tarkistaa vasta ottelun jälkeen.
Kortti ei ole julkisella sivustolla. Tämä toimii casessa esimerkkinä siitä,
miten tekniset prosentit muutettiin luettavaksi, epävarmuuden näyttäväksi tuotteeksi.

### 15.10.2026: ensimmäiset kaksi aidosti ennalta arvioitua tulosta

14.10. pelatut Lahti–Kouvot (91–83) ja Vilpas–KTP (81–102) tarkistettiin
Basket.fi:n virallisista box scoreista. Molemmat läpäisivät validaattorin ilman
varoituksia. Vertailussa käytettiin 13.10. tallennettuja alkuperäisiä arvioita;
ennustehistorian sisältö ja malliparametrit säilyivät muuttumattomina.

Piste-eromallin suosikki voitti molemmat (Lahti 56,8 %, KTP 52,7 %).
Kotipaikkaversio osui Lahteen (65,0 %) mutta suosi Vilpasta (55,5 %).
Kahden pelin Brier-luvut ovat 0,2048 ja 0,2152; 50/50-verrokki 0,2500.
Näin pieni otos ei osoita mallien yleistä paremmuutta tai prosenttien kalibraatiota.
KTP:n 21 pisteen voitto ei myöskään validoi voittomarginaalien ennustetta:
nykyiset mallit tuottavat vain voittotodennäköisyyksiä.

Mallien erimielisyys ratkesi tällä kertaa piste-eromallin suosikin hyväksi.
Se on säilytettävä havainto, ei yksin peruste kotiedun poistamiselle. Lisäksi
malliversiot eroavat myös piste-eropainoltaan. Kehitystä jatketaan evidenssin
perusteella ilman ennalta määrättyä pakollista ottelumäärärajaa.

Tulokset tallennettiin erilliseen `learning/forecasting/results/men-reviewed-results.json`
koosteeseen ja ihmisen luettavaan `men-review-2026-10-14.md` raporttiin.
Vilpas–KTP-esikatselun toteuma päivittyi paikallisesti. Kausidataa, tulevia
arvioita tai julkista sivustoa ei päivitetty tässä tarkistuksessa.

### 21.10.2026: seurannassa 12 päättynyttä ottelua

13.10. arkistossa oli 183 miesten ja 96 naisten tulevan ottelun arviot.
21.10. iltapäivään mennessä näistä kahdeksan miesten ja neljä naisten peliä
oli pelattu. Kaikki 12 tulosta haettiin tai luettiin virallisista paikallisista
box scoreista, validoitiin ja verrattiin ensimmäiseen ennalta tallennettuun,
seitsemän päivän ikkunan arvioon. Ennustehistoria ja parametrit säilyivät ennallaan.

Miehet: molemmat mallit 5/8 suosikkiosumaa. Brier piste-eromallille 0,2314 ja
kotipaikkaversiolle 0,2018. Kotipaikkaversio hävisi Vilpas–KTP-vertailun mutta
suosi oikein Kauhajokea Seagullsia vastaan (91–76). Piste-eromallin alkuperäinen
Seagulls-arvio oli 50,3 %, ei täsmälleen tasan 50 %. Tämä havainnollistaa,
miksi pyöristetyn prosenttiluvun perusteella ei pidä määrittää mallin suosikkia.

Naiset: molemmat 2/4 suosikkiosumaa. Brier 0,3229 ja 0,3595, kun 50/50-verrokki
on 0,2500. ToPo hävisi EBT:lle 67–68, vaikka kotivoittoarviot olivat 86,4 % ja
89,3 %. Yhden pisteen tulos ei osoita yksin todennäköisyyttä vääräksi, mutta
vahvan suosikin tappio on tärkeä tarkistettava tapaus kalibraation ja puuttuvan
kontekstin kannalta. Honka hävisi Peli-Karhuille 75–83, vaikka mallit suosivat
Honkaa (64,8 % / 70,5 %). Syitä ei päätellä näistä loppulukemista.

Yhteensä molemmat 7/12. Liigat raportoidaan myös erikseen, koska niillä on
omat sovitetut parametrit. Havaintoja kertyy jatkuvasti; mallia ei valita
paremmaksi näin pienestä aineistosta eikä odoteta pakollista ottelumäärärajaa.
Nykyiset tulokset ovat 13.10. lähtötiedoista tehtyjen arvioiden seurantaa:
taustalla ei ole automaattista aineiston päivitystä. Tulevat arviot on päivitettävä
erillisessä ajossa uusilla lähtötiedoilla, säilyttäen myös alkuperäiset arviot.

Tulokset, lähdetiedostojen ja ennustehistorian tarkistussummat sekä puuttuvien
alkamisaikojen rajoitus tallennettiin arviointikoosteisiin. Uusi skripti
`13_review_archived.py` tekee saman tarkistuksen uudelleen muuttamatta ennusteita.

## Hallintasimulaattori, ensimmäinen koe 21.10.2026

Basket.fi:n pelitapahtumista muodostettiin hallinnat kentällisineen
(`normalization/basketfi_possessions.py`). Miesten 2025–26 kaudelta 132/192
ottelua täsmäsi box scoreen; loput hylättiin samoilla kentällistarkistuksilla
kuin on/off-luvuissa. Hallintoja 20 952, keskimäärin 79,4 joukkuetta ja ottelua
kohden, 1,5 % box score -arviota enemmän. Pisteet täsmäsivät jokaisessa
hyväksytyssä ottelussa ja hallintojen kestot jokaisessa erässä.

Riistosta alkavat hallinnat tuottivat 124 pistettä sataa kohden, vastustajan
korin jälkeiset 104. Tämä on kuvaileva havainto koko kaudesta, ei ennuste.

`learning/forecasting/possession_sim.py` pelaa ottelun hallinta kerrallaan
pelikelloa vasten. Tulos riippuu alkutavasta sekä hyökkääjän, puolustajan ja
koti/vieras-puolen kertoimista, jotka kutistetaan kohti liigatasoa. Parametrit
(prior 30, tempo-prior 600 s, 2000 simulaatiota, siemen 0) valittiin etukäteen.
Testi `14_possession_sim_backtest.py` käyttää vain aiempien päivien hallintoja.

162 ottelua, joissa molemmilla vähintään viisi aiempaa ottelua:
simulaattori Brier 0,2395, Elo K=32 0,2384, 2024–25 lukittu piste-eromalli
kotikertoimella 0,2322, kotivoittojen osuus 0,2475, 50/50 0,2500.
Simulaattori ei siis ollut Eloa parempi ja hävisi lukitulle piste-eromallille.
Se oli ylivarma: 0,8–1,0-ryhmän keskiarvio 86 %, toteuma 75 % (24 ottelua).
Piste-eron keskivirhe 11,6, kun pelkkä nolla antaa 12,2. Kokonaispisteet
keskimäärin 2,8 liian vähän.

Todennäköisiä syitä: simulaattori näki vain hyväksytyt 132 ottelua, kun Elo
näki kaikki tulokset; joukkuekertoimet ovat piste-estimaatteja ilman
epävarmuutta, mikä tekee jakaumasta liian kapean; kokoonpanoja ja poissaoloja
ei käytetä. Parametreja ei säädetty tämän kauden perusteella, koska se tekisi
vertailusta jälkiviisasta. Säätö kuuluu kaudelle 2024–25 ja lukitaan ennen
uutta vertailua.

## Hallintasimulaattori v2, 21.10.2026

v1:n vertailu lukittiin ottelukohtaisine ennusteineen ja lähteiden
tarkistussummineen: `learning/forecasting/results/possession-sim-v1.json`.

Kaksi muutosta v2:een. Hallinnat muodostetaan nyt myös otteluista, joiden
kentälliset eivät täsmää, kun pisteet täsmäävät (kentälliset jäävät tyhjiksi):
2025–26 191/192 ottelua, aiemmin 132. Simulaattoriin lisättiin valinnainen
ottelukohtainen vire (`shock`), jonka piti vähentää ylivarmuutta.

Parametrit valittiin pelkällä kaudella 2024–25 (189 ottelua hallintoina,
161 arvioitua ottelua): prior {15, 30, 60, 120} × vire {0–0,3}.
Paras oli prior 30 ilman virettä, Brier 0,2161 (Elo 0,2273 samoissa otteluissa).
Vire ei parantanut 2024–25 arviota, joten v2:n parametrit ovat samat kuin v1:n;
ero on aineiston kattavuudessa. Lukitus: `model-lock-possession-sim-v2.json`.

Lukitun v2:n vertailu kaudella 2025–26, samat 162 ottelua kuin v1:
Brier 0,2391 (v1 0,2395), Elo 0,2384, lukittu piste-eromalli 0,2322.
Suosikki voitti 101/162 kertaa, eniten malleista, mutta todennäköisyydet olivat
yhä liian jyrkät: 0,8–1,0-ryhmässä arvio 86 %, toteuma 77 % (22 ottelua);
0,6–0,8-ryhmässä 70 % ja 57 % (51 ottelua). Piste-eron keskivirhe 11,5.
Tallenne: `results/possession-sim-v2.json`.

Johtopäätös: kattavampi aineisto ei yksin poistanut ylivarmuutta. Kaudella
2024–25 simulaattori voitti Elon selvästi, kaudella 2025–26 ei; kahden kauden
ero voi olla satunnaista. Seuraava kokeiltava on epävarmuus, joka riippuu
joukkueen otoksen koosta, sekä pelaajatason kentälliset.

## Pelaajatason simulaattori ja Sim Studio, 21.10.2026

Hallintoihin tallennetaan nyt pelaajatapahtumat: heitot koordinaatteineen,
syötöt, levypallot, menetykset, riistot, blokit ja virheet. Uusi
`simulation/player_sim.py` pelaa hallinnan pelaajatasolla. Toimija valitaan
kentällä olevista käyttöasteen mukaan. Heittoalue ja tarkkuus ovat pelaajan omia,
ja heittopaikka arvotaan pelaajan oikeista heittopaikoista. Syöttäjä valitaan
toteutuneiden syöttöparien mukaan, levypallon ottaja levypallotahdin mukaan.
Puolustuksen kertoimet tulevat joukkuetasolta. Kaikki kutistetaan kohti liigatasoa
etukäteen valituilla priori-painoilla. Rotaatio arvotaan viimeisimpien otteluiden
peliminuuttiosuuksista; poissaoloja malli ei tiedä.

Mekaniikan tarkistus oikeaa box scorea vasten paljasti kolme virhettä, jotka
korjattiin ennen vertailua: vapaaheittokäynnit puuttuivat (alatyyppi lisättiin
hallintadataan liian myöhään), puolustuksen menetyskertoimen kutistus oli vino
ja erän viimeinen hallinta katosi summeriin. Korjaukset koskivat laskennan
mekaniikkaa, eivät otteluvoittajia, eikä priori-painoja muutettu tulosten perusteella.

Ajallisesti oikea vertailu kaudella 2025–26 (161 ottelua, 400 simulaatiota,
2024–25 painolla 0,5): Brier 0,2382. Hallintasimulaattori v2 0,2398, Elo 0,2386
ja lukittu piste-eromalli 0,2329 samoissa otteluissa. Suosikki voitti 90 kertaa.
Kalibraatio oli hyvä: 0,6–0,8-ryhmässä arvio 67 %, toteuma 71 % (44 ottelua).
Kokonaispisteet keskimäärin 1,8 liian vähän. Pelaajien pisteennusteen ja
toteuman korrelaatio 0,65, keskivirhe 4,6 pistettä. Tallenne:
`learning/forecasting/results/player-sim-v1.json`.

Huomio: hallintatiedostot julkaistiin uudelleen tapahtumineen, joten v1:n ja
v2:n lukituksissa olevat hallintatiedostojen tarkistussummat viittaavat
aiempiin tiedostoversioihin. Lukittujen ennusteiden tulokset eivät muutu.

Sim Studio (`web/public/sim-studio/`) näyttää tulevan ottelun 1 000 simulaatiota:
voittotodennäköisyyden, piste-erojakauman, miten kumpikin joukkue voittaa,
pelaajien pistejakaumat ja syöttöparit. Yhden simuloidun pelin voi katsoa
3D-kentällä. Pelaajien liike tapahtumien välillä on havainnollistus pelaajien
omista heittopaikoista, ei seurantadataa; sivu kertoo tämän.

## Pelaajasimulaattorin virheanalyysi (KOR-10), 28.10.2026

Kysymys: missä pelaajasimulaattori (v1, Brier 0,2382) häviää lukitulle
piste-eromallille (0,2329) kauden 2025–26 samoissa 161 ottelussa? Lukittu v1-ajo
toistettiin rinnakkaisena (`simulation/evaluate.py`), ja todennäköisyydet olivat
identtiset jäädytetyn tiedoston kanssa. Lisäksi talteen jäi jokaisen ottelun
piste-erojakauma. Ajo: `python3 -m simulation.error_analysis`, tulos
`learning/forecasting/results/player-sim-v1-error-analysis.json`.

Havainnot:

- **Erottelu on parempi, kalibrointi huonompi.** Brierin hajotelmassa
  simulaattorin resoluutio oli 0,032 (piste-eromalli 0,015, Elo 0,008), mutta
  kalibrointivirhe 0,024 (piste-eromalli 0,003). Simulaattori siis järjestää
  ottelut paremmin, mutta sen todennäköisyydet ovat väärän kokoisia. 161 ottelua
  ja kymmenen luokkaa tekevät hajotelmasta kohinaisen, joten suunta on luotettavampi
  kuin tarkat luvut.
- **Ennusteet ovat liian varovaisia.** Ennustettujen piste-erojen hajonta oli vain
  5,1 pistettä, ja keskimääräinen etäisyys 50 %:sta 0,106 (piste-eromalli 0,140).
  Kotijoukkue voitti keskimäärin 0,95 pistettä ennustettua enemmän.
- **Jakauman leveys on kohdallaan.** Simuloitu piste-eron keskihajonta 14,9,
  toteutunut virheen hajonta 14,5; standardoitujen virheiden hajonta 0,98.
  80 %:n väliin osui 84 %. Ongelma on keskiarvoissa, ei hajonnassa.
- **Häviö tulee vaihtuneista kokoonpanoista.** Kun ottelussa oli joukkue, jonka
  kauden minuuteista enintään 22 % pelasivat samassa joukkueessa edellisellä
  kaudella (80 ottelua), simulaattori hävisi selvästi: 0,238 vs. 0,218. Vakaampien
  kokoonpanojen otteluissa (81) se voitti piste-eromallin: 0,238 vs. 0,248.
  Suurimmat häviöt olivat KTP:n ja Lahden otteluissa, ja kummankin kokoonpano oli
  käytännössä kokonaan uusi. Uudesta pelaajasta simulaattorilla on vain sarjan
  keskitaso, kun taas piste-eromalli oppii joukkueen tuloksista suoraan.
  Jatkuvuus on laskettu koko kauden minuuteista, joten se selittää eikä ennusta.
- **Erimielisyydet:** 37 ottelussa mallit suosivat eri joukkuetta.
  Piste-eromalli oli oikeassa 22, simulaattori 15 kertaa.
- **Kauden vaihe:** simulaattori voitti joulukuun ja tammikuun alun jakson
  (0,202 vs. 0,216), mutta hävisi muut kolme neljännestä.

Päätös: ensin halvin ja reilu korjaus eli priorien viritys kaudella 2024–25
(KOR-11), painona joukkuekertoimen priori. Se ratkaisee, kuinka nopeasti
uuden kokoonpanon tulokset siirtyvät ennusteeseen. Jos viritys ei riitä, seuraava
kokeiltava on joukkuetason tuloskorjaus uusille kokoonpanoille tai kalibrointi
2024–25:llä sovitetulla muunnoksella.

## Pelaajasimulaattorin priorien viritys, v2 (KOR-11), 28.10.2026

Priorit viritettiin pelkällä kaudella 2024–25 ja lukittiin ennen kauden 2025–26
lukemista (`python3 -m simulation.tune --lock v2`). Ruudukko: joukkuekertoimen
priori 40/80/150/300, per minuutti -priori 40/80/160 ja käyttöasteen priori
30/60/120, eli 36 yhdistelmää. Kullakin ajettiin walk-forward 400 simulaatiolla
158 ottelussa, joissa kummallakin joukkueella oli viisi aiempaa ottelua.

- Paras oli joukkuekerroin 300 ja käyttöaste 120 (v1: 150 ja 60): Brier 0,2257,
  kun v1:n arvoilla saatiin 0,2270. Paras arvo osui ruudukon reunaan, eli
  joukkuetason kutistusta haluttiin vahvemmaksi, ei heikommaksi kuin virheanalyysin
  perusteella odotin.
- Per minuutti -priori ei muuttanut voittotodennäköisyyksiä lainkaan. Se vaikuttaa
  vain levypallo-, syöttö- ja riistotilastoihin.
- Lukitusta: `learning/forecasting/model-lock-player-sim-v2.json`.

Lukittu vertailu kaudella 2025–26 samoissa 161 ottelussa
(`python3 -m simulation.tune --evaluate v2`): **v2 Brier 0,2400**, v1 0,2382,
piste-eromalli 0,2329, Elo 0,2386. Suosikki voitti 84 kertaa (v1 90). Viritys
siis huononsi tulosta. Tallenne: `learning/forecasting/results/player-sim-v2.json`.

Todennäköinen syy: 2024–25 viritettiin ilman edellisen kauden historiaa, jolloin
kaikki pelaajat olivat kauden alussa tuntemattomia ja vahva joukkuetason kutistus
auttoi. Kaudella 2025–26 simulaattorilla on 2024–25 historia painolla 0,5, ja
tilanne on toinen. Kahden kauden aineistolla virityskausi ei vastaa testikautta.

Päätös: tuotannon simulaattori pysyy v1:n prioreissa. Prioreista ei ole
haettavissa reilua parannusta ennen kuin historiaa on kolmelta kaudelta.
Seuraava kokeilu kohdistuu suoraan virheanalyysin löydökseen: uusien
kokoonpanojen joukkueille joukkuetason tuloskorjaus nykykauden otteluista, tai
todennäköisyyksien kalibrointi. Kumpikin pitää lukita ennen 2025–26-vertailua
samalla tavalla.

## Naisten simulaattorin lukittu testi (KOR-15), 29.10.2026

Sama ajallisesti oikea testi kuin miehillä (`python3 -m simulation.women_test`):
kausi 2025–26, jokainen ottelu ennustetaan vain aiempien päivien datalla,
kausi 2024–25 painolla 0,5. Priorit ovat lukitut v1-arvot, eli niitä ei ole
säädetty naisten datalla. Ottelupäivät tulevat sivuston ottelutiedostoista,
samasta lähteestä kuin Sim Studiossa. Mukana 83 ottelua, joissa kummallakin
joukkueella oli viisi aiempaa ottelua.

| Malli | Brier |
| --- | --- |
| Naisten lukittu piste-eromalli (women-margin-v1) | 0,1950 |
| Elo k=32 | 0,2031 |
| Pelaajasimulaattori v1 | 0,2103 |
| 50/50 | 0,2500 |
| Kotivoittojen osuus | 0,2535 |

Suosikki voitti 55 ottelua 83:sta. Piste-eron keskivirhe 12,1 pistettä ja
kokonaispisteet keskimäärin 1,8 liikaa. Kalibraatio: 0,6–0,8-ryhmässä arvio 70 %,
toteuma 65 % (23 ottelua); 0,4–0,6-ryhmässä kotijoukkue voitti vain 37 %
(27 ottelua), eli lähes tasaisiksi arvioiduissa otteluissa vierasjoukkue pärjäsi
odotettua paremmin.

Johtopäätös on sama kuin miehillä: simulaattori on selvästi sattumaa parempi,
mutta ei vielä parempi kuin yksinkertaiset joukkuetason mallit. Naisten sarjassa
erot joukkueiden välillä ovat suurempia, joten kaikki mallit osuvat paremmin
kuin miehillä. Tallenne: `learning/forecasting/results/player-sim-women-v1.json`.
Sim Studion naisten selitysteksti päivitettiin vastaamaan tulosta.
## Ottelukohtainen vire pelaajille ja joukkueille (KOR-16), 29.10.2026

Simulaattori käytti jokaisessa simulaatiossa samoja keskiarvoja. Pelaajien
80 %:n pistevälit olivat siksi liian kapeita: kaudella 2025–26 toteuma osui
väliin vain 73,2 %:ssa (2024–25: 71,2 %). Simulaattoriin lisättiin "päivän vire":
jokaiselle simuloidulle ottelulle arvotaan pelaajan heittotarkkuudelle ja
käyttöasteelle sekä joukkueen puolustukselle log-normaali kerroin, keskiarvo 1.
Vire arvotaan omasta satunnaislukuvirrastaan, joten nollahajonnalla tulokset
ovat täsmälleen samat kuin v1:ssä (tarkistettu, ja sille on testi).

Hajonnat valittiin kaudella 2024–25 (`python3 -m simulation.tune_form --lock v1`)
60 yhdistelmästä: heitto 0–0,2, käyttöaste 0–0,3, puolustus 0–0,08. Sääntö
kirjattiin ennen ajoa: Brier saa heiketä enintään 0,001, ja sen sisällä valitaan
kattavuus lähimpänä 80 %:a. Valinta: heitto 0,2, käyttöaste 0,3, puolustus 0,04
(2024–25: kattavuus 71,2 % → 76,2 %, Brier 0,2270 → 0,2258). Suurin kattavuus
koko ruudukossa oli 76,2 %, eli valittu osui ruudukon reunaan.

Lukittu vertailu kaudella 2025–26 (samat 161 ottelua, `--evaluate v1`):

| | Ilman virettä | Vireellä |
| --- | --- | --- |
| Pelaajien 80 %:n välin kattavuus | 73,2 % | 77,9 % |
| Brier | 0,2382 | 0,2419 |
| Piste-eron z-hajonta (tavoite 1) | 0,98 | 0,86 |
| Simuloitu piste-eron keskihajonta | 14,9 | 17,0 |

Vire teki pelaajien pistevälit realistisemmiksi, mutta levitti samalla
joukkueiden lopputuloksia liikaa. Joukkuetason vaihtelu oli jo valmiiksi oikean
kokoinen, joten lisävaihtelu veti todennäköisyyksiä kohti 50 %:a ja heikensi
Brieriä. Tallenteet: `learning/forecasting/model-lock-player-form-v1.json` ja
`learning/forecasting/results/player-form-v1.json`.

Päätös: tuotannossa ei käytetä virettä (`FORM` pysyy nollassa). Seuraava
kokeiltava on vire, joka säilyttää joukkueen kokonaistason: käyttöasteen vire
jakaa saman joukkueen heitot uudelleen pelaajien kesken, ja heittovireet
normitetaan joukkueen sisällä keskiarvoon 1. Silloin yksittäisten pelaajien
illat vaihtelevat, mutta joukkueen piste-eron hajonta ei kasva.
