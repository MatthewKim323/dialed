# Classifier Agent — dialed-classifier

**Real-time brain rot classifier powered by Claude Sonnet.**

## Overview

The Classifier is the detection engine of the Dialed pipeline. When content arrives from the Boss Agent, the Classifier sends it to Claude Sonnet with a structured evaluation prompt targeting seven manipulation dimensions. It returns a confidence score, detected tactics, severity rating, and a human-readable rationale.

## Address

```
agent1q2wrsdyejcx5axv5uz944ujnc0d55wxh0ev3tvn7t0y6yfdnltgw7lz79wj
```

## What It Does

1. **Receives a `ContentPayload`** from the Boss Agent containing caption text, creator handle, engagement metrics, and visual description.
2. **Calls Claude Sonnet** with a structured prompt evaluating the content across seven manipulation dimensions.
3. **Parses the JSON response** into a `ClassificationVerdict` with confidence score, detected tactics, intent alignment, and recommended severity.
4. **Returns the verdict** to the Boss Agent for aggregation.

## Manipulation Dimensions

The Classifier evaluates every piece of content against:

1. **Rage bait** — Content designed to provoke anger for engagement
2. **FOMO hooks** — Artificial urgency and fear of missing out
3. **Social comparison** — Content that triggers unhealthy self-comparison
4. **Outrage amplification** — Escalating moral outrage for clicks
5. **Parasocial exploitation** — Manufactured intimacy with creators
6. **Engagement bait** — "Like if you agree" / comment-farming tactics
7. **Cliffhanger hooks** — Incomplete narratives designed to trap attention

## Message Types

| Direction | Model | Description |
|-----------|-------|-------------|
| **Receives** | `ContentPayload` | Raw content data from Boss |
| **Returns** | `ClassificationVerdict` | `is_brain_rot`, `confidence` (0.0–1.0), `detected_tactics`, `rationale`, `recommended_severity` |

## Chat Protocol

Supports `ChatMessage` and `ChatAcknowledgement` for Agentverse and user-facing chat. Responds to:
- "Why did you flag that?" → Explains the last classification with tactics and rationale
- "What do you detect?" → Lists the seven manipulation dimensions and scoring method

## Tech

- **Framework**: Fetch.ai uAgents v0.24
- **LLM**: Anthropic Claude Sonnet (claude-sonnet-4-20250514)
- **Network**: Testnet
- **Mailbox**: Enabled
- **Protocol**: Chat Protocol (Agentverse-compatible)

## Part of Dialed

Dialed is an autonomous social media defense system. The Classifier is the eyes — it sees manipulation tactics that humans are designed to miss, and scores them with machine precision.
