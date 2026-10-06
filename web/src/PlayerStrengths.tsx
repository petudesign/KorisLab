import { playerAttemptsPer40, playerThreePctFromTotals, playerTrueShootingPctFromTotals, type SeasonPlayerRow } from "./playerStats";
import { useI18n } from "./i18n";

type StrengthId = "trueShooting" | "threePoint" | "assists" | "rebounds";
type StrengthDefinition = {
  id: StrengthId;
  labelFi: string;
  labelEn: string;
  unit: "percent" | "per40";
  value: (player: SeasonPlayerRow) => number | null;
  sample: (player: SeasonPlayerRow) => number;
  sampleThreshold: number;
  sampleNote: (player: SeasonPlayerRow, language: "fi" | "en") => string;
};

type StrengthFinding = {
  id: StrengthId;
  label: string;
  value: number;
  median: number;
  peerCount: number;
  percentile: number;
  sampleNote: string;
  unit: StrengthDefinition["unit"];
};

function percentile(sortedValues: number[], value: number) {
  const below = sortedValues.filter((candidate) => candidate < value).length;
  const equal = sortedValues.filter((candidate) => candidate === value).length;
  return (below + equal / 2) / sortedValues.length;
}

function median(sortedValues: number[]) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
    : sortedValues[middle];
}

