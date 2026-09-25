<!-- HQ-SESSION-GUARD v1 (managed from ScrapeUnblocker/headquarters - do not remove) -->
# HQ SESSION GUARD (Claude - MANDATORY, READ FIRST)

This repo is part of the ScrapeUnblocker ecosystem. All development on it is governed by the central
`headquarters` repo (`ScrapeUnblocker/headquarters`) - its CLAUDE.md carries the global rules
(branch/push policy, lint gates, credentials handling, worklog, deploy runbooks).

- **If the headquarters CLAUDE.md IS loaded in your context** (the session was started from the local
  `headquarters` folder - you can see its "ScrapeUnblocker - Valdymo pultas (Headquarters)" instructions),
  this guard is satisfied: work normally under those rules.
- **If it is NOT loaded** (Claude was launched directly in this repo or anywhere else): treat this repo as
  **READ-ONLY**. Do NOT edit files, do NOT commit, do NOT push, do NOT create branches or tags, and do NOT
  run deploys from here. Tell the developer: ScrapeUnblocker development sessions must be started from the
  local `headquarters` folder (clone of `ScrapeUnblocker/headquarters`) so the global rules load - then stop.
- Reading, searching, running read-only commands and explaining code is always allowed.
- **Exemption:** sanctioned headless server agents (self-heal / scout / parts-monitor / no-code crawler etc.
  running on our servers) follow their own playbooks and are NOT bound by this guard.

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A published [n8n community node](https://docs.n8n.io/integrations/community-nodes/) (npm package `n8n-nodes-scrapeunblocker-tiktok`) that runs ScrapeUnblocker's public **TikTok Scraper** Actor on Apify (`scrapeunblocker/tiktok-scraper`, Actor ID `KvGOw39OlzDUdbzdw`) with the **user's own Apify API token** and returns the run's dataset items. Monetization stays on Apify (pay-per-result on the user's Apify account); the node itself is free. **TypeScript**, built and released with the `@n8n/node-cli` toolchain.

It is one of a family of per-Actor nodes (one public repo + npm package per Apify Actor). Keep `GenericFunctions.ts` identical across them so a fix can be copied everywhere.

## Commands

```bash
npm run build        # n8n-node build -> dist/
npm run dev          # local n8n with this node hot-loaded
npm run lint         # n8n community-node lint rules (the correctness gate; CI runs it)
npm run lint:fix
npm run release      # n8n-node release (release-it: bump, changelog, tag, push)
```

There is no unit test suite; verify changes end to end in a real n8n (docker `n8nio/n8n` with `N8N_CUSTOM_EXTENSIONS` pointing at this folder) against a real Apify run.

## Architecture

- **`nodes/TikTokScraper/TikTokScraper.node.ts`** - node description (Resource + Operation UI) and `execute()`. `buildActorInput()` maps the chosen operation to the Actor's input keys (`profiles`, `video_urls`, `hashtags`, `search_queries`, `comment_urls`, their `max_*` limits, `video_details`, `include_summary_records`, `proxy_country`). Only the fields of the chosen operation are sent. One Actor run per n8n input item; every dataset item becomes one output item paired to that input.
- **`nodes/TikTokScraper/GenericFunctions.ts`** - Actor-agnostic Apify client: start run (`POST /v2/acts/{id}/runs`), long-poll `GET /v2/actor-runs/{id}?waitForFinish=60` until a terminal status, then page through `GET /v2/datasets/{id}/items`. Non-`SUCCEEDED` runs throw with a Console link and the number of results already saved.
- **`credentials/ApifyApi.credentials.ts`** - `apifyApi` credential, `apiKey` sent as `Authorization: Bearer`. Name, property and scheme deliberately match the official Apify n8n node, so an existing "Apify API" credential works here too. Do not rename it.

### Conventions that matter here

- All Apify calls go through `httpRequestWithAuthentication` (lint rule `no-http-request-with-manual-auth`). n8n attaches the execution cancel signal to those requests, so a cancelled execution cannot send `/abort` to Apify - the README documents that the run keeps going.
- Errors: wrap in `NodeApiError` / `NodeOperationError` (lint rule `require-node-api-error`), respect `continueOnFail()`.
- `usableAsTool: true` - parameter descriptions are read by AI agents, keep them accurate.
- Icons are SVG with light/dark variants next to the class that references them.

## Releasing

Same flow as `n8n-nodes-scrapeunblocker`: change on a branch, update the README "Version history", `npm run lint` + `npm run build` + `npm publish --dry-run --ignore-scripts`, PR -> `main`, then on `main` run `GITHUB_TOKEN="$(gh auth token)" CI=true npm run release`. The tag triggers `.github/workflows/publish.yml`, which publishes to npm with provenance (npm trusted publishing / OIDC).
