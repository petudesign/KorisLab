# What changed — first implementation

Shared ChangeAnalysis section after player/team profile metrics. Compare last five verified appearances with all earlier appearances in the selected season, or the full selected season with the immediately previous available season. Default to season comparison when fewer than eight appearances exist. No new standalone route in this first iteration: Explore the change expands in the profile, keeping entity and season scope. Discovery cards already link to these profiles.

Recent comparison requires 5 + at least 3 disjoint games; player baseline also needs 120 minutes and current 30. Season comparison requires 2 current / 8 previous player appearances and 30 / 120 minutes; teams require 2 / 5 games. Player IDs preferred, unique normalized exact names only as fallback. Only positive-minute player appearances count. No missing stats converted to zero.

Player metrics: points/game, minutes/game, points/40, FGA/40, pooled eFG, AST/40, REB/40, starting percentage. Team metrics: ORtg, DRtg, pooled eFG, turnovers/100, ORB%, three-point attempt share. Estimated shared possessions average both teams’ FGA + .44FTA - ORB + TO. eFG needs 30 attempts per period.

Three largest descriptive threshold changes from different categories, no statistical significance claim: PPG 3, MIN 4, PTS/40 4, FGA/40 3, eFG 5, AST/40 1.5, REB/40 2.5, starts 20; team ORtg/DRtg 5, eFG 5, TO/100 3, ORB 5, 3PA share 5. Role/shot selection neutral; lower DRtg/turnover rate better. Thresholds are product heuristics.

Conditional summaries distinguish time-only production changes from changes in shot volume or per-minute output. Team-change context is explicit. Both sample periods, counts, minutes, detailed metrics, match links and original source links are inspectable. Opponent adjustment, injury/news context, tactical inference, export briefs and dedicated share routes remain future work. UI explicitly states these limitations.

Player team context now compares each period’s actual teams with logos/profile links, full verified-season W–L/win percentage (descriptive shared rank, not official placement) and selected-player-sample responsibility. Minutes rank, FGA share and attempts/game visible; points share and point rank expanded. Team responsibility totals include only the player’s selected appearances, using team totals in those same games; multiple teams stay separate. No usage-rate, causal role or championship claims. Missing denominators/ranking inputs stay unavailable.
