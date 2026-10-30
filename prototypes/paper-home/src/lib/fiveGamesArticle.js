// "Mitä viisi ottelua kertoo?": the article's words in one place, so the page and the server-rendered
// summary say the same thing. Correlations and tables come from source/analysis-five-games.json, frozen at `asOf`.
export const articles=[{slug:'viisi-ottelua',published:'2026-10-30',title:{fi:'Mitä viisi ottelua kertoo?',en:'What do five games tell you?'},
 standfirst:{fi:'Naisten Korisliigassa viiden ensimmäisen ottelun piste-ero on ennustanut loppukautta hyvin, miesten sarjassa heikosti. Siksi Kouvottarien 4–0 ja Kipinän 6–1 eivät tarkoita samaa.',
  en:'In the women’s Korisliiga the point difference over the first five games has predicted the rest of the season well, in the men’s league poorly. That is why Kouvottaret’s 4–0 and Kipinä’s 6–1 do not mean the same thing.'}}];
export const articleSlugs=articles.map(article=>article.slug);

const n=(value,lang,decimals=2)=>value.toLocaleString(lang==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});

export function startGroups(data){
 const groups=[['strong',r=>r.wins>=4],['weak',r=>r.wins<=1]];
 return groups.map(([key,test])=>({key,women:data.women.rows.filter(test),men:data.men.rows.filter(test)}));
}

