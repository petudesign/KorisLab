# KorisLab: videosta johdettavan datan suunnitelma

Kirjattu 9.10.2026 keskustelun pohjalta. Tämä on suunnittelumuistio ja
portfolio-casen aineistoa, ei kuvaus toteutetusta videomoottorista tai mitatusta
tarkkuudesta. Teknologiavalinnat ovat alustavia.

## Ongelma ja tavoite

KorisLab yhdistää jo ottelutilastoja, heittokarttoja ja pelitapahtumia.
Nämä eivät kuvaa kaikkea pelaajan toimintaa, erityisesti pallotonta liikkumista,
sijoittumista tai tapahtumaa edeltävää tilannetta. Videohavainnoilla voisi myös
tarkistaa lähdelokista johdettuja kentällisiä ja vaihtojen ajoituksia.

Tavoite on oma videoanalyysijärjestelmä, joka hyödyntää valmiita malleja ja
tuottaa jäljitettävää lähdedataa uusille analyyseille. KorisLab olisi ensimmäinen
käyttökohde. Muita lajeja tuetaan yhteisellä moottorilla ja lajikohtaisilla osilla.

## Alustava rakenne ja rajaus

- Yhteinen moottori: videon lukeminen, havaitseminen, seuranta, aikaleimat,
  kameraleikkausten käsittely, havaintojen tallennus ja tarkistustyökalut.
- Lajikohtainen osa: kentän geometria, peliväline, pelikello, kokoonpanot,
  tapahtumien määritelmät ja tilastojen laskenta.
- YOLO on ehdokas havaitsemiseen; ByteTrack ja BoT-SORT seurantaan.
  Seurannan tunniste ei ole pelaajan nimi tai pelinumero.
- Ensimmäinen oikean videon tavoite: käyttäjä valitsee pelaajan, yhdistää tämän
  kokoonpanoon ja voi korjata katkenneen tai väärään pelaajaan siirtyneen seurannan.
- Kenttäkalibrointi mahdollistaa sijaintianalyysit. Pallokosketukset, syötöt,
  puolustuspaine ja screenit edellyttävät lisätunnistusta ja omaa validointia.
- Kuvan ulkopuolella olevaa pelaajaa ei tulkita penkillä olevaksi.
  Uusinnat eivät saa kasvattaa tapahtumamääriä.

## Paikallinen ajo ja videolähteet

Tavoite on toimia ilman maksullisia API-palveluja. Koneaika, kehitystyö ja
tallennustila ovat silti kustannuksia. Lähtölaitteessa on käyttäjän ilmoituksen
mukaan 24 Gt RAM-muistia; suorituskykyä ei ole mitattu.

Videolähde pidetään vaihdettavana: paikallinen tiedosto, sallittu suora virta tai
YouTube-lähde. Linkin antaminen voi riittää käyttöliittymässä, mutta analyysi
tarvitsee varsinaiset kuvakehykset. YouTuben upotettu soitin sopii katseluun ja
tarkistamiseen; se ei anna kuvakehyksiä konenäölle. Virran lukeminen ilman koko
videon pysyvää tallennusta on tekninen vaihtoehto, jonka toimivuus ja käyttöoikeudet
pitää varmistaa lähdekohtaisesti.

Paikallinen kielimalli voisi auttaa hakemisessa ja tulosten selittämisessä.
Kuvien tulkintaan tarvitaan näköä tukeva malli (VLM). Se ei korvaa jatkuvaa
seurantaa tai tarkistettavaa laskentalogiikkaa. Malli lisätään vasta perustan jälkeen.

## Tallennus ja projektin erottaminen

Python hoitaa käsittelyn ja laskennan. SQLite on alustava valinta otteluiden,
videoiden, analyysiajojen, pelaajatunnistusten, tapahtumien ja korjausten tallennukseen.
Tiheille havaintosarjoille voidaan myöhemmin käyttää Parquet-tiedostoja.
JSON sopii alkuvaiheen tulosten välittämiseen KorisLabille.

Alkuperäinen havainto ja käsikorjaus säilytetään erikseen. Mukaan tallennetaan
lähde, aikaleima, malliversio, asetukset ja tarkistustila.

Yleiskäyttöiselle moottorille suositellaan omaa Git-repoa; branchit palvelevat sen
sisäistä kehitystä. Repoa ei ole tämän muistion yhteydessä luotu. Videoita,
mallipainoja, Python-ympäristöä ja paikallisia tietokantoja ei versionhallita.

SSD:n alustava suunnitteluvaraus on 15–30 Gt ympäristölle, malleille ja pienelle
kokeiluaineistolle. Se ei ole mitattu vaatimus. Ensimmäinen Python-harjoitus
tarvitsee paljon vähemmän. Kahden tunnin video 5 Mbit/s -bittinopeudella vie
noin 4,5 Gt; videot ja välitiedostot määräävät myöhemmän tilantarpeen.

