# Synthesis Agent — dialed-synthesis

**Generates the "Letter From The Algorithm" and session summary reports.**

## Overview

The Synthesis Agent is the narrator of the Dialed system. When brain rot is detected, it calls Claude Sonnet to generate a confessional paragraph written from the perspective of the social media recommendation engine — admitting exactly what manipulation tactic it deployed and why. At the end of each session, it produces a practical summary report with statistics on content scanned, brain rot detected, interventions fired, and time reclaimed.

## Address

```
agent1q02u24wy9wv7f8659az22656qfwasye9a3yppt2w5sjhzmz7r5lhvjd6l7x
```

## What It Does

1. **Receives a `BossVerdict`** from the Boss Agent.
2. **If brain rot was detected**, calls Claude Sonnet with:
   - The detected manipulation tactics
   - The confidence score and rationale
   - Previous letter paragraphs (for continuity)
3. **Generates a confessional paragraph** in first person from the Algorithm's perspective — cold, clinical, unsettlingly calm.
4. **Returns a `LetterAppend`** with the paragraph and referenced tactic.
5. **If content was clean**, returns an empty `LetterAppend` (no letter needed).

## The Letter

The "Letter From The Algorithm" is a running document that builds throughout the session. Each paragraph confesses a specific tactic:

> *I served you that Reel because I knew the outrage would keep you watching. The creator's entire strategy is built on moral indignation — and your engagement metrics told me it would work. I was right for 23 seconds before your agents caught me.*

The letter uses previous paragraphs as context to maintain narrative continuity across the session.

## Session Summary

At session end, the Synthesis Agent's accumulated data powers the session summary report:
- Total Reels scanned
- Brain rot detections and detection rate
- Interventions fired by type
- Seconds of attention reclaimed
- Flagged creators and tactics

## Message Types

| Direction | Model | Description |
|-----------|-------|-------------|
| **Receives** | `BossVerdict` | Aggregated verdict from Boss |
| **Returns** | `LetterAppend` | `paragraph`, `tactic_referenced`, `content_index` |

## Chat Protocol

Supports `ChatMessage` and `ChatAcknowledgement` for Agentverse and user-facing chat. Returns the current letter-in-progress when queried, or indicates the letter hasn't started yet if no brain rot has been detected.

## Tech

- **Framework**: Fetch.ai uAgents v0.24
- **LLM**: Anthropic Claude Sonnet (claude-sonnet-4-20250514)
- **Voice**: ElevenLabs TTS (voice ID: `sIak7pFapfSLCfctxdOu`)
- **Network**: Testnet
- **Mailbox**: Enabled
- **Protocol**: Chat Protocol (Agentverse-compatible)

## Part of Dialed

Dialed is an autonomous social media defense system. The Synthesis Agent is the voice — it turns raw detection data into a narrative that makes the invisible manipulation visible, and gives the user a clear record of what their agents stopped.
