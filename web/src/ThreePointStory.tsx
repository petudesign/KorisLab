import { useState } from "react";
import { useI18n } from "./i18n";
import { Icon } from "./Icon";
import { ShotCount } from "./ShotCount";

type TeamSummary = {
  source_team_id: string;
  name: string;
  games: number;
  totals: { three_pm: number; three_pa: number };
  per_game: { three_pa: number };
  metrics: { three_point_attempt_rate: number };
};

type LeagueSummary = {
  games: number;
  totals: { three_pm: number; three_pa: number };
  metrics: { three_point_attempt_rate: number };
};

type PlayerRow = {
  id: string;
  name: string;
  team: string;
  games: number;
  minutes: number;
  threePM: number;
  threePA: number;
};

type GameRow = {
  id: string;
  date: string | null;
  opponent: string;
  home: boolean;
  points: number;
  opponentPoints: number;
  threePM: number;
  threePA: number;
};

type Props = {
  team: TeamSummary;
  nextTeam: TeamSummary | undefined;
  league: LeagueSummary;
  players: PlayerRow[];
  games: GameRow[];
  dataStatus: "loading" | "ready" | "error";
  onOpenTeamProfile: (teamId: string) => void;
  onOpenMatch: (matchId: string) => void;
};

function formatNumber(value: number, language: "fi" | "en", digits = 1) {
  return value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value: string | null, language: "fi" | "en") {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Helsinki",
  }).format(new Date(value));
}