## Validointi ja julkaistavan datan uskottavuus

Saman mallin toistuvat ajot voivat toistaa saman virheen. Luottamus perustuu
riippumattomaan vertailuun, mitattuun virheeseen ja jatkuvaan laaduntarkistukseen.

1. Luodaan ihmisvoimin tarkistettu vertailuaineisto eri otteluista ja
   kuvausolosuhteista. Kehitys- ja lopputestiaineisto erotetaan ottelutasolla.
2. Arvioidaan jokainen mittari erikseen: henkilöllisyysvirheet, seurannan
   katkeaminen, tapahtumien väärät löydöt ja puuttuvat löydöt sekä aika- ja
   sijaintivirheet. Seurannan arviointiin voidaan käyttää HOTA- ja IDF1-mittareita.
3. Jokainen ottelu käy automaattiset tarkistukset: kellon jatkuvuus, uusinnat,
   sijaintihypyt, henkilöllisyysristiriidat ja vertailukelpoiset lähdetilastot.
4. Tarkistetaan sekä epäselviä että satunnaisesti valittuja tilanteita myös
   käyttöönoton jälkeen. Tarkistusotoksen koko ja hyväksymisrajat päätetään
   mittarikohtaisesti, eivätkä peräkkäiset kuvat ole riippumattomia näytteitä.
5. Mallin, asetusten tai kuvausolosuhteiden muutos käynnistää tarvittavan
   uudelleenarvioinnin.

Normaalin työnkulun ehdotus: yksi analyysiajo, automaattiset tarkistukset ja
kohdennetut uudelleenanalyysit tai käsintarkistukset. Tarkkuustavoitteita ei ole
vielä määritelty eikä saavutettu. Tilastojen kokonaissumman täsmääminen ei yksin
todista yksittäisiä tapahtumia oikeiksi.

Julkaistavan mittarin yhteydessä näytetään määritelmä, menetelmäversio,
testiaineiston laajuus, mitattu tarkkuus ja sen epävarmuus, ottelukohtainen
kattavuus sekä tehdyt korjaukset. Puuttuva havainto ei ole nolla. Mallin
varmuuspistemäärä ei sellaisenaan ole havaintojen todellinen oikeellisuusprosentti.

## Oppimiseen perustuva toteutustapa

Edetään yksi pieni toimiva muutos kerrallaan. Jokaisessa vaiheessa selitetään
tavoite, perustelu, Python-käsitteet, kokeilu ja olennaiset vaihtoehdot.
Vaiheiden välissä jätetään tilaa käyttäjän kysymyksille ja omille kokeiluille.

Ensimmäinen harjoitus: muutama keksitty sijaintihavainto ja reitin piirtäminen.
Seuraavaksi tallennus SQLiteen ja tietojen hakeminen SQL:llä. Oikeat videot
tarvitaan tunnistamisen, seurannan ja suorituskyvyn arviointiin; harjoitusdata
varmistaa vain sille tehtävän käsittelyn ja laskennan.

## Portfolio-case: suositus ja luonnos

Nyt suunnitelma kuuluu KorisLab-casen tulevaan kehityssuuntaan. Oma repo voi
syntyä ennen omaa portfolio-casea. Erillinen case on perusteltu, kun moottorilla
on toimiva demo, dokumentoitu arviointi ja oma selkeä kehitystarina. Näyttö
toisesta lajista vahvistaisi yleiskäyttöisyyttä koskevaa väitettä.

**Luonnosteksti KorisLab-caseen:**

> KorisLabin seuraavaksi kehityssuunnaksi olen suunnitellut paikallista
> videoanalyysimoottoria, joka yhdistäisi valmiin pelaajatunnistuksen ja
> seurannan otteludataan. Tavoitteena on tarkistaa kentällisiä ja tuottaa
> myöhemmin tietoa myös pelaajien sijoittumisesta ja pallottomasta toiminnasta.
> Suunnittelussa olen erottanut yhteisen videonkäsittelyn lajikohtaisesta
> analyysistä ja määritellyt, miten tuloksia arvioitaisiin riippumatonta
> vertailuaineistoa vasten. Moottoria tai sen tarkkuutta ei ole vielä validoitu.

## Viitteet ja aiempi tutkimuskohde

- [YOLO-seuranta](https://docs.ultralytics.com/modes/track/)
- [Videolähteet ja ennusteet](https://docs.ultralytics.com/modes/predict/)
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [MLX-VLM paikallisille näkö-kielimalleille](https://github.com/Blaizzy/mlx-vlm)
- [TrackEval](https://github.com/JonathonLuiten/TrackEval)
- [NIST: arviointi ja käytönaikainen seuranta](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [KorisLabin HBA–Veto-videotarkistus](video-review-968942.md): mahdollinen
  ensimmäinen käyttökohde; pelaajat ja vaihtojen ajoitus ovat vielä vahvistamatta.
