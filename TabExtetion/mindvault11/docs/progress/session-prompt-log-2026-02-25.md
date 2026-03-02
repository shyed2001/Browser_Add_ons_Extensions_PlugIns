# Session Prompt Log — 2026-02-25 (Session 4)

## Prompts

**P1** — Continue from context limit. Fix Firefox tab detection. Make extension work all browsers. Phase 3 web UI. Session/prompt logs. Update changelog + all ref docs. Small steps. Don't waste tokens.

**P2** — "Don't waste tokens" — continue finishing docs + commit.

## Decisions
| Decision | Rationale |
|---|---|
| Drop MAUI, use companion web UI | 2 installs vs 3; any browser; PWA-installable |
| `lastFocusedWindow` not `currentWindow` | Firefox popup resolves currentWindow to popup's own window |
| Reflect CORS origin header | One pattern handles chrome-extension, moz-extension, localhost |
| Go `embed` in server.go | Single binary, no extra deploy step |
| Browser detection in installer | Only register native messaging for installed browsers |
