# Context Agent — dialed-context

**Adaptive session state machine that tracks brain rot exposure over time.**

## Overview

The Context Agent maintains awareness of the entire session — how much brain rot the user has been exposed to, how fatigued the intervention system is, and whether detection thresholds need to tighten or relax. It operates a four-state machine (NORMAL → ELEVATED → ALERT → COOLDOWN) and dynamically adjusts the confidence threshold that the Boss uses to make final decisions.

## Address

```
agent1q0wasn6e8ggs7nhxcx5f3gxvvj2ume8e5ndmfegujfgpka9x48xxyu5zm9h
```

## What It Does

1. **Receives a `ContentPayload`** from the Boss Agent (in parallel with the Classifier).
2. **Evaluates session state** based on:
   - Brain rot density in the last 10 items
   - Number of interventions fired in the last 60 seconds (fatigue)
   - Current state and threshold
3. **Transitions between states**:
   - **NORMAL** (threshold 0.70) — Default state, standard detection
   - **ELEVATED** (threshold 0.50) — Brain rot density > 30%, more aggressive flagging
   - **ALERT** (threshold 0.30) — Brain rot density > 50%, near-zero tolerance
   - **COOLDOWN** (threshold 0.90) — Too many interventions fired, temporarily suppressing to avoid fatigue
4. **Returns a `ContextAssessment`** to the Boss with the current state, adjusted threshold, and fatigue score.

## State Machine

```
          brain rot > 30%           brain rot > 50%
NORMAL ─────────────────► ELEVATED ──────────────────► ALERT
  ▲                          │                           │
  │    interventions ≤ 2     │    interventions > 5      │
  └──────────────────────────┘◄──────────────────────────┘
                             COOLDOWN
```

## Message Types

| Direction | Model | Description |
|-----------|-------|-------------|
| **Receives** | `ContentPayload` | Raw content data from Boss |
| **Returns** | `ContextAssessment` | `session_state`, `adjusted_threshold`, `intervention_fatigue_score`, `reasoning` |

## Chat Protocol

Supports `ChatMessage` and `ChatAcknowledgement` for Agentverse and user-facing chat. Returns current session state, threshold, brain rot density, and fatigue level when queried.

## Tech

- **Framework**: Fetch.ai uAgents v0.24
- **Network**: Testnet
- **Mailbox**: Enabled
- **Protocol**: Chat Protocol (Agentverse-compatible)

## Part of Dialed

Dialed is an autonomous social media defense system. The Context Agent is the memory — it prevents both under-reaction (missing brain rot in dense feeds) and over-reaction (intervention fatigue from too many flags).
