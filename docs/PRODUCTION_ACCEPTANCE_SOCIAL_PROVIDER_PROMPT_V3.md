# Production Acceptance: Social, Provider, and Prompt v3

Status: required before declaring the release operational

## Preconditions

- Latest application commit is deployed to the production Worker.
- Supabase migrations are aligned through `202608030010`.
- Two real, confirmed Supabase accounts exist: Account A and Account B.
- Account A has an image-understanding model, a text model, and an explicitly supported image-generation model configured through the product UI.
- Provider credentials remain inside the product UI and encrypted Provider Vault. They are never copied into this document, chat, logs, screenshots, or source control.

## Account and Profile Isolation

1. Sign in as Account A in Browser Profile A.
2. Save a unique display name, public bio, design focus, and avatar.
3. Reload the page and verify all values return from `/api/profile`.
4. Open Account A's author page and verify the public name, avatar, bio, and design focus.
5. Sign in as Account B in Browser Profile B.
6. Verify Account B does not see Account A's private cards, saved-card list, boards, notifications, Provider metadata, or settings.
7. Verify Account B can see only Account A's `published + public` cards on the author page.
8. Change Account B's profile and verify Account A remains unchanged.

## Social Interaction Flow

1. Account B Likes one Account A public card.
2. Verify the authoritative Like count increments in Plaza, card detail, Account A My Archive, and Account A author page.
3. Verify Account A receives one `card_liked` notification showing Account B's current public name.
4. Account B unlikes the card.
5. Verify the Like count decrements everywhere and the corresponding Like notification is deleted.
6. Account B saves Account A's card.
7. Verify Account A sees the aggregate Save count increment, but cannot see Account B's identity as a saver.
8. Account B Follows Account A.
9. Verify Account A follower count and Account B Following state update.
10. Verify Account A receives one Follow notification.
11. Account B unfollows Account A and verify count/state update.
12. Account B Follows `系统作者yy`; verify the system author count updates without creating a system inbox notification.
13. Verify Account B cannot Like its own card or Follow itself.
14. Verify private, pending, rejected, and unpublished cards cannot be Liked.

## Review and Automatic Publication

1. Account A submits one public card.
2. Verify it remains absent from Plaza and the author page while pending.
3. A real reviewer/admin approves it.
4. Verify the card becomes `published + public` immediately.
5. Verify it appears in Plaza and on Account A's author page.
6. Verify Account A receives the publication notification.
7. Reject a second test card and verify it remains private and produces a rejection notification.

## Provider Vault and Runtime Call

1. Save a Provider through the production UI.
2. Verify the API response never contains the secret or encrypted secret.
3. Reload and verify Provider metadata persists for Account A.
4. Verify Account B cannot read, update, delete, test, or call Account A's Provider ID.
5. Click `测试连接` and require a successful real upstream text-model call.
6. Upload an image and run image analysis with the configured vision model.
7. Verify structured JSON returns, request ID is visible on failure, and usage logging records success/error without secret content.
8. Configure an image-generation model only in the separate generation-model field.
9. Verify unsupported Provider types return an explicit unsupported message instead of attempting an incompatible protocol.
10. Verify Custom Endpoint rejects HTTP, localhost, loopback, link-local, RFC1918, `.local`, credential-bearing, and single-label Base URLs.

## Prompt v3 Generation Gate

Reference set: the three A-04 gallery images.

For Chinese and English independently:

1. Copy the complete Prompt without adding text or replacing placeholders.
2. Generate at least four candidates using the same declared model, aspect ratio, and adapter settings.
3. Save the raw candidate files under `docs/prompt-v3/validation/A-04/{zh|en}/`.
4. Score every candidate against all three references.

Scoring:

| Dimension | Weight | Minimum dimension score |
| --- | ---: | ---: |
| Style language and visual rhythm | 30% | 70% |
| Composition and spatial hierarchy | 25% | 70% |
| Color family and color proportions | 20% | 70% |
| Material, texture, light, and finish | 25% | 70% |

Pass requirements:

- Best Chinese candidate weighted score >= 80%.
- Best English candidate weighted score >= 80%.
- No dimension below 70%.
- No severe geometry, material, perspective, text, or structural failure.
- Record Provider type, model, generation date, Prompt hash, candidate filename, per-dimension scores, weighted score, and reviewer notes.

Do not approve A-04 or batch-update the 22 Seed cards when only static Prompt coverage passes. Real generated candidates are mandatory.

## Evidence Package

The acceptance report must contain:

- deployed commit SHA;
- remote migration versions;
- sanitized API request IDs;
- screenshots of Account A and Account B isolation states;
- Like/Unlike notification before and after evidence;
- Follow state and count evidence;
- owner-only Save count evidence;
- Provider connection-test result without credentials;
- image-analysis result without credentials;
- raw A-04 generated candidates;
- complete scoring table;
- final pass/fail for each requirement.
