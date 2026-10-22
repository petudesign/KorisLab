# Ensimmäinen Elo-koe · Naisten Korisliiga 2025–26

Paikallinen historiallinen koe. Ei tuotannon ennuste eikä validoitu voittotodennäköisyys.

Kaikki joukkueet aloittavat luvusta 1500. K=32 ja asteikko 400 ovat ennalta valittuja
harjoitusarvoja; niitä ei ole optimoitu tämän kauden tuloksiin. Mukana ei ole kotietua,
poissaoloja, minuuttirajoituksia, piste-eroa tai viime kauden tietoa.

Ottelut käsitellään aikajärjestyksessä. Jokaisen päivän arviot tallennetaan ennen
sen päivän tulosten käsittelyä. Kohdeottelun tulos ei vaikuta sen omaan arvioon.

## Joukkueiden kuudennet ottelut

Joukkueella on viisi aiempaa ottelua; vastustajan otos voi olla eri kokoinen.
Sama ottelu näkyy vain kerran. Prosentit esitetään yhden desimaalin tarkkuudella
tämän kokeen vertailua varten, ei todisteena mallin tarkkuudesta.

| Päivä | Koti – vieras | Aiemmat pelit K/V | Koti / vieras | Toteuma | Kuudes peli |
|---|---|---:|---:|---|---|
| 29.10.2025 | ToPo – Espoo Basket Team | 3/5 | 41.4 % / 58.6 % | 64–71 | Espoo Basket Team |
| 01.11.2025 | Vimpelin Veto – Peli-Karhut | 4/5 | 43.9 % / 56.1 % | 74–82 | Peli-Karhut |
| 01.11.2025 | BC Nokia – ToPo | 5/4 | 52.1 % / 47.9 % | 44–75 | BC Nokia |
| 01.11.2025 | Espoo Basket Team – HBA-Märsky | 6/5 | 51.4 % / 48.6 % | 90–78 | HBA-Märsky |
| 04.11.2025 | Tampereen Pyrintö – Vimpelin Veto | 5/5 | 53.3 % / 46.7 % | 72–67 | Tampereen Pyrintö, Vimpelin Veto |
| 05.11.2025 | Peli-Karhut – Tapiolan Honka | 6/5 | 64.1 % / 35.9 % | 104–71 | Tapiolan Honka |
| 05.11.2025 | ToPo – Kouvottaret | 5/5 | 53.9 % / 46.1 % | 74–81 | ToPo, Kouvottaret |

## Arviointi

Brier-arvo mittaa todennäköisyyden ja toteuman erotuksen neliötä.
Pienempi on parempi; jatkuva 50–50-arvio saa arvon 0,250.

| Otos | Pelejä | Elo Brier | 50–50 Brier | Aiempi kotivoitto-osuus Brier |
|---|---:|---:|---:|---:|
| Kuudennet | 7 | 0.216 | 0.250 | 0.259 |
| Molemmilla vähintään 5 aiempaa | 84 | 0.203 | 0.250 | 0.253 |
| Koko aineisto, myös kylmä alku | 108 | 0.209 | 0.250 | 0.261 |

Kuudensissa peleissä suosikki voitti 5/7 kertaa. Tasavahvoja arvioita: 0. Tasavahvasta arviosta ei nimetä suosikkia.

## Mitä tästä ei voi päätellä

- Kuudensien otteluiden pieni otos ei osoita mallin luotettavuutta.
- Virheestä ei voi päätellä loukkaantumista, lepuutusta tai motivaatiota.
- Koko kauden luvut ovat tässä kehitysaineiston tuloksia. Parannukset tarvitsevat myöhemmin erillisen testijakson.
- Nykyinen historiallinen tiedosto voi sisältää jälkikäteen tehtyjä korjauksia; tiedon alkuperäistä saatavuushetkeä ei ole arkistoitu.
- Malli ennustaa voittajaa, ei loppupisteitä. Tulos näkyy vain jälkikäteisessä arvioinnissa.

Lähde: `prototypes/paper-home/public/data/women-2025-26-matches.json` · SHA256 `bc49f1fa8b6de68d1708bd4714dc2c6485a66aa08010fadc07e9b79147fe7a45`
