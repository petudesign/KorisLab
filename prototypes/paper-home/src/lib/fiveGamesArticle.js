// "Mitä viisi ottelua kertoo?": the article's words in one place, so the page and the server-rendered
// summary say the same thing. Correlations and team numbers come from source/analysis-five-games.json, frozen at `asOf`.
// The season the current-season numbers describe: team links stay on it after the site's default season moves on.
export const fiveGamesSeason='2026-27';
export const articles=[{slug:'first-five-games',published:'2026-10-30',title:{fi:'Mitä viisi ottelua kertoo?',en:'What do five games tell you?'},
 standfirst:{fi:'Naisten Korisliigassa viiden ensimmäisen ottelun piste-ero on ennustanut loppukautta hyvin, miesten sarjassa heikosti. Siksi Kouvottarien 4–0 ja Kipinän 6–1 eivät tarkoita samaa.',
  en:'In the women’s Korisliiga the point difference over the first five games has predicted the rest of the season well, in the men’s league poorly. That is why Kouvottaret’s 4–0 and Kipinä’s 6–1 do not mean the same thing.'}}];
export const articleSlugs=articles.map(article=>article.slug);

const n=(value,lang,decimals=2)=>value.toLocaleString(lang==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});

// The 95 % confidence interval of a correlation (Fisher's z), from the rows themselves because the stored figure is rounded. The team seasons are few, so it is wide.
export function correlationInterval(rows){
 const mean=read=>rows.reduce((total,row)=>total+read(row),0)/rows.length,x=row=>row.margin,y=row=>row.restWinPct,mx=mean(x),my=mean(y);
 const sum=(a,b)=>rows.reduce((total,row)=>total+(a(row)-(a===x?mx:my))*(b(row)-(b===x?mx:my)),0);
 const z=Math.atanh(sum(x,y)/Math.sqrt(sum(x,x)*sum(y,y))),margin=1.96/Math.sqrt(rows.length-3);
 return [Math.tanh(z-margin),Math.tanh(z+margin)];
}
const interval=(league,lang)=>correlationInterval(league.rows).map(v=>n(v,lang).replace('-','−')).join('…');
const asOfDate=(league,lang)=>new Date(league.asOf).toLocaleDateString(lang==='fi'?'fi-FI':'en-GB',lang==='fi'?{day:'numeric',month:'numeric'}:{day:'numeric',month:'short'});

export function startGroups(data){
 const groups=[['strong',r=>r.wins>=4],['weak',r=>r.wins<=1]];
 return groups.map(([key,test])=>({key,women:data.women.rows.filter(test),men:data.men.rows.filter(test)}));
}

