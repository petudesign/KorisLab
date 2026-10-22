# Contextual search

SearchPage first routes recognized change/role/preview questions to contextSearch; other queries use the existing basketball resolver. FI/EN name matching supports Aarrejoen, Hongan and common genitives. Ambiguous names return candidate buttons rather than silently picking a person. Explicit seasons and recent/previous-season comparison phrases are respected.

Player role answers reuse changeRecords/analyzeChange and playerTeamContext, leading with team names, minutes and attempt share, then minutes/game, FGA/40 and pooled eFG. Team decline questions check net-rating change (ORtg delta - DRtg delta); ±5 descriptive thresholds, no significance or causal claim. Inadequate samples cannot support a decline premise.

Next-game keys choose an unplayed, non-live future fixture relative to now, compare each team’s verified current-season aggregate, minimum 2 games each, and provide three largest descriptive metric differences with watch prompts. Previous meetings show up to three verified games in the selected or previous season with correctly scoped match links. No automatic lineup/news context or tactical predictions.

Answers retain periods/counts and sources, link profiles/matches, and show missing-data/retry states. This is a deterministic supported question set, not an unrestricted natural-language model.
