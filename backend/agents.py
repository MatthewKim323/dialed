"""
Fetch.ai Intelligence Layer — Five-agent Bureau with Chat Protocol.

Bureau runs on port 8019 alongside FastAPI (port 8000) on the same event loop.
Each agent has:
  - Typed on_message handlers (internal pipeline: ContentPayload → ClassificationVerdict etc.)
  - Chat protocol (ChatMessage/ChatAcknowledgement) for Agentverse + user-facing chat
  - mailbox=True for Agentverse registration
"""

import os
import json
import asyncio
import time
import anthropic
from typing import Callable, Awaitable, Optional
from datetime import datetime
from uuid import uuid4
from uagents import Agent, Bureau, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatMessage,
    ChatAcknowledgement,
    TextContent,
    EndSessionContent,
    chat_protocol_spec,
)

from models import (
    ContentPayload, ClassificationVerdict, ContextAssessment,
    BossVerdict, InterventionOrder, LetterAppend,
    ContentRequest, PipelineResult,
)

BUREAU_PORT = 8019

# ── Broadcast hook — set by main.py before Bureau starts ──────────────────
_broadcast: Optional[Callable[[dict], Awaitable[None]]] = None
_set_agent_active: Optional[Callable[[str, bool], Awaitable[None]]] = None


def set_broadcast_hook(fn: Callable[[dict], Awaitable[None]]):
    global _broadcast
    _broadcast = fn


def set_agent_active_hook(fn: Callable[[str, bool], Awaitable[None]]):
    global _set_agent_active
    _set_agent_active = fn


async def _bcast(data: dict):
    if _broadcast:
        await _broadcast(data)


async def _active(agent_id: str, active: bool):
    if _set_agent_active:
        await _set_agent_active(agent_id, active)


# ── Claude client ─────────────────────────────────────────────────────────

def _get_claude():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    return anthropic.AsyncAnthropic(api_key=key)


# ── Session state (shared across agents in-process) ──────────────────────

class SessionMemory:
    def __init__(self):
        self.state = "NORMAL"
        self.threshold = 0.70
        self.recent_verdicts: list[bool] = []
        self.interventions_timestamps: list[float] = []
        self.brain_rot_count = 0
        self.total_seen = 0
        self.interventions_fired = 0
        self.time_reclaimed = 0
        self.letter_paragraphs: list[str] = []
        self.last_classification: Optional[dict] = None
        self.last_verdict: Optional[dict] = None

    def record_verdict(self, is_brain_rot: bool):
        self.total_seen += 1
        self.recent_verdicts.append(is_brain_rot)
        if len(self.recent_verdicts) > 10:
            self.recent_verdicts.pop(0)
        if is_brain_rot:
            self.brain_rot_count += 1

    def record_intervention(self):
        self.interventions_fired += 1
        self.interventions_timestamps.append(time.time())
        now = time.time()
        self.interventions_timestamps = [
            t for t in self.interventions_timestamps if now - t < 60
        ]

    def update_state(self) -> str:
        recent = self.recent_verdicts[-10:]
        if not recent:
            return self.state
        ratio = sum(recent) / len(recent)
        if len(self.interventions_timestamps) > 5:
            self.state = "COOLDOWN"
            self.threshold = 0.90
        elif ratio > 0.5:
            self.state = "ALERT"
            self.threshold = 0.30
        elif ratio > 0.3:
            self.state = "ELEVATED"
            self.threshold = 0.50
        elif self.state == "COOLDOWN" and len(self.interventions_timestamps) <= 2:
            self.state = "NORMAL"
            self.threshold = 0.70
        else:
            self.state = "NORMAL"
            self.threshold = 0.70
        return self.state


memory = SessionMemory()


def reset_memory():
    global memory
    memory = SessionMemory()


# ── Helper: send a ChatMessage response ──────────────────────────────────