// What each example team's season looks like so far, and what has changed since last season.
const notes={
 'Kouvottaret':{result:['Viime kaudella 3–21. Neljä voittoa 6–17 pisteellä, mutta Märsky, Peli-Karhut ja EBT ovat vielä kohtaamatta.','3–21 last season. Four wins by 6–17 points, but Märsky, Peli-Karhut and EBT are still to come.'],
  change:['Heittäminen ei ole parantunut. Menetyksiä on vähemmän (27,3 → 19,4 %) ja hyökkäyslevypalloja enemmän (27,4 → 35,8 %).','The shooting has not improved. There are fewer turnovers (27.3 → 19.4%) and more offensive rebounds (27.4 → 35.8%).']},
 'ToPo':{result:['Sarjan paras piste-ero. Tappiot vain 7 ja 1 pisteellä, ja Peli-Karhut kaatui 37:llä ja Märsky 14:llä.','The league’s best point difference. The losses were by only 7 and 1 points, and Peli-Karhut fell by 37 and Märsky by 14.'],
  change:['Suurin muutos on heittämisessä. Kaksi uutta tulee Pyrinnöstä.','The biggest change is in the shooting. Two newcomers arrive from Pyrintö.']},
 'HBA-Märsky':{result:['Kolme isoa voittoa. Ainoa tappio tuli ToPolle.','Three big wins. The only loss was to ToPo.'],
  change:['Vakain kokoonpano, ja silti heittäminen ja puolustus ovat parantuneet.','The most stable roster, and still the shooting and defence have improved.']},
 'Espoo Basket Team':{result:['Yksi ottelu tekee melkein kaiken: +46 Honkaa vastaan. Muut neljä yhteensä −13.','One game does nearly all of it: +46 against Honka. The other four total −13.'],
  change:['Puolustus on hieman parempi ja hyökkäys heikompi.','The defence is slightly better and the offence weaker.']},
 'Peli-Karhut':{result:['Mestari kahtena viime kautena. Miinus tulee kahdesta tappiosta Märskylle ja ToPolle, joilla on sarjan suurin piste-ero.','Champions in the last two seasons. The minus comes from two losses to Märsky and ToPo, the teams with the league’s biggest point difference.'],
  change:['Hyökkäys ja puolustus ovat heikentyneet ja menetyksiä on enemmän (18,4 → 24,6 %). Kaksi viidestä ottelusta on tosin pelattu kärkeä vastaan.','The offence and defence have weakened and turnovers are up (18.4 → 24.6%). Two of the five games were against the top teams, though.']},
 'Vimpelin Veto':{result:['Viime kaudella 18–6. Kolme viimeistä tappiota tuli vain 1, 4 ja 6 pisteellä.','18–6 last season. The last three losses were by only 1, 4 and 6 points.'],
  change:['Hyökkäys ja puolustus ovat heikentyneet, ja hyökkäyslevypallot ovat pudonneet (35,4 → 25,7 %).','The offence and defence have weakened, and offensive rebounding has dropped (35.4 → 25.7%).']},
 'KTP-Basket':{result:['Sarjan ainoa tappioton. Viiden ottelun jälkeen 5–0: ainoa vertailukohta on Salon Vilpas 2025–26, joka voitti loppukaudella 63 %.','The league’s only unbeaten team. 5–0 after five games: the only comparison is Salon Vilpas in 2025–26, who won 63% in the rest of the season.'],
  change:['Vähiten viime kauden minuutteja, ja heittäminen ja hyökkäys ovat parantuneet selvästi.','The fewest minutes from last season, and the shooting and offence have clearly improved.']},
 'Kipinä Basket':{result:['Nousija. Viiden ottelun jälkeen 4–1: samalla alulla miesten joukkueet voittivat loppukaudella 37–85 %.','Newly promoted. 4–1 after five games: from the same start, men’s teams won 37–85% in the rest of the season.'],
  change:['Viime kauden lukuja ei ole. Nyt sarjan paras eFG, mutta hyökkäyslevypalloissa 11. Mukana on myös viime kauden Korisliigassa pelanneita: Pöllä, Kuukkanen ja Rantapaju.','No figures from last season. Now the league’s best eFG, but 11th in offensive rebounding. The roster also has players from last season’s Korisliiga: Pöllä, Kuukkanen and Rantapaju.']},
};
export const teamNote=(team,kind,lang)=>notes[team][kind][lang==='fi'?0:1];

// In order of weight: the finding first, then the limits a reader needs before the tables that follow.
const conclusions=lang=>{
 const say=(fi,en)=>lang==='fi'?fi:en;
 return [
  [say('Naisilla alku painaa','The start counts for women'),say('Naisten sarjassa alkukauden piste-eroon kannattaa suhtautua vakavasti. Miesten sarjassa viisi ottelua kertoo vielä vähän.','In the women’s league the early point difference is worth taking seriously. In the men’s league five games still say little.')],
  [say('Aineisto on pieni','The data is small'),say('Vain kaksi kautta ja 43 joukkuekautta, joten luottamusvälit ovat leveitä. Se riittää huomioon, ei sääntöön.','Only two seasons and 43 team seasons, so the confidence intervals are wide. That is enough for an observation, not a rule.')],
  [say('Vastustajia ei ole korjattu','Opponents are not adjusted'),say('Näin aikaisin osa joukkueista on pelannut selvästi kovemman ohjelman kuin toiset.','This early, some teams have played a clearly harder schedule than others.')],
  [say('Syytä ei tiedetä','The reason is not known'),say('Korrelaatio ei kerro syytä. Loukkaantumiset ja valmentajat eivät ole mukana.','Correlation does not give a reason. Injuries and coaches are not included.')]];
};
// The short version under the standfirst repeats the conclusions word for word, so it can never claim more than they do.
export const fiveGamesBrief=lang=>conclusions(lang).slice(0,3);