function formatNumber(value: number, language: "fi" | "en", digits = 1) {
  return value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCount(value: number, language: "fi" | "en") {
  return Math.round(value).toLocaleString(language === "fi" ? "fi-FI" : "en-GB");
}

export function PlayerStrengths({ player, players, minimumGames, minimumMinutes, teamShotShare }: {
  player: SeasonPlayerRow;
  players: SeasonPlayerRow[];
  minimumGames: number;
  minimumMinutes: number;
  teamShotShare: number | null;
}) {
  const { language, tr } = useI18n();
  const eligiblePlayers = players.filter((row) => row.games >= minimumGames && row.minutes >= minimumMinutes);
  const playerIsEligible = player.games >= minimumGames && player.minutes >= minimumMinutes;
  const definitions: StrengthDefinition[] = [
    {
      id: "trueShooting",
      labelFi: "Pisteiden heittotehokkuus · TS%",
      labelEn: "Scoring efficiency · TS%",
      unit: "percent",
      value: playerTrueShootingPctFromTotals,
      sample: (row) => (row.twoPA + row.threePA) + 0.44 * row.fta,
      sampleThreshold: Math.max(30, minimumGames * 4),
      sampleNote: (row, language) => language === "fi"
        ? `${formatCount(row.twoPA + row.threePA, language)} kenttäheittoyritystä · ${formatCount(row.fta, language)} vapaaheittoa`
        : `${formatCount(row.twoPA + row.threePA, language)} field-goal attempts · ${formatCount(row.fta, language)} free throws`,
    },
    {
      id: "threePoint",
      labelFi: "Kolmen pisteen tarkkuus · 3P%",
      labelEn: "Three-point accuracy · 3P%",
      unit: "percent",
      value: playerThreePctFromTotals,
      sample: (row) => row.threePA,
      sampleThreshold: Math.max(15, minimumGames * 2),
      sampleNote: (row, language) => language === "fi"
        ? `${formatCount(row.threePA, language)} kolmen pisteen yritystä`
        : `${formatCount(row.threePA, language)} three-point attempts`,
    },
    {
      id: "assists",
      labelFi: "Syöttötuotto / 40 min",
      labelEn: "Assists / 40 min",
      unit: "per40",
      value: (row) => row.minutes > 0 ? (row.assists / row.minutes) * 40 : null,
      sample: (row) => row.assists,
      sampleThreshold: Math.max(10, minimumGames * 1.5),
      sampleNote: (row, language) => language === "fi"
        ? `${formatCount(row.assists, language)} syöttöä`
        : `${formatCount(row.assists, language)} assists`,
    },
    {
      id: "rebounds",
      labelFi: "Levypallotuotto / 40 min",
      labelEn: "Rebounds / 40 min",
      unit: "per40",
      value: (row) => row.minutes > 0 ? (row.rebounds / row.minutes) * 40 : null,
      sample: (row) => row.rebounds,
      sampleThreshold: Math.max(20, minimumGames * 2),
      sampleNote: (row, language) => language === "fi"
        ? `${formatCount(row.rebounds, language)} levypalloa`
        : `${formatCount(row.rebounds, language)} rebounds`,
    },
  ];

  const findings: StrengthFinding[] = [];
  if (playerIsEligible && eligiblePlayers.length >= 12) {
    for (const definition of definitions) {
      const cohort = eligiblePlayers.filter((row) => definition.sample(row) >= definition.sampleThreshold)
        .map((row) => definition.value(row))
        .filter((value): value is number => value !== null && Number.isFinite(value))
        .sort((a, b) => a - b);
      if (cohort.length < 12) continue;
      const value = definition.value(player);
      if (value == null || definition.sample(player) < definition.sampleThreshold) continue;
      const cutoff = cohort[Math.ceil(cohort.length * 0.75) - 1];
      const referenceMedian = median(cohort);
      if (value < cutoff || value <= referenceMedian) continue;
      findings.push({
        id: definition.id,
        label: tr(definition.labelFi, definition.labelEn),
        value,
        median: referenceMedian,
        peerCount: cohort.length,
        percentile: percentile(cohort, value),
        sampleNote: definition.sampleNote(player, language),
        unit: definition.unit,
      });
    }
  }
  findings.sort((a, b) => b.percentile - a.percentile);

  const qualificationMessage = !playerIsEligible
    ? tr(`Pelaajan otos ei vielä yllä vertailurajaan: ${minimumGames} ottelua ja ${minimumMinutes} peliminuuttia.`, `The player's sample has not reached the comparison threshold yet: ${minimumGames} games and ${minimumMinutes} minutes.`)
    : eligiblePlayers.length < 12
      ? tr(`Vertailuryhmässä on vielä vain ${eligiblePlayers.length} pelaajaa. Tarvitaan vähintään 12 riittävän isolla otoksella.`, `The comparison group has only ${eligiblePlayers.length} players so far. At least 12 with a sufficient sample are needed.`)
      : null;
  const attemptsPer40 = playerAttemptsPer40(player);

  return (
    <section className="panel player-strengths" aria-labelledby="player-strengths-heading">
      <div className="player-strengths-heading">
        <div>
          <h2 id="player-strengths-heading">{tr("Tilastolliset vahvuudet", "Statistical strengths")}</h2>
          <p>{tr("Nostot perustuvat pelaajan asemaan sarjan vertailuryhmässä, eivät pelkkään pistekeskiarvoon.", "Highlights compare the player with a league peer group, not just points per game.")}</p>
        </div>
        <span className="panel-context">{tr(`Vertailuraja ${minimumGames} ottelua · ${minimumMinutes} min`, `Minimum ${minimumGames} games · ${minimumMinutes} min`)}</span>
      </div>
      {qualificationMessage ? <p className="player-strengths-empty" role="status">{qualificationMessage}</p> : findings.length > 0 ? <div className="player-strength-grid">
        {findings.map((finding) => <article className="player-strength-card" key={finding.id}>
          <span>{finding.label}</span>
          <strong>{formatNumber(finding.value, language)}{finding.unit === "percent" ? "%" : ""}</strong>
          <small>{tr("Vertailuryhmän mediaani", "Peer-group median")}: {formatNumber(finding.median, language)}{finding.unit === "percent" ? "%" : ""}</small>
          <small>{tr("Ylin neljännes", "Top quartile")} · {finding.peerCount} {tr("pelaajan vertailu", "players compared")}</small>
          <small>{finding.sampleNote}</small>
        </article>)}
      </div> : <p className="player-strengths-empty">{tr("Tarkastelluista mittareista mikään ei vielä yllä vertailuryhmän ylimpään neljännekseen riittävällä otoksella.", "No measured category reaches the top quartile of the peer group with a sufficient sample yet.")}</p>}
      {teamShotShare != null && <p className="player-strengths-role">{tr("Heittovastuu", "Shot share")}: <strong>{formatNumber(teamShotShare, language)}%</strong> {tr("joukkueen kenttäheittoyrityksistä", "of team field-goal attempts")} · <strong>{attemptsPer40 == null ? "—" : formatNumber(attemptsPer40, language)}</strong> FGA / 40 min. {tr("Tämä kuvaa yritysten määrää, ei sitä kuka loi heittopaikan tai kuinka vaikea heitto oli.", "This describes attempt volume, not who created the shot or how difficult it was.")}</p>}
      <p className="player-strengths-method">{tr("Vahvuus tarkoittaa tässä ylimpään neljännekseen sijoittumista riittävän otoksen pelaajien joukossa. Vertailu ei vakioi pelipaikkaa, joukkuetovereiden luomia paikkoja tai heittojen vaikeutta; per 40 min -luvut suhteuttavat vain peliaikaan.", "Strength here means ranking in the top quartile among players with sufficient samples. The comparison does not adjust for position, teammate-created opportunities or shot difficulty; per-40 figures adjust only for playing time.")}</p>
    </section>
  );
}
