import * as XLSX from "xlsx";

export const importFields = [
  { key: "gameId", label: "Ottelun tunniste", required: false, aliases: ["game id", "match id", "ottelu id", "ottelun id", "id"] },
  { key: "date", label: "Ottelupäivä", required: true, aliases: ["date", "päivä", "pvm", "ottelupäivä", "pelipäivä", "game date"] },
  { key: "team", label: "Oma joukkue", required: true, aliases: ["team", "joukkue", "oma joukkue", "joukkueen nimi"] },
  { key: "opponent", label: "Vastustaja", required: true, aliases: ["opponent", "vastustaja", "vastustajan nimi"] },
  { key: "homeAway", label: "Koti / vieras", required: false, aliases: ["home away", "home/away", "koti vieras", "koti/vieras", "venue"] },
  { key: "opponentPoints", label: "Vastustajan pisteet", required: false, aliases: ["opponent points", "opp points", "points against", "vastustajan pisteet", "pisteet vastaan"] },
  { key: "playerId", label: "Pelaajan tunniste", required: false, aliases: ["player id", "pelaaja id", "pelaajan id", "source player id"] },
  { key: "player", label: "Pelaaja", required: true, aliases: ["player", "pelaaja", "player name", "pelaajan nimi", "name"] },
  { key: "minutes", label: "Minuutit", required: false, aliases: ["minutes", "minute", "min", "peliaika", "peliminuutit"] },
  { key: "points", label: "Pisteet", required: true, aliases: ["points", "pts", "pisteet", "pisteitä"] },
  { key: "twoPM", label: "2P osumat", required: false, aliases: ["2pm", "2p made", "2p osumat", "two pm", "two pointers made"] },
  { key: "twoPA", label: "2P yritykset", required: false, aliases: ["2pa", "2p attempts", "2p yritykset", "two pa", "two pointers attempted"] },
  { key: "threePM", label: "3P osumat", required: false, aliases: ["3pm", "3p made", "3p osumat", "three pm", "three pointers made"] },
  { key: "threePA", label: "3P yritykset", required: false, aliases: ["3pa", "3p attempts", "3p yritykset", "three pa", "three pointers attempted"] },
  { key: "ftm", label: "Vapaaheitot osumat", required: false, aliases: ["ftm", "free throws made", "vapaat osumat", "vapaaheitot osumat"] },
  { key: "fta", label: "Vapaaheitot yritykset", required: false, aliases: ["fta", "free throws attempted", "vapaat yritykset", "vapaaheitot yritykset"] },
  { key: "rebounds", label: "Levypallot", required: false, aliases: ["rebounds", "reb", "levypallot", "levypallot yhteensä"] },
  { key: "offensiveRebounds", label: "Hyökkäyslevypallot", required: false, aliases: ["offensive rebounds", "orb", "hyökkäyslevypallot"] },
  { key: "defensiveRebounds", label: "Puolustuslevypallot", required: false, aliases: ["defensive rebounds", "drb", "puolustuslevypallot"] },
  { key: "assists", label: "Syötöt", required: false, aliases: ["assists", "ast", "syötöt", "syötöt yhteensä"] },
  { key: "turnovers", label: "Menetykset", required: false, aliases: ["turnovers", "to", "menetykset", "menetykset yhteensä"] },
  { key: "steals", label: "Riistot", required: false, aliases: ["steals", "stl", "riistot"] },
  { key: "blocks", label: "Torjunnat", required: false, aliases: ["blocks", "blk", "torjunnat"] },
  { key: "plusMinus", label: "Plus / miinus", required: false, aliases: ["plus minus", "plus/minus", "+/-", "plusminus"] },
] as const;

export type ImportField = typeof importFields[number]["key"];
export type ImportMapping = Record<ImportField, number | null>;
export type StatField = "minutes" | "points" | "twoPM" | "twoPA" | "threePM" | "threePA" | "ftm" | "fta" | "rebounds" | "offensiveRebounds" | "defensiveRebounds" | "assists" | "turnovers" | "steals" | "blocks" | "plusMinus";
export const statFields: StatField[] = ["minutes", "points", "twoPM", "twoPA", "threePM", "threePA", "ftm", "fta", "rebounds", "offensiveRebounds", "defensiveRebounds", "assists", "turnovers", "steals", "blocks", "plusMinus"];

export type WorkbookSheet = { name: string; headers: string[]; rows: unknown[][] };
export type ImportedPlayerGame = {
  matchId: string;
  date: string;
  team: string;
  opponent: string;
  homeAway: "home" | "away" | null;
  opponentPoints: number | null;
  playerId: string;
  player: string;
  stats: Record<StatField, number | null>;
};
export type LocalCustomDataset = {
  fileName: string;
  sheetName: string;
  importedAt: string;
  availableFields: ImportField[];
  rows: ImportedPlayerGame[];
};
export type RowIssue = { line: number; message: string };
export type ValidationResult = {
  rows: ImportedPlayerGame[];
  issues: RowIssue[];
  warnings: string[];
  skippedDnp: number;
};