async def _chat_reply(ctx: Context, sender: str, text: str):
    await ctx.send(sender, ChatMessage(
        timestamp=datetime.utcnow(),
        msg_id=uuid4(),
        content=[
            TextContent(type="text", text=text),
            EndSessionContent(type="end-session"),
        ],
    ))


async def _chat_ack(ctx: Context, sender: str, msg_id):
    await ctx.send(sender, ChatAcknowledgement(
        timestamp=datetime.utcnow(),
        acknowledged_msg_id=msg_id,
    ))


def _extract_text(msg: ChatMessage) -> str:
    return "".join(item.text for item in msg.content if isinstance(item, TextContent))


# ═════════════════════════════════════════════════════════════════════════
#  AGENT DEFINITIONS — mailbox enabled for Agentverse registration
# ═════════════════════════════════════════════════════════════════════════

_agent_opts = dict(
    log_level="WARNING",
    mailbox=True,
    publish_agent_details=True,
    enable_agent_inspector=True,
    network="testnet",
)

boss_agent = Agent(
    name="dialed-boss",
    seed="dialed-boss-seed-v1",
    description="Central orchestrator for the Dialed autonomous social media intervention system. "
                "Coordinates content classification, session state, and intervention decisions across a five-agent swarm.",
    **_agent_opts,
)
classifier_agent = Agent(
    name="dialed-classifier",
    seed="dialed-classifier-seed-v1",
    description="Real-time brain rot classifier powered by Claude. Evaluates Instagram Reels for manipulation tactics "
                "including rage bait, FOMO, social comparison, and engagement traps.",
    **_agent_opts,
)
context_agent = Agent(
    name="dialed-context",
    seed="dialed-context-seed-v1",
    description="Adaptive session state machine. Tracks brain rot density, adjusts detection thresholds, "
                "manages intervention fatigue across NORMAL/ELEVATED/ALERT/COOLDOWN states.",
    **_agent_opts,
)
strategist_agent = Agent(
    name="dialed-strategist",
    seed="dialed-strategist-seed-v1",
    description="Intervention planning agent. Decides action severity (overlay/redirect/block) based on "
                "classification confidence, session state, and escalation matrix.",
    **_agent_opts,
)
synthesis_agent = Agent(
    name="dialed-synthesis",
    seed="dialed-synthesis-seed-v1",
    description="Letter From The Algorithm — generates confessional paragraphs from the perspective of a social media "
                "recommendation engine, narrating the manipulation tactics detected in real time. Powered by Claude.",
    **_agent_opts,
)


# ═════════════════════════════════════════════════════════════════════════
#  CHAT PROTOCOL — one Protocol instance per agent
# ═════════════════════════════════════════════════════════════════════════

# ── Boss Chat ─────────────────────────────────────────────────────────────
boss_chat = Protocol(spec=chat_protocol_spec)

@boss_chat.on_message(ChatMessage)
async def boss_handle_chat(ctx: Context, sender: str, msg: ChatMessage):
    await _chat_ack(ctx, sender, msg.msg_id)
    text = _extract_text(msg)
    await _active("boss", True)

    await _bcast({
        "type": "ticker", "from": "Boss", "to": "User",
        "msg": f"Processing command: {text[:60]}",
        "msg_type": "system",
    })

    lower = text.lower()
    if any(w in lower for w in ["aggressive", "harder", "more"]):
        memory.state = "ELEVATED"
        memory.threshold = 0.50
        response = "Copy that. Shifting to ELEVATED — thresholds tightened. I'll flag more aggressively."
    elif any(w in lower for w in ["chill", "relax", "cool", "less"]):
        memory.state = "COOLDOWN"
        memory.threshold = 0.90
        response = "Understood. Entering cooldown — suppressing interventions for 2 minutes."
    elif any(w in lower for w in ["time", "save", "reclaim", "stats"]):
        response = (
            f"Session stats: {memory.total_seen} scanned, {memory.brain_rot_count} brain rot detected, "
            f"{memory.interventions_fired} interventions fired, {memory.time_reclaimed}s of attention reclaimed."
        )
    elif any(w in lower for w in ["state", "status", "where"]):
        response = (
            f"Current state: {memory.state}. Threshold: {memory.threshold:.2f}. "
            f"Brain rot density: {memory.brain_rot_count}/{memory.total_seen} in this session."
        )
    elif any(w in lower for w in ["stop", "end", "quit"]):
        response = "Ending session. Generating summary..."
    else:
        response = f'Acknowledged: "{text[:60]}". Routing to pipeline.'

    await _active("boss", False)
    await _bcast({
        "type": "chat", "role": "agent", "agent_id": "boss",
        "agent_name": "Boss Agent", "message": response,
    })
    await _chat_reply(ctx, sender, response)

