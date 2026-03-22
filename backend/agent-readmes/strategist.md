# Strategist Agent — dialed-strategist

**Intervention planning agent that decides what to do when brain rot is confirmed.**

## Overview

The Strategist receives the Boss Agent's aggregated verdict and decides the severity and type of intervention to execute. It maps confidence levels and session states to an escalation matrix, choosing between passing, warning overlays, content replacement, and account blocking. It also tracks intervention fatigue to avoid overwhelming the user.

## Address

```
agent1qd8242mvr59znudzpvu4umjm5swlhdd46q3khwx9xcrvnz37vwv2vza9mwn
```

## What It Does

1. **Receives a `BossVerdict`** containing `is_brain_rot`, `final_confidence`, `detected_tactics`, and `session_state`.
2. **Applies the escalation matrix**:
   - **ALERT state or confidence ≥ 0.9** → Critical intervention (full overlay)
   - **ELEVATED state or confidence ≥ 0.7** → High severity intervention
   - **Confidence ≥ 0.5** → Medium severity intervention
   - **Below threshold** → Pass (no intervention)
3. **Generates an `InterventionOrder`** with the intervention type, severity level, and overlay message.
4. **Records the intervention** in session memory (affects the Context Agent's fatigue tracking).

## Escalation Matrix

| Session State | Confidence | Action | Severity |
|--------------|-----------|--------|----------|
| ALERT | ≥ 0.9 | Full overlay | Critical |
| ELEVATED | ≥ 0.7 | Overlay | High |
| NORMAL | ≥ 0.5 | Overlay | Medium |
| Any | < threshold | Pass | Low |
| COOLDOWN | Any below 0.9 | Suppressed | — |

## Message Types

| Direction | Model | Description |
|-----------|-------|-------------|
| **Receives** | `BossVerdict` | Aggregated verdict from Boss |
| **Returns** | `InterventionOrder` | `intervention_type`, `severity`, `overlay_message` |

## Chat Protocol

Supports `ChatMessage` and `ChatAcknowledgement` for Agentverse and user-facing chat. Responds with details about the last intervention, escalation logic, and current decision rationale.

## Tech

- **Framework**: Fetch.ai uAgents v0.24
- **Network**: Testnet
- **Mailbox**: Enabled
- **Protocol**: Chat Protocol (Agentverse-compatible)

## Part of Dialed

Dialed is an autonomous social media defense system. The Strategist is the shield — it translates detection into action, deciding exactly how aggressively to protect the user based on the full session context.
