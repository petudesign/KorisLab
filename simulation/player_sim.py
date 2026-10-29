"""Player-level possession simulator built from reconciled Basket.fi possessions.

Every rate is a weighted count shrunk towards the league: a player with little
history behaves like an average player, never like an extreme. The simulation
is a model of play, not a replay; its positions come from where each player has
actually taken shots.
"""
from bisect import bisect
from collections import defaultdict
from math import exp
import random

from simulation.court import ZONES, THREE_ZONES, shot_zone, to_left_half

STARTS = ("period_start", "made_fg", "made_ft", "defensive_rebound", "steal", "turnover")
ACTIONS = ("shot", "turnover", "free_throws")
REBOUNDS = ("offensive_rebound", "defensive_rebound")
# Prior strengths: how many observations count as "league average" for a player or team.
PRIORS = {"usage_minutes": 60, "action": 40, "zone_share": 20, "two_pct": 25, "three_pct": 60,
          "ft_pct": 20, "per_minute": 80, "team": 150, "pace": 600}
# Game-to-game form: log-normal spread of a player's shooting and usage and a team's defence in one game.
# Zero means every simulation uses the same averages (the locked v1 behaviour).
FORM = {"shot": 0.0, "usage": 0.0, "defense": 0.0}


def next_start(possession, following):
    end = possession["end"]
    if end == "turnover":
        stolen = following and following["period"] == possession["period"] and following["start"] == "steal"
        return "steal" if stolen else "turnover"
    return end if end in ("made_fg", "made_ft", "defensive_rebound") else "turnover"


def offensive_chances(possession):
    """The offense's decisions: shots, turnovers and free-throw trips (and-ones excluded)."""
    offense, chances, made_clocks = possession["offense"], [], set()
    for index, event in enumerate(possession["events"]):
        if event["team"] != offense:
            continue
        kind = event["type"]
        if kind in ("2pt", "3pt"):
            chances.append(("shot", index))
            if event.get("made"):
                made_clocks.add(event["clock"])
        elif kind == "turnover":
            chances.append(("turnover", index))
        elif kind == "free_throw" and str(event.get("subtype") or "").startswith("1Of"):
            if not (event["subtype"] == "1Of1" and event["clock"] in made_clocks):
                chances.append(("free_throws", index))
    return chances


def following_rebound(events, index):
    for event in events[index + 1:]:
        if event["type"] in REBOUNDS:
            return event
        if event["type"] in ("2pt", "3pt", "turnover", "free_throw"):
            return None
    return None


def shrink(count, total, prior_rate, prior):
    return (count + prior_rate * prior) / (total + prior)


def weighted_choice(rng, items, weights):
    total, cumulative = 0.0, []
    for weight in weights:
        total += weight
        cumulative.append(total)
    return items[bisect(cumulative, rng.random() * total)]


class Counts(defaultdict):
    def __init__(self):
        super().__init__(float)