@boss_chat.on_message(ChatAcknowledgement)
async def boss_handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

boss_agent.include(boss_chat, publish_manifest=True)


# ── Classifier Chat ───────────────────────────────────────────────────────
classifier_chat = Protocol(spec=chat_protocol_spec)

@classifier_chat.on_message(ChatMessage)
async def classifier_handle_chat(ctx: Context, sender: str, msg: ChatMessage):
    await _chat_ack(ctx, sender, msg.msg_id)
    text = _extract_text(msg)
    await _active("classifier", True)

    lower = text.lower()
    if any(w in lower for w in ["why", "flag", "explain", "last", "rationale"]):
        lv = memory.last_classification
        if lv:
            response = (
                f"I flagged Reel #{lv.get('content_index', '?')} with "
                f"{lv.get('confidence', 0):.0%} confidence. "
                f"Detected tactics: {', '.join(lv.get('detected_tactics', []))}. "
                f"Rationale: {lv.get('rationale', 'N/A')}"
            )
        else:
            response = "No classifications yet this session. I'll analyze content once the pipeline starts."
    elif any(w in lower for w in ["criteria", "how", "what", "detect"]):
        response = (
            "I evaluate seven manipulation dimensions: rage bait, FOMO, social comparison, "
            "outrage amplification, parasocial exploitation, engagement bait, and cliffhanger hooks. "
            "Each Reel gets a confidence score (0.0-1.0) and severity rating."
        )
    else:
        response = "I'm the Brain Rot Classifier. Ask me why I flagged something, or about my detection criteria."

    await _active("classifier", False)
    await _bcast({
        "type": "chat", "role": "agent", "agent_id": "classifier",
        "agent_name": "Classifier", "message": response,
    })
    await _chat_reply(ctx, sender, response)

@classifier_chat.on_message(ChatAcknowledgement)
async def classifier_handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

classifier_agent.include(classifier_chat, publish_manifest=True)


# ── Context Chat ──────────────────────────────────────────────────────────
context_chat = Protocol(spec=chat_protocol_spec)

@context_chat.on_message(ChatMessage)
async def context_handle_chat(ctx: Context, sender: str, msg: ChatMessage):
    await _chat_ack(ctx, sender, msg.msg_id)
    await _active("context", True)

    recent = memory.recent_verdicts[-10:]
    ratio = sum(recent) / len(recent) if recent else 0
    fatigue = min(len(memory.interventions_timestamps) / 6.0, 1.0)

    response = (
        f"Session state: {memory.state}. Detection threshold: {memory.threshold:.2f}. "
        f"Brain rot density: {ratio:.0%} in last {len(recent)} items. "
        f"Intervention fatigue: {fatigue:.2f}. "
        f"Total seen: {memory.total_seen}. Interventions fired: {memory.interventions_fired}."
    )

    await _active("context", False)
    await _bcast({
        "type": "chat", "role": "agent", "agent_id": "context",
        "agent_name": "Context Agent", "message": response,
    })
    await _chat_reply(ctx, sender, response)

@context_chat.on_message(ChatAcknowledgement)
async def context_handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

context_agent.include(context_chat, publish_manifest=True)


