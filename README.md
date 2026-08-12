# GlacierEQ Command Center

APEX / AKOS **operating plane** for multi-connector work.

## Purpose

Stop tool-hopping. One static surface that:

- Shows connector fleet health from `supabase-glaciereq`
- Encodes operator **intents** (copy-ready agent prompts)
- Maps MCP domains / connectors
- Tracks gaps + system registry
- Links GitHub · Vercel · Supabase · AKOS

## Stack

| Layer | System |
|-------|--------|
| Surface | Vercel static |
| Truth | GitHub `GlacierEQ/command-center` |
| State | Supabase `supabase-glaciereq` (`kjebemdgvjvuutzvhbtp`) |
| Tool mesh | Smithery + native connectors |

## Local

```bash
npx serve .
```

## Config

`config.js` holds public Supabase URL + anon key. **RLS is the security boundary.** Legal/court/evidence tables stay locked from anon.

## Migration

See `supabase/migrations/20260812_ops_plane.sql`.

## Operator loop

1. Open plane
2. Triage fleet
3. Pick intent
4. Run agent with `@GitHub @Vercel @Supabase @Smithery`
5. Verify gaps closed with evidence