class PlayerModel:
    """Fit from games: dicts with weight, home, possessions and the box-score record."""

    def __init__(self, games):
        if not games:
            raise ValueError("No history")
        self.league, self.players, self.teams = Counts(), defaultdict(Counts), defaultdict(Counts)
        self.coords = defaultdict(list)
        self.pairs = defaultdict(Counts)
        self.names, self.team_names = {}, {}
        self.durations = defaultdict(list)
        self.records = []
        for game in games:
            self._count_records(game)
        for game in games:
            self._count_events(game)
        for game in games:
            self._count_expected(game)
        self.durations_all = [s for values in self.durations.values() for s in values]

    # --- fitting -------------------------------------------------------------------------
    def _count_records(self, game):
        w, record = game["weight"], game["record"]
        self.records.append((game["date"], w, record))
        for team in record["teams"]:
            self.team_names[team["source_id"]] = team["name"]
            for player in team["players"]:
                pid = player["source_player_id"]
                self.names[pid] = player.get("display_name") or pid
                self.players[pid]["minutes"] += w * (player.get("minutes") or 0)
                self.league["minutes"] += w * (player.get("minutes") or 0)

    def _count_events(self, game):
        w, L = game["weight"], self.league
        possessions = game["possessions"]
        for possession, following in zip(possessions, possessions[1:] + [None]):
            events, offense, start = possession["events"], possession["offense"], possession["start"]
            start = start if start in STARTS else "turnover"
            if possession["end"] != "period_end":
                self.durations[(start, next_start(possession, following))].append(possession["seconds"])
                self.teams[offense]["seconds"] += w * possession["seconds"]
                self.teams[possession["defense"]]["seconds_defended"] += w * possession["seconds"]
            for kind, index in offensive_chances(possession):
                event, player = events[index], events[index]["player"]
                L[kind] += w
                L[f"start:{start}:chances"] += w
                if player:
                    self.players[player][kind] += w
                else:
                    L[f"team_{kind}"] += w  # Shot-clock and other team turnovers have no player.
                if kind == "turnover":
                    L[f"start:{start}:turnover"] += w
                    stolen = any(e["type"] == "steal" and e["clock"] == event["clock"] and e["team"] != offense for e in events)
                    L["turnover_stolen"] += w * stolen
                elif kind == "shot":
                    zone = shot_zone(event["type"], event.get("x"), event.get("y"))
                    made = bool(event.get("made"))
                    L[f"att:{zone}"] += w
                    L[f"made:{zone}"] += w * made
                    L[f"start:{start}:att"] += w
                    L[f"start:{start}:made"] += w * made
                    L[f"side:{offense == game['home']}:att"] += w
                    L[f"side:{offense == game['home']}:made"] += w * made
                    if player:
                        self.players[player][f"att:{zone}"] += w
                        self.players[player][f"made:{zone}"] += w * made
                        if event.get("x") is not None:
                            self.coords[(player, zone)].append(to_left_half(event["x"], event["y"]))
                    if event.get("x") is not None:
                        self.coords[(None, zone)].append(to_left_half(event["x"], event["y"]))
                    if made:
                        L[f"made_fg:{zone}"] += w
                        assist = next((e for e in events if e["type"] == "assist" and e["clock"] == event["clock"]
                                       and e["team"] == offense and e["player"] != player), None)
                        L[f"assisted:{zone}"] += w * bool(assist)
                        if assist and assist["player"] and player:
                            self.pairs[assist["player"]][player] += w
                        and_one = any(e["type"] == "free_throw" and e["clock"] == event["clock"] and e.get("subtype") == "1Of1"
                                      for e in events[index + 1:])
                        L[f"and_one:{zone}"] += w * and_one
                    else:
                        L[f"missed:{zone}"] += w
                        blocked = any(e["type"] == "block" and e["clock"] == event["clock"] for e in events)
                        L[f"blocked:{zone}"] += w * blocked
                        rebound = following_rebound(events, index)
                        if rebound:
                            key = "oreb" if rebound["type"] == "offensive_rebound" else "dreb"
                            L[f"{key}:shot"] += w
                            self.teams[offense][f"{key}_for"] += w
                            self.teams[possession["defense"]][f"{key}_against"] += w
            for index, event in enumerate(events):
                player = event["player"]
                if event["type"] == "free_throw" and player:
                    self.players[player]["fta"] += w
                    self.players[player]["ftm"] += w * bool(event.get("made"))
                    L["fta"] += w
                    L["ftm"] += w * bool(event.get("made"))
                    last = str(event.get("subtype") or "").split("Of")
                    if len(last) == 2 and last[0] == last[1] and not event.get("made"):
                        rebound = following_rebound(events, index)
                        if rebound:
                            L["oreb:ft" if rebound["type"] == "offensive_rebound" else "dreb:ft"] += w
                if not player:
                    continue
                for kind, stat in (("assist", "assists"), ("offensive_rebound", "oreb"), ("defensive_rebound", "dreb"),
                                   ("steal", "steals"), ("block", "blocks")):
                    if event["type"] == kind:
                        self.players[player][stat] += w
                        L[stat] += w
                if event["type"] == "foul" and event.get("subtype") == "personal":
                    self.players[player]["fouls"] += w
                    L["fouls"] += w

    def _count_expected(self, game):
        """Second pass: what the league average would have produced against each defense."""
        w = game["weight"]
        for possession in game["possessions"]:
            defense, events = possession["defense"], possession["events"]
            for kind, index in offensive_chances(possession):
                self.teams[defense]["chances_against"] += w
                self.teams[defense]["turnover_against"] += w * (kind == "turnover")
                if kind == "shot":
                    zone = shot_zone(events[index]["type"], events[index].get("x"), events[index].get("y"))
                    self.teams[defense]["made_against"] += w * bool(events[index].get("made"))
                    self.teams[defense]["expected_made_against"] += w * self.zone_pct(zone)
            if possession["end"] != "period_end":
                self.teams[possession["offense"]]["expected_seconds"] += w * self.mean_seconds
                self.teams[defense]["expected_seconds_defended"] += w * self.mean_seconds

    # --- league and player rates -----------------------------------------------------------
    @property
    def mean_seconds(self):
        if not hasattr(self, "_mean_seconds"):
            values = [s for v in self.durations.values() for s in v]
            self._mean_seconds = sum(values) / len(values)
        return self._mean_seconds

    def zone_pct(self, zone):
        return (self.league[f"made:{zone}"] + 1) / (self.league[f"att:{zone}"] + 2)

    def league_rate(self, key, total_key):
        return self.league[key] / self.league[total_key] if self.league[total_key] else 0.0

    def usage(self, pid):
        p = self.players[pid]
        actions = sum(p[a] for a in ACTIONS)
        league = sum(self.league[a] for a in ACTIONS) / max(self.league["minutes"], 1)
        return shrink(actions, p["minutes"], league, PRIORS["usage_minutes"])

    def action_mix(self, pid):
        p, total = self.players[pid], sum(self.players[pid][a] for a in ACTIONS)
        # The prior describes player decisions; team turnovers are simulated separately.
        league = {a: self.league[a] - self.league[f"team_{a}"] for a in ACTIONS}
        league_total = sum(league.values())
        return [shrink(p[a], total, league[a] / league_total, PRIORS["action"]) for a in ACTIONS]

    def zone_mix(self, pid):
        p = self.players[pid]
        total = sum(p[f"att:{z}"] for z in ZONES)
        league_total = sum(self.league[f"att:{z}"] for z in ZONES)
        return [shrink(p[f"att:{z}"], total, self.league[f"att:{z}"] / league_total, PRIORS["zone_share"]) for z in ZONES]

    def shooting(self, pid, zone):
        p = self.players[pid]
        prior = PRIORS["three_pct"] if zone in THREE_ZONES else PRIORS["two_pct"]
        return shrink(p[f"made:{zone}"], p[f"att:{zone}"], self.zone_pct(zone), prior)

    def free_throw_pct(self, pid):
        p = self.players[pid]
        return shrink(p["ftm"], p["fta"], self.league_rate("ftm", "fta"), PRIORS["ft_pct"])

    def per_minute(self, pid, stat):
        league = self.league[stat] / max(self.league["minutes"], 1)
        return shrink(self.players[pid][stat], self.players[pid]["minutes"], league, PRIORS["per_minute"])

    def team_factor(self, team, observed, expected, prior=None):
        prior = PRIORS["team"] if prior is None else prior  # Read at call time so a tuning run can change PRIORS.
        t = self.teams[team]
        return (t[observed] + prior) / (t[expected] + prior)

    def defense(self, team):
        t = self.teams[team]
        league_to = self.league["turnover"] / max(sum(self.league[a] for a in ACTIONS), 1)
        return {"make": self.team_factor(team, "made_against", "expected_made_against"),
                "turnover": shrink(t["turnover_against"], t["chances_against"], league_to, PRIORS["team"]) / league_to if league_to else 1}

    def offensive_rebound_rate(self, offense, defense, source):
        league = self.league[f"oreb:{source}"] / max(self.league[f"oreb:{source}"] + self.league[f"dreb:{source}"], 1)
        base = self.league["oreb:shot"] / max(self.league["oreb:shot"] + self.league["dreb:shot"], 1)
        if not base:
            return 0.0

        def team_rate(team, own, other):
            t = self.teams[team]
            return (t[own] + base * PRIORS["team"]) / (t[own] + t[other] + PRIORS["team"])
        attack = team_rate(offense, "oreb_for", "dreb_for") / base
        allow = team_rate(defense, "oreb_against", "dreb_against") / base
        return min(0.6, league * attack * allow)

    def pace(self, offense, defense):
        return (self.team_factor(offense, "seconds", "expected_seconds", PRIORS["pace"])
                * self.team_factor(defense, "seconds_defended", "expected_seconds_defended", PRIORS["pace"]))

    def start_factor(self, start, kind):
        L = self.league
        if kind == "make":
            overall = sum(L[f"made:{z}"] for z in ZONES) / max(sum(L[f"att:{z}"] for z in ZONES), 1)
            return shrink(L[f"start:{start}:made"], L[f"start:{start}:att"], overall, 200) / overall if overall else 1.0
        overall = L["turnover"] / max(sum(L[a] for a in ACTIONS), 1)
        return shrink(L[f"start:{start}:turnover"], L[f"start:{start}:chances"], overall, 200) / overall if overall else 1.0

    def side_factor(self, home):
        L = self.league
        overall = (L["side:True:made"] + L["side:False:made"]) / max(L["side:True:att"] + L["side:False:att"], 1)
        return shrink(L[f"side:{home}:made"], L[f"side:{home}:att"], overall, 500) / overall if overall else 1.0

    def roster(self, team, last_games=5):
        """Players and minute shares from the team's latest games, current season first."""
        games = sorted((r for r in self.records if any(t["source_id"] == team for t in r[2]["teams"])),
                       key=lambda r: r[0])
        if not games:
            raise ValueError(f"No games for team {team}")
        latest_weight = games[-1][1]
        games = [g for g in games if g[1] == latest_weight][-last_games:]
        minutes, starters = defaultdict(float), []
        for _, _, record in games:
            for t in record["teams"]:
                if t["source_id"] == team:
                    for player in t["players"]:
                        minutes[player["source_player_id"]] += player.get("minutes") or 0
        last = next(t for t in games[-1][2]["teams"] if t["source_id"] == team)
        starters = [p["source_player_id"] for p in last["players"] if p.get("starter")]
        share = {pid: min(0.95, m / (40 * len(games))) for pid, m in minutes.items() if m > 0}
        if len(share) < 5:
            raise ValueError(f"Too few players for team {team}")
        starters = [pid for pid in starters if pid in share][:5]
        return {"share": share, "starters": starters, "games": len(games)}


