# KorisLab design system — yhteinen perusta v0.1

Tila: ehdotus ja käyttöön ottamaton CSS-tokenipohja. Lopullinen ilme on avoin.
Tämä ei vielä ole valmis komponenttikirjasto tai visuaalisesti testattu järjestelmä.

## Tavoite

KorisLab auttaa löytämään, vertaamaan ja ymmärtämään suomalaista koripallodataa.
Yhteiset mitat ja käyttäytymissäännöt helpottavat uusien näkymien tekemistä.
Urheilullisuus tulee otteluista, joukkueista, pelaajista, tuloksista ja grafiikoista.
Dataa pitää pystyä lukemaan ja vertaamaan ilman pitkää selitystä.

Säilytettävät lähtökohdat: KorisLabin nykyinen logo sekä `Icon.tsx`:n Material
Outlined -ikonit. Sivupalkki on nykyinen lähtökohta, mutta sen lopullinen leveys
ja navigaation toimivuus tarkistetaan oikealla sisällöllä.

## Miksi yhteinen perusta tarvitaan

Nykyinen `web/src/index.css` sisältää kartoitushetkellä 3 586 riviä, 55 erilaista
font-size-arvomääritystä ja 24 border-radius-arvomääritystä. Nämä ovat CSS-arvoja,
eivät 55 lopullista fonttikokoa: mukana on myös esimerkiksi clamp-lausekkeita.
Yleisimpiä fonttikokoja ovat 10, 11 ja 12 px. Yhteisiä väritokeneita on jo,
mutta monet komponentit määrittelevät omat värit ja mitat suoraan.

Nykyisiä hyödyllisiä rakennusosia ovat `Icon`, `TeamLogo`, `PlayerPortrait`,
`MetricSparkline`, `SeasonSelector`, `TeamTrend` ja `ShotChart`.
Niitä kannattaa yhtenäistää ennen rinnakkaisten versioiden luomista.

## Perustokenit

Konekielinen lähtökohta: `web/src/design-system/foundation.css`.
Tokenit käyttävät `--kl-`-etuliitettä ja ovat vielä käyttöön ottamatta.
Alla olevat pikselivastineet olettavat selaimen 16 px:n juurifontin.

### Typografia

| Rooli | Koko | Käyttö |
| --- | --- | --- |
| caption | 12 px | lähde, aikaleima, lyhyt lisätieto |
| label | 14 px | kontrollit, taulukot, kaavioiden tekstit |
| body | 16 px | leipäteksti ja selitykset |
| section | 20 px | osion otsikko |
| title | 28 px | merkittävän sisältöalueen otsikko |
| page | 32 px | sivun otsikko |
| stat | 40 px | tärkeä yksittäinen luku |
| score | 48 px | ottelutulos |

- Käyttöliittymän lähtöfontti on nykyinen Inter/system-fonttipino.
- Urheilullinen otsikkofontti valitaan myöhemmin, jos sille on tarve.
- Painot: 400, 500, 600 ja 700. Rivivälit: 1.2 otsikoissa, 1.4 kontrolleissa,
  1.5 leipätekstissä. Monirivinen sisältö saa kasvattaa komponentin korkeutta.
- Numerot: `font-variant-numeric: tabular-nums lining-nums`.
- 12 px on lisätiedon koko; varsinainen tilastotaulukko käyttää 14 px tekstiä.
- Isot luvut palvelevat hierarkiaa. Jokaiselle tilastolle ei tehdä isoa lukukorttia.

### Välit ja pinnat

Väliasteikko: **4, 8, 12, 16, 20, 24, 32, 40, 48 ja 64 px**.

- Ikonin ja tekstin väli: 8 px. Kentän otsikon ja kontrollin väli: 8 px.
- Kontrolliryhmän sisäinen väli: 12–16 px. Sisältöryhmien väli: 24 px.
- Pääosioiden väli: 32–48 px. Sivun reunaväli: 16–32 px leveyden mukaan.
- Kontrollin kulmapyöristys: 4 px. Erillisen pinnan kulmapyöristys: 8 px.
- Pyöreä muoto sopii avatariin ja datapisteeseen. Normaali kontrolli ei ole pilleri.
- Erota sisältö ensin ryhmittelyllä, väleillä ja viivoilla. Käytä erillistä pintaa,
  kun sisältö muodostaa itsenäisen kokonaisuuden. Varjo ei ole oletus.

### Komponenttien mitat

