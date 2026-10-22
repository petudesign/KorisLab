# Pelaajien seuranta videolta

Työkalut ovat tämän kansion erillisessä `.venv`-ympäristössä: yt-dlp, imageio-ffmpeg (sisältää FFmpeg-ohjelman) ja RF-DETR. Valmista RF-DETR Small COCO -mallia on kokeiltu kolmella ruudulla. Oma koulutus, joukkueiden erottelu, pelaajaseuranta ja nimien tunnistus eivät kuulu ensimmäiseen kokeiluun.

Videot tallennetaan `media/originals/`-kansioon ja testikatkelmat `media/clips/`-kansioon. Media ja virtuaaliympäristö eivät kuulu Gitiin.

## Lataaminen

```sh
learning/vision/.venv/bin/python learning/vision/download_games.py
```

Lataa kaksi lähdevideota parhaalla saatavalla kuvanlaadulla, yhdistää kuvan ja äänen MKV-tiedostoon pakkaamatta niitä uudelleen ja tallentaa YouTuben metatiedot rinnalle. Olemassa olevia valmiita videoita ei korvata. Lataus ei käytä selaimen kirjautumista tai evästeitä.

## Leikkaaminen

Aja projektin juuresta esimerkiksi:

```sh
learning/vision/.venv/bin/python learning/vision/cut_clip.py \
  learning/vision/media/originals/ottelu.mp4 \
  learning/vision/media/clips/ottelu-ensimmainen-testi.mp4 \
  --start 600 --duration 30
```

`--start 600` aloittaa videon kohdasta 10:00; se ei tarkoita ottelukellon aikaa.

Ohjelma kirjoittaa uuden tiedoston ja estää olemassa olevien tiedostojen korvaamisen. Alkuperäistä ei muuteta. Katkelma pakataan tarkkaa leikkausta varten uudelleen hyvällä laadulla (CRF 18); resoluutiota ja kuvataajuutta ei tarkoituksella pienennetä. Alkuperäinen säilyttää ladatun laadun.

Valitaan ensin 30–60 sekunnin laaja pelikameran jakso. Ensimmäinen ottelu kehittämiseen, toinen erilliseen testiin. Kokonaisten otteluiden toimivuutta ei päätellä yhden katkelman tuloksesta.

Lähdevideot:
- https://www.youtube.com/watch?v=qFkzvLoQO40
- https://www.youtube.com/watch?v=6FjDbtSGiGg

Oppaan koodi: https://github.com/roboflow/notebooks/blob/main/notebooks/basketball-ai-how-to-detect-track-and-identify-basketball-players.ipynb

## Näkyvä ensimmäinen oppitunti

```sh
learning/vision/.venv/bin/python learning/vision/preview_server.py
```

Avaa http://127.0.0.1:5191 ja käynnistä toisesta terminaalista:

```sh
learning/vision/.venv/bin/python learning/vision/detect_frames.py
```

Näkymä lukee oikeaa käsittelytilaa `media/detection/status.json`-tiedostosta. Malli analysoi ruudut kohdista 0, 5 ja 10 sekuntia katkelman alusta CPU:lla. Mallipainot haetaan ensimmäisellä ajolla; videoa ei lähetetä palveluun. Havaintorajan säädin suodattaa tallennetut havainnot selaimessa eikä suorita mallia uudelleen. Luokka 1 tarkoittaa ihmistä, ei pelaajaa. Havaintopistemäärä ei ole tässä aineistossa mitattu luotettavuus.

## Oppitunti 2: paidan värien tutkiminen

```sh
learning/vision/.venv/bin/python learning/vision/classify_shirts.py
```

Aja tunnistuksen jälkeen. Rajaa laatikon keskimmäiset 50 % leveydestä ja 20–50 % yläosan korkeudesta. Tallentaa paitakuvat sekä HSV-värisäännön tuottamat vihreän/valkoisen/epäselvän luokat. Säännöt sovitettiin ensimmäisestä ruudusta (0 s); samaa sääntöä sovellettiin ruutuihin 5 s ja 10 s. Tämä ei ole riippumaton testiaineisto tai opittu joukkuemalli. Valkoisen säännöstä jätettiin pois lämpimiä lattian ja ihon sävyjä; vihreän sävyalue sisältää kameran sinivihreän.

Oletushavaintoraja on 60 %, käyttäjän kolmesta ruudusta tekemien havaintojen perusteella. Epäselvät ovat oletuksena mukana: oikea pelaaja voi jäädä epäselväksi. Peliasun väri ei varmista, että henkilö pelaa kentällä (myös vaihtopelaaja voi olla samanvärisessä asussa). Havaintonumerot ovat ruutukohtaisia, eivät seuranta-ID:itä. Näkymä näyttää alkuperäisen paitakuvan ja pikseliosuudet; klikkaus korostaa rajauksen isossa kuvassa. Paikallinen palvelin on käynnistettävä uudelleen palvelinkoodin muutoksen jälkeen.