export function fiveGamesSections(data,lang){
 const {women:w,men:m}=data,say=(fi,en)=>lang==='fi'?fi:en,c=(v)=>n(v,lang);
 return [
  {heading:say('Alkukausi painaa eri tavalla','The start of the season weighs differently'),paragraphs:[
   say(`Katsoin kaudet 2024–25 ja 2025–26: ${w.teamSeasons} joukkuekautta naisissa ja ${m.teamSeasons} miehissä. Jokaiselta joukkueelta otin viiden ensimmäisen ottelun piste-eron per ottelu ja vertasin sitä saman joukkueen voittoprosenttiin loppukaudella.`,
    `I looked at the 2024–25 and 2025–26 seasons: ${w.teamSeasons} team seasons in the women’s league and ${m.teamSeasons} in the men’s. For each team I took the point difference per game over the first five games and compared it with the same team’s win percentage in the rest of the season.`),
   say(`Korrelaatio oli naisilla ${c(w.corrMargin)} ja miehillä ${c(m.corrMargin)}. Luku 1 tarkoittaisi, että alku kertoo loppukauden järjestyksen täysin, ja 0, ettei se kerro mitään. Ero toistui molempina kausina (naiset ${c(w.bySeason['2024-25'])} ja ${c(w.bySeason['2025-26'])}, miehet ${c(m.bySeason['2024-25'])} ja ${c(m.bySeason['2025-26'])}). Naisten luku pysyi ${c(w.withoutLowest.corrMargin)}:ssa, kun ääripää ${w.withoutLowest.team} jätettiin pois.`,
    `The correlation was ${c(w.corrMargin)} for women and ${c(m.corrMargin)} for men. A value of 1 would mean the start tells you the season’s order completely, and 0 that it tells you nothing. The gap repeated in both seasons (women ${c(w.bySeason['2024-25'])} and ${c(w.bySeason['2025-26'])}, men ${c(m.bySeason['2024-25'])} and ${c(m.bySeason['2025-26'])}). The women’s figure stayed at ${c(w.withoutLowest.corrMargin)} with the extreme case, ${w.withoutLowest.team}, left out.`)],chart:true},
  {heading:say('Sama alku, eri loppu','Same start, different finish'),table:'starts',paragraphs:[
   say('Miesten sarjassa Helsinki Seagulls aloitti kahtena peräkkäisenä kautena 4–1. Loppukaudella se voitti ensin 85 % otteluistaan ja seuraavalla kaudella 37 %. Naisten sarjassa yksikään joukkue, jolla oli viiden ottelun jälkeen enintään yksi voitto, ei noussut loppukaudella 50 prosenttiin. Miehissä kolme viidestä nousi.',
    'In the men’s league Helsinki Seagulls started 4–1 in two straight seasons. In the rest of the season they won 85% of their games the first time and 37% the second. In the women’s league no team with at most one win after five games reached 50% in the rest of the season. In the men’s league three of five did.'),
   say(`Todennäköinen selitys on tasoero. Loppukauden voittoprosenttien hajonta oli naisilla ${n(w.spread,lang,0)} ja miehillä ${n(m.spread,lang,0)} prosenttiyksikköä. Kun joukkueet ovat kaukana toisistaan, vahvat ja heikot erottuvat nopeasti. Tasaisemmassa sarjassa viidessä ottelussa on enemmän sattumaa. Tätä selitystä aineisto ei todista, se vain sopii siihen.`,
    `The likely explanation is the gap in quality. The spread of rest-of-season win percentages was ${n(w.spread,lang,0)} points for women and ${n(m.spread,lang,0)} for men. When teams are far apart, strong and weak separate quickly. In a more even league, five games hold more chance. The data does not prove this explanation; it only fits it.`)]},
  {heading:say('Naisten sarja nyt','The women’s league now'),table:'women',bullets:[
   say('Kouvottaret oli viime kaudella 3–21 ja on nyt 4–0. Voitot ovat tulleet 6–17 pisteellä, ja Märsky, Peli-Karhut ja EBT ovat vielä kohtaamatta. Otteluita on myös vasta neljä.','Kouvottaret went 3–21 last season and are now 4–0. The wins came by 6–17 points, and Märsky, Peli-Karhut and EBT are still to come. It is also only four games.'),
   say('ToPo on 3–2, mutta piste-ero on sarjan paras, +91. Tappiot tulivat 7 ja 1 pisteellä, ja se on voittanut Peli-Karhut 37:llä ja Märskyn 14:llä. Aiempina kausina neljä joukkuetta teki viidessä ottelussa vähintään +16 per ottelu, ja ne voittivat loppukaudella 62–81 %.','ToPo are 3–2, but their point difference is the league’s best, +91. The losses were by 7 and 1 points, and the wins include +37 against Peli-Karhut and +14 against Märsky. In earlier seasons four teams reached at least +16 per game over five games, and they won 62–81% in the rest of the season.'),
   say('EBT on 4–1 ja +33, mutta yksi ottelu tekee melkein kaiken: +46 Honkaa vastaan. Muissa neljässä ottelussa ero on yhteensä −13.','EBT are 4–1 and +33, but one game does nearly all of it: +46 against Honka. Across the other four games the difference is −13.'),
   say('Peli-Karhut voitti mestaruuden kahtena viime kautena ja on nyt 3–2 ja −34. Miinus tulee kahdesta tappiosta: Märskylle −24 ja ToPolle −37, eli juuri niille kahdelle joukkueelle, joilla on sarjan suurin piste-ero.','Peli-Karhut won the last two championships and are now 3–2 and −34. The minus comes from two losses: −24 to Märsky and −37 to ToPo, the two teams with the league’s biggest point difference.'),
   say('Vimpelin Veto oli viime kaudella 18–6 ja on nyt 0–5. Kolme viimeistä tappiota tulivat 1, 4 ja 6 pisteellä, joten ero on pienempi kuin ennätys antaa ymmärtää.','Vimpelin Veto went 18–6 last season and are now 0–5. The last three losses were by 1, 4 and 6 points, so the gap is smaller than the record suggests.')]},
  {heading:say('Miesten sarja nyt','The men’s league now'),table:'men',paragraphs:[
   say('KTP on 7–0 ja nousija Kipinä 6–1. Hieno alku kummallakin, mutta historia kehottaa varovaisuuteen. Kipinä oli viiden ottelun jälkeen 4–1 ja +8,0 per ottelu. Samalla 4–1-alulla miesten joukkueet voittivat loppukaudella 37–85 % otteluistaan. KTP:n 5–0-alulle on aineistossa yksi vertailukohta: Salon Vilpas 2025–26 voitti loppukaudella 63 %.',
    'KTP are 7–0 and newly promoted Kipinä 6–1. A fine start for both, but history urges caution. Kipinä were 4–1 and +8.0 per game after five games. From the same 4–1 start, men’s teams won 37–85% in the rest of the season. KTP’s 5–0 start has one comparison in the data: Salon Vilpas in 2025–26 won 63% in the rest of the season.')]},
  {heading:say('Mitä tästä voi päätellä','What you can conclude'),bullets:[
   say('Naisten sarjassa alkukauden piste-eroon kannattaa suhtautua vakavasti. Miesten sarjassa viisi ottelua kertoo vielä vähän.','In the women’s league the early point difference is worth taking seriously. In the men’s league five games still say little.'),
   say('Aineistossa on vain kaksi kautta ja 43 joukkuekautta. Se riittää huomioon, ei sääntöön.','The data covers only two seasons and 43 team seasons. That is enough for an observation, not a rule.'),
   say('Vastustajia ei ole korjattu. Näin aikaisin osa joukkueista on pelannut selvästi kovemman ohjelman kuin toiset.','Opponents are not adjusted for. This early, some teams have played a clearly harder schedule than others.'),
   say('Korrelaatio ei kerro syytä. Kokoonpanot, loukkaantumiset ja valmentajat eivät ole mukana.','Correlation does not give a reason. Rosters, injuries and coaches are not included.')]},
 ];
}

export const methodNote={fi:'Viisi ensimmäistä tilastoitua ottelua verrattuna saman kauden muihin otteluihin. Mukana joukkuekaudet, joilla on vähintään viisi ottelua lisää. Runkosarja-aineisto, mukana kauden jatkosarjat. Lähde: Basket.fi:n tulospalvelu.',en:'The first five recorded games compared with the same season’s other games. Team seasons with at least five more games are included. Regular-season data, including continuation rounds. Source: Basket.fi results service.'};

// Plain text for the server-rendered page, so search engines and AI answers can read the article without JavaScript.
export function fiveGamesSummaryHtml(data,escape){
 return fiveGamesSections(data,'fi').map(s=>`<h2>${escape(s.heading)}</h2>${(s.paragraphs||[]).map(p=>`<p>${escape(p)}</p>`).join('')}${s.bullets?`<ul>${s.bullets.map(b=>`<li>${escape(b)}</li>`).join('')}</ul>`:''}`).join('')+`<p>${escape(methodNote.fi)}</p>`;
}
