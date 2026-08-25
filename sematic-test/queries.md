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

## 🟡 Medium — paraphrase / synonym, zero shared keywords

The exact words below **do not appear** in the target docs. These are where the vector side should win and FTS should fail.

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

## How to read the results

- **Easy** should be near-perfect. If these miss, the index itself is broken, not the embeddings.
- **Medium** is the real semantic test. Check that the target doc lands in the **top 3**. If it only shows up in Easy queries, the vector side isn't pulling its weight.
- **Hard** is about *relative* relevance: even a "wrong" doc is informative. E.g. for `turning a small balcony into a pantry`, a hit on 10 is ideal; a hit on 04 (soup/vegetables) is defensible; a hit on 15 (Rust) means the embedding is failing you.

## Two tips for isolating the vector side

1. vectile's search is hybrid (FTS + vector + RRF). To see what the *embeddings alone* find, drop `fts_weight` to `0` and set `vector_weight` to `1` in Settings → Search, then re-run the Medium/Hard sets. That removes the keyword crutch entirely.
2. Compare each query's top result at `vector_weight=1` vs. the default hybrid — the difference is exactly how much the semantic layer is contributing.
