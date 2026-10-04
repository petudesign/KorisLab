import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyMapping, importFields, makeDataset, parseWorkbookFile, statFields, suggestMapping, validateSheetRows,
  type ImportField, type ImportMapping, type ImportedPlayerGame, type LocalCustomDataset, type StatField, type WorkbookSheet,
} from "./customImportData";
import {
  playerAssistTurnoverRatio, playerFgPctFromTotals, playerPerGame, playerThreePctFromTotals,
  type SeasonPlayerRow,
} from "./playerStats";
import { useI18n } from "./i18n";
import { Icon } from "./Icon";

const dbName = "korislab-custom-import";
const storeName = "datasets";
const activeDatasetKey = "active";
const templateHeaders = [
  "ottelu_id", "ottelupäivä", "joukkue", "vastustaja", "koti_vieras", "vastustajan_pisteet",
  "pelaaja_id", "pelaaja", "minuutit", "pisteet", "2PM", "2PA", "3PM", "3PA", "FTM", "FTA",
  "levypallot", "hyökkäyslevypallot", "puolustuslevypallot", "syötöt", "menetykset", "riistot", "torjunnat", "plus_miinus",
];

const englishFieldLabels: Record<ImportField, string> = {
  gameId: "Game ID", date: "Game date", team: "Team", opponent: "Opponent", homeAway: "Home / away",
  opponentPoints: "Opponent points", playerId: "Player ID", player: "Player", minutes: "Minutes",
  points: "Points", twoPM: "2P made", twoPA: "2P attempted", threePM: "3P made", threePA: "3P attempted",
  ftm: "Free throws made", fta: "Free throws attempted", rebounds: "Rebounds",
  offensiveRebounds: "Offensive rebounds", defensiveRebounds: "Defensive rebounds", assists: "Assists",
  turnovers: "Turnovers", steals: "Steals", blocks: "Blocks", plusMinus: "Plus / minus",
};

const statLabels: Record<StatField, [string, string]> = {
  minutes: ["Minuutit", "Minutes"], points: ["Pisteet", "Points"], twoPM: ["2P osumat", "2P made"],
  twoPA: ["2P yritykset", "2P attempted"], threePM: ["3P osumat", "3P made"], threePA: ["3P yritykset", "3P attempted"],
  ftm: ["Vapaaheitot osumat", "FT made"], fta: ["Vapaaheitot yritykset", "FT attempted"],
  rebounds: ["Levypallot", "Rebounds"], offensiveRebounds: ["Hyökkäyslevypallot", "Offensive rebounds"],
  defensiveRebounds: ["Puolustuslevypallot", "Defensive rebounds"], assists: ["Syötöt", "Assists"],
  turnovers: ["Menetykset", "Turnovers"], steals: ["Riistot", "Steals"], blocks: ["Torjunnat", "Blocks"],
  plusMinus: ["Plus / miinus", "Plus / minus"],
};

type GameSummary = {
  id: string;
  date: string;
  opponent: string;
  homeAway: "home" | "away" | null;
  points: number;
  opponentPoints: number | null;
  stats: Record<StatField, number | null>;
  rows: ImportedPlayerGame[];
};

type PlayerSummary = {
  id: string;
  name: string;
  team: string;
  games: number;
  minutesPerGame: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  turnoversPerGame: number | null;
  fgPct: number | null;
  threePct: number | null;
  assistTurnover: number | null;
};

function openDatasetDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage"));
  });
}

async function readSavedDataset(): Promise<LocalCustomDataset | null> {
  if (!("indexedDB" in window)) return null;
  const db = await openDatasetDb();
  return new Promise<LocalCustomDataset | null>((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(activeDatasetKey);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local dataset"));
  }).finally(() => db.close());
}

async function saveDataset(dataset: LocalCustomDataset) {
  const db = await openDatasetDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(dataset, activeDatasetKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the local dataset"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving the local dataset was cancelled"));
  }).finally(() => db.close());
}

async function removeSavedDataset() {
  const db = await openDatasetDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(activeDatasetKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete the local dataset"));
  }).finally(() => db.close());
}