| Osa | Oletus | Tiivis / muu |
| --- | --- | --- |
| Painike, valinta, haku | vähintään 44 px korkea | 36 px työpöydän tiiviissä näkymässä |
| Ikonipainikkeen kosketusalue | vähintään 44 × 44 px | ikoni itsessään 20 px |
| Taulukon rivi | vähintään 44 px | 36 px tiiviissä työpöytänäkymässä |
| Taulukon vaakapehmuste | 12 px | sama eri taulukoissa |
| Ikoni | 20 px | 16 px tekstin sisällä, 24 px korostettuna |
| Joukkue-/pelaajatunnus | 40 px | 24 px rivillä, 64 px profiilissa |
| Sivupalkki | ehdotus 216 px | nykyinen 244 px; tarkistettava |
| Ylätyökalurivi | vähintään 56 px | rivittyy tarvittaessa |
| Sisällön enimmäisleveys | 1 440 px | laaja taulukko voi vaatia poikkeuksen |
| Kaavion korkeus | 288 px | pieni 192 px, suuri 384 px |

Korkeudet ovat minimejä tai lähtöarvoja, eivät tekstin leikkaavia pakotteita.
Kosketuskäytössä käytetään normaalia kokoa. Tiivis koko ei pienennä tekstiä.
Kaavion korkeus sisältää suunnittelutilan akseleille ja selitteille; sitä ei
pakoteta samoihin mittoihin kaikkien kaaviotyyppien kanssa.

## Värit: päätetään roolit ennen palettia

Design system tarvitsee seuraavat semanttiset roolit. Niiden väriarvot valitaan
ja kontrasti tarkistetaan ilmesuunnan ratkettua.

| Ryhmä | Roolit |
| --- | --- |
| Pinnat | canvas, surface, surface-subtle |
| Teksti | text-primary, text-secondary, text-muted, text-on-accent |
| Rajat | border, border-strong, focus |
| Brändi ja toiminta | brand, action, action-hover, selection |
| Tilat | positive, negative, warning, info, disabled |
| Datavertailu | series-a, series-b, reference, grid |

- Logo voi säilyttää mintun, vaikka toimintojen korostusväri vaihtuu.
- Joukkueen tunnistusväri, toimintoväri ja positiivisen tuloksen väri ovat eri rooleja.
- Sama joukkue säilyttää tunnistusvärinsä saman vertailun kaikissa grafiikoissa.
- Väriä tukee aina nimi, arvo, merkki tai viivatyyli.
- Pelitapaa kuvaavaa suuretta, esimerkiksi kolmosten osuutta, ei värjätä automaattisesti
  hyväksi tai huonoksi. Mittarin suunta määritellään erikseen.
- Vaalea ja tumma teema käyttävät samaa roolirakennetta. Molempien toteutus ei ole
  v0.1:n edellytys; molempia ei luvata ennen tarkistusta.

## Ensimmäinen komponenttijoukko

| Komponentti | Rajattu vastuu | Tilat / variantit |
| --- | --- | --- |
| Button / IconButton | toiminnon käynnistäminen | primary, secondary, quiet; hover, focus, disabled, loading |
| Select / SearchField | valinta ja haku | label, hint, error, loading, empty |
| Tabs | saman asiayhteyden näkymän vaihto | selected, focus, disabled; semantiikka toiminnon mukaan |
| DataTable | lajittelu ja lukujen vertailu | default, compact; sorted, loading, empty, error |
| MetricValue | arvo, yksikkö, muutos, selitys | neutral, positive, negative, missing |
| EntityLabel | joukkue tai pelaaja, oikea kuva/tunnus | team, player; saatavilla oleva assetti tai nimikirjaimet |
| ChartFrame | otsikko, selite, kaavio, lähde | loading, ready, partial, empty, error |
| DataStatus | kattavuus, päivitys ja arvio | verified, estimated, partial, unavailable |
| PageHeader / FilterBar | näkymän nimi ja yhteinen rajaus | leveä, rivittyvä |

Ehdotetut nimet eivät tarkoita, että nämä React-komponentit olisi jo toteutettu.
Jaettu komponentti tehdään, kun sillä on todellinen käyttötarve. Domain-logiikka,
tilastojen laskenta ja datan haku pidetään erillään esityskomponenteista.

## Datan esittämisen yhteiset säännöt

1. **Luku ja yksikkö yhdessä.** Prosentti: `43,5 %`; prosenttiyksikkömuutos:
   `+2,0 pp`; pisteet ottelua kohti ja pisteet 100 arvioitua pallonhallintaa kohti
   nimetään eri mittareiksi. FI/EN-muotoilu käyttää nykyistä kielivalintaa.
2. **Vertailun konteksti näkyy.** Sarja, kausi, vaihe, otos ja mittarin peruste
   pitää pystyä tunnistamaan ilman toiseen näkymään siirtymistä.
