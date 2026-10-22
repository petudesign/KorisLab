# Elo-kokeen ennusteiden vahvuus

Sama paikallinen Naisten Korisliigan 2025–26 koe. Ei uusia malliparametreja tai kalibrointia.
Luokkarajat 55 % ja 65 % ovat tämän tarkastelun valintoja, eivät todistettuja laatuluokkia.
Suosikki tarkoittaa suuremman todennäköisyyden saanutta joukkuetta, kotona tai vieraissa.
Tasan 50–50-arvioista ei nimetä suosikkia. Tyhjä ryhmä esitetään puuttuvana tietona.

## Kuudennet ottelut

Otteluita 7, joista tasavahvoja 0.

| Ryhmä | Pelejä | Arvioiden KA | Suosikin voitot | Toteutunut osuus | Brier |
|---|---:|---:|---:|---:|---:|
| Lähes tasavahva: yli 50 %, alle 55 % | 4 | 52.7% | 2/4 | 50.0% | 0.254 |
| Kohtalainen suosikki: 55–alle 65 % | 3 | 59.6% | 3/3 | 100.0% | 0.164 |
| Vahva suosikki: vähintään 65 % | 0 | — | — | — | — |

## Molemmilla vähintään viisi aiempaa ottelua

Otteluita 84, joista tasavahvoja 0.

| Ryhmä | Pelejä | Arvioiden KA | Suosikin voitot | Toteutunut osuus | Brier |
|---|---:|---:|---:|---:|---:|
| Lähes tasavahva: yli 50 %, alle 55 % | 19 | 52.4% | 8/19 | 42.1% | 0.256 |
| Kohtalainen suosikki: 55–alle 65 % | 26 | 59.2% | 18/26 | 69.2% | 0.212 |
| Vahva suosikki: vähintään 65 % | 39 | 73.2% | 31/39 | 79.5% | 0.171 |

## Havainto ja tulkinnan rajat

- Kuudensien pelien lähes tasavahvassa ryhmässä suosikki voitti 2/4 ja kohtalaisessa 3/3.
  Kolme voittoa kolmesta ei tarkoita, että noin 60 % arvio on oikeasti 100 %.
- Laajemmassa otoksessa suurempi ennustettu etu liittyi suurempaan suosikin voitto-osuuteen.
  Mallissa näyttää olevan erottelukykyä tällä aineistolla; tämä ei ole näyttö tulevien kausien tarkkuudesta.
- Lähes tasavahvat suosikit voittivat vain 8/19. Ryhmä on pieni, joten emme vielä muuta mallia tämän perusteella.
- Vahvoissa suosikeissa arvioiden keskiarvo oli noin 73 % ja toteutunut osuus noin 79 %.
  Se voi viitata varovaisiin arvioihin tässä ryhmässä, mutta ei osoita systemaattista aliarviointia.
- Brier mittaa todennäköisyyden ja tuloksen neliövirhettä. Ryhmien eri Brier-arvot eivät yksin todista kalibrointia.
- Näitä ryhmiä ei pidä käyttää tämän saman aineiston jälkikäteiseen optimointiin ja kutsua tulosta riippumattomaksi testiksi.
- Piste-eroja, poissaoloja, lepuutusta tai syy-seuraussuhteita ei päätellä voittaja-arvioista.

Lähtökoe: `women-2025-26-elo.json`. Otteluaineiston SHA256: `bc49f1fa8b6de68d1708bd4714dc2c6485a66aa08010fadc07e9b79147fe7a45`.
