# Social Interactions Plan

Status: implementation plan
Scope: card likes, author profiles, follows, notifications, and owner-facing engagement statistics

## Product Principles

1. Save and Like are different actions.
   - Save is private organization: only the saving user can see it.
   - Like is public appreciation: the count is visible and the card author can be notified.
2. Only published public cards participate in public Likes and public author pages.
3. Private cards can show their owner the eventual Like count, but other users cannot access or Like them before publication.
4. Users cannot Like their own cards or Follow themselves.
5. A repeated Like or Follow is idempotent. One user contributes at most one active Like per card and one active Follow per author.
6. Notifications are created by trusted database functions or server routes, never by arbitrary client inserts.
7. Seed cards use the controlled author identity `系统作者yy`. This identity is not a fake end-user account.

## Information Architecture

### Workspace Header

Add a message icon button immediately before the account control.

- Bell icon with unread count badge.
- Click opens a compact notification panel.
- `View all` opens `/notifications`.
- Badge is hidden at zero.
- The button remains visible on desktop and mobile.

### Card Detail

Keep the author block at the bottom-left of the gallery column.

```text
[avatar] Author name
         Role / identity

[Like icon] 128
```

Behavior:

- Avatar and name open `/authors/{public_profile_id}`.
- Like button is available only for authenticated users and published public cards.
- Anonymous click redirects to `/auth?next=...`.
- Own card shows the count but disables Like with a tooltip.
- Private/unpublished card shows owner-only count `0` or the retained historical count, but no Like action.

### Public Plaza Cards

Add a small Like count next to the author attribution in the card footer. Keep Save as a separate private action.

- Clicking the heart toggles Like without opening the card.
- Clicking the author opens the author page.
- Card keyboard behavior must preserve focus and stop event propagation for both controls.

### My Archive

Each card row/card shows an owner analytics strip:

```text
Public status · 128 Likes · 24 Saves (optional, private metric) · Updated date
```

Phase 1 should expose Likes only. Save counts should not be exposed until a clear privacy policy is approved because Save is currently defined as private organization.

### Author Page

Route: `/authors/[id]`

First viewport:

- Avatar, display name, role/identity, short bio, design focus.
- Follow / Following button.
- Published card count, follower count, following count.
- No email or private contact data.

Content:

- Published public cards only.
- Sort: newest, most liked.
- Filter: category.
- Empty state for authors with no public cards.
- Pagination or cursor loading after 24 cards.

Own profile behavior:

- Follow button is replaced by `Edit profile`.
- Owner can see a private link back to My Archive.
- Draft, pending, rejected, and private cards never appear on the public author page.

### Notifications Page

Route: `/notifications`

Notification types:

- `card_liked`
- `author_followed`
- `card_approved`
- `card_rejected`
- `card_published`
- `card_unpublished`

Grouping:

- Multiple likes on one card within a time window can display as `3 people liked your card`.
- Follow events remain individual initially.
- Review notifications include the card and reviewer note when allowed.

Actions:

- Mark one as read.
- Mark all as read.
- Click notification opens the relevant card, author, or Review Queue state.

## Data Model

Create a new migration after `202608030006`.

### Public Profile Fields

Extend `profiles`:

```sql
alter table public.profiles
  add column if not exists public_id uuid unique default gen_random_uuid(),
  add column if not exists bio text,
  add column if not exists design_focus text,
  add column if not exists is_public boolean not null default true,
  add column if not exists is_system boolean not null default false;
```

Do not expose `profiles.id` as the public URL identifier. `id` is the Auth user ID; use `public_id` in author routes.

Add a controlled system author record or a dedicated `authors` table. Preferred approach:

```text
auth-backed user authors -> profiles
system/curated authors    -> authors
```

For a simpler first release, create a dedicated `public.authors` table that can reference a Profile optionally:

```sql
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  slug text unique not null,
  display_name text not null,
  avatar_url text,
  identity_label text not null default 'Creator',
  bio text,
  design_focus text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Insert one controlled row:

```text
slug: system-author-yy
display_name: 系统作者yy
identity_label: 系统策展
is_system: true
```

Add `author_id` to `aesthetic_cards` and backfill:

- Existing Seed cards -> `系统作者yy`.
- Existing user cards -> author row linked to `owner_id` Profile.
- New cards -> server assigns the authenticated user's author row.

The server must assign `author_id`; clients cannot select an arbitrary author.

### Card Likes

```sql
create table public.card_likes (
  card_id uuid not null references public.aesthetic_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
```

`author_id` is denormalized for efficient owner notification and analytics, but the server/database function must derive it from the card. Never trust a client-supplied author ID.

Indexes:

```sql
create index card_likes_author_created_idx on public.card_likes(author_id, created_at desc);
create index card_likes_card_created_idx on public.card_likes(card_id, created_at desc);
```

### Follows

```sql
create table public.author_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id)
);
```

Prevent self-follow through a trusted function that resolves `authors.profile_id`. A plain check constraint cannot safely compare these two identities.

### Notifications

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  card_id uuid references public.aesthetic_cards(id) on delete cascade,
  author_id uuid references public.authors(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

Constraints:

- `type` limited to the approved notification types.
- Recipient cannot equal actor for Like/Follow events.
- Payload contains display hints only, never secrets, email, Provider data, or authorization details.

Indexes:

```sql
create index notifications_recipient_unread_idx
  on public.notifications(recipient_id, created_at desc)
  where read_at is null;