3. **Puuttuva tieto on `—`, ei nolla.** Osittainen data, tyhjä tulos, lataus ja
   hakuvika ovat eri tiloja. Virheessä näytetään toimiva uudelleenyritys.
4. **Vertailu käyttää yhteistä asteikkoa.** Pylväiden lähtökohta on nolla.
   Rajatun asteikon piste- ja viivakaavioissa akselin rajaus on näkyvä.
   Eri mittareita ei yhdistetä näennäisesti yhteismitallisiksi ilman selitystä.
5. **Trendi ei yhdistä puuttuvia havaintoja.** Sparkline kuvaa todellista
   havaintosarjaa; itsenäisesti skaalatuista sparklineista ei päätellä tasoeroja.
6. **Grafiikka ja tarkka arvo tukevat toisiaan.** Keskeiset arvot ovat luettavissa
   myös ilman hoveria ja kosketuslaitteella. Kaavion yhteydessä on tekstivastine
   tai saavutettava taulukko tarkoituksen mukaan.
7. **Tulkinta kertoo mittarin suunnan.** Puolustustehokkuudessa pienempi on parempi;
   kolmosten osuus kuvaa pelitapaa. Menetelmä ja kattavuus rajaavat johtopäätöksiä.
8. **Oikeat assetit.** Käytetään nykyistä logoa ja ikonikirjastoa. Joukkueiden
   tunnuksia ei oteta generoitujen luonnosten kuvitteellisista logoista.

## Responsiivisuus ja käytettävyys

- Näkymä järjestetään sisällön tilantarpeen mukaan, ei vain laitenimen perusteella.
- Pienellä ruudulla suodattimet rivittyvät. Taulukko säilyttää vertailtavat
  sarakkeet ja saa tarvittaessa oman vaakavierityksen; koko sivu ei levene.
- Fokuksen pitää näkyä. Kontrollilla on ohjelmallinen nimi ja näkyvä otsikko,
  kun tarkoitus ei muuten ole selvä. Hover ei ole ainoa tapa nähdä tietoa.
- Fontin suurentaminen ja pitkä pelaaja-/joukkuenimi eivät leikkaa sisältöä.
- Kontrasti tarkistetaan valmiista paletista: tavallinen teksti 4,5:1,
  suuri teksti 3:1, olennaiset kontrollien ja grafiikan osat 3:1.
  Nämä ovat suunnittelukriteerejä, eivät väite nykyisen sovelluksen vaatimustenmukaisuudesta.
- Liike on lyhyttä käyttöpalautetta (120/180 ms), ei jatkuvaa datan koristelua.
  Reduced motion huomioidaan komponenteissa; tokenit yksin eivät riitä.

## Toteutusjärjestys ja hyväksyntä

1. **Perusta:** tämä dokumentti ja käyttöönottoa odottavat kokotokenit.
2. **Komponenttien esimerkkisivu:** oikeat nykyiset logo/ikonit, kontrollit,
   taulukko, mittarit ja niiden tilat. Samoja komponentteja käytetään sovelluksessa.
3. **Ilme:** värien roolit, paletti ja mahdollinen otsikkofontti valitaan
   esimerkkisivun ja oikean joukkuevertailun avulla.
4. **Pilotti:** yksi joukkuevertailu koko ketjun läpi. Tarkistetaan todelliset
   nimet, puuttuva data, rajaukset, näppäimistö ja kapea/leveys sekä suurennettu teksti.
5. **Laajennus:** hyväksi todettu järjestelmä viedään näkymiin vaiheittain.
   Vanhoja CSS-sääntöjä poistetaan vasta niiden korvaamisen yhteydessä.

v0.1 on käyttövalmis vasta, kun tokenit ovat todellisten komponenttien käytössä,
esimerkkisivu näyttää keskeiset tilat ja pilotti on tarkistettu selaimessa.
Pelkkä tokenitiedosto tai värikartta ei täytä tätä.

## Ohje uusille näkymille

Lue tämä dokumentti ennen uuden KorisLab-näkymän suunnittelua. Käytä yhteisiä
komponentteja ja tokeneita niiden käyttöönoton jälkeen. Valitse tiheys käyttäjän
tehtävän mukaan. Uutta fonttikokoa, kulmapyöristystä tai värin roolia ei lisätä
yksittäisen sivun tyylitiedostoon ilman perusteltua tarvetta ja yhteisen pohjan
päivitystä. Kaavion geometria ja domain-kohtaiset mitat saavat olla omia arvojaan.
Ilmeen avoimia päätöksiä ei ratkaista satunnaisesti uuden ominaisuuden yhteydessä.
