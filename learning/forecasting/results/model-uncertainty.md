# Onko kotipaikkamalli oikeasti parempi?

Paikallinen jatkotutkimus. Sama kehitysaineisto ja samat kiinteät mallit kuin aiemmin.

## Voittajaosumat samoissa peleissä

Kotipaikaton piste-eromalli nimesi suosikin 103 otteluun. Näissä samoissa peleissä:

| Malli | Oikein | Väärin | Osuus |
|---|---:|---:|---:|
| Piste-ero ilman kotipaikkaa | 75 | 28 | 72.8% |
| Piste-ero + kotipaikka | 76 | 27 | 73.8% |

Lisäksi kotipaikkamalli nimesi suosikin 5 peliin, jotka toinen jätti 50–50-arvioiksi.
Näissä lisävalinnoissa se osui 1/5 kertaa.
Useampaan peliin tehty valinta ei siis automaattisesti ole parempi tai luotettavampi valinta.

## Prosenttiarvioiden eron epävarmuus

Kaikki 108 peliä ovat mukana, myös tasavahvat arviot. Vertailu on parittainen:
kunkin mallin virheestä vähennetään saman ottelun vertailumallin virhe.
Kauden viikkoja otetaan uudelleen 5000 kertaa; saman viikon pelit pysyvät yhdessä.

| Vertailu | Brier-ero | Suuntaa-antava 95 % bootstrap-vaihteluväli |
|---|---:|---:|
| Piste-eromalli miinus Elo | -0.0146 | -0.0322 … +0.0038 |
| Kotipaikkamalli miinus kotipaikaton piste-ero | +0.0040 | -0.0051 … +0.0126 |

Negatiivinen ero suosii rivin ensimmäistä mallia; positiivinen vertailumallia.
Jos vaihteluväli ulottuu nollan molemmille puolille, tämä koe ei erottele malleja vakuuttavasti.

## Kolme eri asiaa, joita ei pidä sekoittaa

1. Mallien paremmuuden epävarmuus: vaihteleeko niiden tulosten ero otteluotoksen mukana? Tätä tutkittiin nyt.
2. Todennäköisyyksien kalibrointi: voittavatko esimerkiksi noin 60 % suosikit pitkässä seurannassa noin 60 % peleistä? Tätä ei vielä varmennettu.
3. Yksittäisen pelin malliarvion epävarmuus: miten arvio muuttuu eri sovituksilla tai kokoonpano-oletuksilla? Tätä ei vielä laskettu.

Yllä oleva vaihteluväli ei tarkoita ottelun voittoprosentin ±virhemarginaalia.
Ottelun luontainen yllätysmahdollisuus on eri asia kuin epävarmuus mallista.

## Rajat ja seuraava vaihe

Aineistossa on 21 viikkolohkoa. Joukkueet toistuvat myös eri viikoilla,
joten viikkolohkojenkin riippumattomuus on vain likimääräinen oletus.
Välit kuvaavat tätä otosta kiinteillä parametreilla, eivät puuttuvaa dataa, tulevaa kautta
tai parametrien sovitusepävarmuutta. Kehityskokeiden valintaharhaa ei korjata tällä.
Seuraavaksi jäädytetään vertailtavat mallit ja kirjataan tulevien otteluiden arviot ennen tuloksia.
Kalibrointia ja malliarvion herkkyyttä tutkitaan erikseen ennen käyttöliittymän virhemarginaalia.