export function fiveGamesSections(data,lang){
 const {women:w,men:m}=data,say=(fi,en)=>lang==='fi'?fi:en,c=(v)=>n(v,lang);
 return [
  {heading:say('Alkukausi painaa eri tavalla','The start of the season weighs differently'),chart:'scatter',paragraphs:[
   say(`Katsoin kaudet 2024–25 ja 2025–26: ${w.teamSeasons} joukkuekautta naisissa ja ${m.teamSeasons} miehissä. Jokaiselta joukkueelta otin viiden ensimmäisen ottelun piste-eron per ottelu ja vertasin sitä saman joukkueen voittoprosenttiin loppukaudella.`,
    `I looked at the 2024–25 and 2025–26 seasons: ${w.teamSeasons} team seasons in the women’s league and ${m.teamSeasons} in the men’s. For each team I took the point difference per game over the first five games and compared it with the same team’s win percentage in the rest of the season.`),
   say(`Korrelaatio oli naisilla ${c(w.corrMargin)} ja miehillä ${c(m.corrMargin)}. Luku 1 tarkoittaisi, että alku kertoo loppukauden järjestyksen täysin, ja 0, ettei se kerro mitään. Ero toistui molempina kausina, ja naisten luku pysyi ${c(w.withoutLowest.corrMargin)}:ssa, kun ääripää ${w.withoutLowest.team} jätettiin pois.`,
    `The correlation was ${c(w.corrMargin)} for women and ${c(m.corrMargin)} for men. A value of 1 would mean the start tells you the season’s order completely, and 0 that it tells you nothing. The gap repeated in both seasons, and the women’s figure stayed at ${c(w.withoutLowest.corrMargin)} with the extreme case, ${w.withoutLowest.team}, left out.`),
   say(`Joukkuekausia on vähän, joten luvut ovat epävarmoja. 95 %:n luottamusväli on naisilla noin ${interval(w,lang)} ja miehillä noin ${interval(m,lang)}. Miesten väli ulottuu nollan alle, joten aineisto ei sulje pois sitäkään, ettei alku ennusta miehillä mitään. Välit myös koskettavat toisiaan, joten sarjojen ero on selvä suunta, ei tarkka mitta.`,
    `With so few team seasons the figures are uncertain. The 95% confidence interval is about ${interval(w,lang)} for women and about ${interval(m,lang)} for men. The men’s interval reaches below zero, so the data cannot rule out that the start predicts nothing for men. The two intervals also touch, so the gap between the leagues is a clear direction, not an exact measure.`)]},
  {heading:say('Sama alku, eri loppu','Same start, different finish'),chart:'starts',paragraphs:[
   say('Miesten sarjassa Helsinki Seagulls aloitti kahtena peräkkäisenä kautena 4–1. Loppukaudella se voitti ensin 85 % otteluistaan ja seuraavalla kaudella 37 %. Naisten sarjassa yksikään joukkue, jolla oli viiden ottelun jälkeen enintään yksi voitto, ei noussut loppukaudella 50 prosenttiin. Miehissä kolme viidestä nousi.',
    'In the men’s league Helsinki Seagulls started 4–1 in two straight seasons. In the rest of the season they won 85% of their games the first time and 37% the second. In the women’s league no team with at most one win after five games reached 50% in the rest of the season. In the men’s league three of five did.')]},
  {heading:say('Selittääkö kauden pituus eron?','Does the length of the season explain the gap?'),chart:'length',paragraphs:[
   say(`Ei yksin. Naisissa on 9–10 joukkuetta ja joukkue pelaa ${w.seasonLength.gamesPerTeam[0]}–${w.seasonLength.gamesPerTeam[1]} ottelua, miehissä 12 joukkuetta ja ${m.seasonLength.gamesPerTeam[0]}–${m.seasonLength.gamesPerTeam[1]} ottelua. Viisi ottelua on naisilla noin viidennes kaudesta ja miehillä noin kuudesosa, ja naisilla se voi kattaa yli puolet vastustajista, miehillä alle puolet. Seitsemän ottelua on miehillä kuitenkin sama osuus kaudesta kuin viisi naisilla, ja korrelaatio on silti ${c(m.seasonLength.corrAt['7'])}.`,
    `Not alone. The women’s league has 9–10 teams playing ${w.seasonLength.gamesPerTeam[0]}–${w.seasonLength.gamesPerTeam[1]} games each, the men’s 12 teams playing ${m.seasonLength.gamesPerTeam[0]}–${m.seasonLength.gamesPerTeam[1]}. Five games are about a fifth of the women’s season and about a sixth of the men’s, and for women they can cover more than half the opponents, for men less than half. But seven games are the same share of the men’s season as five are of the women’s, and the correlation is still ${c(m.seasonLength.corrAt['7'])}.`),
   say(`Todennäköisempi selitys on tasoero. Loppukauden voittoprosenttien hajonta oli naisilla ${n(w.spread,lang,0)} ja miehillä ${n(m.spread,lang,0)} prosenttiyksikköä. Kun joukkueet ovat kaukana toisistaan, vahvat ja heikot erottuvat nopeasti. Tätä selitystä aineisto ei todista, se vain sopii siihen.`,
    `A likelier explanation is the gap in quality. The spread of rest-of-season win percentages was ${n(w.spread,lang,0)} points for women and ${n(m.spread,lang,0)} for men. When teams are far apart, strong and weak separate quickly. The data does not prove this explanation; it only fits it.`)]},
  {heading:say(`Naisten sarja nyt (tilanne ${asOfDate(w,lang)})`,`The women’s league now (as of ${asOfDate(w,lang)})`),results:'women'},
  {heading:say(`Miesten sarja nyt (tilanne ${asOfDate(m,lang)})`,`The men’s league now (as of ${asOfDate(m,lang)})`),results:'men'},
  {heading:say('Mikä joukkueissa on muuttunut?','What has changed in these teams?'),changes:true,paragraphs:[
   say('Vertasin esimerkkijoukkueita viime kauteen. Tällä kaudella otteluita on vasta 4–7 ja vastustajat ovat eri, joten nämä ovat havaintoja. Ne eivät kerro, johtuuko muutos pelaajista. Pelaaja, joka ei ole pelannut tällä kaudella, voi olla poissa mistä syystä tahansa.',
    'I compared the example teams with last season. This season has only 4–7 games so far against different opponents, so these are observations. They do not say whether the players caused the change. A player who has not played this season may be out for any reason.')],
   after:[say('Yhtä kaavaa tästä ei saa. Märsky on parantunut lähes samalla kokoonpanolla ja KTP lähes uudella. Kokoonpanon vaihtuminen ei yksin kerro, kumpaan suuntaan joukkue menee.','No single pattern emerges. Märsky have improved with nearly the same roster and KTP with a nearly new one. Roster turnover alone does not say which way a team will go.')]},
  {heading:say('Mitä tästä voi päätellä','What you can conclude'),conclusions:conclusions(lang)},
 ];
}