const maxFileBytes = 15 * 1024 * 1024;
const maxRows = 50000;

export async function parseWorkbookFile(file: File): Promise<WorkbookSheet[]> {
  if (file.size > maxFileBytes) throw new Error("Tiedosto on liian suuri. Enimmäiskoko on 15 Mt.");
  const extension = file.name.split(".").at(-1)?.toLocaleLowerCase();
  if (!extension || !["csv", "xlsx", "xls"].includes(extension)) throw new Error("Valitse CSV- tai Excel-tiedosto (.xlsx, .xls).");
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true, cellFormula: false });
  const sheets = workbook.SheetNames.map((name) => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false });
    const headerRowIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
    if (headerRowIndex < 0) return { name, headers: [], rows: [] };
    const headers = matrix[headerRowIndex].map((cell, index) => String(cell ?? "").trim() || "Sarake " + (index + 1));
    return { name, headers, rows: matrix.slice(headerRowIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim() !== "")) };
  }).filter((sheet) => sheet.headers.length > 0);
  if (sheets.length === 0) throw new Error("Tiedostosta ei löytynyt otsikkoriviä ja rivejä.");
  if (sheets.some((sheet) => sheet.rows.length > maxRows)) throw new Error("Tiedostossa on yli 50 000 riviä. Rajaa aineisto ja yritä uudelleen.");
  return sheets;
}