export function ThreePointStory({ team, nextTeam, league, players, games, dataStatus, onOpenTeamProfile, onOpenMatch }: Props) {
  const { language, tr } = useI18n();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const activeGame = games.find((game) => game.id === selectedGameId) ?? games.at(-1);
  const teamThreePct = team.totals.three_pa > 0 ? 100 * team.totals.three_pm / team.totals.three_pa : null;
  const leagueThreePct = league.totals.three_pa > 0 ? 100 * league.totals.three_pm / league.totals.three_pa : null;
  const topPlayers = [...players]
    .filter((player) => player.team === team.name && player.threePA > 0)
    .sort((a, b) => b.threePA - a.threePA || a.name.localeCompare(b.name, "fi"))
    .slice(0, 5);
  const highestPlayerAttempts = Math.max(1, ...topPlayers.map((player) => player.threePA));
  const maxGameAttempts = Math.max(5, Math.ceil(Math.max(...games.map((game) => game.threePA), team.per_game.three_pa) / 5) * 5);
  const chart = { left: 54, right: 760, top: 16, bottom: 142 };
  const step = (chart.right - chart.left) / Math.max(1, games.length);
  const barWidth = Math.min(20, Math.max(8, step * 0.58));
  const y = (value: number) => chart.bottom - (value / maxGameAttempts) * (chart.bottom - chart.top);
  const ticks = [0, maxGameAttempts / 2, maxGameAttempts];
  const selectedGameDate = activeGame ? formatDate(activeGame.date, language) : null;

  return (
    <section className="panel three-point-story" aria-labelledby="three-point-story-heading">
      <div className="three-point-story-heading">
        <div>
          <h2 id="three-point-story-heading">{tr(`${team.name} yritti eniten kolmen pisteen heittoja`, `${team.name} attempted the most threes`)}</h2>
          <p>{tr(
            `${formatNumber(team.per_game.three_pa, language)} yritystä ottelua kohti${nextTeam ? `. Seuraava joukkue, ${nextTeam.name}, yritti ${formatNumber(nextTeam.per_game.three_pa, language)} ottelua kohti` : ""}. Tarkkuus oli ${teamThreePct === null ? "—" : `${formatNumber(teamThreePct, language)}%`}; sarjan yhteistulos oli ${leagueThreePct === null ? "—" : `${formatNumber(leagueThreePct, language)}%`}.`,
            `${formatNumber(team.per_game.three_pa, language)} attempts per game${nextTeam ? `. The next team, ${nextTeam.name}, attempted ${formatNumber(nextTeam.per_game.three_pa, language)} per game` : ""}. Accuracy was ${teamThreePct === null ? "—" : `${formatNumber(teamThreePct, language)}%`}; the league total was ${leagueThreePct === null ? "—" : `${formatNumber(leagueThreePct, language)}%`}.`,
          )}</p>
        </div>
        <div className="three-point-story-actions">
          <span className="panel-context">{team.games} {tr("ottelun aineisto", "games in sample")}</span>
          <button className="outline-button small" type="button" onClick={() => onOpenTeamProfile(team.source_team_id)}>
            {tr(`Avaa ${team.name} -profiili`, `Open ${team.name} profile`)} <Icon name="arrowOutward" size={14} />
          </button>
        </div>
      </div>

      <div className="three-point-metrics" aria-label={tr("ToPon kolmosprofiilin pääluvut", "Main figures for the team three-point profile")}>
        <article>
          <span>{tr("Yrityksiä ottelua kohti", "Attempts per game")}</span>
          <strong>{formatNumber(team.per_game.three_pa, language)}</strong>
          <small>{team.totals.three_pa} {tr("yritystä", "attempts")} · {team.games} {tr("ottelua", "games")}</small>
        </article>
        <article>
          <span>{tr("Osumatarkkuus", "Shooting accuracy")}</span>
          <strong>{teamThreePct === null ? "—" : `${formatNumber(teamThreePct, language)}%`}</strong>
          <small><ShotCount made={team.totals.three_pm} attempted={team.totals.three_pa} /> {tr("osumaa / yritystä", "made / attempted")}</small>
        </article>
        <article>
          <span>{tr("Kolmosten osuus kenttäheittoyrityksistä", "Three-point share of field-goal attempts")}</span>
          <strong>{formatNumber(team.metrics.three_point_attempt_rate, language)}%</strong>
          <small>{tr("Sarjan yhteistulos", "League total")} {formatNumber(league.metrics.three_point_attempt_rate, language)}%</small>
        </article>
      </div>

      <div className="three-point-story-grid">
        <section className="three-point-games" aria-labelledby="three-point-games-heading">
          <div className="three-point-subheading">
            <div>
              <h3 id="three-point-games-heading">{tr("Ottelut kauden järjestyksessä", "Games through the season")}</h3>
              <p>{tr("Pylväs näyttää kaikki yritykset, vihreä osa osumat.", "Each bar shows all attempts; the green part shows makes.")}</p>
            </div>
            <span className="panel-context">{games.length} / {team.games}</span>
          </div>
          {dataStatus !== "ready" || games.length === 0 ? <p className="three-point-empty" role="status">{dataStatus === "error"
            ? tr("Ottelukohtaisia tietoja ei saatu ladattua. Kausiyhteenveto perustuu tarkistettuun aineistoon.", "Game-level data could not be loaded. Season totals still use the verified dataset.")
            : dataStatus === "loading"
              ? tr("Ottelukohtaisia kolmostietoja ladataan…", "Loading game-level three-point data…")
              : tr("Ottelukohtaisia kolmostietoja ei ole saatavilla.", "Game-level three-point data is unavailable.")}</p> : <>
            <div className="three-point-legend" aria-label={tr("Kuvaajan selite", "Chart legend")}>
              <span><i className="three-point-legend-mark three-point-legend-mark--attempts" /> {tr("3PA yritykset", "3PA attempts")}</span>
              <span><i className="three-point-legend-mark three-point-legend-mark--makes" /> {tr("3PM osumat", "3PM makes")}</span>
              <span><i className="three-point-legend-mark three-point-legend-mark--average" /> {tr("kauden ottelukeskiarvo", "season game average")}</span>
            </div>
            <div className="three-point-chart-wrap">
              <svg className="three-point-chart" viewBox="0 0 800 184" role="group" aria-label={tr(`${team.name}: kolmosyritykset ja osumat ottelujärjestyksessä`, `${team.name}: three-point attempts and makes by game`)}>
                {ticks.map((tick) => <g key={tick}>
                  <line x1={chart.left} x2={chart.right} y1={y(tick)} y2={y(tick)} className="three-point-chart-grid" />
                  <text x={chart.left - 10} y={y(tick) + 4} textAnchor="end">{formatNumber(tick, language, 0)}</text>
                </g>)}
                <line x1={chart.left} x2={chart.right} y1={y(team.per_game.three_pa)} y2={y(team.per_game.three_pa)} className="three-point-chart-average" />
                {games.map((game, index) => {
                  const center = chart.left + (index + 0.5) * step;
                  const attemptsY = y(game.threePA);
                  const makesY = y(game.threePM);
                  const isSelected = activeGame?.id === game.id;
                  const date = formatDate(game.date, language) ?? `${tr("Ottelu", "Game")} ${index + 1}`;
                  const label = `${date} · ${game.opponent}: ${game.threePM}/${game.threePA} ${tr("kolmosta", "threes made/attempted")}`;
                  return <g
                    key={game.id}
                    className={`three-point-game-bar${isSelected ? " selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={label}
                    onClick={() => setSelectedGameId(game.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedGameId(game.id);
                      }
                    }}
                  >
                    <title>{label}</title>
                    <rect className="three-point-game-hit" x={center - step / 2} y={chart.top - 4} width={step} height={chart.bottom - chart.top + 8} />
                    <rect className="three-point-game-attempts" x={center - barWidth / 2} y={attemptsY} width={barWidth} height={chart.bottom - attemptsY} rx="2" />
                    <rect className="three-point-game-makes" x={center - barWidth / 2 + 2} y={makesY} width={barWidth - 4} height={chart.bottom - makesY} rx="2" />
                    {isSelected && <rect className="three-point-game-outline" x={center - barWidth / 2 - 3} y={attemptsY - 3} width={barWidth + 6} height={chart.bottom - attemptsY + 6} rx="4" />}
                  </g>;
                })}
                {[0, Math.floor((games.length - 1) / 2), games.length - 1].filter((index, position, values) => games.length > 0 && values.indexOf(index) === position).map((index) => {
                  const center = chart.left + (index + 0.5) * step;
                  return <text key={index} x={center} y="168" textAnchor="middle">{index + 1}</text>;
                })}
              </svg>
            </div>
            <div className="three-point-chart-endpoints"><span>{games[0] ? formatDate(games[0].date, language) ?? tr("Alku", "Start") : "—"}</span><span>{games.at(-1) ? formatDate(games.at(-1)!.date, language) ?? tr("Loppu", "End") : "—"}</span></div>
            {activeGame && <div className="three-point-game-readout" aria-live="polite">
              <div>
                <strong>{selectedGameDate ?? tr("Ottelu", "Game")} · {activeGame.opponent}</strong>
                <span>{activeGame.home ? tr("Koti", "Home") : tr("Vieras", "Away")} · {activeGame.points}–{activeGame.opponentPoints} · {activeGame.threePM}/{activeGame.threePA} {tr("kolmosta", "threes")}{activeGame.threePA > 0 ? ` (${formatNumber(100 * activeGame.threePM / activeGame.threePA, language)}%)` : ""}</span>
              </div>
              <button className="outline-button small" type="button" onClick={() => onOpenMatch(activeGame.id)}>{tr("Avaa ottelun analyysi", "Open game analysis")} <Icon name="arrowOutward" size={14} /></button>
            </div>}
          </>}
        </section>

        <section className="three-point-players" aria-labelledby="three-point-players-heading">
          <div className="three-point-subheading">
            <div>
              <h3 id="three-point-players-heading">{tr("Ketkä ottivat heitot?", "Who took the shots?")}</h3>
              <p>{tr("Pelaajat järjestetty yritysmäärän mukaan.", "Players ordered by attempts.")}</p>
            </div>
            <span className="panel-context">{tr("top 5", "top 5")}</span>
          </div>
          {dataStatus !== "ready" || topPlayers.length === 0 ? <p className="three-point-empty" role="status">{dataStatus === "error"
            ? tr("Pelaajakohtaisia rivejä ei saatu muodostettua.", "Player-level rows could not be prepared.")
            : dataStatus === "loading"
              ? tr("Pelaajarivejä ladataan…", "Loading player rows…")
              : tr("Pelaajakohtaisia kolmostietoja ei ole saatavilla.", "Player-level three-point data is unavailable.")}</p> : <ol className="three-point-player-list">
            {topPlayers.map((player, index) => {
              const accuracy = player.threePA > 0 ? 100 * player.threePM / player.threePA : null;
              const attemptShare = team.totals.three_pa > 0 ? 100 * player.threePA / team.totals.three_pa : 0;
              const makeShare = team.totals.three_pm > 0 ? 100 * player.threePM / team.totals.three_pm : 0;
              const attemptsPer40 = player.minutes > 0 ? 40 * player.threePA / player.minutes : null;
              return <li className="three-point-player" key={player.id}>
                <div className="three-point-player-identity"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{player.name}</strong><small>{player.games} {tr("ottelua", "games")} · {formatNumber(player.minutes, language, 0)} {tr("min", "min")}</small></div></div>
                <div className="three-point-player-volume">
                  <div className="three-point-player-bar" role="img" aria-label={`${player.name}: ${formatNumber(attemptShare, language)}% ${tr("joukkueen kolmosyrityksistä", "of team three-point attempts")}`}><span style={{ width: `${(player.threePA / highestPlayerAttempts) * 100}%` }} /></div>
                  <small>{formatNumber(attemptShare, language)}% {tr("yrityksistä", "of attempts")} · {formatNumber(makeShare, language)}% {tr("osumista", "of makes")}</small>
                </div>
                <div className="three-point-player-shooting"><strong><ShotCount made={player.threePM} attempted={player.threePA} /><small> 3PM/3PA</small></strong><span>{accuracy === null ? "—" : `${formatNumber(accuracy, language)}%`} · {tr("tarkkuus", "accuracy")}</span></div>
                <div className="three-point-player-rate"><strong>{attemptsPer40 === null ? "—" : formatNumber(attemptsPer40, language)}</strong><span>3PA / 40 {tr("minuuttia", "min")}</span></div>
              </li>;
            })}
          </ol>}
        </section>
      </div>

      <p className="three-point-method-note">{tr(
        `${team.games} ottelua · 3P% = 3PM/3PA ja kolmosten osuus kenttäheittoyrityksistä = 3PA/FGA. Ottelukohtainen kuvaaja ei kerro, tapahtuiko heitto pelaajan ollessa kentällä vai penkillä.`,
        `${team.games} games · 3P% = 3PM/3PA and the three-point share of field-goal attempts = 3PA/FGA. The game-by-game chart does not show whether attempts happened with a particular player on the floor or on the bench.`,
      )}</p>
    </section>
  );
}
