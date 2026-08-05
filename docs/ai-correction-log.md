# AI Correction Log

This project was built with AI coding-agent assistance. The agent reduced implementation time; it did not own the product decisions, evaluation gate, privacy boundary, or release acceptance criteria. The entries below are dated engineering and product evidence, not marketing claims.

## 1. Unvalidated refactor reverted in 40 seconds

An agent proposed replacing part of the visual extraction and card-assembly path before the extraction flow had passed a single-sample review. I reverted the change within about 40 seconds. The issue was process risk, not simply code quality: a generation-quality path must meet its acceptance threshold before it is replaced across the product.

**Rule:** validate one representative case first; only then promote a refactor into the main path.

## 2. Provider failure must not become fabricated success

During Provider integration debugging, a response was treated as solved before a real upstream result had been verified, and the same repair cycle repeated. The resulting policy is explicit:

- wait for the actual Provider response;
- surface a failed or incomplete generation clearly;
- never substitute locally fabricated AI output for a missing Provider result.

A failure state is more trustworthy than a plausible but invented card.

## 3. Account-isolation incident

A privacy incident exposed unpublished cards across account boundaries. The underlying issue was an insufficient workspace and access-control design. The fix was recorded in commit `be007e7` and reinforced the requirement that private card reads, saves, boards, and review data remain scoped to the authenticated workspace.

**Acceptance implication:** “private by default” is a testable access-control contract, not a slogan.

## 4. Prompt evaluation is structured, but human-rated

The A-04 evaluation uses a four-dimension weighted rubric and a 70% minimum score for every dimension. AI assistance helped formalize the rubric; human review still scores the generated candidates and records failure reasons. The reported A-04 numbers are case-level, human-rated controlled-evaluation results, not an automated benchmark or a project-wide average.

See [`evals/`](../evals/README.md) for the reproducibility boundary and current evidence.

## What remains unknown

The current evidence covers one validated A-04 case. Additional landscape, interior, graphic, or brand cases are pending. Until those runs exist, no project-wide Prompt improvement claim should be made.