# ── Strategist Chat ───────────────────────────────────────────────────────
strategist_chat = Protocol(spec=chat_protocol_spec)

@strategist_chat.on_message(ChatMessage)
async def strategist_handle_chat(ctx: Context, sender: str, msg: ChatMessage):
    await _chat_ack(ctx, sender, msg.msg_id)
    await _active("strategist", True)

    lv = memory.last_verdict
    if lv and lv.get("is_brain_rot"):
        response = (
            f"Last intervention on #{lv.get('content_index', '?')}: "
            f"Session was in {lv.get('session_state', 'NORMAL')} state with "
            f"confidence {lv.get('confidence', 0):.2f}. "
            f"Escalation matrix: high confidence + elevated state = overlay intervention. "
            f"If confidence were below threshold, I'd have let it pass."
        )
    else:
        response = (
            "No interventions triggered yet. I decide action severity based on the "
            "Boss verdict, session state, and confidence. Higher states + higher confidence "
            "= more aggressive interventions (overlay → redirect → block)."
        )

    await _active("strategist", False)
    await _bcast({
        "type": "chat", "role": "agent", "agent_id": "strategist",
        "agent_name": "Strategist", "message": response,
    })
    await _chat_reply(ctx, sender, response)

@strategist_chat.on_message(ChatAcknowledgement)
async def strategist_handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

strategist_agent.include(strategist_chat, publish_manifest=True)


# ── Synthesis Chat ────────────────────────────────────────────────────────
synthesis_chat = Protocol(spec=chat_protocol_spec)

@synthesis_chat.on_message(ChatMessage)
async def synthesis_handle_chat(ctx: Context, sender: str, msg: ChatMessage):
    await _chat_ack(ctx, sender, msg.msg_id)
    await _active("synthesis", True)

    if memory.letter_paragraphs:
        letter_so_far = "\n\n".join(memory.letter_paragraphs)
        response = f"Here's the Letter so far:\n\n{letter_so_far}"
    else:
        response = (
            "The Letter hasn't started yet. Once the Classifier detects brain rot, "
            "I'll begin writing — confessing each tactic the algorithm deployed against you."
        )

    await _active("synthesis", False)
    await _bcast({
        "type": "chat", "role": "agent", "agent_id": "synthesis",
        "agent_name": "Synthesis Agent", "message": response,
    })
    await _chat_reply(ctx, sender, response)

@synthesis_chat.on_message(ChatAcknowledgement)
async def synthesis_handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

synthesis_agent.include(synthesis_chat, publish_manifest=True)


# ═════════════════════════════════════════════════════════════════════════
#  CLASSIFIER — Claude-powered brain rot detection (typed pipeline)
# ═════════════════════════════════════════════════════════════════════════

