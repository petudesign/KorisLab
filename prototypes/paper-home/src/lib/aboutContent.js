// The About page's words, shared by the page and the server-rendered summary. Answers come first, so they can be quoted as they are.
export const about={
 title:{fi:'Tietoa KorisLabista',en:'About KorisLab'},
 lead:{fi:'KorisLab on Petteri Helttulan tekemä suomalaisen koripallon analytiikkasivusto. Se kokoaa Naisten ja Miesten Korisliigan ottelut, joukkueet ja pelaajat yhteen ja kertoo, mitä luvuista voi päätellä ja mitä ei.',
  en:'KorisLab is a Finnish basketball analytics site made by Petteri Helttula. It brings together the games, teams and players of the women’s and men’s Korisliiga, and says what the numbers can and cannot tell.'},
 sections:[
  {q:{fi:'Mitä sivustolla voi tehdä?',en:'What can you do on the site?'},
   a:{fi:'Selata sarjataulukkoa, otteluita, joukkueita ja pelaajia kausilta 2024–25, 2025–26 ja 2026–27. Vertailla joukkueita ja pelaajia Matchup Labissa, katsoa pelaajaprofiileja ja seurata tulevien otteluiden simulaatioita Sim Studiossa.',
    en:'Browse the standings, games, teams and players from the 2024–25, 2025–26 and 2026–27 seasons. Compare teams and players in Matchup Lab, read player profiles, and follow simulations of upcoming games in Sim Studio.'}},
  {q:{fi:'Mistä data tulee?',en:'Where does the data come from?'},
   a:{fi:'Basket.fi:n julkisesta tulospalvelusta. Ottelu hyväksytään tilastoihin vasta, kun sen tiedot täsmäävät pöytäkirjaan, ja puuttuva tieto näytetään viivana eikä nollana. Data päivittyy automaattisesti yleensä 2–4 kertaa päivässä. Päivitysajat vaihtelevat, joten illan ottelu voi näkyä tilastoissa vasta seuraavana päivänä.',
    en:'From Basket.fi’s public results service. A game enters the statistics only once its data matches the official scoresheet, and missing information shows as a dash, not a zero. The data updates automatically, usually two to four times a day. The times vary, so an evening game may reach the statistics only the next day.'}},
  {q:{fi:'Kuinka luotettavia ennusteet ovat?',en:'How reliable are the forecasts?'},
   a:{fi:'Selvästi sattumaa parempia, mutta eivät vielä parempia kuin yksinkertaiset mallit. Ajallisesti oikeassa testissä kaudella 2025–26 simulaattorin Brier oli miehillä 0,238 (piste-eromalli 0,233) ja naisilla 0,210 (piste-eromalli 0,195). Pienempi on parempi, ja kolikonheitto antaa 0,250. Jokaisen ennusteen toteuma näkyy Sim Studiossa.',
    en:'Clearly better than chance, but not yet better than simple models. In a time-ordered test on 2025–26 the simulator’s Brier score was 0.238 for men (margin model 0.233) and 0.210 for women (margin model 0.195). Lower is better; a coin flip scores 0.250. How every forecast turned out is shown in Sim Studio.'}},
  {q:{fi:'Onko KorisLab virallinen palvelu?',en:'Is KorisLab an official service?'},
   a:{fi:'Ei. KorisLab ei ole Koripalloliiton, Korisliigan tai seurojen virallinen palvelu. Joukkueiden ja sarjojen nimet ja logot kuuluvat omistajilleen. Sivuston sarjataulukko ei sovella virallisia tasapistesääntöjä, joten virallinen sarjatilanne löytyy Basket.fi:stä.',
    en:'No. KorisLab is not an official service of the Finnish Basketball Association, Korisliiga or the clubs. Team and league names and logos belong to their owners. The site’s standings do not apply official tiebreak rules, so the official table is on Basket.fi.'}},
  {q:{fi:'Kuka KorisLabin tekee?',en:'Who makes KorisLab?'},
   a:{fi:'Petteri Helttula, suomalainen tuotesuunnittelija. Muut työt ja yhteystiedot löytyvät portfoliosta.',
    en:'Petteri Helttula, a Finnish product designer. Other work and contact details are in the portfolio.'},
   links:[{href:'https://www.petu.design/',label:'petu.design'},{href:'https://www.petu.design/korislab/',label:{fi:'KorisLab-case',en:'KorisLab case study'}}]},
 ],
};
export const aboutSummaryHtml=escape=>`<p>${escape(about.lead.fi)}</p>${about.sections.map(s=>`<h2>${escape(s.q.fi)}</h2><p>${escape(s.a.fi)}</p>`).join('')}`;
