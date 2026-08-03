# Prompt Template v3

Status: candidate contract. Production seed cards are not migrated until real generation validation passes.

## Required Outcome

Every card contains two complete, directly runnable image-generation Prompts:

- Chinese output contains Chinese generation instructions only.
- English output contains English generation instructions only.
- Copying either Prompt into an image model produces a concrete test image without filling any placeholder.
- Users may then replace the concrete subject or project details while retaining the reusable style, composition, palette, and material logic.

The Prompt must not contain:

- `{{variable}}`, `[subject]`, parentheses that ask the user to fill content, or blank slots;
- “user-provided subject”, “replace with”, “to be completed”, or equivalent meta instructions;
- use-case metadata, research notes, source warnings, or model-specific parameters;
- unsupported architect, designer, studio, brand, software, location, or date attribution.

## Four System Templates

### 1. Spatial and Architectural Reconstruction

Scope: architecture, interior, landscape, exhibition.

Extract and lock:

- concrete spatial subject and program;
- mass topology and quantity;
- circulation, foreground/midground/background;
- camera height, direction, lens character, perspective;
- scale references;
- material surface, joints, roughness, reflection;
- key/fill light, direction, softness, color temperature;
- dominant/support/accent color proportions;
- buildable geometry and spatial negative constraints.

### 2. Brand, Graphic, and UI Reconstruction

Scope: brand identity, poster, editorial, packaging, Web/UI.

Extract and lock:

- concrete output object: poster, cover, package face, or interface;
- canvas ratio and grid columns;
- visual anchor, image-to-type ratio, whitespace distribution;
- text-block quantity and visible typographic morphology;
- type classification, weight contrast, alignment, hierarchy;
- color-block proportions and contrast;
- print substrate, screen finish, grain, halftone, or pixel treatment;
- no fabricated brand identity or unreadable long copy.

### 3. Photography and Moving-Image Reconstruction

Scope: portrait, still life, documentary, cinematic scene.

Extract and lock:

- concrete subject appearance, pose, and action;
- setting and narrative relation;
- shot size, camera position, lens character, focus plane, depth of field;
- motion character and exposure impression;
- key/fill/practical light and color temperature;
- dynamic range, grading, grain, halation, or digital texture;
- anatomy, focus, skin, background, and watermark constraints.

### 4. Product, Furniture, and Installation Reconstruction

Scope: product, furniture, installation, accessory.

Extract and lock:

- concrete object category and use state;
- silhouette and perceived proportions;
- component quantity, connection, seam, thickness, and edge treatment;
- material and finish;
- color zoning;
- support surface and environmental context;
- commercial camera and lighting setup;
- structural integrity and material-quality constraints.

## Card Contract

```text
IDENTITY
- schemaId
- promptVersion
- card ID, bilingual title, category

EVIDENCE
- visibleFacts.zh / visibleFacts.en
- designInferences.zh / designInferences.en

GENERATION PROMPT
- generationPrompt.zh
- generationPrompt.en
- one concrete directly runnable scene in each language

NEGATIVE PROMPT
- negativePrompt.zh
- negativePrompt.en
- copied separately

COPY BEHAVIOR
- default = generationPrompt
- containsPlaceholders = false
- containsUseCaseMetadata = false
- containsModelParameters = false

QUALITY REVIEW
- language isolation
- directly runnable
- evidence coverage
- real generation validation status
```

## Quality Gate

A v3 card cannot enter production only because its writing appears detailed.

### Static Gate

Automated and human checks must pass:

1. No placeholder or meta instruction.
2. Chinese and English are isolated.
3. Concrete subject, composition/camera, color, material/texture, and light are all present.
4. No conflicting camera, lighting, material, or geometry instruction.
5. Negative Prompt is specific to the reference.
6. No unsupported attribution.

### Generation Gate

Generate at least four candidates from each language Prompt using a declared test model and stable adapter settings.

Score each candidate against the reference gallery:

| Dimension | Weight |
| --- | ---: |
| Style language and visual rhythm | 30% |
| Composition and spatial hierarchy | 25% |
| Color family and color proportions | 20% |
| Material, texture, light, and finish | 25% |

Pass conditions:

- best Chinese candidate weighted score >= 80%;
- best English candidate weighted score >= 80%;
- no dimension below 70%;
- no severe structural, anatomy, typography, or material failure;
- reviewer records model, date, candidate images, score, and revision notes.

A static evidence score is only a preflight check. It must never be reported as a generation-match score.

## Current A-04 Status

`A-04-parametric-architecture.sample.json` is directly runnable and contains no placeholders. Its static evidence coverage passes. Real generation validation is currently blocked because no image-generation Provider is configured in the current environment. It is not yet approved for batch migration.