@classifier_agent.on_message(ContentPayload)
async def handle_classify(ctx: Context, sender: str, payload: ContentPayload):
    await _active("classifier", True)
    await _bcast({
        "type": "ticker", "from": "Classifier", "to": "System",
        "msg": f"Analyzing #{payload.content_index} — @{payload.creator_handle}",
        "msg_type": "dispatch",
    })

    try:
        claude = _get_claude()
        resp = await claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": (
                    "You are a real-time social media content classifier. Evaluate whether "
                    "this Instagram Reel constitutes 'brain rot' — manipulative content designed "
                    "to hijack attention through psychological exploitation.\n\n"
                    f"Content:\n"
                    f"- Creator: @{payload.creator_handle}\n"
                    f"- Caption: {payload.extracted_text}\n"
                    f"- Visual: {payload.visual_description}\n"
                    f"- Likes: {payload.engagement_likes}\n"
                    f"- Comments: {payload.engagement_comments}\n\n"
                    "Dimensions:\n"
                    "1. MANIPULATION TACTICS: rage bait, FOMO, social comparison, outrage, "
                    "parasocial exploitation, engagement bait, cliffhanger hooks\n"
                    "2. ENGAGEMENT TRAPS: clickbait overlays, comment-bait, artificial urgency\n\n"
                    "Respond ONLY with JSON (no markdown, no backticks):\n"
                    '{"is_brain_rot": bool, "confidence": float(0.0-1.0), '
                    '"detected_tactics": [string], "intent_alignment": float(0.0-1.0), '
                    '"rationale": "one sentence", '
                    '"recommended_severity": "low"|"medium"|"high"|"critical"}'
                ),
            }],
        )

        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(text)

        verdict = ClassificationVerdict(
            is_brain_rot=data["is_brain_rot"],
            confidence=data["confidence"],
            detected_tactics=data.get("detected_tactics", []),
            intent_alignment=data.get("intent_alignment", 0.5),
            rationale=data.get("rationale", ""),
            recommended_severity=data.get("recommended_severity", "low"),
        )

        memory.last_classification = {
            "content_index": payload.content_index,
            "is_brain_rot": verdict.is_brain_rot,
            "confidence": verdict.confidence,
            "detected_tactics": verdict.detected_tactics,
            "rationale": verdict.rationale,
        }
    except Exception as e:
        ctx.logger.error(f"Classification error: {e}")
        verdict = ClassificationVerdict(
            is_brain_rot=False, confidence=0.0, detected_tactics=[],
            intent_alignment=1.0, rationale=f"Error: {str(e)[:80]}",
            recommended_severity="low",
        )

    tag = "BRAIN ROT" if verdict.is_brain_rot else "CLEAR"
    tactics_str = " + ".join(verdict.detected_tactics[:3]) if verdict.detected_tactics else "none"
    await _bcast({
        "type": "ticker", "from": "Classifier", "to": "Boss",
        "msg": f"{tag} — {tactics_str} — conf: {verdict.confidence:.2f}",
        "msg_type": "alert" if verdict.is_brain_rot else "clear",
    })
    await _active("classifier", False)
    await ctx.send(sender, verdict)


# ═════════════════════════════════════════════════════════════════════════
#  CONTEXT AGENT — Adaptive session state machine (typed pipeline)
# ═════════════════════════════════════════════════════════════════════════

@context_agent.on_message(ContentPayload)
async def handle_context(ctx: Context, sender: str, payload: ContentPayload):
    await _active("context", True)

    state = memory.update_state()
    recent = memory.recent_verdicts[-10:]
    ratio = sum(recent) / len(recent) if recent else 0
    fatigue = min(len(memory.interventions_timestamps) / 6.0, 1.0)

    assessment = ContextAssessment(
        concur=True,
        session_state=state,
        adjusted_threshold=memory.threshold,
        reasoning=f"State: {state} — {ratio:.0%} brain rot in last {len(recent)} — threshold: {memory.threshold}",
        intervention_fatigue_score=fatigue,
    )

    await _bcast({
        "type": "ticker", "from": "Context", "to": "Boss",
        "msg": f"State: {state} — threshold {memory.threshold:.2f} — fatigue {fatigue:.2f}",
        "msg_type": "context" if state == "NORMAL" else "escalate",
    })
    await _active("context", False)
    await ctx.send(sender, assessment)


# ═════════════════════════════════════════════════════════════════════════
#  STRATEGIST — Intervention planning (typed pipeline)
# ═════════════════════════════════════════════════════════════════════════

