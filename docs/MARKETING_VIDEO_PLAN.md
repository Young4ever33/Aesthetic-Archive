# Aesthetic Archive Marketing Video Plan

## Principle

The live landing page is the primary product proof. A rendered video is a secondary distribution asset for launch posts, social clips, and presentations.

## Source

Use the HTML/React marketing scenes as the source of truth:

1. Opening: material field and headline.
2. Analysis: reference image becomes structured fields.
3. Plaza: public card discovery and detail state.
4. Archive: private card editing and save feedback.
5. Board: references, stroke, note, and summary.
6. Model layer: provider route diagram.
7. Closing: direction board and CTA.

## Render Targets

- Product promo: 16:9, 30-45 seconds, WebM and MP4.
- Social vertical cut: 9:16, 15-20 seconds, no tiny UI text.
- Short hero loop: 16:9, 8-10 seconds, muted, no narration.

## HyperFrames Workflow

When the CLI is available:

```bash
npx hyperframes skills update product-launch-video
npx hyperframes init
npx hyperframes lint
npx hyperframes validate
npx hyperframes render --format webm
npx hyperframes render --format mp4
```

The composition should be authored as a seekable HTML timeline. Do not record a live authenticated workspace as the only source because credentials, network state, and provider latency make the result non-deterministic.

## Accessibility and Performance

- The live page must not require video playback.
- Use a poster image for every video placement.
- Respect reduced motion and reduced data preferences.
- Keep the first video under a deferred/lazy loading boundary.
- Do not autoplay audio.
- Provide an accessible text equivalent through the live HTML scenes.

## Current Status

HyperFrames is not installed in the current workspace. The live HTML scenes are complete enough to become the render source once the renderer is available.
