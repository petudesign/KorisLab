# HBA-Märsky – Vimpelin Veto: ensimmäinen videotarkistus

Ottelu: 9.1.2026, lähde-ID `968942`, lopputulos 89–93.
Video: https://www.youtube.com/watch?v=6FjDbtSGiGg
Tarkistus aloitettu 3.10.2026. Julkaistuun on/off-aineistoon ei ole tehty
videokorjausta tämän tutkimuksen perusteella.

## Todetut erot

Nykyinen vaihtolokin tulkinta tuottaa seuraavat kokonaispeliajat:

| Pelaaja | Vaihtolokista laskettu | Box score | Laskennan ero |
| --- | --- | --- | --- |
| Jessi Nenonen, HBA | 27:26 | 26:54 | +32 s |
| Veronika Nanje, HBA | 18:52 | 19:23 | −31 s |
| Sara Puckett, Veto | 36:37 | 36:47 | −10 s |
| Carolina Kert, Veto | 30:10 | 30:02 | +8 s |
| Jeanae Terry, Veto | 36:38 | 36:29 | +9 s |
| Minttu Isoranta, Veto | 9:05 | 9:14 | −9 s |

Nenosen ja Nanjen erot ylittävät nykyisen 30 sekunnin toleranssin.
Myös heidän plus/miinuksensa poikkeavat:

| Pelaaja | Laskettu | Box score |
| --- | --- | --- |
| Jessi Nenonen | 0 | −3 |
| Veronika Nanje | +8 | +11 |

Diagnoosissa peliaika- ja plus/miinuserot kerättiin yhteen muistinvaraisella
tutkimusajolla, jotta ensimmäinen hylkäys ei peittäisi myöhempiä eroja.
Tuotannon hyväksymisehtoja ei muutettu. Muiden pelaajien plus/miinuksista ei
tullut tässä ajossa ristiriitoja, ja joukkueiden vaaditut tilastot täsmäsivät.

## Hypoteesi ja sen rajat

Vastakkaiset aikaerot sekä kolmen pisteen siirtymä sopivat väärään aikaan
tulkittuun Nenosen ja Nanjen vaihtoon. Tämä on tutkimushypoteesi, ei todistettu
lähdevirhe. Kokeilemalla heidän jokaisen saman kellonajan keskinäisen vaihtonsa
siirtoa erikseen ±31 ja ±32 sekuntia ei löytynyt vaihtoehtoa, joka läpäisisi
kaikki nykyiset tarkistukset. Yhden vaihdon siirtäminen ei siis vielä selitä eroja.
Box score tai oma tulkinta voi myös olla ongelman lähde.

## Videosta havaittu ankkuri

HBA:n kauden 2025–26 virallinen joukkuesivu ilmoittaa Nenosen pelinumeroksi
**18** ja Nanjen numeroksi **7**:
https://www.hba.fi/HBA%2BMarsky%2Btytot%2B2025-26
Tämä on kokoonpanolähteen tieto; numerot pitää vielä tunnistaa tämän videon
vaihtotilanteista. Videon kuvauksessa Veto on valkoinen joukkue.

Videon noin **5:38** kohdalla ruudun tulostaulussa on **1. erä, 6:10**.
Tämä vahvistaa videon ja pelilokin yhteisen tarkistuskohdan. Pelaajien nimien
ja pelinumeroiden yhdistämistä tai vaihdon tarkkaa toteutumista ei ole vielä
vahvistettu tästä kuvasta.

Avaa jakso hieman ennen katkosta:
https://www.youtube.com/watch?v=6FjDbtSGiGg&t=320s

Pelikello ja videon aika kulkevat eri tahtiin katkojen, aikalisien ja erätaukojen
vuoksi. Tätä ankkuria ei voi käyttää vakiosiirtymänä koko ottelulle.

## Tarkistettavat keskinäiset vaihdot

| Erä | Pelikello | Lokin kirjaus | Videotarkistus |
| --- | --- | --- | --- |
| 1 | 6:10 | Nenonen ulos, Nanje sisään | Pelikello paikannettu noin 5:38; pelaajat vahvistamatta |
| 1 | 4:01 | Nanje ulos, Nenonen sisään | Avoin |
| 2 | 5:24 | Nanje ulos, Nenonen sisään | Avoin |
| 2 | 1:21 | Nenonen ulos, Nanje sisään | Avoin |
| 2 | 0:09 | Nanje ulos, Nenonen sisään | Avoin |
| 3 | 1:38 | Nanje ulos, Nenonen sisään | Avoin |
| 3 | 0:25 | Nenonen ulos, Nanje sisään | Avoin |
| 4 | 8:05 | Nanje ulos, Nenonen sisään | Avoin |

Tämä lista sisältää vain kyseisen parin keskinäiset vaihdot; kaikki heidän
vaihtonsa eivät ole keskinäisiä. Tarkistuksessa pitää tarvittaessa seurata myös
muita vaihtoja sekä erän alussa kentällä olevia pelaajia.

## Seuraava tarkistus

1. Tunnista videolta HBA:n numerot 18 (Nenonen) ja 7 (Nanje), jotka on löydetty
   kauden viralliselta joukkuesivulta.
2. Katso ensimmäinen katko ennen ja jälkeen vaihdon. Kirjaa erä, pelikello,
   videon aikaleima, ulos/sisään tuleva pelaaja sekä tunnistamisen varmuus.
3. Etene listan muihin vaihtokohtiin ja tarvittaessa erien aloituksiin.
4. Vasta kuvallisen vahvistuksen jälkeen ehdota erillistä korjausta lähdelokin
   rinnalle ja laske sekä peliminuutit että plus/miinukset uudelleen.

Pythonin kannalta tässä erotetaan kolme asiaa: raaka tapahtumaloki, siitä
laskettu kentällinen ja box scoreen tehtävä vertailu. Videohavainto olisi
neljäs, erikseen talletettava todistetyyppi.
