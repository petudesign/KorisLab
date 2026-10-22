# Aineiston kattavuus ja mallivertailu

## Mitä käytännössä tapahtui?

Jokainen malli antoi ennen ottelua koti- ja vierasjoukkueen voittoarvion.
Suuremman arvion saanut joukkue on mallin suosikki. Sitten katsottiin, voittiko se oikeasti.

| Malli | Suosikki voitti | Suosikki hävisi | Ei suosikkia (50–50) |
|---|---:|---:|---:|
| Elo ilman kotietua | 71 | 31 | 6 |
| Elo + aiemmasta kaudesta sovitettu kotipaikkakorjaus | 69 | 39 | 0 |
| Piste-ero ilman kotietua | 75 | 28 | 5 |
| Piste-ero + kotipaikkakorjaus | 77 | 31 | 0 |

Jokaisen rivin luvut summautuvat 108 otteluun. Tasavahva arvio ei nimeä voittajaa,
joten sitä ei merkitä oikeaksi tai vääräksi. Mallit eivät nimeä suosikkia täsmälleen samoihin peleihin.

**Brier ei ole osumaprosentti eikä virheprosentti.** 0,194 ei tarkoita 19,4 % virheitä tai 80,6 % oikeita.
Se arvioi, miten hyvin ennusteen varmuus sopii tuloksiin: 90 % suosikin tappio on suurempi virhe kuin 52 % suosikin tappio.
Siksi malli voi nimetä voittajan oikein useammin, mutta antaa huonompia prosenttiarvioita.

Piste-ero + kotipaikka nimesi oikean suosikin 77 kertaa, mutta kotipaikattoman mallin
todennäköisyysarviot saivat pienemmän Brier-virheen. Tavoitteena ei siis ole vain voittajan arvaaminen
vaan myös rehellinen arvio siitä, kuinka epävarma ottelu on. Tämä on edelleen yhden kauden kehityskoe.

Paikallinen kehityskoe: parametrit sovitetaan vain 2024–25 otteluihin.
2025–26 arvioidaan aikajärjestyksessä. Tätä kautta on jo tutkittu aiemmissa kokeissa,
joten se ei ole koskematon lopullinen testikausi. Ei julkaistuja ennusteita.

## Kattavuus

| Kausi | Lähdekoosteen pelatut | Haetut / tässä käytetyt | Haun epäonnistumiset |
|---|---:|---:|---:|
| 2024-25 | 130 | 129 | 1 |
| 2025-26 | 108 | 108 | 0 |

2024–25 otoksesta puuttuu yksi lähdekoosteessa mainittu ottelu.
Forssan Alulla ja Vimpelin Vedolla on 25 ottelua, muilla 26; tämä ei yksin varmista puuttuvan pelin tunnistetta.
2025–26 kaikilla on 24 ottelua, ja tiedoston 108 peliä täsmää lähdekoosteeseen.
Tämä on sisäinen kattavuustarkistus, ei riippumaton koko kilpailukauden varmennus.
Pudotuspelit ovat erillisissä aineistoissa eivätkä mukana tässä runkosarjakokeessa.

## Vertailu · Brier, pienempi parempi

Kaikki mallit arvioidaan samoilla otteluilla. Alkukausi: molemmilla alle 5 aiempaa peliä.
Loppuotos: molemmilla vähintään 5. Väliin jäävät ottelut sisältyvät koko aineistoon.

| Malli | Alkukausi (21) | Kuudennet (7) | Loppuotos (84) | Kaikki (108) |
|---|---:|---:|---:|---:|
| Elo ilman kotietua | 0.231 | 0.216 | 0.203 | 0.209 |
| Elo + aiemmasta kaudesta sovitettu kotipaikkakorjaus | 0.231 | 0.223 | 0.205 | 0.211 |
| Piste-ero ilman kotietua | 0.198 | 0.207 | 0.194 | 0.194 |
| Piste-ero + kotipaikkakorjaus | 0.199 | 0.220 | 0.197 | 0.198 |
| Jatkuva 50–50 | 0.250 | 0.250 | 0.250 | 0.250 |

## Mitä malliin lisättiin

- Elo-kotipaikkakorjaus on aiemman kauden ennen ottelua laskettujen Elo-arvioiden log-odds-siirtymä.
  Joukkueen vahvuusarvio päivittyy korjatun odotuksen mukaan. Korjaus ei ole todistettu kotiedun kausaalivaikutus.
- Piste-eromalli käyttää ennen päivää kertynyttä tehtyjen ja päästettyjen pisteiden keskiarvoeroa.
  Pientä otosta hillitsee viiden nollamarginaalisen lähtöpelin paino; skaalauksen jakaja on 10.
  Logistinen muunnos sovitetaan aiempaan kauteen L2-painolla 1, ei arviointikauteen.
- Piste-ero ei huomioi vastustajien vahvuutta, pelitempoa, poissaoloja tai kokoonpanon jatkuvuutta.
- Malli ennustaa edelleen vain voittajaa, ei loppupisteitä tai piste-erojakaumaa.

## Sovitetut arvot ja rajat

Harjoitusotteluita, molemmilla vähintään viisi aiempaa: 103.
Elo-korjauksen bias: 0.1385; tasavahvojen kotivoittoarvio: 53.5%.
Piste-ero ilman kotietua: slope=1.4808, bias=0.0000.
Piste-ero + kotipaikka: slope=1.4984, bias=0.2550.

Sovitus käyttää puutteellista aiempaa otosta. Erojen epävarmuutta ei ole vielä arvioitu,
ja seuraavaan kauteen yleistyminen tarvitsee erillisen testin. Älä valitse tuotantomallia automaattisesti.