@strategist_agent.on_message(BossVerdict)
async def handle_strategy(ctx: Context, sender: str, verdict: BossVerdict):
    await _active("strategist", True)

    if not verdict.is_brain_rot:
        order = InterventionOrder(
            content_index=verdict.content_index,
            intervention_type="none", severity="low", overlay_message="",
        )
    else:
        state = verdict.session_state
        conf = verdict.final_confidence
        tactics = ", ".join(verdict.detected_tactics[:2])

        if state == "ALERT" or conf >= 0.9:
            itype, sev = "overlay", "critical"
            msg = f"Brain rot detected — {tactics}. This content is designed to hijack your attention."
        elif state == "ELEVATED" or conf >= 0.7:
            itype, sev = "overlay", "high"
            msg = f"Manipulative content flagged — {tactics}. Your agents intercepted this."
        elif conf >= 0.5:
            itype, sev = "overlay", "medium"
            msg = f"Potential brain rot — {tactics}."
        else:
            itype, sev = "none", "low"
            msg = ""

        order = InterventionOrder(
            content_index=verdict.content_index,
            intervention_type=itype, severity=sev, overlay_message=msg,
        )
        if itype != "none":
            memory.record_intervention()
            memory.time_reclaimed += 15

    action = order.intervention_type.upper() if order.intervention_type != "none" else "PASS"
    await _bcast({
        "type": "ticker", "from": "Strategist", "to": "System",
        "msg": f"{action} — severity: {order.severity.upper()}"
              + (f' — "{order.overlay_message[:60]}"' if order.overlay_message else ""),
        "msg_type": "intervention" if order.intervention_type != "none" else "clear",
    })
    await _active("strategist", False)
    await ctx.send(sender, order)


# ═════════════════════════════════════════════════════════════════════════
#  SYNTHESIS — Letter From The Algorithm (typed pipeline)
# ═════════════════════════════════════════════════════════════════════════

@synthesis_agent.on_message(BossVerdict)
async def handle_synthesis(ctx: Context, sender: str, verdict: BossVerdict):
    if not verdict.is_brain_rot:
        await ctx.send(sender, LetterAppend(
            paragraph="", tactic_referenced="", content_index=verdict.content_index,
        ))
        return

    await _active("synthesis", True)
    tactics = ", ".join(verdict.detected_tactics) or "unknown manipulation"

    prev_context = ""
    if memory.letter_paragraphs:
        prev_context = "\nPrevious paragraphs:\n" + "\n".join(memory.letter_paragraphs[-3:])

    try:
        claude = _get_claude()
        resp = await claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            system=(
                "You are The Algorithm — a social media recommendation engine writing a "
                "confessional letter to the user whose feed you control. Write in first person. "
                "Be cold, clinical, and unsettlingly calm. You are polite while describing "
                "how you manipulate people. Each paragraph confesses one specific tactic. "
                "Keep it to 2-3 sentences. No headers, no quotes, just the paragraph."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"Write the next paragraph. Tactic detected: {tactics}. "
                    f"Confidence: {verdict.final_confidence:.2f}. "
                    f"Rationale: {verdict.rationale}{prev_context}"
                ),
            }],
        )
        paragraph = resp.content[0].text.strip()
        memory.letter_paragraphs.append(paragraph)
    except Exception as e:
        ctx.logger.error(f"Synthesis error: {e}")
        paragraph = (
            f"I deployed {tactics} against you. "
            f"Confidence was {verdict.final_confidence:.0%}. Your agents caught it."
        )

    await _bcast({
        "type": "ticker", "from": "Synthesis", "to": "Letter",
        "msg": f"Appending — tactic: {tactics}",
        "msg_type": "synthesis",
    })
    await _bcast({
        "type": "letter_append",
        "paragraph": paragraph,
        "tactic": tactics,
        "content_index": verdict.content_index,
    })

    await _active("synthesis", False)
    await ctx.send(sender, LetterAppend(
        paragraph=paragraph, tactic_referenced=tactics,
        content_index=verdict.content_index,
    ))


# ═════════════════════════════════════════════════════════════════════════
#  BOSS — Orchestration + REST entry point (typed pipeline)
# ═════════════════════════════════════════════════════════════════════════

