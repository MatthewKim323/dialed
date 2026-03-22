# Dialed — Agentverse + Chat Protocol Integration Spec

**Purpose:** Wrap the existing Python uAgents in a chat protocol layer and register them on Agentverse for Fetch.ai prize compliance. No agent logic rewrites. This is a layer on top.

---

## What the Docs Actually Say

From the official Fetch.ai docs and hackpack materials, the prize compliance checklist is:

1. **Agents registered on Agentverse** — visible in the Almanac, discoverable via search
2. **Chat protocol enabled** — agents use `ChatMessage`/`ChatAcknowledgement` from `uagents_core.contrib.protocols.chat`
3. **LLM-powered reasoning** — can be any LLM (Claude, OpenAI, ASI:One). The hackpack explicitly says Anthropic is fine as long as agents are registered and chat protocol is enabled.
4. **Agents are running and reachable** — either via Mailbox (for intermittent agents) or Proxy (for continuously running agents)

Fetch.ai's own docs have an Anthropic integration example that uses Claude as the reasoning engine inside a uAgent with REST endpoints. So the stack (Anthropic + uAgents + Agentverse) is explicitly supported.

---

## Two-Stage Implementation Plan

### Stage 1: Build and test locally (current state)

Keep building exactly as you are. All five agents (Boss, Classifier, Context, Strategist, Synthesis) run locally in a Bureau. They communicate via `ctx.send` and `ctx.send_and_receive` with typed `Model` payloads. Claude Sonnet is the LLM backbone. Everything works on `localhost`.

**No Agentverse dependency during development.** The Bureau handles all inter-agent messaging locally. You don't need to be online, you don't burn any Agentverse quota, and you can iterate fast.

### Stage 2: Wrap and register (late in build, before demo)

Once the pipeline is stable, add the Agentverse integration layer. This involves three things per agent: enable the chat protocol, enable Mailbox or Proxy, and publish agent details.

---

## Exactly What to Change Per Agent

The pattern is the same for every agent. Here's the transformation:

### Before (local-only agent):

```python
from uagents import Agent, Context, Model

boss_agent = Agent(
    name="dialed-boss",
    seed="boss-seed-phrase-here",
    port=8000,
    endpoint=["http://localhost:8000/submit"],
)
```

### After (Agentverse-registered with chat protocol):

```python
from uagents import Agent, Context, Model, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatMessage,
    ChatAcknowledgement,
    TextContent,
    EndSessionContent,
    chat_protocol_spec,
)
from datetime import datetime
from uuid import uuid4

boss_agent = Agent(
    name="dialed-boss",
    seed="boss-seed-phrase-here",
    port=8000,
    endpoint=["http://localhost:8000/submit"],
    mailbox=True,                    # <-- connects to Agentverse Mailbox
    publish_agent_details=True,      # <-- publishes to Agentverse marketplace
)

# Create a chat protocol instance
chat_proto = Protocol(spec=chat_protocol_spec)

# Chat protocol handler — this is the Agentverse/ASI:One facing interface
@chat_proto.on_message(ChatMessage)
async def handle_chat_message(ctx: Context, sender: str, msg: ChatMessage):
    # 1. Acknowledge receipt (required by chat protocol)
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.utcnow(),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    # 2. Extract the text from the ChatMessage
    text = ""
    for item in msg.content:
        if isinstance(item, TextContent):
            text += item.text

    # 3. Route to your existing Boss Agent logic
    #    This is where your current code lives — no changes needed
    response_text = await process_boss_command(text)

    # 4. Send response back via chat protocol
    await ctx.send(
        sender,
        ChatMessage(
            timestamp=datetime.utcnow(),
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=response_text),
                EndSessionContent(type="end-session"),
            ],
        ),
    )

@chat_proto.on_message(ChatAcknowledgement)
async def handle_chat_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    # Log or ignore — not needed for core flow
    pass

# Include the chat protocol on the agent
boss_agent.include(chat_proto, publish_manifest=True)
```

**What changed:**
- Added `mailbox=True` and `publish_agent_details=True` to the Agent constructor
- Created a `Protocol(spec=chat_protocol_spec)` instance
- Added `on_message(ChatMessage)` handler that acknowledges, extracts text, routes to existing logic, and responds
- Added `on_message(ChatAcknowledgement)` handler (required, can be a no-op)
- Included the protocol with `publish_manifest=True`

