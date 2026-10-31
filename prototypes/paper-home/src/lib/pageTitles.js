// What a page is called in search results. The server summary and the loaded page must agree, because Google reads the page after JavaScript has run.
const LEAGUES={men:{fi:'Korisliiga',en:'Korisliiga'},women:{fi:'Naisten Korisliiga',en:'Women’s Korisliiga'}};
const SECTIONS={
 Yleiskatsaus:{fi:'sarjataulukko ja tilastot',en:'standings and stats'},
 Pelaajat:{fi:'pelaajatilastot',en:'player stats'},
 Joukkueet:{fi:'joukkuetilastot',en:'team stats'},
 Ottelut:{fi:'ottelut ja tulokset',en:'games and results'},
 Kausitrendit:{fi:'kausitrendit',en:'season trends'},
 'Matchup Lab':{fi:'Matchup Lab',en:'Matchup Lab'},
 'Sim Studio':{fi:'Sim Studio',en:'Sim Studio'},
};
const competition=(leagueId,seasonId,lang)=>`${LEAGUES[leagueId][lang]} ${seasonId.replace('-','–')}`;

export const homeTitle=(lang='fi')=>lang==='en'?'Korisliiga stats and analysis':'Korisliiga-tilastot ja analyysit';
// Sections without a season scope, such as the search page, keep their own name.
export const sectionTitle=(section,leagueId,seasonId,lang='fi')=>SECTIONS[section]?`${competition(leagueId,seasonId,lang)}: ${SECTIONS[section][lang]}`:section;
export const playerTitle=(name,leagueId,seasonId,lang='fi')=>`${name}: ${lang==='en'?'stats':'tilastot'}, ${competition(leagueId,seasonId,lang)}`;
export const teamTitle=(name,leagueId,seasonId,lang='fi')=>`${name}: ${lang==='en'?'stats and games':'tilastot ja ottelut'}, ${competition(leagueId,seasonId,lang)}`;
// Without a score the game has not been played or verified yet.
export const matchTitle=(home,away,score,lang='fi')=>`${home} – ${away} · ${score||(lang==='en'?'preview':'ennakko')}`;
