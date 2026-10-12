// Values transcribed from the Finnish Basketball Association's official
// 2026–27 Korisliiga season briefs. A dash in the source is kept as null.
const women = {
  sourceUrl: 'https://basket.fi/wp-content/uploads/2026/10/N_Korisliiga_pahkinankuoressa2026v2.pdf',
  updatedAt: '2026-10-02',
  teams: {
    'BC Nokia': {coach:'Denis Kucevic',coachSeasons:2,previousCoach:'Miikka Sopanen',budget:160000,previousBudget:135000,payroll:92000,previousPayroll:78900,previousRank:4,rankBefore:8},
    'Espoo Basket Team': {coach:'Niko Hellman',coachSeasons:11,previousCoach:'Niko Hellman',budget:50500,previousBudget:73400,payroll:21000,previousPayroll:32000,previousRank:7,rankBefore:3},
    'HBA-Märsky': {coach:'Janne Hänninen',coachSeasons:3,previousCoach:'Janne Hänninen',budget:null,previousBudget:null,payroll:null,previousPayroll:null,previousRank:2,rankBefore:7},
    'Kouvottaret': {coach:'Joonas Frimodig',coachSeasons:7,previousCoach:'Joonas Frimodig',budget:167500,previousBudget:203500,payroll:86000,previousPayroll:90000,previousRank:9,rankBefore:5},
    'Peli-Karhut': {coach:'Niki Hillberg',coachSeasons:1,previousCoach:'Roope Mäkelä',budget:294000,previousBudget:306000,payroll:187800,previousPayroll:184000,previousRank:1,rankBefore:1},
    'Tampereen Pyrintö': {coach:'Antti Nikkilä',coachSeasons:2,previousCoach:'Damon Williams',budget:107100,previousBudget:143000,payroll:55100,previousPayroll:87000,previousRank:5,rankBefore:6},
    'Tapiolan Honka': {coach:'Reetta Piipari',coachSeasons:1,previousCoach:'Niko Nyholm',budget:171400,previousBudget:212400,payroll:132000,previousPayroll:177700,previousRank:8,rankBefore:4},
    'ToPo': {coach:'Tuomo Holopainen',coachSeasons:2,previousCoach:'Arttu Tammi',budget:122500,previousBudget:108500,payroll:66000,previousPayroll:73000,previousRank:3,rankBefore:2},
    'Vimpelin Veto': {coach:'Juuso Sainio',coachSeasons:1,previousCoach:'Jukka-Pekka Kujala',budget:95300,previousBudget:100500,payroll:52200,previousPayroll:52000,previousRank:6,rankBefore:9},
  },
};

const men = {
  sourceUrl: 'https://basket.fi/wp-content/uploads/2026/09/M_Korisliiga_pahkinankuoressa2026.xlsx.pdf',
  updatedAt: '2026-09-28',
  teams: {
    'Bisons Loimaa': {coach:'Michael Pounds',coachSeasons:1,previousCoach:'Konsta Mastomäki',budget:383000,previousBudget:382500,payroll:289000,previousPayroll:294000,previousRank:9,rankBefore:6},
    'Helsinki Seagulls': {coach:'Timo Saukkola',coachSeasons:2,previousCoach:'Timo Saukkola',budget:908300,previousBudget:777200,payroll:374900,previousPayroll:442600,previousRank:4,rankBefore:1},
    'Kataja Basket': {coach:'Petri Virtanen',coachSeasons:7,previousCoach:'Petri Virtanen',budget:859000,previousBudget:770000,payroll:480000,previousPayroll:447000,previousRank:2,rankBefore:4},
    'Kauhajoki': {coach:'Konsta Mastomäki',coachSeasons:4,previousCoach:'Janne Koskimies',budget:985000,previousBudget:980000,payroll:420000,previousPayroll:518000,previousRank:5,rankBefore:2},
    'Kipinä Basket': {coach:'Joni Hautsalo',coachSeasons:1,previousCoach:null,budget:324700,previousBudget:null,payroll:241000,previousPayroll:null,previousRank:'I divisioona',rankBefore:'I divisioona'},
    'Korihait': {coach:'Pieti Poikola',coachSeasons:11,previousCoach:'Kari Kurronen',budget:424400,previousBudget:407000,payroll:268000,previousPayroll:274000,previousRank:3,rankBefore:5},
    'Kouvot': {coach:'Kari Kurronen',coachSeasons:2,previousCoach:'Darko Mihajlovic',budget:455000,previousBudget:502000,payroll:220000,previousPayroll:260000,previousRank:11,rankBefore:8},
    'KTP-Basket': {coach:'Greg Gibson',coachSeasons:14,previousCoach:'Kristian Palotie',budget:532000,previousBudget:460000,payroll:338000,previousPayroll:323000,previousRank:6,rankBefore:11},
    'Lahti Basketball': {coach:'Teemu Turunen',coachSeasons:2,previousCoach:null,budget:505300,previousBudget:458600,payroll:335000,previousPayroll:233900,previousRank:'I divisioona',rankBefore:'I divisioona'},
    'Salon Vilpas': {coach:'Jussi Savolainen',coachSeasons:5,previousCoach:'Jussi Savolainen',budget:965000,previousBudget:781400,payroll:495800,previousPayroll:434700,previousRank:1,rankBefore:3},
    'Tampereen Pyrintö': {coach:'Tero Hassinen',coachSeasons:6,previousCoach:'Tero Hassinen',budget:382000,previousBudget:407200,payroll:286500,previousPayroll:299600,previousRank:8,rankBefore:7},
    'Tapiolan Honka': {coach:'Aapo Heinonen',coachSeasons:6,previousCoach:'Aapo Heinonen',budget:384500,previousBudget:368000,payroll:312400,previousPayroll:315000,previousRank:7,rankBefore:10},
  },
};