**What didn't change:** All your existing `on_message`, `on_rest_post`, `send_and_receive`, typed Models, session state machine — none of that changes. The chat protocol is an *additional* interface on the same agent, not a replacement.

---

## Per-Agent Chat Protocol Wiring

Each agent gets the same pattern, but the `process_*` function routes to different existing logic:

### Boss Agent
- Chat protocol receives natural language commands (same as the user chat interface)
- Routes through the existing `process_boss_command()` logic
- Returns text responses about session state, verdicts, stats

### Brain Rot Classifier
- Chat protocol receives content descriptions for classification
- Routes to the existing Claude API classification prompt
- Returns the `ClassificationVerdict` as formatted text

### Context Agent
- Chat protocol receives session state queries
- Returns current state (Normal/Elevated/Alert/Cooldown), threshold, recent brain rot density

### Intervention Strategist
- Chat protocol receives verdict summaries
- Returns the intervention decision as text

### Synthesis Agent
- Chat protocol receives detection summaries
- Returns the latest Letter paragraph

---

## Mailbox vs Proxy — Which to Use

**Use Proxy for the demo.** Here's why:

- **Mailbox** = agent can receive messages even when offline. Messages queue up and get delivered when the agent comes back online. Good for agents that aren't always running.
- **Proxy** = agent is continuously running and directly reachable. Better for live demos where agents need to respond in real time.

Since all five Dialed agents run continuously during a session (in the Bureau), Proxy is the right choice. But during development, Mailbox is easier to set up initially because it doesn't require a publicly reachable endpoint.

**Development:** Use `mailbox=True` — easier setup, no ngrok needed
**Demo day:** Switch to `proxy=True` if you have a public endpoint (e.g., Vultr hosting), otherwise keep Mailbox

```python
# Development
agent = Agent(name="dialed-boss", seed="...", port=8000, mailbox=True)

# Demo day (if hosting on public server)
agent = Agent(name="dialed-boss", seed="...", proxy=True)
```

---

## Connecting to Agentverse (One-Time Setup)

### Step 1: Run the agent locally

```bash
python boss_agent.py
```

You'll see output including the Agent Inspector URL:

```
INFO: [dialed-boss]: Agent inspector available at https://agentverse.ai/inspect/?uri=http%3A//127.0.0.1%3A8000&address=agent1q...
INFO: [dialed-boss]: Starting mailbox client for https://agentverse.ai
INFO: [dialed-boss]: Mailbox access token acquired
```

### Step 2: Click the Inspector URL

This opens the Agentverse Inspector for your agent. Click **Connect** → select **Mailbox** (or **Proxy**).

### Step 3: Verify registration

The terminal will show:

```
INFO: [mailbox]: Successfully registered as mailbox agent in Agentverse
INFO: [mailbox]: Agent details updated in Agentverse
```

Your agent is now on Agentverse. Repeat for all five agents (each on a different port).

### Step 4: Set agent profile on Agentverse

Go to the Agentverse dashboard, find your agent, and update:
- **Name:** e.g., "Dialed Boss Agent"
- **Handle:** e.g., "@dialed-boss"
- **Description:** "Central orchestrator for the Dialed autonomous social media intervention system. Coordinates content classification, session state management, and intervention decisions across a five-agent swarm."

Do this for all five agents. Good READMEs and descriptions improve discoverability and are explicitly mentioned in Fetch.ai's judging criteria.

---

## Bureau Compatibility

The Bureau still works. You can run all five agents in one process with Mailbox enabled on each:

```python
from uagents import Bureau

bureau = Bureau([
    boss_agent,        # port 8000, mailbox=True
    classifier_agent,  # port 8001, mailbox=True
    context_agent,     # port 8002, mailbox=True
    strategist_agent,  # port 8003, mailbox=True
    synthesis_agent,   # port 8004, mailbox=True
])
bureau.run()
```

Each agent registers independently on Agentverse with its own address and mailbox. The Bureau just manages them in one process.

---

## Using Anthropic as the LLM Backbone

The Fetch.ai docs have an explicit Anthropic example page. The pattern is simple — instead of calling ASI:One or OpenAI, you call the Anthropic API:

```python
import anthropic

client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

async def classify_content(payload: ContentPayload, intent_profile: dict) -> str:
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        messages=[
            {"role": "user", "content": build_classifier_prompt(payload, intent_profile)}
        ],
    )
    return response.content[0].text
```

