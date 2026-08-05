# Prompt Evaluation Evidence

This directory stores reproducible records for Prompt experiments. The current dataset contains one case study, A-04 parametric architecture. It should be read as a case-level evaluation, not as a project-wide quality benchmark.

## Method

- Same three-image reference set for the A-04 case.
- Chinese and English Prompt variants are compared separately.
- Four candidates are intended for each language and version when the run record is complete.
- Scores are human-rated against the same four dimensions.
- A candidate passes only when the weighted score is acceptable and every dimension reaches the 70% minimum gate.
- Provider, model, aspect ratio, candidate count, settings, and missing metadata are recorded per run when available.

## Current evidence

- A-04 Chinese v3.0 baseline: best candidate about 60%.
- A-04 English v3.0 baseline: best candidate 79.0%.
- A-04 Chinese v3.1 revised: best candidate 81.2%.
- A-04 English v3.1 revised: best candidate 82.8%.

These are best-candidate results for one controlled case. They are not averages across cards, Providers, or users.

## Files

- [`rubric.json`](rubric.json): scoring dimensions, weights, and gate.
- [`datasets/a04-parametric-architecture.json`](datasets/a04-parametric-architecture.json): case definition and evaluation boundary.
- [`results/summary.md`](results/summary.md): current interpretation and known gaps.

Additional cases are intentionally marked pending until their raw inputs and scoring records are available.
