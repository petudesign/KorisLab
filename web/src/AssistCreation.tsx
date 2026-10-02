import { useEffect, useState } from "react";
import { useSeason } from "./SeasonContext";
import { useI18n } from "./i18n";
import { assistValues, parseAssistStats, type AssistStats } from "./assistStats";
import { playerAssistTurnoverRatio, type SeasonPlayerRow } from "./playerStats";
import { playerDisplayName } from "./playerName";
import { followLink, routeHref } from "./routing";

type Sort = "points" | "assists" | "pointsPerAssist" | "threeShare";

export function AssistCreation({ players, onOpenPlayer, profile = false }: {
  players: SeasonPlayerRow[]; onOpenPlayer?: (id: string) => void; profile?: boolean;
}) {
  const { seasonId, current } = useSeason();
  const { tr, language } = useI18n();
  const [state, setState] = useState<{ season: string; data: AssistStats | null; status: "loading" | "ready" | "error" }>({ season: "", data: null, status: "loading" });
  const [sort, setSort] = useState<Sort>("points");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/assists-${seasonId}.json`, { signal: controller.signal, cache: "no-cache" })
      .then(async response => {
        if (!response.ok) throw new Error("Assist data unavailable");
        const data = parseAssistStats(await response.json(), seasonId);
        if (!controller.signal.aborted) setState({ season: seasonId, data, status: "ready" });
      }).catch(() => { if (!controller.signal.aborted) setState({ season: seasonId, data: null, status: "error" }); });
    return () => controller.abort();
  }, [seasonId, current?.updated_at]);
  const data = state.season === seasonId ? state.data : null;
  const status = state.season === seasonId ? state.status : "loading";
  const byId = new Map(data?.players.map(row => [row.id, row]));
  const rows = players.flatMap(player => {
    const row = byId.get(player.id);
    return row && (profile || row.assists > 0) ? [{ ...row, player, assistTurnover: row.games === player.games ? playerAssistTurnoverRatio(player) : null, ...assistValues(row) }] : [];
  });
  const rateSort = sort === "pointsPerAssist" || sort === "threeShare";
  const sorted = rows.filter(row => profile || !rateSort || row.baskets >= 10).sort((a, b) =>
    Number(a.unlinked > 0) - Number(b.unlinked > 0) || (b[sort] ?? -1) - (a[sort] ?? -1) || a.player.name.localeCompare(b.player.name, language));
  const decimal = (value: number | null, digits = 1) => value === null ? "—" : value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const labels: Record<Sort, string> = { points: tr("Pelitilannepisteet syötöistä", "Field-goal points from assists"), assists: tr("Syöttömäärä", "Total assists"), pointsPerAssist: tr("Pisteet / korisyöttö", "Points / field-goal assist"), threeShare: tr("Kolmoseen johtaneiden osuus", "Share leading to threes") };
  const ftAssists = rows.reduce((sum, row) => sum + row.free_throw, 0);
  return <section className="panel players-table-panel assist-creation" aria-labelledby={profile ? "profile-assist-heading" : "assist-heading"}>
    <div className="panel-heading panel-heading--plain">
      <div><h2 id={profile ? "profile-assist-heading" : "assist-heading"}>{tr("Mitä syötöistä syntyy?", "What do assists create?")}</h2>
        <p className="panel-subcopy">{tr("Sama syöttömäärä, eri pistearvo. Vertaa kakkosiin ja kolmosiin johtaneita syöttöjä.", "The same assist count can create different points. Compare passes leading to twos and threes.")}</p></div>
      {data && <span className="panel-context">{profile ? rows[0]?.games ?? 0 : data.verified_games} / {profile ? players[0]?.games ?? 0 : data.expected_games} {tr("ottelua tarkistettu", "games checked")}</span>}
    </div>
    {status === "loading" ? <p role="status">{tr("Ladataan syöttövertailua…", "Loading assist comparison…")}</p>
      : status === "error" ? <p role="alert">{tr("Syöttövertailun lataus epäonnistui. Yritä päivittää sivu.", "Could not load assist comparison. Try refreshing the page.")}</p>
      : rows.length === 0 ? <p>{tr("Valinnalle ei löydy vielä tarkistettua syöttödataa.", "No checked assist data for this selection yet.")}</p>
      : <>
        {profile ? <div className="assist-profile-values">
          <div><span>{tr("Pelitilannepisteet syötöistä", "Field-goal points from assists")}</span><strong>{rows[0].unlinked ? "≥ " : ""}{rows[0].points}</strong><small>{rows[0].two} × 2P + {rows[0].three} × 3P</small></div>
          <div><span>{tr("Pisteet / korisyöttö", "Points / field-goal assist")}</span><strong>{decimal(rows[0].pointsPerAssist, 2)}</strong><small>{rows[0].baskets} {tr("tunnistettua koria", "linked baskets")}</small></div>
          <div><span>{tr("Kolmoseen johtaneiden osuus", "Share leading to threes")}</span><strong>{rows[0].threeShare === null ? "—" : `${decimal(rows[0].threeShare)}%`}</strong><small>{rows[0].three} / {rows[0].baskets} {tr("korisyöttöä", "field-goal assists")}</small></div>
        </div> : <>
          <label className="assist-sort">{tr("Järjestä syöttövertailu", "Sort assist comparison")}<select value={sort} onChange={event => setSort(event.target.value as Sort)}>{(Object.keys(labels) as Sort[]).map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></label>
          {rateSort && <p className="players-method-note">{tr("Osuus- ja keskiarvovertailussa vähintään 10 tunnistettua korisyöttöä.", "Rate comparisons require at least 10 linked field-goal assists.")}</p>}
          <div className="players-table-wrap" tabIndex={0} role="region" aria-label={tr("Syöttövertailu, vieritettävä taulukko", "Assist comparison, scrollable table")}>
            <table className="players-table assist-table"><caption className="sr-only">{tr("Syötöistä syntyneet pelitilannepisteet", "Field-goal points created by assists")}</caption>
              <thead><tr>{[tr("Pelaaja", "Player"), tr("Syötöt", "Assists"), "AST/TO", tr("2P-korit", "2P baskets"), tr("3P-korit", "3P baskets"), tr("Pisteet syötöistä", "Points from assists"), tr("Pisteet / korisyöttö", "Points / FG assist"), tr("Kolmosten osuus", "Three share"), tr("Vaparitilanteet", "FT situations")].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
              <tbody>{sorted.slice(0, showAll ? sorted.length : 10).map(row => <tr key={row.id}><th scope="row"><a className="player-name-link" href={routeHref("player-profile", seasonId, row.id)} onClick={event => { if (onOpenPlayer) followLink(event, () => onOpenPlayer(row.id)); }}>{playerDisplayName(row.player.name)}</a><small>{row.player.team} · {row.games} / {row.player.games} {tr("ottelua", "games")}{row.unlinked > 0 ? tr(` · ${row.unlinked} syöttöä kohdistamatta`, ` · ${row.unlinked} unlinked assists`) : ""}</small></th>
                <td>{row.assists}</td><td>{decimal(row.assistTurnover, 2)}</td><td>{row.two}</td><td>{row.three}</td><td className="assist-points">{row.unlinked ? "≥ " : ""}{row.points}</td><td>{decimal(row.pointsPerAssist, 2)}</td><td>{row.threeShare === null ? "—" : `${decimal(row.threeShare)}%`}</td><td>{row.free_throw}</td></tr>)}</tbody>
            </table>
          </div>
          {sorted.length === 0 && <p>{tr("Valinnassa ei ole riittävää otosta tähän vertailuun.", "No players in this selection meet the sample requirement.")}</p>}
          {sorted.length > 10 && <button className="outline-button assist-show-all" onClick={() => setShowAll(value => !value)}>{showAll ? tr("Näytä 10 ensimmäistä", "Show top 10") : tr(`Näytä kaikki ${sorted.length} pelaajaa`, `Show all ${sorted.length} players`)}</button>}
        </>}
        <p className="players-method-note">{tr(
          "Pisteet = 2 × kakkoseen johtaneet syötöt + 3 × kolmoseen johtaneet syötöt. Pisteet / korisyöttö ja kolmosten osuus lasketaan vain näistä tunnistetuista koreista. Vapaaheittopisteet eivät sisälly näihin lukuihin.",
          "Points = 2 × assists to twos + 3 × assists to threes. Points per field-goal assist and three share use only these linked baskets. Free-throw points are excluded.")}</p>
        <p className="players-method-note">{tr(`Lähde kirjaa myös syöttöjä vapaaheittotilanteisiin (${ftAssists} tässä valinnassa). Ne näkyvät erikseen ja sisältyvät Syötöt-lukuun. Epäselvä yhteys jätetään kohdistamatta; ≥ tarkoittaa vähintään.`, `The source also records assists in free-throw situations (${ftAssists} in this selection). These are listed separately and included in total assists. Ambiguous links are left unassigned; ≥ means at least.`)}</p>
        {!profile && <p className="players-method-note">{tr("AST/TO on kauden box score -syöttöjen suhde menetyksiin; se näytetään vain, kun play-by-play- ja box score -ottelumäärät täsmäävät pelaajalla.", "AST/TO is season box-score assists divided by turnovers; it is shown only when the player's play-by-play and box-score game counts match.")}</p>}
        {profile && <p className="players-method-note">{rows[0].games} / {rows[0].player.games} {tr("pelaajan ottelua tarkistettu", "player games checked")} · {rows[0].assists} {tr("syöttöä", "assists")}{rows[0].unlinked ? tr(` · ${rows[0].unlinked} syöttöä kohdistamatta`, ` · ${rows[0].unlinked} unlinked assists`) : ""}</p>}
        <p className="players-method-note">{tr("Pelaajakohtaiset syöttömäärät on tarkistettu box scoresta. Luku kuvaa kirjattujen syöttöjen tulosta; se ei yksin mittaa syöttäjän laatua tai luotujen heittopaikkojen vaikeutta.", "Player assist counts are checked against box scores. This describes recorded assist outcomes; it does not alone measure passing quality or shot difficulty.")}</p>
      </>}
  </section>;
}