```

### Counts

Do not maintain mutable `like_count` and `follower_count` columns in Phase 1. Query counts through indexed aggregate views or RPC functions to avoid drift.

If production volume later requires cached counters, update them through database triggers and add reconciliation checks.

## Security and RLS

### Authors

- Anyone can select public author fields.
- Authenticated users can update only the author row linked to their own Profile.
- System authors are admin-managed only.
- Email, contact, Supabase Auth ID, Provider data, and private Profile fields are never selected by public endpoints.

### Likes

- Anyone can read aggregate counts for published public cards.
- Authenticated users can read whether they personally liked a card.
- Authenticated users can Like only published public cards they do not own.
- Users can delete only their own Like.
- Direct inserts should be replaced by `like_card(card_id)` security-definer RPC or a server API using an admin client after ownership/publication checks.

### Follows

- Anyone can read follower/following aggregate counts.
- Authenticated users can read their own Follow state.
- Users can Follow public non-self authors.
- Users can delete only their own Follow.

### Notifications

- A user can select and mark read only notifications where `recipient_id = auth.uid()`.
- Browser clients cannot insert notifications.
- Trusted Like, Follow, and review operations create notifications.
- Admin cannot read user notifications by default unless a documented support requirement is added.

## API Design

### Authors

```text
GET /api/authors/{publicId}
GET /api/authors/{publicId}/cards?sort=newest&cursor=...
```

Response contains public author fields, counts, viewer Follow state, and published cards only.

### Likes

```text
POST   /api/cards/{cardId}/like
DELETE /api/cards/{cardId}/like
```

Response:

```json
{
  "data": {
    "liked": true,
    "likeCount": 128
  }
}
```

The operation and returned count must be one transaction/RPC to avoid races.

### Follows

```text
POST   /api/authors/{publicId}/follow
DELETE /api/authors/{publicId}/follow
```

Response includes `following` and `followerCount`.

### Notifications

```text
GET   /api/notifications?cursor=...
PATCH /api/notifications/{id}
PATCH /api/notifications/read-all
```

Header unread badge can use:

```text
GET /api/notifications/unread-count
```

Do not poll every few seconds initially. Fetch on app load, tab focus, and after relevant mutations. Add Supabase Realtime only after the base flow is correct.

## Event Flow

### Like

1. Viewer clicks Like.
2. UI optimistically updates only after request dispatch, with rollback on failure.
3. Server verifies authentication.
4. Server loads card and checks `visibility = public`, `publish_status = published`, and viewer is not owner.
5. Transaction inserts `card_likes` using `on conflict do nothing`.
6. Transaction creates one notification only when a new Like row was inserted.
7. API returns authoritative Like state and count.
8. Author sees count in My Archive and an unread notification.

Unlike deletes the Like but does not delete the historical notification in Phase 1. The notification represents an event that occurred; repeated Like after Unlike can be rate-limited or deduplicated by a time window.

### Follow

1. Viewer opens author page from card avatar/name.
2. Viewer clicks Follow.
3. Server rejects self-follow and system authors if Following system authors is not desired.
4. Insert is idempotent.
5. New insert creates `author_followed` notification for user-backed authors.
6. UI updates follower count from authoritative response.

Decision required: allow Following `系统作者yy` or disable it. Recommended: allow it only if the product will later use Following to build a personalized feed; otherwise disable with `System author` status.

### Review Notifications

Extend existing review routes:

- approval/rejection/publish/unpublish writes a notification for the card owner in the same trusted server operation;
- notification payload can contain a sanitized review note;
- reviewer/admin identity is shown only according to the moderation policy.

## Interaction States

Every Like and Follow control requires:

- anonymous;
- authenticated idle;
- own-content disabled;
- loading;
- active;
- server error with rollback;
- unavailable/private/unpublished;
- count unavailable fallback.

Notification UI requires:

- zero unread;
- unread badge 1-99;
- `99+` overflow;
- loading skeleton;
- empty state;
- partial API failure;
- mark-read failure.

## Migration and Rollout

### Phase 1: Data and Read Models

1. Create authors, likes, follows, notifications.
2. Add `author_id` to cards.
3. Backfill Seed cards to `系统作者yy`.
4. Backfill user cards to user-backed authors.
5. Add RLS, constraints, indexes, and RPC functions.
6. Audit migration with dry-run before linked production push.
7. Add author and Like aggregates to card API responses.

### Phase 2: UI and Routes

1. Add Like control in detail gallery and Public Plaza cards.
2. Add owner Like counts in My Archive.
3. Make author avatar/name clickable.
4. Build `/authors/[id]` page with Follow.
5. Add notification bell and `/notifications` page.
6. Add bilingual copy and responsive states.

### Phase 3: Event Integration

1. Create Like and Follow notifications transactionally.
2. Add review notifications.
3. Add unread count refresh on focus and mutations.
4. Add Realtime only if needed.
5. Add abuse controls and rate limits.

## Abuse and Privacy Controls

- Rate-limit Like/Unlike and Follow/Unfollow toggling.
- Do not expose a public list of users who saved a card.
- Decide whether the public list of users who liked a card is needed; default is count only.
- Do not expose follower email, contact, Auth ID, or private activity.
- Add block/mute/report capabilities before enabling comments or direct messaging. This plan does not include direct user-to-user messages.
- `Message` in this scope means notifications, not direct messaging.

## Acceptance Tests

1. A user cannot Like their own card.
2. A user cannot Like private, pending, rejected, approved-but-unpublished, or unpublished cards.
3. Repeated Like requests produce one Like row and one count increment.
4. Unlike removes only the current user's Like.
5. Like count is identical in Plaza, detail, My Archive owner metrics, and author page.
6. A new Like creates one notification for the author and no notification for the actor.
7. A user cannot Follow themselves.
8. Repeated Follow requests produce one Follow row.
9. Author page exposes only published public cards.
10. Public author responses contain no email, contact, Auth ID, Provider data, or private cards.
11. Notifications are readable only by their recipient.
12. Seed cards resolve to `系统作者yy`.
13. Deleting a card removes Likes and related card notifications according to foreign-key behavior.
14. Deleting an account removes its Likes/Follows and preserves or anonymizes notifications according to policy.
15. Mobile header, card controls, author page, and notification panel do not overlap or wrap incoherently.

## Confirmed Product Decisions

1. Users can Follow `系统作者yy`; because it is not an Auth user, it accumulates follower counts but has no notification inbox.
2. Like totals are visible, but the liker list is not exposed. A Like notification identifies only the actor associated with that event.
3. Unlike deletes the Like notification through `notifications.like_id -> card_likes.id on delete cascade`.
4. Authors can see aggregate Save counts for their own cards. Saver identities remain private.
5. Reviewer approval immediately sets the card to `published + public`; it then appears on the author page.
6. Public author routes use immutable `public_id` UUID values in Phase 1.