export function emptyMapping(): ImportMapping {
  return Object.fromEntries(importFields.map((field) => [field.key, null])) as ImportMapping;
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function suggestMapping(headers: string[]): ImportMapping {
  const normalizedHeaders = headers.map(normalizeHeader);
  const mapping = emptyMapping();
  for (const field of importFields) {
    const aliases = [field.label, ...field.aliases].map(normalizeHeader);
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (index !== -1) mapping[field.key] = index;
  }
  return mapping;
}

function readCell(row: unknown[], mapping: ImportMapping, field: ImportField) {
  const index = mapping[field];
  return index === null || index === undefined ? "" : row[index] ?? "";
}

function parseDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value >= 20000 && value <= 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000).toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  const european = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (european) return european[3] + "-" + european[2].padStart(2, "0") + "-" + european[1].padStart(2, "0");
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return iso[1] + "-" + iso[2].padStart(2, "0") + "-" + iso[3].padStart(2, "0");
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let raw = value.trim().replace(/[\s\u00a0\u202f]/g, "");
  if (!raw || ["—", "-", "–", "dnp", "n/a"].includes(raw.toLocaleLowerCase())) return null;
  raw = raw.replace(/%$/, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma !== -1 && dot !== -1) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (comma !== -1) {
    raw = raw.replace(",", ".");
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMinutes(value: unknown): number | null {
  if (typeof value === "string") {
    const clock = value.trim().match(/^(\d{1,3}):(\d{1,2})$/);
    if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
  }
  return parseNumber(value);
}

function parseHomeAway(value: unknown): "home" | "away" | null {
  const normalized = normalizeHeader(String(value ?? ""));
  if (["home", "h", "koti", "kotipeli"].includes(normalized)) return "home";
  if (["away", "a", "vieras", "vieraspeli"].includes(normalized)) return "away";
  return null;
}

function isDnp(value: unknown) {
  return typeof value === "string" && /^(dnp|did not play|ei pelannut|ei peliaikaa)$/i.test(value.trim());
}

function normalizedIdentity(value: string) {
  return normalizeHeader(value);
}

export function validateSheetRows(sheet: WorkbookSheet, mapping: ImportMapping): ValidationResult {
  const rows: ImportedPlayerGame[] = [];
  const issues: RowIssue[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let skippedDnp = 0;

  for (const [index, rawRow] of sheet.rows.entries()) {
    const line = index + 2;
    if (!rawRow.some((cell) => String(cell ?? "").trim() !== "")) continue;
    const minutesValue = readCell(rawRow, mapping, "minutes");
    if (isDnp(minutesValue)) {
      skippedDnp += 1;
      continue;
    }
    const date = parseDate(readCell(rawRow, mapping, "date"));
    const team = String(readCell(rawRow, mapping, "team")).trim();
    const opponent = String(readCell(rawRow, mapping, "opponent")).trim();
    const player = String(readCell(rawRow, mapping, "player")).trim();
    const points = parseNumber(readCell(rawRow, mapping, "points"));
    const missing = [
      ...(!date ? ["ottelupäivä"] : []),
      ...(!team ? ["oma joukkue"] : []),
      ...(!opponent ? ["vastustaja"] : []),
      ...(!player ? ["pelaaja"] : []),
      ...(points === null ? ["pisteet"] : []),
    ];
    if (missing.length) {
      issues.push({ line, message: "Puuttuva tai virheellinen: " + missing.join(", ") });
      continue;
    }

    const explicitId = String(readCell(rawRow, mapping, "gameId")).trim();
    const matchId = explicitId || [date, normalizedIdentity(opponent)].join("|");
    const rawOpponentPoints = readCell(rawRow, mapping, "opponentPoints");
    const opponentPoints = rawOpponentPoints === "" ? null : parseNumber(rawOpponentPoints);
    if (rawOpponentPoints !== "" && opponentPoints === null) {
      issues.push({ line, message: "Vastustajan pisteitä ei voitu lukea lukuna." });
      continue;
    }
    const rawPlayerId = String(readCell(rawRow, mapping, "playerId")).trim();
    const playerId = rawPlayerId || normalizedIdentity(player);
    const duplicateKey = [matchId, normalizedIdentity(team), playerId].join("|");
    if (seen.has(duplicateKey)) {
      issues.push({ line, message: "Sama pelaaja esiintyy ottelussa useammin kuin kerran." });
      continue;
    }
    seen.add(duplicateKey);

    const stats = Object.fromEntries(statFields.map((field) => {
      if (field === "points") return [field, points];
      const value = readCell(rawRow, mapping, field);
      if (value === "") return [field, null];
      return [field, field === "minutes" ? parseMinutes(value) : parseNumber(value)];
    })) as Record<StatField, number | null>;

    const invalidStats = statFields.filter((field) => {
      if (field === "points" || mapping[field] === null) return false;
      const raw = readCell(rawRow, mapping, field);
      return raw !== "" && stats[field] === null && !isDnp(raw);
    });
    if (invalidStats.length) {
      issues.push({ line, message: "Virheellinen lukuarvo: " + invalidStats.map((field) => importFields.find((item) => item.key === field)?.label ?? field).join(", ") });
      continue;
    }
    const checks: [StatField, StatField, string][] = [
      ["twoPM", "twoPA", "2P osumia on enemmän kuin yrityksiä"],
      ["threePM", "threePA", "3P osumia on enemmän kuin yrityksiä"],
      ["ftm", "fta", "Vapaaheittojen osumia on enemmän kuin yrityksiä"],
    ];
    const invalidShot = checks.find(([made, attempted]) => stats[made] !== null && stats[attempted] !== null && stats[made]! > stats[attempted]!);
    if (invalidShot) {
      issues.push({ line, message: invalidShot[2] });
      continue;
    }
    const rawHomeAway = readCell(rawRow, mapping, "homeAway");
    const homeAway = rawHomeAway === "" ? null : parseHomeAway(rawHomeAway);
    if (rawHomeAway !== "" && homeAway === null && !warnings.includes("Koti/vieras-arvoja ei tunnistettu kaikilta riveiltä.")) {
      warnings.push("Koti/vieras-arvoja ei tunnistettu kaikilta riveiltä.");
    }
    rows.push({
      matchId,
      date: date!,
      team,
      opponent,
      homeAway,
      opponentPoints,
      playerId,
      player,
      stats,
    });
  }

  const opponentScores = new Map<string, Set<number>>();
  for (const row of rows) {
    if (row.opponentPoints === null) continue;
    const key = row.matchId + "|" + normalizedIdentity(row.team);
    const scores = opponentScores.get(key) ?? new Set<number>();
    scores.add(row.opponentPoints);
    opponentScores.set(key, scores);
  }
  for (const [key, scores] of opponentScores) {
    if (scores.size > 1) {
      const row = rows.find((item) => item.matchId + "|" + normalizedIdentity(item.team) === key);
      issues.push({ line: 0, message: (row?.opponent ?? "Ottelun") + ": vastustajan pisteet ovat eri pelaajariveillä erilaiset." });
    }
  }
  const availableFields = importFields.filter((field) => mapping[field.key] !== null).map((field) => field.key);
  if (rows.length && !availableFields.includes("opponentPoints")) warnings.push("Vastustajan pisteitä ei ole tuotu. Ottelusaldo ja piste-ero eivät ole käytettävissä.");
  if (rows.length && !availableFields.includes("homeAway")) warnings.push("Koti- ja vierasotteluiden vertailu ei ole käytettävissä.");
  if (rows.length && availableFields.some((field) => ["twoPM", "twoPA", "threePM", "threePA"].includes(field))) {
    const allShotFields = ["twoPM", "twoPA", "threePM", "threePA"].every((field) => availableFields.includes(field as ImportField));
    if (!allShotFields) warnings.push("Heittoprosenttien vertailu vaatii sekä osumat että yritykset kaikista pelitilanneheitoista.");
  }
  if (rows.length === 0 && issues.length === 0) warnings.push("Taulukosta ei löytynyt tuotavia rivejä.");
  return { rows, issues, warnings, skippedDnp };
}

export function makeDataset(fileName: string, sheetName: string, mapping: ImportMapping, rows: ImportedPlayerGame[]): LocalCustomDataset {
  return {
    fileName,
    sheetName,
    importedAt: new Date().toISOString(),
    availableFields: importFields.filter((field) => mapping[field.key] !== null).map((field) => field.key),
    rows,
  };
}