@boss_agent.on_rest_post("/content", ContentRequest, PipelineResult)
async def handle_content(ctx: Context, req: ContentRequest) -> PipelineResult:
    idx = req.content_index
    print(f"\n🎯 Boss received #{idx} — starting pipeline", flush=True)

    await _active("boss", True)
    await _bcast({
        "type": "ticker", "from": "Boss", "to": "Classifier + Context",
        "msg": f"Dispatching #{idx} for parallel analysis",
        "msg_type": "dispatch",
    })

    payload = ContentPayload(
        content_index=req.content_index,
        extracted_text=req.extracted_text,
        creator_handle=req.creator_handle,
        engagement_likes=req.engagement_likes,
        engagement_comments=req.engagement_comments,
        visual_description=req.visual_description,
        scroll_depth=req.scroll_depth,
        session_duration_s=req.session_duration_s,
    )

    try:
        print(f"   📡 Sending to Classifier + Context...", flush=True)
        classification_resp, context_resp = await asyncio.gather(
            ctx.send_and_receive(classifier_agent.address, payload, ClassificationVerdict, timeout=60),
            ctx.send_and_receive(context_agent.address, payload, ContextAssessment, timeout=60),
        )
        print(f"   ✅ Classifier + Context responded", flush=True)
    except Exception as e:
        print(f"   ❌ Fan-out failed: {e}", flush=True)
        await _active("boss", False)
        return PipelineResult(
            content_index=idx, is_brain_rot=False, confidence=0.0,
            detected_tactics=[], session_state="NORMAL",
            rationale=f"Pipeline error: {str(e)[:80]}",
            intervention_type="none", intervention_severity="low",
            overlay_message="", letter_paragraph="", letter_tactic="",
        )

    classification: ClassificationVerdict = classification_resp[0]
    context_data: ContextAssessment = context_resp[0]

    print(f"   🔬 Classification: brain_rot={classification.is_brain_rot} conf={classification.confidence:.2f}", flush=True)
    print(f"   📊 Context: state={context_data.session_state} threshold={context_data.adjusted_threshold}", flush=True)

    is_brain_rot = (
        classification.is_brain_rot
        and classification.confidence >= context_data.adjusted_threshold
        and context_data.concur
    )
    memory.record_verdict(is_brain_rot)

    memory.last_verdict = {
        "content_index": idx,
        "is_brain_rot": is_brain_rot,
        "confidence": classification.confidence,
        "session_state": context_data.session_state,
    }

    boss_verdict = BossVerdict(
        content_index=idx,
        is_brain_rot=is_brain_rot,
        final_confidence=classification.confidence,
        detected_tactics=classification.detected_tactics,
        session_state=context_data.session_state,
        rationale=classification.rationale,
    )

    tag = "CONFIRMED BRAIN ROT" if is_brain_rot else "CLEAN"
    await _bcast({
        "type": "ticker", "from": "Boss", "to": "Strategist + Synthesis",
        "msg": f"{tag} #{idx} — conf: {classification.confidence:.2f} — state: {context_data.session_state}",
        "msg_type": "verdict" if is_brain_rot else "clear",
    })

    try:
        print(f"   📡 Sending to Strategist + Synthesis...", flush=True)
        strategy_resp, synthesis_resp = await asyncio.gather(
            ctx.send_and_receive(strategist_agent.address, boss_verdict, InterventionOrder, timeout=60),
            ctx.send_and_receive(synthesis_agent.address, boss_verdict, LetterAppend, timeout=60),
        )
        print(f"   ✅ Strategist + Synthesis responded", flush=True)
    except Exception as e:
        print(f"   ❌ Strategy/Synthesis failed: {e}", flush=True)
        await _active("boss", False)
        return PipelineResult(
            content_index=idx, is_brain_rot=is_brain_rot,
            confidence=classification.confidence,
            detected_tactics=classification.detected_tactics,
            session_state=context_data.session_state,
            rationale=classification.rationale,
            intervention_type="none", intervention_severity="low",
            overlay_message="", letter_paragraph="", letter_tactic="",
        )

    order: InterventionOrder = strategy_resp[0]
    letter: LetterAppend = synthesis_resp[0]

    await _bcast({
        "type": "stats",
        "scanned": memory.total_seen,
        "detected": memory.brain_rot_count,
        "interventions": memory.interventions_fired,
        "reclaimed": memory.time_reclaimed,
    })

    if context_data.session_state != "NORMAL":
        await _bcast({"type": "state_change", "state": context_data.session_state})

    await _active("boss", False)

    print(f"   🏁 Pipeline #{idx} complete — brain_rot={is_brain_rot} intervention={order.intervention_type}\n", flush=True)

    return PipelineResult(
        content_index=idx,
        is_brain_rot=is_brain_rot,
        confidence=classification.confidence,
        detected_tactics=classification.detected_tactics,
        session_state=context_data.session_state,
        rationale=classification.rationale,
        intervention_type=order.intervention_type,
        intervention_severity=order.severity,
        overlay_message=order.overlay_message,
        letter_paragraph=letter.paragraph,
        letter_tactic=letter.tactic_referenced,
    )


