from uagents import Model
from typing import List, Optional


# ── Browser → Intelligence Layer ─────────────────────────────────────────

class ContentPayload(Model):
    content_index: int
    extracted_text: str
    creator_handle: str
    engagement_likes: str
    engagement_comments: str
    visual_description: str
    scroll_depth: int
    session_duration_s: int


# ── Classifier → Boss ────────────────────────────────────────────────────

class ClassificationVerdict(Model):
    is_brain_rot: bool
    confidence: float
    detected_tactics: List[str]
    intent_alignment: float
    rationale: str
    recommended_severity: str


# ── Context Agent → Boss ─────────────────────────────────────────────────

class ContextAssessment(Model):
    concur: bool
    session_state: str
    adjusted_threshold: float
    reasoning: str
    intervention_fatigue_score: float


# ── Boss aggregate verdict ───────────────────────────────────────────────

class BossVerdict(Model):
    content_index: int
    is_brain_rot: bool
    final_confidence: float
    detected_tactics: List[str]
    session_state: str
    rationale: str


# ── Strategist → FastAPI (intervention execution) ────────────────────────

class InterventionOrder(Model):
    content_index: int
    intervention_type: str
    severity: str
    overlay_message: str
    redirect_url: Optional[str] = None


# ── Synthesis Agent → Frontend ───────────────────────────────────────────

class LetterAppend(Model):
    paragraph: str
    tactic_referenced: str
    content_index: int


# ── REST request/response wrappers for on_rest_post ──────────────────────

class ContentRequest(Model):
    content_index: int
    extracted_text: str
    creator_handle: str
    engagement_likes: str
    engagement_comments: str
    visual_description: str
    scroll_depth: int
    session_duration_s: int
    intent_purpose: List[str]
    intent_triggers: List[str]
    intent_aggressiveness: str


class PipelineResult(Model):
    content_index: int
    is_brain_rot: bool
    confidence: float
    detected_tactics: List[str]
    session_state: str
    rationale: str
    intervention_type: str
    intervention_severity: str
    overlay_message: str
    letter_paragraph: str
    letter_tactic: str


class UserCommand(Model):
    message: str


class AgentResponse(Model):
    agent_name: str
    response_text: str
