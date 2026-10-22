# Peliaikojen lähdevirhe, 21.10.2026

## Havainto ja vaikutus

Miesten Korisliigan 2025–26 lähteen osa peliajoista sisältää pyöristetyn
minuuttimäärän ISO-keston **sekuntikentässä**. Basket.fi:n nykyinen julkinen
Sportradar-lähde palauttaa esimerkiksi Dunnin 22.10.2025 ottelulle PT0M40S.
Normaali ISO-parseri tulkitsee tämän oikein 40 sekunniksi, mutta lähdearvo on
virheellinen. Joukkueiden yhteenlasketut peliajat paljastavat yksikkövirheen.
Yhdessä ottelussa vain neljän pelaajan arvot ovat väärässä yksikössä.

Lähdeottelut:
- [Kobrat–Kauhajoki, 968707](https://tulospalvelu.basket.fi/match/968707/statistics)
- [Vilpas–Bisons, 968760](https://tulospalvelu.basket.fi/match/968760/statistics)

Virhe vaikuttaa MIN/O-lukuun, per 40 minuutin tilastoihin, roolivertailuihin
ja minuutteja käyttäviin otosrajoihin. Pistekeskiarvo ei itsessään muutu.

## Korjaus

Kuuden käyttöliittymäkauden tarkistuksessa löydettiin 63 tunnistettavaa
yksikkövirheottelua: 62 miesten kaudella 2025–26 ja yksi kaudella 2024–25.
48 ottelun virheelliset peliajat palautettiin virallisten vaihtotapahtumien ja
ottelukellon perusteella. 15 ottelussa (14 + 1) tapahtumadata ei läpäissyt
kaikkia tarkistuksia: niiden virheellisiä minuutteja ei julkaista lukuna.

Pelkkä kertominen 60:llä ei ole korjaus: alkuperäisistä arvoista puuttuvat
sekunnit. Palautus vaatii täydet erät, viisi pelaajaa kentällä, johdonmukaiset
vaihdot, pisteiden ja heittojen täsmäytyksen sekä pelaajakohtaisen +/−-tarkistuksen.
Palautettujen sekuntien on lisäksi vastattava lähteen pyöristettyä minuuttimäärää
30 sekunnin toleranssilla. Epäselvää yksikköehdokasta ei valita arvauksella.

- Damian Dunn: kaikki 13 ottelua nyt käytettävissä, MIN/O 31,2. Esimerkkipeli
  39:48 ja 32 pistettä.
- Claudell Harris Jr.: neljän ottelun ajat palautettu (23:37, 24:33, 26:44,
  31:57). Otteluiden 968761 ja 968751 peliajat jäävät puuttuviksi. MIN/O sekä
  kauden per-40-luvut näytetään viivana. Kaikki kuusi ottelua ja PPG 20,0 säilyvät.

Puuttuvat minuutit eivät saa poistaa pelaajan ottelua tai laskea esimerkiksi
koko kauden pisteitä vain neljän ottelun minuuteilla. Samat suojaukset koskevat
profiileja, listoja, hakua, muutostarkastelua ja Matchup Labin per-40-laskentaa.
Käyttöliittymässä on FI/EN-selite puuttuville peliajoille.

## Jäljitettävyys ja regressiosuoja

- Ottelukohtainen auditointi: `playing-time-audit-2026-10-21.json`.
- Alkuperäiset peliajat säilytetään pelaajan source_fields-kentässä.
- Palautuksen menetelmä, tapahtumalähteen fixture ID ja SHA-256 säilytetään.
- Viralliset tapahtumavastaukset paikallisesti `data/cache/playing-time-recovery/`.
- Uusi datanhaku yrittää saman tarkistetun palautuksen; epäonnistuessaan se
  jättää minuutit puuttuviksi säilyttäen muut tilastot.
- Vanhan yksikkövirheen sisältävä välimuisti ei enää läpäise validointia.
- Molempien korjattujen kausien kaikki pisteet, muut laskettavat tilastot,
  ottelutulokset ja ottelumäärät verrattu Gitin alkuperäiseen aineistoon: samat.
- Ennustekokeiden lukittuja opetus- tai arvioaineistoja ei muutettu. Niiden
  historiatiedostojen alkuperäiset tiivisteet säilyvät auditoinnissa, jos
  lähdeaineiston korjattu versio poikkeaa myöhemmin samassa tiedostopolussa.

Tämä auditointi korjaa tunnistetun yksikkövirheen, ei lupaa kaikkien lähdekenttien
olevan virheettömiä. Joissakin muissa otteluissa joukkueiden peliaikasummat
poikkeavat odotetusta ilman tunnistettavaa yksikkövirhettä; niiden syytä tai
korvaavia peliaikoja ei päätellä tästä säännöstä. Näitä pitää tutkia erikseen.