export const methodNote={fi:'Viisi ensimmäistä tilastoitua ottelua verrattuna saman kauden muihin otteluihin. Mukana joukkuekaudet, joilla on vähintään viisi ottelua lisää. Runkosarja-aineisto, mukana kauden jatkosarjat. Lähde: Basket.fi:n tulospalvelu.',en:'The first five recorded games compared with the same season’s other games. Team seasons with at least five more games are included. Regular-season data, including continuation rounds. Source: Basket.fi results service.'};

// Plain text for the server-rendered page, so search engines and AI answers can read the article without JavaScript.
export function fiveGamesSummaryHtml(data,escape,teamHref){
 const team=(name,league)=>teamHref?`<a href="${escape(teamHref(name,league))}">${escape(name)}</a>`:escape(name);
 const list=(leagues,kind)=>`<ul>${leagues.flatMap(league=>data[league].changes.map(row=>`<li>${team(row.team,league)}: ${escape(teamNote(row.team,kind,'fi'))}</li>`)).join('')}</ul>`;
 const points=rows=>`<ul>${rows.map(([a,b])=>`<li>${escape(a)}: ${escape(b)}</li>`).join('')}</ul>`;
 return `<h2>Lyhyesti</h2>${points(fiveGamesBrief('fi'))}`+fiveGamesSections(data,'fi').map(s=>`<h2>${escape(s.heading)}</h2>${(s.paragraphs||[]).map(p=>`<p>${escape(p)}</p>`).join('')}${s.results?list([s.results],'result'):''}${s.changes?list(['women','men'],'change'):''}${(s.after||[]).map(p=>`<p>${escape(p)}</p>`).join('')}${s.conclusions?points(s.conclusions):''}`).join('')+`<p>${escape(methodNote.fi)}</p>`;
}
