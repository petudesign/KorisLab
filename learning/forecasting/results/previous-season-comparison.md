# Edellisen kauden paino · ensimmäinen vertailu

Historiallinen kehityskoe. Ei tuotannon malli eikä parametrin lopullinen valinta.

2024–25 aineiston ottelut muodostavat lähtöarvion. Uuden kauden lähtöluku:

`1500 + kerroin * (edellisen aineiston päättävä Elo - 1500)`

Kertoimet 0, 0,25, 0,5, 0,75 ja 1 valittiin ennen tulosten laskemista.
Kaikissa K=32 ja asteikko 400. Kokoonpanomuutoksia ei vielä huomioida.
Uusi tunnistamaton joukkue aloittaisi 1500:sta; lähtöluvut yhdistetään ID:llä.

Edellinen aineisto: 129 ottelua, 10 joukkuetta.
Tiedoston ei ole tässä varmistettu kattavan koko kilpailukautta tai pudotuspelejä.
2024–25 aikavyöhykkeettömät ajat tulkittiin lähteen suomalaiseksi paikallisajaksi.

## Lähtöarvioiden lähdeotos

| Joukkue | Aiemman aineiston pelejä | Elo lopussa |
|---|---:|---:|
| BC Nokia | 26 | 1430.8 |
| Espoo Basket Team | 26 | 1561.0 |
| HBA-Märsky | 26 | 1427.2 |
| Kouvottaret | 26 | 1634.2 |
| Peli-Karhut | 26 | 1675.9 |
| Tampereen Pyrintö | 26 | 1435.9 |
| Tapiolan Honka | 26 | 1547.5 |
| ToPo | 26 | 1674.2 |
| Vimpelin Veto | 25 | 1326.8 |

## Todennäköisyyksien vertailu

Brier: pienempi on parempi. 50–50-arvion vertailuarvo on 0,250.
Alkukausi = ottelut, joissa molemmilla on alle viisi aiempaa peliä.
Ryhmärajat perustuvat ottelumääriin, eivät arvioihin, joten otokset ovat kaikille samat.

| Kerroin | Alkukauden Brier | Kuudensien Brier | Loppuotoksen Brier | Koko aineiston Brier |
|---:|---:|---:|---:|---:|
| 0 | 0.231 | 0.216 | 0.203 | 0.209 |
| 0.25 | 0.244 | 0.190 | 0.210 | 0.215 |
| 0.5 | 0.263 | 0.171 | 0.219 | 0.225 |
| 0.75 | 0.285 | 0.158 | 0.230 | 0.238 |
| 1 | 0.310 | 0.150 | 0.243 | 0.253 |

Ottelumäärät: early=21, sixth=7, warm=84, all=108.

## Tulkinnan rajat

- Koko kauden keskiarvo ei saa peittää alkukauden mahdollista hyötyä tai haittaa.
- Mallia ei valita seitsemän kuudennen pelin perusteella. Ryhmät sisältävät osittain samoja otteluita.
- Edellisen kauden vahvuuden jatkuvuus on oletus; pelaajasiirrot voivat rikkoa sen.
- Pienempi Brier tässä aineistossa ei osoita toimivuutta seuraavalla kaudella.
- Jos kerroin valitaan tästä vertailusta, 2025–26 on sen kehitysaineisto. Seuraava testi pitää pitää erillään.
- Saman päivän tulokset eivät vaikuta toisiinsa; historiatiedon alkuperäisiä julkaisuaikoja ei tunneta.