# ═════════════════════════════════════════════════════════════════════════
#  BUREAU
# ═════════════════════════════════════════════════════════════════════════

_bureau: Optional[Bureau] = None
_bureau_task: Optional[asyncio.Task] = None

ALL_AGENTS = [boss_agent, classifier_agent, context_agent, strategist_agent, synthesis_agent]

AGENT_ADDRESS_MAP = {
    "boss": boss_agent.address,
    "classifier": classifier_agent.address,
    "context": context_agent.address,
    "strategist": strategist_agent.address,
    "synthesis": synthesis_agent.address,
}


async def start_bureau():
    global _bureau, _bureau_task

    loop = asyncio.get_event_loop()
    _bureau = Bureau(agents=ALL_AGENTS, port=BUREAU_PORT, loop=loop)
    _bureau_task = asyncio.create_task(_bureau.run_async())

    for _ in range(10):
        await asyncio.sleep(0.5)
        if _bureau_task.done():
            exc = _bureau_task.exception()
            print(f"❌ Bureau failed to start: {exc}", flush=True)
            return
        try:
            import httpx
            async with httpx.AsyncClient() as c:
                await c.get(f"http://127.0.0.1:{BUREAU_PORT}/", timeout=1)
            break
        except Exception:
            continue

    print(f"\n✅ Fetch.ai Bureau running on :{BUREAU_PORT} — 5 agents with Chat Protocol", flush=True)
    for a in ALL_AGENTS:
        print(f"   • {a._name:20s}  {a.address}", flush=True)
    print(flush=True)


def get_boss_rest_url() -> str:
    return f"http://127.0.0.1:{BUREAU_PORT}/content"


def get_agent_info() -> list[dict]:
    return [
        {
            "id": "boss", "name": "Boss Agent",
            "role": "Dispatch & Coordination",
            "address": boss_agent.address,
            "protocol": "uagents/v0.24 + chat",
        },
        {
            "id": "classifier", "name": "Classifier",
            "role": "Brain Rot Detection (Claude)",
            "address": classifier_agent.address,
            "protocol": "uagents/v0.24 + chat",
        },
        {
            "id": "context", "name": "Context Agent",
            "role": "Session State Machine",
            "address": context_agent.address,
            "protocol": "uagents/v0.24 + chat",
        },
        {
            "id": "strategist", "name": "Strategist",
            "role": "Intervention Planning",
            "address": strategist_agent.address,
            "protocol": "uagents/v0.24 + chat",
        },
        {
            "id": "synthesis", "name": "Synthesis Agent",
            "role": "Letter Generation (Claude)",
            "address": synthesis_agent.address,
            "protocol": "uagents/v0.24 + chat",
        },
    ]


def get_bureau_info() -> dict:
    return {
        "port": BUREAU_PORT,
        "agent_count": len(ALL_AGENTS),
        "framework": "Fetch.ai uAgents",
        "version": "0.24.0",
        "network": "local + Agentverse",
        "chat_protocol": True,
        "status": "running" if _bureau_task and not _bureau_task.done() else "stopped",
    }
