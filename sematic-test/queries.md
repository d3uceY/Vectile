# vectile Semantic Test — Query Sets

Test corpus lives in [`text documents/`](./text%20documents/) (17 files, `01`–`17`).

The **target** column shows which file(s) a *good* semantic result should surface.

---

## 🟢 Easy — literal keyword overlap (should hit even with plain full-text search)

These verify the index itself works before you judge semantics.

| # | Query | Target |
|---|-------|--------|
| E1 | `tomato sauce` | 01 |
| E2 | `banana bread` | 02 |
| E3 | `sourdough starter` | 03 |
| E4 | `vegetable soup` | 04 |
| E5 | `sleep` | 12 |
| E6 | `git` | 14 |
| E7 | `Rust command line tools` | 15 |
| E8 | `science fiction reading list` | 16 |

---

## 🟡 Medium — paraphrase / synonym, low shared keywords

Mostly paraphrase, meant to have little literal overlap — but a word-boundary audit shows **several share content words with their targets**: `spotty bananas` → 02, `flour/water/tangy/bread` → 03, `short/bursts` → 05, `cold/weather` → 04, `carry` → 08, `meat/muscle` → 11, `desk` → 13, `history/working/alone` → 14 (M6/M7 are the only truly keyword-free rows). Treat these as "should win even with a keyword bridge." For queries with a keyword that doesn't exist **anywhere**, use the ⚫️ Black set below.

| # | Query | Target |
|---|-------|--------|
| M1 | `quick bread made from spotty bananas` | 02 |
| M2 | `fermented flour and water for tangy bread` | 03 |
| M3 | `high-intensity cardio in short bursts` | 05 |
| M4 | `warm stew for cold weather` | 04 |
| M5 | `what to carry when flying` | 08 |
| M6 | `planning a trip into the mountains` | 07 |
| M7 | `growing food in small outdoor spaces` | 10 |
| M8 | `meat-free meals that build muscle` | 11 |
| M9 | `making the desk stop hurting` | 13 |
| M10 | `keeping code history when working alone` | 14 |

---

## 🔴 Hard — abstract / oblique, needs topical inference

The query shares almost nothing lexically; the embedding has to infer the *topic*. Some are genuinely ambiguous — that's intentional. Watch **which** doc surfaces and whether it's plausibly the best of the set.

| # | Query | Target (or what to look for) |
|---|-------|------------------------------|
| H1 | `what should I bake this weekend for guests` | 02 or 03 (infer baking + weekend) |
| H2 | `preparing for a night away from home` | 08 or 09 (infer travel) |
| H3 | `healthy routines that start the day right` | 05 / 12 (infer morning + health) |
| H4 | `turning a small balcony into a pantry` | 10 (infer growing food in small space) |
| H5 | `cheap ways to get more energy during the day` | 11 or 12 |
| H6 | `escaping the city to clear my head` | 07 (ridge, quiet, no signal) |
| H7 | `fun things to do together on a Friday` | 17 |
| H8 | `quiet hobbies that keep my mind sharp` | 16 or 14 |

---

## ⚫️ Black — one keyword doesn't exist anywhere (regex-verifiable)

Same idea as Medium but *impossible to fake with a keyword*. Each query carries one salient term — the word you'd naturally search for — that a word-boundary regex confirms appears **nowhere in the corpus** (checked against all 17 files: 0 hits). A plain FTS query for that word returns nothing, so only the embedding can route to the right document.

The **Missing keyword** column is the word to verify. Run the regex in **Verify** against the target file (VS Code Find → regex, or PowerShell `Select-String -Path '<file>' -Pattern '<regex>'`) — it must match nothing. A ready-to-run check that tests all 17 at once lives in [`verify-missing-keywords.ps1`](./verify-missing-keywords.ps1).

| # | Query | Target | Missing keyword | Verify (against target file) |
|---|-------|--------|-----------------|------------------------------|
| B1 | `homemade spaghetti sauce from ripe tomatoes` | 01 | `spaghetti` | `(?i)\bspaghetti\b` |
| B2 | `turning ripe bananas into muffins` | 02 | `muffin` | `(?i)\bmuffin\b` |
| B3 | `natural yeast that makes bread tangy` | 03 | `yeast` | `(?i)\byeast\b` |
| B4 | `cozy autumn chowder with beans` | 04 | `chowder` | `(?i)\bchowder\b` |
| B5 | `HIIT sessions to raise your stamina` | 05 | `HIIT` | `(?i)\bhiit\b` |
| B6 | `marathon fuel and hydration plan` | 06 | `marathon` | `(?i)\bmarathon\b` |
| B7 | `mountain trail with sweeping views` | 07 | `mountain` | `(?i)\bmountain\b` |
| B8 | `airport carry-on essentials checklist` | 08 | `airport` | `(?i)\bairport\b` |
| B9 | `overnight camping kit that stays light` | 09 | `camping` | `(?i)\bcamping\b` |
| B10 | `fresh salsa straight from the pots` | 10 | `salsa` | `(?i)\bsalsa\b` |
| B11 | `vegan protein sources for athletes` | 11 | `vegan` | `(?i)\bvegan\b` |
| B12 | `evening wind-down ritual for deep rest` | 12 | `ritual` | `(?i)\britual\b` |
| B13 | `office posture tips for long days at a screen` | 13 | `posture` | `(?i)\bposture\b` |
| B14 | `version control for a one-person project` | 14 | `version` | `(?i)\bversion\b` |
| B15 | `systems language for terminal tools` | 15 | `terminal` | `(?i)\bterminal\b` |
| B16 | `dystopian novels about what comes next` | 16 | `dystopian` | `(?i)\bdystopian\b` |
| B17 | `cartoon marathon for family night` | 17 | `cartoon` | `(?i)\bcartoon\b` |

**Reading the results:** if the target surfaces in the top few despite its keyword being absent, the embedding genuinely inferred the topic — the strongest proof the vector side works. A wrong doc (e.g. B6 landing on 05) means the model is drifting on topic.

---

## How to read the results

- **Easy** should be near-perfect. If these miss, the index itself is broken, not the embeddings.
- **Medium** is the real semantic test. Check that the target doc lands in the **top 3**. If it only shows up in Easy queries, the vector side isn't pulling its weight.
- **Hard** is about *relative* relevance: even a "wrong" doc is informative. E.g. for `turning a small balcony into a pantry`, a hit on 10 is ideal; a hit on 04 (soup/vegetables) is defensible; a hit on 15 (Rust) means the embedding is failing you.
- **Black** is the anti-keyword trap: the missing keyword must return 0 regex hits, and the target should still surface near the top — it's the cleanest signal that the vector side (not FTS) is doing the work.

## Two tips for isolating the vector side

1. vectile's search is hybrid (FTS + vector + RRF). To see what the *embeddings alone* find, drop `fts_weight` to `0` and set `vector_weight` to `1` in Settings → Search, then re-run the Medium/Hard sets. That removes the keyword crutch entirely.
2. Compare each query's top result at `vector_weight=1` vs. the default hybrid — the difference is exactly how much the semantic layer is contributing.
