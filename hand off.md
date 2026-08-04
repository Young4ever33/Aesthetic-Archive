# Aesthetic Archive Hand Off

Updated: 2026-08-04
Project root: `A:/04-Pi Agent/01_Projects/05_AI产品优化/aesthetic-archive`
Repository: `https://github.com/Young4ever33/Aesthetic-Archive`
Production: `https://aesthetic-archive.laverneyue33.workers.dev`

## Current Release State

Cloudflare Git remains the only production deployer. GitHub Actions performs checks and the Ubuntu OpenNext Worker build only. Do not add Wrangler deployment credentials or a second deployment path.

Production unauthenticated smoke checks pass. Production HTML, JavaScript, and CSS have been checked directly rather than inferred from a successful deployment. Authenticated moderation, Like, Provider, and two-account acceptance still require real browser sessions and must not be marked complete until their state-changing actions are observed.

The local worktree should contain only the intentionally untracked `Prompt Test images/` directory after committed changes are pushed. Do not commit or delete that directory.

## Implemented Behavior

### Moderation

- `profiles.role` is resolved through the server-side admin context.
- Only `reviewer` and `admin` can load or act on the review queue.
- Regular users cannot expose moderation by using `?tab=reviews`.
- Pending and rejected cards are loaded with signed private image URLs.
- Reviewers cannot review their own cards on either moderation API path.
- Unsupported review actions are rejected.
- Approval writes `publish_status = published`, `visibility = public`, an audit row, and an author notification.
- If the audit insert fails, the card update is rolled back to its prior state.

### Likes and notifications

- Seed cards use registered `system_cards.card_key` values; user cards use UUIDs.
- All 22 frontend Seed IDs match the production migration registry.
- Like and unlike are idempotent through `toggle_card_like`.
- Own user cards cannot be Liked.
- Unlike deletes the Like and its cascaded notification.
- A failure in cards, Saved, or board synchronization no longer marks the entire account offline or disables Likes.
- Like failures show the server code and request ID.

### Collage Board

- A selected gallery image is stored on the board node and takes precedence over the card cover.
- The image picker is viewport-contained and closes before the detail panel when Escape is pressed.
- The desktop right rail uses one vertical scroll container; Inspector and element list no longer compete for fixed heights.
- Mobile restores natural single-column height and page scrolling.

### AI card analysis

- Up to six JPG, PNG, or WebP references are sent in one Provider request.
- Original uploaded image bytes are read without client-side resize, JPEG conversion, or quality reduction.
- The Provider prompt requires per-image inspection before synthesis and forbids moving a subject or property from one image into another.
- Title and prompts must represent the complete image set.
- Unverified cultural attribution is labeled as requiring verification.
- Design elements, composition, and use cases have separate responsibilities.
- Duplicate phrases are removed within and across structured fields.
- Palette values are unique hexadecimal colors.
- Invalid generic titles, missing core fields, or mixed-language Prompts reject the draft instead of filling the form.
- Existing malformed saved cards are not automatically repaired; they must be re-analyzed with the original image set or deleted.

### Card detail contract

Left side:

- Aesthetic Background / 风格背景 only.
- It uses the saved cultural/aesthetic background, never the summary as a substitute.
- Unknown cultural origin is explicitly marked as requiring verification.

Right side, fixed order:

1. Design Elements / 设计要素
2. Composition / 构图方式
3. Palette / 色卡
4. Use Cases / 使用场景
5. Chinese Prompt / 中文提示词
6. English Prompt / 英文提示词

The opposite-language title is hidden. Palette entries show one hex value only. Negative Prompt data remains stored for generation and export but is not a separate detail column.

### Provider request policy

Provider calls are submitted once and awaited until the upstream responds. The application has no AbortController deadline, automatic retry, image-quality reduction, or local substitute AI result. Do not configure `AI_REQUEST_TIMEOUT_MS`.

An upstream gateway can still return its own 504 or unavailable response; the application cannot override the Provider's deadline.

## Production Evidence

The production workspace loads fingerprinted static paths rather than query-string cache busting. Cloudflare was observed ignoring query parameters for old static assets, so new releases must use a new asset path or content-hashed build output.

The following were verified against production responses after deployment:

- workspace HTML contains the fixed six-field card detail order;
- moderation JavaScript uses the current server-confirmed access state;
- multi-image analysis sends an `images` array;
- Like requests are isolated from unrelated workspace synchronization failures;
- Collage Board CSS uses a single scrolling right rail;
- unauthenticated profile and review APIs return `401`;
- homepage and auth page return `200`;
- `/app` redirects unauthenticated users to `/auth`;
- security headers are present.

## Required Authenticated Acceptance

Use two real accounts: one ordinary author and one separate reviewer. Do not bypass permissions and do not let the reviewer approve their own card.

1. Author submits a public card and sees Pending Review.
2. Reviewer opens `/app?tab=reviews` and sees the queue and signed images.
3. Reviewer approves one card.
4. Confirm the queue decreases and the response is successful.
5. Confirm the card is `published + public` and appears in Public Plaza.
6. Confirm the author receives a publication notification showing the reviewer actor.
7. From the other account, Like and unlike the published card.
8. Confirm the total count changes and unlike removes the Like notification.
9. Open Collage Board at desktop and mobile sizes and inspect all right-rail controls.
10. Re-analyze a three-image set with the configured Provider and confirm the resulting title, background, six fields, and bilingual Prompts describe the complete set without repeated sections.

## China Network and Custom Domain

The current machine resolves the `workers.dev` hostname to `198.18.0.61`, an address in a benchmarking/test range, showing that the current network does not provide trustworthy `workers.dev` resolution. Application code cannot repair DNS interception or regional reachability.

Before China-network release:

1. Choose a user-owned domain managed in Cloudflare DNS.
2. Add a dedicated hostname such as `archive.example.com` as the Worker custom domain.
3. Add `https://archive.example.com/auth/callback` to Supabase Auth redirect URLs before moving traffic.
4. Update the Supabase Site URL when the custom hostname becomes canonical.
5. Update OpenRouter referer metadata and application documentation.
6. Test DNS, TLS, homepage, authentication callback, APIs, and Provider outbound requests from at least two independent mainland networks.

Do not point production to an unowned or temporary domain.

## Validation Commands

```bash
node --check public/local-mvp/app.js
pnpm lint
pnpm typecheck
pnpm build
pnpm smoke:production -- https://aesthetic-archive.laverneyue33.workers.dev
git diff --check
git status --short --branch
```

The authoritative OpenNext Worker build runs on GitHub Ubuntu. Local Windows can fail at symlink creation even when the Next.js build succeeds.

## Known Remaining Acceptance Work

- A real reviewer approval has not yet been observed from an authenticated browser session.
- A real production Like/unlike has not yet been observed after the latest client isolation change.
- The new multi-image contract has not yet completed a real Agnes response using the user's Provider key.
- Twenty-one Seed cards remain `static-pass-generation-pending` and require real generation review.
- A China-reachable custom domain is not configured because no owned hostname has been selected.