function downloadTemplate() {
  const csv = "\ufeff" + templateHeaders.join(";") + "\r\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "korislab-custom-import-pohja.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function emptySheetLabel(sheet: WorkbookSheet) {
  return sheet.name + " · " + sheet.rows.length + " riviä";
}

function groupGames(rows: ImportedPlayerGame[]): GameSummary[] {
  const groups = new Map<string, ImportedPlayerGame[]>();
  for (const row of rows) {
    const key = row.matchId + "|" + row.team.toLocaleLowerCase();
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([id, gameRows]) => {
    const stats = Object.fromEntries(statFields.map((field) => {
      const values = gameRows.map((row) => row.stats[field]);
      if (values.some((value) => value === null)) return [field, null];
      return [field, values.reduce<number>((sum, value) => sum + value!, 0)];
    })) as Record<StatField, number | null>;
    const opponentScores = new Set(gameRows.flatMap((row) => row.opponentPoints === null ? [] : [row.opponentPoints]));
    return {
      id,
      date: gameRows[0].date,
      opponent: gameRows[0].opponent,
      homeAway: gameRows.find((row) => row.homeAway !== null)?.homeAway ?? null,
      points: stats.points ?? 0,
      opponentPoints: opponentScores.size === 1 ? [...opponentScores][0] : null,
      stats,
      rows: gameRows,
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function aggregatePlayers(rows: ImportedPlayerGame[], availableFields: ImportField[]): PlayerSummary[] {
  const groups = new Map<string, ImportedPlayerGame[]>();
  for (const row of rows) {
    const group = groups.get(row.playerId) ?? [];
    group.push(row);
    groups.set(row.playerId, group);
  }
  return [...groups.entries()].map(([id, playerRows]) => {
    const first = playerRows[0];
    const totals = Object.fromEntries(statFields.map((field) => {
      const values = playerRows.map((row) => row.stats[field]);
      if (values.some((value) => value === null)) return [field, null];
      return [field, values.reduce<number>((sum, value) => sum + value!, 0)];
    })) as Record<StatField, number | null>;
    const row = {
      id, name: first.player, team: first.team, games: playerRows.length, starts: 0,
      minutes: totals.minutes ?? 0, points: totals.points ?? 0, twoPM: totals.twoPM ?? 0, twoPA: totals.twoPA ?? 0,
      threePM: totals.threePM ?? 0, threePA: totals.threePA ?? 0, ftm: totals.ftm ?? 0, fta: totals.fta ?? 0,
      rebounds: totals.rebounds ?? 0, assists: totals.assists ?? 0, turnovers: totals.turnovers ?? 0,
      steals: totals.steals, blocks: totals.blocks, efficiency: 0,
    } as SeasonPlayerRow;
    const has = (field: ImportField) => availableFields.includes(field);
    const sumAvailable = (field: StatField) => totals[field] !== null && has(field as ImportField);
    return {
      id, name: first.player, team: first.team, games: playerRows.length,
      minutesPerGame: sumAvailable("minutes") ? playerRows.reduce((sum, item) => sum + item.stats.minutes!, 0) / playerRows.length : null,
      pointsPerGame: playerPerGame(row, "points"),
      reboundsPerGame: sumAvailable("rebounds") ? playerPerGame(row, "rebounds") : null,
      assistsPerGame: sumAvailable("assists") ? playerPerGame(row, "assists") : null,
      turnoversPerGame: sumAvailable("turnovers") ? row.turnovers / row.games : null,
      fgPct: ["twoPM", "twoPA", "threePM", "threePA"].every((field) => has(field as ImportField) && totals[field as StatField] !== null) ? playerFgPctFromTotals(row) : null,
      threePct: has("threePM") && has("threePA") && totals.threePM !== null && totals.threePA !== null ? playerThreePctFromTotals(row) : null,
      assistTurnover: sumAvailable("assists") && sumAvailable("turnovers") ? playerAssistTurnoverRatio(row) : null,
    };
  }).sort((a, b) => (b.pointsPerGame ?? -Infinity) - (a.pointsPerGame ?? -Infinity) || a.name.localeCompare(b.name));
}

function fmt(value: number | null | undefined, language: string, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function dateLabel(value: string, language: string) {
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.valueOf()) ? date.toLocaleDateString(language === "fi" ? "fi-FI" : "en-GB", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", year: "numeric" }) : value;
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "positive" | "negative" }) {
  return <article className="custom-metric">
    <span>{label}</span>
    <strong className={tone ? "custom-metric-value custom-metric-value--" + tone : "custom-metric-value"}>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function TrendChart({ games, metric, onMetricChange, availableFields, language, tr }: {
  games: GameSummary[];
  metric: StatField;
  onMetricChange: (metric: StatField) => void;
  availableFields: ImportField[];
  language: string;
  tr: (finnish: string, english: string) => string;
}) {
  const choices: { key: StatField; label: string }[] = [
    { key: "points", label: tr("Pisteet", "Points") },
    ...(availableFields.includes("rebounds") ? [{ key: "rebounds" as const, label: tr("Levypallot", "Rebounds") }] : []),
    ...(availableFields.includes("assists") ? [{ key: "assists" as const, label: tr("Syötöt", "Assists") }] : []),
    ...(availableFields.includes("turnovers") ? [{ key: "turnovers" as const, label: tr("Menetykset", "Turnovers") }] : []),
    ...(availableFields.includes("threePA") ? [{ key: "threePA" as const, label: tr("3P yritykset", "3P attempts") }] : []),
  ];
  const activeMetric = choices.some((choice) => choice.key === metric) ? metric : "points";
  const chartRows = games.filter((game) => game.stats[activeMetric] !== null);
  const maxValue = Math.max(1, ...chartRows.map((row) => row.stats[activeMetric] ?? 0), ...(activeMetric === "points" ? chartRows.map((row) => row.opponentPoints ?? 0) : []));
  const minValue = Math.min(0, ...chartRows.map((row) => row.stats[activeMetric] ?? 0), ...(activeMetric === "points" ? chartRows.map((row) => row.opponentPoints ?? 0) : []));
  const range = maxValue - minValue || 1;
  const x = (index: number) => 60 + (chartRows.length < 2 ? 0.5 : index / (chartRows.length - 1)) * 680;
  const y = (value: number) => 235 - ((value - minValue) / range) * 195;
  const ownPoints = chartRows.map((row, index) => x(index) + "," + y(row.stats[activeMetric] ?? 0)).join(" ");
  const opponentPoints = activeMetric === "points" && chartRows.every((row) => row.opponentPoints !== null)
    ? chartRows.map((row, index) => x(index) + "," + y(row.opponentPoints!)).join(" ")
    : "";
  const ticks = [0, 1, 2, 3].map((index) => minValue + (range * index) / 3);
  const labelIndexes = [...new Set([0, Math.floor((chartRows.length - 1) / 2), chartRows.length - 1])].filter((index) => index >= 0);
  return <section className="panel custom-trend-panel" aria-labelledby="custom-trend-title">
    <div className="panel-heading panel-heading--plain custom-section-heading">
      <div><h2 id="custom-trend-title">{tr("Joukkueen kehitys", "Team development")}</h2><p className="panel-subcopy">{tr("Ottelukohtaiset luvut aikajärjestyksessä.", "Game-by-game values in chronological order.")}</p></div>
      <label className="custom-control"><span>{tr("Mittari", "Metric")}</span><select value={activeMetric} onChange={(event) => onMetricChange(event.target.value as StatField)}>{choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}</select></label>
    </div>
    {chartRows.length === 0 ? <p className="custom-empty-state">{tr("Valittua mittaria ei ole riittävästi otteluriveillä.", "There is not enough game data for this metric.")}</p> : <>
      <div className="custom-chart-legend"><span><i className="custom-legend-own" />{tr("Oma joukkue", "Your team")}</span>{opponentPoints && <span><i className="custom-legend-opponent" />{tr("Vastustajan pisteet", "Opponent points")}</span>}</div>
      <div className="custom-trend-chart">
        <svg viewBox="0 0 800 280" role="img" aria-label={tr("Ottelukohtainen kehityskaavio", "Game-by-game trend chart")}>
          {ticks.map((value) => <g key={value}><line x1="60" x2="740" y1={y(value)} y2={y(value)} className="custom-chart-grid" /><text x="48" y={y(value) + 4} textAnchor="end">{fmt(value, language, 0)}</text></g>)}
          {opponentPoints && <polyline points={opponentPoints} className="custom-chart-line custom-chart-line--opponent" />}
          <polyline points={ownPoints} className="custom-chart-line" />
          {chartRows.map((row, index) => <g key={row.id}><circle cx={x(index)} cy={y(row.stats[activeMetric] ?? 0)} r="4" className="custom-chart-point" /><title>{dateLabel(row.date, language)} · {row.opponent} · {fmt(row.stats[activeMetric], language)}</title></g>)}
          {labelIndexes.map((index) => <text key={index} x={x(index)} y="258" textAnchor={index === 0 ? "start" : index === chartRows.length - 1 ? "end" : "middle"}>{dateLabel(chartRows[index].date, language)} · {chartRows[index].opponent}</text>)}
        </svg>
      </div>
    </>}
  </section>;
}

export default function CustomImportPage() {
  const { language, tr } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<LocalCustomDataset | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [draft, setDraft] = useState<{ fileName: string; sheets: WorkbookSheet[]; sheetName: string } | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>(emptyMapping);
  const [activeTeamState, setActiveTeam] = useState("");
  const [trendMetric, setTrendMetric] = useState<StatField>("points");
  const [showAllGames, setShowAllGames] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readSavedDataset().then((saved) => { if (!cancelled) setDataset(saved); }).catch(() => {
      if (!cancelled) setError(tr("Paikallista aineistoa ei voitu lukea. Tarkista selaimen tallennustila-asetukset.", "Could not read the local dataset. Check browser storage settings."));
    }).finally(() => { if (!cancelled) setLoadingSaved(false); });
    return () => { cancelled = true; };
  }, [tr]);

  const activeSheet = draft?.sheets.find((sheet) => sheet.name === draft.sheetName) ?? draft?.sheets[0] ?? null;
  const validation = useMemo(() => activeSheet ? validateSheetRows(activeSheet, mapping) : null, [activeSheet, mapping]);
  const teams = useMemo(() => [...new Set(dataset?.rows.map((row) => row.team) ?? [])].sort((a, b) => a.localeCompare(b, language)), [dataset, language]);
  const activeTeam = teams.includes(activeTeamState) ? activeTeamState : teams[0] ?? "";
  const teamRows = useMemo(() => dataset?.rows.filter((row) => row.team === activeTeam) ?? [], [dataset, activeTeam]);
  const games = useMemo(() => groupGames(teamRows), [teamRows]);
  const players = useMemo(() => aggregatePlayers(teamRows, dataset?.availableFields ?? []), [teamRows, dataset]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setReadingFile(true);
    setError("");
    setNotice("");
    setDraft(null);
    try {
      const sheets = await parseWorkbookFile(file);
      setDraft({ fileName: file.name, sheets, sheetName: sheets[0].name });
      setMapping(suggestMapping(sheets[0].headers));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr("Tiedostoa ei voitu lukea.", "Could not read the file."));
    } finally {
      setReadingFile(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const selectSheet = (name: string) => {
    if (!draft) return;
    const sheet = draft.sheets.find((item) => item.name === name);
    if (!sheet) return;
    setDraft({ ...draft, sheetName: name });
    setMapping(suggestMapping(sheet.headers));
  };

  const setMappedField = (field: ImportField, value: string) => {
    setMapping((current) => ({ ...current, [field]: value === "" ? null : Number(value) }));
  };

  const importDataset = async () => {
    if (!draft || !activeSheet || !validation || validation.issues.length || validation.rows.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const imported = makeDataset(draft.fileName, activeSheet.name, mapping, validation.rows);
      await saveDataset(imported);
      setDataset(imported);
      setActiveTeam(imported.rows[0]?.team ?? "");
      setDraft(null);
      setShowAllGames(false);
      setNotice(tr("Aineisto ladattu ja tallennettu paikallisesti. Se ei siirtynyt palvelimelle.", "Dataset imported and saved locally. It was not sent to a server."));
    } catch {
      setError(tr("Aineistoa ei voitu tallentaa tähän selaimeen.", "Could not save the dataset in this browser."));
    } finally {
      setSaving(false);
    }
  };

  const clearDataset = async () => {
    if (!window.confirm(tr("Poistetaanko tuotu aineisto tältä selaimelta?", "Remove the imported dataset from this browser?"))) return;
    try {
      await removeSavedDataset();
      setDataset(null);
      setActiveTeam("");
      setNotice(tr("Paikallinen aineisto poistettu.", "Local dataset removed."));
    } catch {
      setError(tr("Aineistoa ei voitu poistaa.", "Could not remove the dataset."));
    }
  };

  const available = dataset?.availableFields ?? [];
  const avgPoints = games.length ? games.reduce((sum, game) => sum + game.points, 0) / games.length : null;
  const opponentCoverage = games.length > 0 && games.every((game) => game.opponentPoints !== null);
  const avgAgainst = opponentCoverage ? games.reduce((sum, game) => sum + game.opponentPoints!, 0) / games.length : null;
  const pointDiff = avgPoints !== null && avgAgainst !== null ? avgPoints - avgAgainst : null;
  const wins = opponentCoverage ? games.filter((game) => game.points > game.opponentPoints!).length : null;
  const losses = opponentCoverage ? games.filter((game) => game.points < game.opponentPoints!).length : null;
  const playerOptions = players;
  const [firstPlayerId, setFirstPlayerId] = useState("");
  const [secondPlayerId, setSecondPlayerId] = useState("");
  useEffect(() => {
    if (!playerOptions.length) return;
    setFirstPlayerId((current) => playerOptions.some((player) => player.id === current) ? current : playerOptions[0].id);
    setSecondPlayerId((current) => playerOptions.some((player) => player.id === current && player.id !== firstPlayerId) ? current : playerOptions[1]?.id ?? playerOptions[0].id);
  }, [playerOptions, firstPlayerId]);
  const firstPlayer = playerOptions.find((player) => player.id === firstPlayerId) ?? playerOptions[0];
  const secondPlayer = playerOptions.find((player) => player.id === secondPlayerId) ?? playerOptions[1];
  const requiredMappingsComplete = importFields.filter((field) => field.required).every((field) => mapping[field.key] !== null);
  const previewHeaders = activeSheet?.headers.slice(0, 6) ?? [];
  const rowCountForImport = validation?.rows.length ?? 0;
  const completeFieldGoals = ["twoPM", "twoPA", "threePM", "threePA"].every((field) => available.includes(field as ImportField));

  return <div className="custom-import-page">
    <header className="custom-import-header">
      <div><h1>Custom import</h1><p>{tr("Tuo joukkueesi ottelutilastot ja tutki niitä KorisLabin analyyseillä.", "Bring in your team's game statistics and explore them with KorisLab analysis.")}</p></div>
      <div className="custom-local-note"><span aria-hidden="true">●</span>{tr("Aineisto tallentuu vain tälle selaimelle", "Data stays in this browser")}</div>
    </header>

    {error && <div className="custom-alert" role="alert">{error}</div>}
    {notice && <div className="custom-notice" role="status">{notice}<button type="button" aria-label={tr("Sulje ilmoitus", "Dismiss notice")} onClick={() => setNotice("")}>×</button></div>}

    <input ref={fileInput} className="custom-file-input" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" aria-label={tr("Valitse CSV- tai Excel-tiedosto", "Choose a CSV or Excel file")} onChange={(event) => void handleFile(event.currentTarget.files?.[0])} />

    {draft ? <section className="panel custom-import-setup" aria-labelledby="custom-import-setup-title">
      <div className="panel-heading panel-heading--plain custom-section-heading">
        <div><h2 id="custom-import-setup-title">{tr("Yhdistä sarakkeet", "Map columns")}</h2><p className="panel-subcopy">{draft.fileName} · {activeSheet?.rows.length ?? 0} {tr("taulukkoriviä", "spreadsheet rows")}</p></div>
        <button type="button" className="outline-button small" onClick={() => setDraft(null)}>{tr("Peruuta", "Cancel")}</button>
      </div>
      {draft.sheets.length > 1 && <label className="custom-control custom-sheet-select"><span>{tr("Välilehti", "Sheet")}</span><select value={activeSheet?.name ?? ""} onChange={(event) => selectSheet(event.target.value)}>{draft.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{emptySheetLabel(sheet)}</option>)}</select></label>}
      {!activeSheet || activeSheet.headers.length === 0 ? <p className="custom-alert" role="alert">{tr("Valitulla välilehdellä ei ole luettavaa taulukkoa.", "The selected sheet does not contain a readable table.")}</p> : <>
        <div className="custom-mapping-grid">{importFields.filter((field) => field.required).map((field) => <label className="custom-control" key={field.key}>
          <span>{tr(field.label, englishFieldLabels[field.key])}<b aria-hidden="true"> *</b></span>
          <select value={mapping[field.key] ?? ""} onChange={(event) => setMappedField(field.key, event.target.value)}>
            <option value="">{tr("Valitse sarake", "Choose a column")}</option>
            {activeSheet.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}
          </select>
        </label>)}</div>
        <details className="custom-optional-fields">
          <summary>{tr("Lisää tilastokenttiä", "Additional statistics fields")}</summary>
          <div className="custom-mapping-grid">{importFields.filter((field) => !field.required).map((field) => <label className="custom-control" key={field.key}>
            <span>{tr(field.label, englishFieldLabels[field.key])}</span>
            <select value={mapping[field.key] ?? ""} onChange={(event) => setMappedField(field.key, event.target.value)}>
              <option value="">{tr("Ei tuotu", "Not included")}</option>
              {activeSheet.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}
            </select>
          </label>)}</div>
        </details>
        <div className="custom-validation-summary" aria-live="polite">
          <strong>{validation?.issues.length ? tr(validation.issues.length + " tarkistettavaa riviä", validation.issues.length + " rows need attention") : tr(rowCountForImport + " käyttökelpoista pelaajariviä", rowCountForImport + " player rows ready")}</strong>
          {validation?.skippedDnp ? <span>{tr(validation.skippedDnp + " DNP-riviä ohitetaan", validation.skippedDnp + " DNP rows will be skipped")}</span> : null}
        </div>
        {validation?.issues.length ? <ul className="custom-issues">{validation.issues.slice(0, 6).map((issue, index) => <li key={index}>{issue.line ? tr("Rivi " + issue.line + ": ", "Row " + issue.line + ": ") : ""}{issue.message}</li>)}</ul> : null}
        {validation?.warnings.map((warning) => <p className="custom-warning" key={warning}>{warning}</p>)}
        <div className="custom-preview-wrap"><table className="custom-preview-table"><thead><tr>{previewHeaders.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{activeSheet.rows.slice(0, 4).map((row, rowIndex) => <tr key={rowIndex}>{previewHeaders.map((_, index) => <td key={index}>{String(row[index] ?? "") || "—"}</td>)}</tr>)}</tbody></table></div>
        <div className="custom-setup-footer"><span>{tr("* Pakollinen kenttä. Lukitut arvot ja laskentatulos jäävät selaimeen.", "* Required field. Imported values and analysis stay in this browser.")}</span><button className="outline-button custom-primary-button" type="button" onClick={() => void importDataset()} disabled={!requiredMappingsComplete || !validation || validation.issues.length > 0 || validation.rows.length === 0 || saving}>{saving ? tr("Tallennetaan…", "Saving…") : tr("Analysoi aineisto", "Analyze dataset")} <Icon name="arrowOutward" size={16} /></button></div>
      </>}
    </section> : dataset ? <>
      <section className="panel custom-dataset-bar">
        <div className="custom-file-meta"><span className="custom-file-mark"><Icon name="overview" size={20} /></span><div><strong>{dataset.fileName}</strong><span>{games.length} {tr("ottelua", "games")} · {teamRows.length} {tr("pelaajariviä", "player rows")} · {tr("Tuotu", "Imported")} {dateLabel(dataset.importedAt.slice(0, 10), language)}</span></div></div>
        <div className="custom-dataset-actions">
          {teams.length > 1 && <label className="custom-control"><span>{tr("Joukkue", "Team")}</span><select value={activeTeam} onChange={(event) => setActiveTeam(event.target.value)}>{teams.map((team) => <option key={team}>{team}</option>)}</select></label>}
          <button className="outline-button small" type="button" onClick={() => fileInput.current?.click()}>{tr("Vaihda tiedosto", "Replace file")}</button>
          <button className="outline-button small custom-delete-button" type="button" onClick={() => void clearDataset()}>{tr("Poista aineisto", "Remove dataset")}</button>
        </div>
      </section>
      <div className="custom-coverage-line"><span className="custom-coverage-dot" />{tr("Analyysi käyttää vain ladattua aineistoa. Tiedostoa ei lähetetty palvelimelle.", "Analysis uses only this imported dataset. The file was not sent to a server.")}<span>{available.length} {tr("kenttää mukana", "fields included")}</span></div>

      <section className="custom-metric-strip" aria-label={tr("Joukkueen kausiluvut", "Team season metrics")}>
        <MetricCard label={tr("Otteluita", "Games")} value={String(games.length)} detail={tr("tuodussa aineistossa", "in imported dataset")} />
        <MetricCard label={tr("Voitot – tappiot", "Wins – losses")} value={wins === null ? "—" : wins + "–" + losses} detail={wins === null ? tr("Tuo vastustajan pisteet", "Include opponent points") : tr("ottelutulosten perusteella", "from game results")} />
        <MetricCard label={tr("Omat pisteet / ottelu", "Points for / game")} value={fmt(avgPoints, language)} detail={tr("pelaajariveistä laskettu", "summed from player rows")} />
        <MetricCard label={tr("Piste-ero / ottelu", "Point difference / game")} value={fmt(pointDiff, language)} detail={pointDiff === null ? tr("Vaatii vastustajan pisteet", "Requires opponent points") : tr("oma pistemäärä − vastustaja", "points for − against")} tone={pointDiff === null ? undefined : pointDiff >= 0 ? "positive" : "negative"} />
      </section>

      <TrendChart games={games} metric={trendMetric} onMetricChange={setTrendMetric} availableFields={available} language={language} tr={tr} />

      <div className="custom-analysis-grid">
        <section className="panel custom-split-panel">
          <div className="panel-heading panel-heading--plain custom-section-heading"><div><h2>{tr("Koti ja vieras", "Home and away")}</h2><p className="panel-subcopy">{tr("Miten tulos ja piste-ero jakautuvat pelipaikan mukaan?", "How do scoring and margins differ by venue?")}</p></div></div>
          {!available.includes("homeAway") ? <p className="custom-empty-state">{tr("Tuo sarake Koti / vieras, niin tämä vertailu avautuu.", "Include a Home / away column to enable this comparison.")}</p> : <div className="custom-split-table-wrap"><table className="custom-split-table"><thead><tr><th>{tr("Pelipaikka", "Venue")}</th><th>{tr("Otteluita", "Games")}</th><th>{tr("Omat pisteet", "Points for")}</th><th>{tr("Vastustaja", "Against")}</th><th>{tr("Piste-ero", "Margin")}</th></tr></thead><tbody>{(["home", "away"] as const).map((venue) => {
            const subset = games.filter((game) => game.homeAway === venue);
            const pointsFor = subset.length ? subset.reduce((sum, game) => sum + game.points, 0) / subset.length : null;
            const pointsAgainst = subset.length && subset.every((game) => game.opponentPoints !== null) ? subset.reduce((sum, game) => sum + game.opponentPoints!, 0) / subset.length : null;
            return <tr key={venue}><th>{venue === "home" ? tr("Kotona", "Home") : tr("Vieraissa", "Away")}</th><td>{subset.length || "—"}</td><td>{fmt(pointsFor, language)}</td><td>{fmt(pointsAgainst, language)}</td><td>{fmt(pointsFor !== null && pointsAgainst !== null ? pointsFor - pointsAgainst : null, language)}</td></tr>;
          })}</tbody></table></div>}
        </section>

        <section className="panel custom-games-panel">
          <div className="panel-heading panel-heading--plain custom-section-heading"><div><h2>{tr("Ottelut", "Games")}</h2><p className="panel-subcopy">{tr("Tuodun kauden otteluloki.", "Game log from the imported season.")}</p></div><span className="panel-context">{games.length} {tr("ottelua", "games")}</span></div>
          <div className="custom-games-table-wrap"><table className="custom-data-table"><thead><tr><th>{tr("Päivä", "Date")}</th><th>{tr("Vastustaja", "Opponent")}</th><th>{tr("Tulos", "Result")}</th><th>{tr("Omat pisteet", "Points for")}</th><th>{tr("Vastustaja", "Against")}</th></tr></thead><tbody>{(showAllGames ? [...games].reverse() : [...games].reverse().slice(0, 8)).map((game) => <tr key={game.id}><td>{dateLabel(game.date, language)}</td><td>{game.homeAway === "home" ? "vs " : game.homeAway === "away" ? "@ " : ""}{game.opponent}</td><td>{game.opponentPoints === null ? "—" : game.points > game.opponentPoints ? tr("Voitto", "Win") : game.points < game.opponentPoints ? tr("Tappio", "Loss") : tr("Tasapeli", "Draw")}</td><td>{fmt(game.points, language, 0)}</td><td>{fmt(game.opponentPoints, language, 0)}</td></tr>)}</tbody></table></div>
          {games.length > 8 && <button className="custom-text-button" type="button" onClick={() => setShowAllGames((value) => !value)}>{showAllGames ? tr("Näytä vähemmän", "Show fewer") : tr("Näytä kaikki ottelut", "Show all games")}</button>}
        </section>
      </div>

      <section className="panel custom-players-panel">
        <div className="panel-heading panel-heading--plain custom-section-heading"><div><h2>{tr("Pelaajien tilastot", "Player statistics")}</h2><p className="panel-subcopy">{tr("Keskiarvot ottelua kohti. Puuttuvat kentät näytetään viivana.", "Per-game averages. Missing fields are shown as a dash.")}</p></div><span className="panel-context">{players.length} {tr("pelaajaa", "players")}</span></div>
        <div className="custom-player-table-wrap"><table className="custom-data-table custom-player-table"><thead><tr><th>{tr("Pelaaja", "Player")}</th><th>{tr("OTT", "GP")}</th>{available.includes("minutes") && <th>{tr("MIN", "MIN")}</th>}<th>{tr("PTS", "PTS")}</th>{available.includes("rebounds") && <th>{tr("REB", "REB")}</th>}{available.includes("assists") && <th>{tr("AST", "AST")}</th>}{available.includes("turnovers") && <th>{tr("MEN", "TO")}</th>}{completeFieldGoals && <th>{tr("FG%", "FG%")}</th>}{available.includes("threePM") && available.includes("threePA") && <th>{tr("3P%", "3P%")}</th>}</tr></thead><tbody>{players.map((player) => <tr key={player.id}><th scope="row">{player.name}</th><td>{player.games}</td>{available.includes("minutes") && <td>{fmt(player.minutesPerGame, language)}</td>}<td>{fmt(player.pointsPerGame, language)}</td>{available.includes("rebounds") && <td>{fmt(player.reboundsPerGame, language)}</td>}{available.includes("assists") && <td>{fmt(player.assistsPerGame, language)}</td>}{available.includes("turnovers") && <td>{fmt(player.turnoversPerGame, language)}</td>}{completeFieldGoals && <td>{fmt(player.fgPct, language) === "—" ? "—" : fmt(player.fgPct, language) + "%"}</td>}{available.includes("threePM") && available.includes("threePA") && <td>{fmt(player.threePct, language) === "—" ? "—" : fmt(player.threePct, language) + "%"}</td>}</tr>)}</tbody></table></div>
      </section>

      {players.length > 1 && firstPlayer && secondPlayer && <section className="panel custom-compare-panel">
        <div className="panel-heading panel-heading--plain custom-section-heading"><div><h2>{tr("Pelaajavertailu", "Player comparison")}</h2><p className="panel-subcopy">{tr("Vertaa saman joukkueen pelaajien ottelukohtaisia lukuja.", "Compare per-game statistics for players on this team.")}</p></div></div>
        <div className="custom-compare-selects">
          <label className="custom-control"><span>A</span><select value={firstPlayer.id} onChange={(event) => setFirstPlayerId(event.target.value)}>{players.map((player) => <option key={player.id} value={player.id} disabled={player.id === secondPlayer.id}>{player.name}</option>)}</select></label>
          <label className="custom-control"><span>B</span><select value={secondPlayer.id} onChange={(event) => setSecondPlayerId(event.target.value)}>{players.map((player) => <option key={player.id} value={player.id} disabled={player.id === firstPlayer.id}>{player.name}</option>)}</select></label>
        </div>
        <div className="custom-compare-table-wrap"><table className="custom-compare-table"><thead><tr><th>{tr("Mittari", "Metric")}</th><th>{firstPlayer.name}</th><th>{tr("Ero", "Difference")}</th><th>{secondPlayer.name}</th></tr></thead><tbody>{[
          [tr("Pisteet / ottelu", "Points / game"), firstPlayer.pointsPerGame, secondPlayer.pointsPerGame],
          ...(available.includes("rebounds") ? [[tr("Levypallot / ottelu", "Rebounds / game"), firstPlayer.reboundsPerGame, secondPlayer.reboundsPerGame] as [string, number | null, number | null]] : []),
          ...(available.includes("assists") ? [[tr("Syötöt / ottelu", "Assists / game"), firstPlayer.assistsPerGame, secondPlayer.assistsPerGame] as [string, number | null, number | null]] : []),
          ...(firstPlayer.fgPct !== null && secondPlayer.fgPct !== null ? [["FG%", firstPlayer.fgPct, secondPlayer.fgPct] as [string, number | null, number | null]] : []),
          ...(firstPlayer.threePct !== null && secondPlayer.threePct !== null ? [["3P%", firstPlayer.threePct, secondPlayer.threePct] as [string, number | null, number | null]] : []),
          ...(available.includes("turnovers") ? [[tr("Menetykset / ottelu", "Turnovers / game"), firstPlayer.turnoversPerGame, secondPlayer.turnoversPerGame] as [string, number | null, number | null]] : []),
        ].map(([label, a, b]) => <tr key={String(label)}><th>{label}</th><td>{fmt(a as number | null, language)}{String(label).includes("%") && a !== null ? "%" : ""}</td><td>{a == null || b == null ? "—" : fmt((a as number) - (b as number), language)}{String(label).includes("%") && a != null && b != null ? " pp" : ""}</td><td>{fmt(b as number | null, language)}{String(label).includes("%") && b !== null ? "%" : ""}</td></tr>)}</tbody></table></div>
        {available.includes("assists") && available.includes("turnovers") && <p className="custom-method-note">{tr("AST/TO ", "AST/TO ")}{fmt(firstPlayer.assistTurnover, language)} · {fmt(secondPlayer.assistTurnover, language)}{tr(" perustuu tuotujen otteluiden yhteenlaskettuihin syöttöihin ja menetyksiin.", " uses total assists and turnovers from imported games.")}</p>}
      </section>}
    </> : <section className="panel custom-upload-panel">
      <div className="custom-upload-copy"><h2>{tr("Aloita joukkueesi datasta", "Start with your team's data")}</h2><p>{tr("Tuo pelaajakohtaiset ottelurivit CSV- tai Excel-tiedostona. KorisLab rakentaa niistä joukkueen trendit ja pelaajavertailut.", "Import player-by-game rows from a CSV or Excel file. KorisLab will build team trends and player comparisons from them.")}</p></div>
      <button type="button" className={"custom-dropzone" + (dragActive ? " custom-dropzone--active" : "")} onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); void handleFile(event.dataTransfer.files?.[0]); }} disabled={readingFile || loadingSaved}>
        <span className="custom-dropzone-icon"><Icon name="overview" size={22} /></span>
        <strong>{readingFile ? tr("Luetaan tiedostoa…", "Reading file…") : tr("Valitse tiedosto tai pudota se tähän", "Choose a file or drop it here")}</strong>
        <span>{tr("CSV · XLSX · XLS · enintään 15 Mt", "CSV · XLSX · XLS · up to 15 MB")}</span>
      </button>
      <div className="custom-upload-footer"><p>{tr("Tuonti käsitellään selaimessa. Tiedostoa ei ladata KorisLabin palvelimelle.", "The file is processed in your browser and is not uploaded to KorisLab.")}</p><button type="button" className="custom-text-button" onClick={downloadTemplate}>{tr("Lataa CSV-pohja", "Download CSV template")} <Icon name="arrowOutward" size={14} /></button></div>
    </section>}

    {!dataset && !draft && loadingSaved && <p className="custom-loading-state" role="status">{tr("Tarkistetaan paikallista aineistoa…", "Checking for a local dataset…")}</p>}
  </div>;
}
