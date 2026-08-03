# Aesthetic Archive Production Contract

Status: Draft v1
Scope: cloud beta foundation after the local browser MVP

This document is the shared contract for authentication, persistence, AI Gateway, card quality, moderation, migration, and QA. It does not change the marketing page or restore the old client-side cloud implementation.

## 1. Security Boundary

```text
Browser -> authenticated application API -> server-side AI Gateway -> Provider
```

The browser may hold a session token and public card data. It must never hold a Provider API key, service-role key, encryption key, or unrestricted provider endpoint credential.

Provider secrets must be:

- accepted only over authenticated server requests;
- encrypted at rest or stored in a managed secret vault;
- resolved by authenticated `providerId` and owner;
- excluded from API responses, exports, client logs, analytics, and error messages;
- rotated and deleted through server-side operations.

The server must enforce request size, image MIME/type, model allowlists, timeout, rate limit, ownership, and normalized errors.

## 2. Identity and Roles

Required account states: `unverified`, `active`, `suspended`, `deleted`.

Required roles: `user`, `reviewer`, `admin`.

Required flows:

- sign up;
- email verification;
- sign in and sign out;
- password reset;
- expired-session recovery;
- profile update;
- account deletion policy;
- local workspace import after authentication.

Every private read and write is authorized against the authenticated user ID. Public reads are limited to cards with both `publish_status = approved` and `visibility = published`.

## 3. Card Contract

Card status is a server-owned state machine:

```text
draft -> ai_generated -> needs_review -> approved -> published
                                      |-> rejected
published -> unpublished
```

Only the owner may edit a private card. A published card is edited through a new version or an explicit unpublish/edit flow; an old published version must not silently change.

Every generated or edited card records:

- `template_id` and `template_version`;
- Provider and model metadata, without secrets;
- request ID and generation timestamp;
- source and rights status;
- confidence and review notes;
- current card status and version ID.

Minimum content fields:

```text
category
title
title_zh
summary
visible_facts
cultural_context
inferences
materials
lighting
geometry
typography
palette
composition
use_cases
prompt_zh
prompt_en
negative_prompt
confidence
review_notes
source
rights_status
```

`visible_facts` must describe evidence in the image. `cultural_context` and `inferences` must be explicitly marked as interpretation or uncertainty. The generator must not invent a designer, brand, location, date, provenance, or material.

## 4. AI API Contract

Initial server routes:

```text
POST /api/ai/analyze-image
POST /api/ai/generate-prompt
POST /api/ai/board-summary
```

Each request requires an authenticated session and a server-resolved provider owned by the user. Each response includes a non-secret `requestId`.

Success shape:

```json
{
  "requestId": "req_...",
  "data": {},
  "meta": {
    "providerType": "openai-compatible",
    "model": "allowed-model",
    "templateId": "system-default",
    "templateVersion": 1
  }
}
```

Error shape:

```json
{
  "requestId": "req_...",
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "The AI service did not respond in time.",
    "retryable": true
  }
}
```

Never return upstream response bodies, authorization headers, API keys, full image data, or private prompts in errors.

## 5. Moderation Contract

Automatic checks may flag:

- invalid schema;
- unreadable or missing images;
- empty or unusable Prompt fields;
- missing source or rights status;
- sensitive content;
- duplicate cards;
- low confidence;
- possible fabricated provenance.

Automatic checks cannot independently approve cultural accuracy, copyright, historical claims, or public release. High-risk flags require human review.

Every review records reviewer, action, reason, timestamp, previous status, and resulting status in an audit log.

## 6. Local Migration Contract

A local backup is versioned data, not an authenticated import command.

Import must:

- validate schema and version before writing;
- never import Provider secrets;
- require authentication;
- show a preview and conflict strategy;
- use an explicit `merge`, `skip`, or `replace` choice;
- preserve existing cloud data unless the user confirms replacement;
- provide an import report and recoverable failure behavior.

Provider records may be imported as metadata with an empty secret state. The user must re-enter a secret through the server-side vault.

## 7. Observability and Privacy

Record only the minimum metadata needed for operations:

- request ID;
- user ID or hashed operational identifier;
- route;
- provider and model name;
- status;
- duration;
- usage summary;
- normalized error code.

Do not log API keys, service-role keys, complete image Base64, private source images, or complete private Prompts unless the user explicitly submits them as feedback and the retention policy allows it.

Production must have health checks, error monitoring, backups, restore verification, alerts, and a documented rollback path.

## 8. Non-goals for the First Cloud Beta

Billing, team workspaces, marketplace features, realtime multiplayer boards, platform-funded AI credits, and advanced automated cultural moderation are out of scope until identity, data ownership, secret protection, and review operations are stable.