class GameSimulator:
    def __init__(self, model, home, away):
        self.m, self.home, self.away = model, home, away
        self.other = {home: away, away: home}
        self.rosters = {team: model.roster(team) for team in (home, away)}
        players = [pid for team in (home, away) for pid in self.rosters[team]["share"]]
        self.usage = {pid: model.usage(pid) for pid in players}
        self.actions = {pid: model.action_mix(pid) for pid in players}
        self.zones = {pid: model.zone_mix(pid) for pid in players}
        self.pct = {(pid, z): model.shooting(pid, z) for pid in players for z in ZONES}
        self.ft = {pid: model.free_throw_pct(pid) for pid in players}
        self.rates = {(pid, s): model.per_minute(pid, s) for pid in players for s in ("assists", "oreb", "dreb", "steals", "blocks", "fouls")}
        self.defense = {team: model.defense(team) for team in (home, away)}
        self.pace = {team: model.pace(team, self.other[team]) for team in (home, away)}
        self.oreb = {(team, src): model.offensive_rebound_rate(team, self.other[team], src) for team in (home, away) for src in ("shot", "ft")}
        self.start_make = {s: model.start_factor(s, "make") for s in STARTS}
        self.start_turnover = {s: model.start_factor(s, "turnover") for s in STARTS}
        self.side = {home: model.side_factor(True), away: model.side_factor(False)}
        L = model.league
        self.assisted = {z: model.league_rate(f"assisted:{z}", f"made_fg:{z}") for z in ZONES}
        self.and_one = {z: model.league_rate(f"and_one:{z}", f"made_fg:{z}") for z in ZONES}
        self.blocked = {z: model.league_rate(f"blocked:{z}", f"missed:{z}") for z in ZONES}
        self.stolen = L["turnover_stolen"] / max(L["turnover"], 1)
        self.team_turnover = L["team_turnover"] / max(sum(L[a] for a in ACTIONS), 1)

    # --- lineups ---------------------------------------------------------------------------
    def substitute(self, rng, team, on_court):
        share = self.rosters[team]["share"]
        keep = [pid for pid in on_court if rng.random() < share[pid] ** 0.5]
        bench = [pid for pid in share if pid not in keep]
        while len(keep) < 5 and bench:
            pick = weighted_choice(rng, bench, [share[p] / (1 - share[p] + 0.05) for p in bench])
            keep.append(pick)
            bench.remove(pick)
        return keep

    def opening_lineup(self, rng, team):
        starters = self.rosters[team]["starters"]
        return list(starters) if len(starters) == 5 else self.substitute(rng, team, [])

    # --- one possession --------------------------------------------------------------------
    def possession(self, rng, offense, start, on_court, log):
        defense = self.other[offense]
        attackers, defenders = on_court[offense], on_court[defense]
        points = 0
        for chance in range(8):
            if rng.random() < self.team_turnover * self.defense[defense]["turnover"]:
                log.append({"type": "turnover", "team": offense, "player": None})
                return points, "turnover"
            actor = weighted_choice(rng, attackers, [self.usage[p] * self.form["usage"][p] for p in attackers])
            mix = self.actions[actor]
            weights = [mix[0], mix[1] * self.defense[defense]["turnover"] * self.start_turnover.get(start, 1), mix[2]]
            action = weighted_choice(rng, ACTIONS, weights)
            if action == "turnover":
                stolen = rng.random() < self.stolen
                log.append({"type": "turnover", "team": offense, "player": actor})
                if stolen:
                    thief = weighted_choice(rng, defenders, [self.rates[(p, "steals")] for p in defenders])
                    log.append({"type": "steal", "team": defense, "player": thief})
                return points, "steal" if stolen else "turnover"
            if action == "free_throws":
                fouler = weighted_choice(rng, defenders, [self.rates[(p, "fouls")] for p in defenders])
                log.append({"type": "foul", "team": defense, "player": fouler})
                made = [rng.random() < self.ft[actor] for _ in range(2)]
                for shot in made:
                    log.append({"type": "free_throw", "team": offense, "player": actor, "made": shot, "points": int(shot)})
                points += sum(made)
                if made[-1]:
                    return points, "made_ft"
                if not self.rebound(rng, offense, attackers, defenders, "ft", log):
                    return points, "defensive_rebound"
                start = "offensive_rebound"
                continue
            zone = ZONES[bisect_choice(rng, self.zones[actor])]
            x, y = self.location(rng, actor, zone)
            three = zone in THREE_ZONES
            probability = (self.pct[(actor, zone)] * self.form["shot"][actor] * self.defense[defense]["make"] * self.form["defense"][defense]
                           * self.start_make.get(start, 1) * self.side[offense])
            made = rng.random() < min(0.95, max(0.02, probability))
            shot = {"type": "3pt" if three else "2pt", "team": offense, "player": actor, "zone": zone,
                    "x": x, "y": y, "made": made, "points": (3 if three else 2) * made}
            if made:
                teammates = [p for p in attackers if p != actor]
                if rng.random() < self.assisted[zone]:
                    weights = [self.m.pairs[p][actor] + 2 * self.rates[(p, "assists")] / max(self.mean_rate("assists"), 1e-9)
                               for p in teammates]
                    shot["assist"] = weighted_choice(rng, teammates, weights)
                log.append(shot)
                points += shot["points"]
                if not three and rng.random() < self.and_one[zone]:
                    bonus = rng.random() < self.ft[actor]
                    log.append({"type": "free_throw", "team": offense, "player": actor, "made": bonus, "points": int(bonus)})
                    points += bonus
                return points, "made_fg"
            if rng.random() < self.blocked[zone]:
                shot["block"] = weighted_choice(rng, defenders, [self.rates[(p, "blocks")] for p in defenders])
            log.append(shot)
            if not self.rebound(rng, offense, attackers, defenders, "shot", log):
                return points, "defensive_rebound"
            start = "offensive_rebound"
        return points, "turnover"

    def mean_rate(self, stat):
        return self.m.league[stat] / max(self.m.league["minutes"], 1)

    def rebound(self, rng, offense, attackers, defenders, source, log):
        offensive = rng.random() < self.oreb[(offense, source)]
        group, stat = (attackers, "oreb") if offensive else (defenders, "dreb")
        player = weighted_choice(rng, group, [self.rates[(p, stat)] for p in group])
        log.append({"type": "offensive_rebound" if offensive else "defensive_rebound",
                    "team": offense if offensive else self.other[offense], "player": player})
        return offensive

    def location(self, rng, player, zone):
        options = self.m.coords.get((player, zone)) or self.m.coords.get((None, zone))
        return options[int(rng.random() * len(options))] if options else (20.0, 50.0)

    # --- whole game ------------------------------------------------------------------------
    def draw_form(self, seed):
        """Separate random stream, so a zero spread leaves the game stream untouched."""
        rng = random.Random(f"form-{seed}")
        factor = lambda sd: exp(rng.gauss(0, sd) - sd * sd / 2) if sd else 1.0
        players = [pid for team in (self.home, self.away) for pid in self.rosters[team]["share"]]
        return {"shot": {pid: factor(FORM["shot"]) for pid in players}, "usage": {pid: factor(FORM["usage"]) for pid in players},
                "defense": {team: factor(FORM["defense"]) for team in (self.home, self.away)}}

    def play(self, seed, keep_log=False):
        rng = random.Random(seed)
        self.form = self.draw_form(seed)
        home, away = self.home, self.away
        score, quarters = {home: 0, away: 0}, []
        stats = defaultdict(lambda: defaultdict(int))
        pairs = defaultdict(int)
        log, margin_track, lead_changes, leader = [], [], 0, None
        largest = {home: 0, away: 0}
        jump = home if rng.random() < 0.5 else away
        period, elapsed = 1, 0.0
        while True:
            length = 600 if period <= 4 else 300
            remaining, period_offset = length, elapsed
            on_court = {team: self.opening_lineup(rng, team) if period in (1, 3) else self.substitute(rng, team, [])
                        for team in (home, away)}
            if keep_log:
                for team in (home, away):
                    log.append({"t": round(elapsed, 1), "period": period, "clock": remaining, "type": "lineup",
                                "team": team, "players": list(on_court[team])})
            offense = (jump if period % 2 else self.other[jump]) if period <= 4 else (home if rng.random() < 0.5 else away)
            start, next_sub = "period_start", rng.uniform(150, 260)
            period_start_score = dict(score)
            while True:
                events = []
                points, outcome = self.possession(rng, offense, start, on_court, events)
                duration = rng.choice(self.m.durations.get((start, outcome)) or self.m.durations_all) * self.pace[offense]
                buzzer = duration >= remaining
                if buzzer:
                    # The possession beats the buzzer in proportion to the time left.
                    if rng.random() >= remaining / duration:
                        elapsed += remaining
                        break
                    duration = remaining
                for index, event in enumerate(events):
                    event_clock = remaining - duration * (index + 1) / len(events)
                    player = event["player"]
                    if event["type"] in ("2pt", "3pt", "free_throw"):
                        stats[player]["points"] += event["points"]
                        score[offense] += event["points"]
                    if event.get("assist"):
                        stats[event["assist"]]["assists"] += 1
                        pairs[(event["assist"], player)] += 1
                    if event["type"] in REBOUNDS:
                        stats[player]["rebounds"] += 1
                    if event["type"] == "steal":
                        stats[player]["steals"] += 1
                    if keep_log:
                        x, y = event.get("x"), event.get("y")
                        if x is not None and self.attacks_right(offense, period):
                            x, y = 100 - x, 100 - y
                        log.append({**event, "x": x, "y": y, "t": round(period_offset + length - event_clock, 1), "period": period,
                                    "clock": round(event_clock, 1), "home_score": score[home], "away_score": score[away]})
                remaining -= duration
                elapsed += duration
                margin = score[home] - score[away]
                now = home if margin > 0 else away if margin < 0 else leader
                if leader and now != leader:
                    lead_changes += 1
                leader = now
                largest[home] = max(largest[home], margin)
                largest[away] = max(largest[away], -margin)
                margin_track.append((period, remaining, margin))
                if buzzer:
                    break
                start, offense = outcome, self.other[offense]
                if remaining < next_sub and outcome in ("made_ft", "turnover", "made_fg"):
                    on_court = {team: self.substitute(rng, team, on_court[team]) for team in (home, away)}
                    next_sub = remaining - rng.uniform(150, 260)
                    if keep_log:
                        for team in (home, away):
                            log.append({"t": round(elapsed, 1), "period": period, "clock": round(remaining, 1),
                                        "type": "lineup", "team": team, "players": list(on_court[team])})
            quarters.append({team: score[team] - period_start_score[team] for team in (home, away)})
            if period == 3:
                after_three = score[home] - score[away]
            if period >= 4 and score[home] != score[away]:
                break
            period += 1
        return {"seed": seed, "score": dict(score), "quarters": quarters, "after_three": after_three,
                "lead_changes": lead_changes, "largest_lead": largest, "overtime": period > 4,
                "stats": {pid: dict(values) for pid, values in stats.items()}, "pairs": dict(pairs),
                "log": log if keep_log else None}

    def attacks_right(self, team, period):
        """FIBA: teams switch baskets at half-time; home attacks the left basket first."""
        first_half = period <= 2
        return (team == self.away) == first_half


def bisect_choice(rng, weights):
    total, cumulative = 0.0, []
    for weight in weights:
        total += weight
        cumulative.append(total)
    return bisect(cumulative, rng.random() * total)
