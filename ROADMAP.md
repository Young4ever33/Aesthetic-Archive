# Aesthetic Archive Roadmap

> Source of truth for detailed execution: `docs/PHASED_BUILD_PLAN.md`.

## Phase 0｜Product Direction

- [x] Reposition product as an AI aesthetic knowledge base for designers.
- [x] Define Open Beta strategy.
- [x] Define BYO AI Provider direction.
- [x] Create product PRD and UI design standard.
- [x] Create phased build plan.
- [x] Remove old API mock, payment, Supabase, serverless and legacy prototype files unrelated to the next iteration.

## Phase 1｜Landing Page Refresh

- [ ] Update Hero copy: “别再只是收藏参考图，开始搭建你的审美知识库。”
- [ ] Add early product entry cards: Public Plaza, My Archive, Collage Board.
- [ ] Replace old support/pricing narrative with Open Beta and custom AI Provider narrative.
- [ ] Add product workflow: Search or Upload → Extract Structure → Reuse Everywhere.
- [ ] Add static feature preview for sidebar + search + card grid.

## Phase 2｜App Shell And Card Grid

- [ ] Add sidebar modules: Public Plaza, My Archive, Saved, Collage Board, AI Provider, Settings.
- [ ] Make main area search/filter/card-grid first.
- [ ] Add filters for category, style, palette, composition and output type.
- [ ] Reuse existing 22 seed cases.

## Phase 3｜Card Detail Panel

- [ ] Add flip-inspired detail panel interaction.
- [ ] Use left-side Style Gallery and right-side aesthetic knowledge layout.
- [ ] Show cultural background, design elements, palette, composition, use cases and prompts.
- [ ] Support copy prompt, save, add to Collage and export actions.

## Phase 4｜My Archive

- [ ] Add manual style-case creation.
- [ ] Add image upload preview.
- [ ] Save private style cases to localStorage.
- [ ] Support edit, delete and review status.

## Phase 5｜Custom AI Provider

- [ ] Add AI Provider settings UI.
- [ ] Support OpenAI, Gemini, OpenRouter and Custom Endpoint settings.
- [ ] Store key locally in browser for Open Beta.
- [ ] Add mock or real `analyzeReference`, `generatePrompt`, and `analyzeCollage` adapter methods.

## Phase 6｜Collage Board MVP

- [ ] Add Collage board list.
- [ ] Add lightweight board editor.
- [ ] Support adding images, text notes and basic export.
- [ ] Prepare future AI summary and image generation hooks.

## Phase 7｜Open Beta Testing

- [ ] Run 3–5 lightweight user tests with design-related users.
- [ ] Collect feedback and Bad Cases.
- [ ] Validate whether users create My Archive items, connect AI Provider, save references or use Collage.

## Later｜Commercialization And Advanced AI

- [ ] Decide Hosted AI / Pro / Team pricing after Open Beta evidence.
- [ ] Add hosted API, usage tracking and rate limits only after demand is validated.
- [ ] Explore text-to-image, image-to-image, Collage-to-image and team workspaces.