export const teamSeasonInfo = {women:{'2026-27':women},men:{'2026-27':men}};

const normalize = value => String(value || '').normalize('NFC').trim().toLocaleLowerCase('fi-FI');

function playerRoster(games, teamName) {
  const byId = new Map();
  for (const game of games || []) {
    if (!game.verified) continue;
    const team = (game.teams || []).find(row => row.name === teamName);
    if (!team) continue;
    for (const player of team.players || []) {
      if (!player.id || !Number.isFinite(player.minutesValue) || player.minutesValue <= 0) continue;
      byId.set(player.id, {id:player.id,name:player.name,teamId:team.id,teamName:team.name});
    }
  }
  const byName = new Map();
  for (const player of byId.values()) {
    const key = normalize(player.name);
    byName.set(key,[...(byName.get(key) || []),player]);
  }
  return {byId,byName};
}

function allPlayers(games) {
  const byId = new Map();
  for (const game of games || []) {
    if (!game.verified) continue;
    for (const team of game.teams || []) for (const player of team.players || []) {
      if (!player.id || !Number.isFinite(player.minutesValue) || player.minutesValue <= 0) continue;
      byId.set(player.id,{id:player.id,name:player.name,teamId:team.id,teamName:team.name});
    }
  }
  const byName = new Map();
  for (const player of byId.values()) {
    const key = normalize(player.name);
    byName.set(key,[...(byName.get(key) || []),player]);
  }
  return {byId,byName};
}

function findPlayer(player, index) {
  if (index.byId.has(player.id)) return index.byId.get(player.id);
  const candidates = index.byName.get(normalize(player.name)) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

export function teamSeasonContext(games, previousGames, teamName) {
  const played = (games || []).filter(game => game.verified && (game.teams || []).length === 2);
  const leagueResults = played.map(game => {
    const [own,opponent] = game.teams;
    if (!Number.isFinite(own?.score) || !Number.isFinite(opponent?.score)) return null;
    return {id:game.id,date:game.date,teams:game.teams,margin:own.score-opponent.score};
  }).filter(Boolean);
  const results = leagueResults.filter(game=>game.teams.some(team=>team.name===teamName)).map(game=>{
    const own=game.teams.find(team=>team.name===teamName),opponent=game.teams.find(team=>team!==own);
    return {id:game.id,date:game.date,opponent:opponent.name,ownScore:own.score,opponentScore:opponent.score,margin:own.score-opponent.score};
  });
  const latestTie = (a,b) => String(b.date || '').localeCompare(String(a.date || ''));
  const wins = results.filter(result => result.margin > 0).sort((a,b)=>b.margin-a.margin||latestTie(a,b));
  const losses = results.filter(result => result.margin < 0).sort((a,b)=>a.margin-b.margin||latestTie(a,b));

  const records = new Map();
  for (const result of leagueResults) {
    const [home,away]=result.teams;
    for (const [teamRow,margin] of [[home,result.margin],[away,-result.margin]]) {
      const name=teamRow.name;
      const row = records.get(name) || {name,wins:0,losses:0,diff:0,games:0};
      if (margin > 0) row.wins++;
      else if (margin < 0) row.losses++;
      row.diff += margin;row.games++;
      records.set(name,row);
    }
  }
  const standings = [...records.values()].sort((a,b)=>b.wins/Math.max(1,b.games)-a.wins/Math.max(1,a.games)||b.diff-a.diff||a.name.localeCompare(b.name,'fi'));
  const currentRank = standings.findIndex(row=>row.name===teamName)+1 || null;
  const currentRecord = records.get(teamName) || {wins:0,losses:0};

  if (!Array.isArray(previousGames)) return {games:results.length,biggestWin:wins[0]||null,biggestLoss:losses[0]||null,currentRank,standingsCount:standings.length,wins:currentRecord.wins,losses:currentRecord.losses,roster:null};
  const currentRoster = playerRoster(games,teamName), previousRoster = playerRoster(previousGames,teamName), previousLeague = allPlayers(previousGames);
  const returning = [...currentRoster.byId.values()].filter(player=>findPlayer(player,previousRoster));
  const movedIn = [...currentRoster.byId.values()].filter(player=>{
    const prior=findPlayer(player,previousLeague);
    return prior && prior.teamName!==teamName;
  });
  const newToLeagueData = [...currentRoster.byId.values()].filter(player=>!findPlayer(player,previousLeague));
  const notYetSeen = [...previousRoster.byId.values()].filter(player=>!findPlayer(player,currentRoster));
  return {games:results.length,biggestWin:wins[0]||null,biggestLoss:losses[0]||null,currentRank,standingsCount:standings.length,wins:currentRecord.wins,losses:currentRecord.losses,roster:{current:currentRoster.byId.size,previous:previousRoster.byId.size,returning:returning.length,joined:currentRoster.byId.size-returning.length,movedIn:movedIn.length,newToLeagueData:newToLeagueData.length,notYetSeen:notYetSeen.length}};
}
