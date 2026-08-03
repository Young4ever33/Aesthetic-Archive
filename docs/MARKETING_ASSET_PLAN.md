# Aesthetic Archive Marketing Assets

## Boundary

The landing page borrows the reference site's narrative rhythm and interaction logic. It does not copy brand assets, wording, illustrations, source code, or visual identity.

## Asset Matrix

| Scene | Purpose | Asset | Ratio | Safe area |
|---|---|---|---|---|
| Opening | establish the visual archive world | architectural material study, no UI text | 16:10 | left 38% clear for headline |
| Fragments | show scattered references | 8-12 independent material crops | 4:3 and 1:1 | no important subject within 8% edge |
| Analysis | show one reference becoming structured knowledge | quiet interior with visible texture | 4:3 | central subject, no text baked in |
| Public Plaza | show discovery breadth | real product UI rendered in React | 16:10 | UI text remains code-rendered |
| My Archive | show private structured memory | real product UI rendered in React | 4:3 | image area left, metadata right |
| Board | show composition and relationships | 3-5 reference images plus paper note | 16:10 | open negative space for strokes |
| Closing | give the CTA a visual endpoint | final direction board material image | 3:2 | right 35% clear for CTA on desktop |

## Generation Prompts

### Hero

> Editorial architectural material study for a designer's visual archive, raw concrete, weathered timber, mineral plaster, quiet daylight, tactile surfaces, restrained cold grey paper palette with one muted brown accent, asymmetric composition, generous negative space on the left for headline typography, subtle film grain, no people, no logos, no UI, no text, no gradient blob, premium art direction, 16:10 landscape.

### Fragments

> Single material reference photograph for an editorial design archive, close crop of oxidized metal, folded paper, stone, fabric, or architectural shadow, tactile detail, neutral grey and off-white palette, controlled contrast, no text, no logo, no UI, 4:3 landscape.

### Analysis reference

> Quiet wabi-sabi interior reference for design analysis, weathered timber, mineral wall, hand-finished plaster, soft side light, clear material relationships and asymmetry, no furniture branding, no people, no text, 4:3 landscape.

### Board endpoint

> Editorial project direction board photographed from above, architectural reference prints, material samples, graphite marks, paper labels with no readable text, restrained grey paper and muted brown palette, organized but tactile, open space for overlay annotations, no UI, 16:10 landscape.

## Production Rules

1. Generate each scene as a separate asset; never use one hero image as every section background.
2. Do not ask an image model to render product UI, buttons, prompts, or readable labels.
3. Keep faces, logos, and readable text out of generated imagery.
4. Check desktop crop at 1440x900, 1280x800, and mobile crop at 390x844.
5. Keep focal subjects inside the central 84% safe region.
6. Normalize exposure, saturation, grain, and white balance across the set.
7. Keep originals outside `public`; put optimized derivatives under `public/marketing/`.
8. Use `next/image` for fixed local assets; keep user-uploaded and Supabase images as native `img` elements.

## Compression

When ImageMagick or cwebp is available, create WebP derivatives from originals. Do not overwrite originals. The current development machine has no configured image-generation key, so existing archive references are used until the asset generation step is authorized.