This slots directly into the chat protocol handler — when a `ChatMessage` comes in, you extract the text, call Claude, and send the response back as a `ChatMessage`.

---

## What This Gets You for Prize Compliance

| Requirement | How Dialed Meets It |
|------------|-------------------|
| Agents registered on Agentverse | All five agents registered via Mailbox/Proxy with descriptive profiles |
| Chat protocol enabled | Each agent includes `Protocol(spec=chat_protocol_spec)` with `ChatMessage`/`ChatAcknowledgement` handlers |
| LLM-powered reasoning | Claude Sonnet via Anthropic API (explicitly supported per Fetch docs) |
| Agents discoverable | `publish_agent_details=True` + `publish_manifest=True` makes agents visible in Agentverse marketplace |
| Multi-agent coordination | Five agents with typed message passing, parallel `send_and_receive`, adaptive state machine — all visible in the agent ticker |
| Real-world use case | Mental health track — autonomous real-time social media intervention |

---

## Implementation Timeline

| When | What | Time |
|------|------|------|
| **Phase 1–3** | Build everything locally. No Agentverse dependency. | Bulk of hackathon |
| **Phase 4** | Add `mailbox=True` and `publish_agent_details=True` to each agent constructor. Add chat protocol handler to each agent. | ~30 min per agent (2.5 hours total) |
| **Phase 4** | Run agents, click Inspector URLs, connect Mailboxes. Set profiles on Agentverse dashboard. | ~15 min per agent (1.25 hours total) |
| **Phase 4** | Test: send a `ChatMessage` to the Boss Agent from a test client or ASI:One chat, verify response | 30 min |
| **Demo day** | Agents are running in Bureau, registered on Agentverse, chat protocol active, Claude reasoning, visible in marketplace | Ready |

**Total Agentverse integration time: ~4 hours, all at the end of the build cycle.**

---

## Test Client (Verify Chat Protocol Works)

Use this to confirm your agents respond to ChatMessages before the demo:

```python
from datetime import datetime
from uuid import uuid4
from uagents import Agent, Context
from uagents_core.contrib.protocols.chat import (
    ChatMessage, ChatAcknowledgement, TextContent
)

BOSS_ADDRESS = "agent1q..."  # your Boss Agent's address

test_client = Agent(
    name="test-client",
    seed="test-client-seed",
    port=9000,
    endpoint=["http://localhost:9000/submit"],
)

@test_client.on_event("startup")
async def send_test(ctx: Context):
    await ctx.send(BOSS_ADDRESS, ChatMessage(
        timestamp=datetime.utcnow(),
        msg_id=uuid4(),
        content=[TextContent(type="text", text="What's the current session state?")],
    ))

@test_client.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    ctx.logger.info(f"Ack from {sender} for {msg.acknowledged_msg_id}")

@test_client.on_message(ChatMessage)
async def handle_response(ctx: Context, sender: str, msg: ChatMessage):
    for item in msg.content:
        if isinstance(item, TextContent):
            ctx.logger.info(f"Response: {item.text}")

test_client.run()
```

If you get a response back in `ChatMessage` format, the integration is complete.

---

## Key Principle

**The chat protocol is the user interface, not a compliance layer.**

In Dialed, the chat protocol does double duty. It satisfies the Fetch.ai prize requirement (agents are chat-protocol-enabled and registered on Agentverse) AND it powers the actual user-facing chat in the right panel of the dashboard. Users @ mention agents by name (`@classifier why did you flag that?`) and the message is sent as a `ChatMessage` to that agent's address. The agent responds with a `ChatMessage`. Same protocol, same transport, same message format — but it's the product, not just a checkbox.

Your agents keep their existing `on_message` handlers for typed `Model` payloads (the internal pipeline: `ContentPayload`, `ClassificationVerdict`, etc.). The chat protocol handlers are an *additional* `Protocol` included on each agent that provides both the Agentverse/ASI:One-facing interface AND the user-facing chat interface.

Internal pipeline: `ContentPayload` → `ClassificationVerdict` → `BossVerdict` → `InterventionOrder` (typed Models, `ctx.send`/`send_and_receive`)

User + Agentverse interface: `ChatMessage` → text extraction → route to existing logic → `ChatMessage` response (chat protocol, powers the right panel chat AND Agentverse discoverability)

Both coexist on the same agent. The chat protocol wraps your existing logic, it doesn't replace it.
