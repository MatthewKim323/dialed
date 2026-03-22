# Boss Agent — dialed-boss

**Central orchestrator for the Dialed autonomous social media intervention system.**

## Overview

The Boss Agent is the central coordinator of the Dialed pipeline. Every piece of content extracted from the user's Instagram feed passes through the Boss first. It dispatches content to the Classifier and Context agents in parallel, aggregates their verdicts, and forwards the combined result to the Strategist and Synthesis agents for action planning and reporting.

## Address

```
agent1qvpy6yuxf0ezxusn559tsawh9ul29f4pncq84uudrwxmykxgg8epxtnj8rk
```

## What It Does

1. **Receives content payloads** from the FastAPI backend via a REST endpoint (`/content`).
2. **Fans out** the content to the Classifier (brain rot detection) and Context Agent (session state) simultaneously using `asyncio.gather`.
3. **Aggregates verdicts** — combines the classification confidence with the session-adjusted threshold to make a final `is_brain_rot` determination.
4. **Dispatches downstream** — sends the `BossVerdict` to the Strategist (intervention planning) and Synthesis (letter generation) in parallel.
5. **Returns the full pipeline result** back to FastAPI, which instructs the browser agent to act.

## Message Types

| Direction | Model | Description |
|-----------|-------|-------------|
| **Receives** | `ContentRequest` | Content payload from browser agent (via REST) |
| **Sends** | `ContentPayload` | Dispatched to Classifier + Context |
| **Receives** | `ClassificationVerdict` | Brain rot classification from Classifier |
| **Receives** | `ContextAssessment` | Session state from Context Agent |
| **Sends** | `BossVerdict` | Aggregated verdict to Strategist + Synthesis |
| **Receives** | `InterventionOrder` | Action plan from Strategist |
| **Receives** | `LetterAppend` | Letter paragraph from Synthesis |
| **Returns** | `PipelineResult` | Full result back to FastAPI |

## Chat Protocol

Supports `ChatMessage` and `ChatAcknowledgement` for Agentverse and user-facing chat. Responds to commands like:
- "Go more aggressive" → Shifts to ELEVATED state
- "Chill out" → Enters COOLDOWN
- "Stats" → Returns session statistics
- "Status" → Returns current state and threshold

## Tech

- **Framework**: Fetch.ai uAgents v0.24
- **Network**: Testnet
- **Mailbox**: Enabled
- **Protocol**: Chat Protocol (Agentverse-compatible)

## Part of Dialed

Dialed is an autonomous social media defense system. Five Fetch.ai uAgents coordinate in real time to classify and intervene on manipulative content in your Instagram feed. The Boss is the brain — nothing happens without its coordination.
