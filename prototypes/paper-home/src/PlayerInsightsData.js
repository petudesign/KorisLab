const ON_OFF_SEASONS={men:['2024-25','2025-26'],women:['2025-26']},APPEARANCE_MIN=2;
// The comparison lives in Matchup Lab. The link shows only when that page has enough to compare.
export function matchupComparison(games,playerId,leagueId,seasonId){
 const verified=games.filter(game=>game.verified),played=verified.filter(game=>game.teams.some(team=>team.players.some(row=>row.id===playerId&&(row.minutesValue>0||row.participated===true))));
 const team=played.toSorted((a,b)=>String(b.date).localeCompare(String(a.date)))[0]?.teams.find(row=>row.players.some(player=>player.id===playerId));
 if(!team)return null;
 if(ON_OFF_SEASONS[leagueId]?.includes(seasonId))return played.length>=APPEARANCE_MIN?{mode:'onoff',teamId:team.id}:null;
 const teamGames=verified.filter(game=>game.teams.some(row=>row.id===team.id));
 const with_=played.filter(game=>game.teams.some(row=>row.id===team.id)).length,without=teamGames.length-with_;
 return with_>=APPEARANCE_MIN&&without>=APPEARANCE_MIN?{mode:'appearance',teamId:team.id}:null;
}
