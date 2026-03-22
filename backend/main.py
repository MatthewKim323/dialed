from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from browser_use_sdk import AsyncBrowserUse
from typing import Optional
from pathlib import Path
import asyncio
import os
import traceback
import httpx
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path, override=True)


def _read_key_from_file(path, key):
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


api_key = _read_key_from_file(env_path, "BROWSER_USE_API_KEY") or os.getenv("BROWSER_USE_API_KEY", "")
anthropic_key = _read_key_from_file(env_path, "ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY", "")

if not api_key:
    print("\n⚠️  BROWSER_USE_API_KEY not found\n", flush=True)
else:
    print(f"\n✅ BROWSER_USE_API_KEY loaded ({api_key[:8]}...)\n", flush=True)

if not anthropic_key:
    print("⚠️  ANTHROPIC_API_KEY not found\n", flush=True)
else:
    print(f"✅ ANTHROPIC_API_KEY loaded ({anthropic_key[:12]}...)\n", flush=True)

os.environ["ANTHROPIC_API_KEY"] = anthropic_key

agentverse_key = _read_key_from_file(env_path, "AGENTVERSE_API_KEY") or os.getenv("AGENTVERSE_API_KEY", "")
if agentverse_key:
    os.environ["AGENTVERSE_API_KEY"] = agentverse_key
    print(f"✅ AGENTVERSE_API_KEY loaded ({agentverse_key[:20]}...)\n", flush=True)
else:
    print("⚠️  AGENTVERSE_API_KEY not found — mailbox registration may fail\n", flush=True)

elevenlabs_key = _read_key_from_file(env_path, "ELEVENLABS_API_KEY") or os.getenv("ELEVENLABS_API_KEY", "")
if elevenlabs_key:
    print(f"✅ ELEVENLABS_API_KEY loaded ({elevenlabs_key[:12]}...)\n", flush=True)
else:
    print("⚠️  ELEVENLABS_API_KEY not found — TTS will be unavailable\n", flush=True)

AGENT_VOICES = {
    "boss": "1hR2qVedP7lrOxD8z7OH",
    "classifier": "g2W4HAjKvdW93AmsjsOx",
    "context": "EWx0RRDmpbbmVRmQfzC0",
    "strategist": "Te3lE8ImQx0Z8EfP7o5b",
    "synthesis": "sIak7pFapfSLCfctxdOu",
}

app = FastAPI(title="Dialed Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncBrowserUse(api_key=api_key)

MOBILE_W, MOBILE_H = 390, 844


# ── Import Fetch.ai agents ────────────────────────────────────────────────

from agents import (
    start_bureau, get_boss_rest_url, get_agent_info, get_bureau_info,
    set_broadcast_hook, set_agent_active_hook, reset_memory,
    AGENT_ADDRESS_MAP,
)
import re


# ── Models ────────────────────────────────────────────────────────────────

class ReelContent(BaseModel):
    caption_text: str
    creator_handle: str
    like_count: str
    comment_count: str
    visual_description: str


class StartSessionRequest(BaseModel):
    platform: str = "instagram"
    username: str = ""
    password: str = ""


class SessionResponse(BaseModel):
    live_url: str


class TwoFARequest(BaseModel):
    code: str


class UserChatRequest(BaseModel):
    message: str


class SessionStatus(BaseModel):
    active: bool
    stats: dict
    state: str


AGENTS_LIST = [
    {"id": "boss",       "name": "Boss Agent",    "role": "Dispatch & Coordination"},
    {"id": "classifier", "name": "Classifier",    "role": "Brain Rot Detection"},
    {"id": "context",    "name": "Context Agent",  "role": "Session State Machine"},
    {"id": "strategist", "name": "Strategist",     "role": "Intervention Planning"},
    {"id": "synthesis",  "name": "Synthesis Agent", "role": "Letter & Narration"},
]


# ── State ─────────────────────────────────────────────────────────────────

class AppState:
    def __init__(self):
        self.session = None
        self.scout_task: Optional[asyncio.Task] = None
        self.ws_clients: set[WebSocket] = set()
        self.content_index = 0
        self.stats = {"scanned": 0, "detected": 0, "interventions": 0, "reclaimed": 0}
        self.session_state = "NORMAL"
        self.social_creds: Optional[StartSessionRequest] = None
        self.twofa_event: asyncio.Event = asyncio.Event()
        self.twofa_code: Optional[str] = None
        self.active_agents: set = set()
        self.chat_history: list = []


state = AppState()


# ── Broadcast ─────────────────────────────────────────────────────────────

async def broadcast(data: dict):
    dead = set()
    for ws in state.ws_clients:
        try:
            await ws.send_json(data)
        except Exception:
            dead.add(ws)
    state.ws_clients -= dead


async def set_agent_active(agent_id: str, active: bool):
    if active:
        state.active_agents.add(agent_id)
    else:
        state.active_agents.discard(agent_id)
    await broadcast({"type": "agent_status", "agent_id": agent_id, "active": active})


# Wire broadcast hooks into agents (same event loop, no threading needed)
set_broadcast_hook(broadcast)
set_agent_active_hook(set_agent_active)


# ── Bureau startup ────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    print("🚀 Starting Fetch.ai Bureau...", flush=True)
    await start_bureau()


# ── Send content to Boss Agent via REST ───────────────────────────────────

async def send_to_boss(content_request: dict) -> Optional[dict]:
    url = get_boss_rest_url()
    idx = content_request.get("content_index", "?")
    print(f"📤 Sending #{idx} to Boss at {url}...", flush=True)
    try:
        async with httpx.AsyncClient(timeout=90) as http:
            resp = await http.post(url, json=content_request)
            if resp.status_code == 200:
                data = resp.json()
                print(f"📥 Boss returned #{idx}: brain_rot={data.get('is_brain_rot')} conf={data.get('confidence')}", flush=True)
                return data
            print(f"❌ Boss returned {resp.status_code}: {resp.text[:300]}", flush=True)
            return None
    except httpx.TimeoutException:
        print(f"⏰ Boss timed out on #{idx} (90s)", flush=True)
        return None
    except Exception as e:
        print(f"❌ Error sending #{idx} to Boss: {e}", flush=True)
        return None


# ── Scout Loop ────────────────────────────────────────────────────────────

async def scout_loop():
    if not state.session:
        return

    session_id = state.session.id
    creds = state.social_creds

    await set_agent_active("boss", True)
    await broadcast({
        "type": "ticker", "from": "System", "to": "Scout",
        "msg": "Session initialized — connecting to Instagram feed",
        "msg_type": "system",
    })

    # ── Login ─────────────────────────────────────────────────────────
    if creds and creds.username and creds.password:
        try:
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Logging into Instagram as @{creds.username}...",
                "msg_type": "system",
            })
            await client.run(
                f"Navigate to https://www.instagram.com/accounts/login/. "
                f"Enter the username '{creds.username}' into the username field. "
                f"Enter the password '{creds.password}' into the password field. "
                f"Click the Log In button. Wait a few seconds for the next page to appear. "
                f"Do NOT interact with anything else after clicking Log In — just stop and wait.",
                session_id=session_id,
            )
        except Exception as e:
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Login error: {str(e)[:120]}",
                "msg_type": "system",
            })
            return

        # ── 2FA pause ─────────────────────────────────────────────────
        state.twofa_event.clear()
        state.twofa_code = None
        await broadcast({
            "type": "ticker", "from": "System", "to": "User",
            "msg": "Verification required — enter the security code sent to your email or phone.",
            "msg_type": "system",
        })
        await broadcast({"type": "2fa_required"})

        print("⏳ Waiting for 2FA code...", flush=True)
        await state.twofa_event.wait()
        code = state.twofa_code
        print("✅ 2FA code received — agent entering code", flush=True)

        try:
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": "Entering verification code...",
                "msg_type": "system",
            })
            await client.run(
                f"There should be a security code / verification input field on the page. "
                f"Type the code '{code}' into the verification input field and submit it "
                f"(click Confirm or press Enter). Wait for the page to load after submitting. "
                f"If any dialog appears (like 'Save Your Login Info', 'Turn on Notifications', "
                f"or 'Add Instagram to Home Screen'), dismiss it by clicking 'Not Now' or the X button.",
                session_id=session_id,
            )
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Authenticated as @{creds.username}. Navigating to feed.",
                "msg_type": "system",
            })
            await broadcast({"type": "2fa_resolved"})
        except Exception as e:
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Verification error: {str(e)[:120]}",
                "msg_type": "system",
            })
            return

    # ── Navigate to Reels ─────────────────────────────────────────────
    try:
        await client.run(
            "Navigate to https://www.instagram.com/reels/ and wait for the first Reel video to load. "
            "If any pop-up or dialog appears, dismiss it.",
            session_id=session_id,
        )
        await broadcast({
            "type": "ticker", "from": "Scout", "to": "Boss",
            "msg": "Feed connected. Beginning content extraction.",
            "msg_type": "system",
        })
    except Exception as e:
        await broadcast({
            "type": "ticker", "from": "Scout", "to": "System",
            "msg": f"Navigation error: {str(e)[:120]}",
            "msg_type": "system",
        })
        return

    # ══════════════════════════════════════════════════════════════════
    #  SEQUENTIAL PIPELINE — extract → analyze → act → scroll → repeat
    #  The browser agent does NOTHING until the pipeline decides.
    # ══════════════════════════════════════════════════════════════════
    session_start = asyncio.get_event_loop().time()
    await set_agent_active("boss", False)

    while state.session and state.session.id == session_id:
        try:
            state.content_index += 1
            idx = state.content_index
            print(f"\n{'='*60}", flush=True)
            print(f"  PIPELINE ITERATION #{idx}", flush=True)
            print(f"{'='*60}", flush=True)

            # ── STEP 1: EXTRACT ───────────────────────────────────────
            # Browser agent ONLY reads. No scrolling, no tapping, nothing.
            print(f"  [1/4] Extracting content from Reel #{idx}...", flush=True)
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Reading Reel #{idx}...",
                "msg_type": "system",
            })

            try:
                result = await client.run(
                    "You are looking at an Instagram Reel. "
                    "Your ONLY job is to READ what is on screen and report back. "
                    "DO NOT scroll. DO NOT tap. DO NOT like. DO NOT interact in ANY way. "
                    "Just read and extract:\n"
                    "1. The caption text\n"
                    "2. The creator username/handle\n"
                    "3. The like count\n"
                    "4. The comment count\n"
                    "5. A brief description of what you see in the video\n"
                    "Report the data and STOP. Do absolutely nothing else.",
                    session_id=session_id,
                    output_schema=ReelContent,
                )
                reel = result.output
            except Exception as e:
                print(f"  ❌ Extraction failed: {e}", flush=True)
                await broadcast({
                    "type": "ticker", "from": "Scout", "to": "System",
                    "msg": f"Extraction error on #{idx} — advancing.",
                    "msg_type": "system",
                })
                try:
                    await client.run(
                        "Swipe up once to go to the next Reel. Do nothing else.",
                        session_id=session_id,
                    )
                except Exception:
                    pass
                await asyncio.sleep(2)
                continue

            state.stats["scanned"] += 1
            print(f"  ✅ Extracted: @{reel.creator_handle} — \"{reel.caption_text[:60]}\"", flush=True)

            await broadcast({
                "type": "ticker", "from": "Scout", "to": "Boss",
                "msg": f'#{idx} — @{reel.creator_handle} — "{reel.caption_text[:60]}"',
                "msg_type": "payload",
            })

            # ── STEP 2: ANALYZE ───────────────────────────────────────
            # Send to Fetch.ai Bureau. Browser agent is IDLE during this.
            print(f"  [2/4] Sending to Fetch.ai pipeline for analysis...", flush=True)
            await broadcast({
                "type": "ticker", "from": "Boss", "to": "Classifier + Context",
                "msg": f"Analyzing #{idx} — waiting for verdict...",
                "msg_type": "dispatch",
            })

            elapsed = int(asyncio.get_event_loop().time() - session_start)
            content_req = {
                "content_index": idx,
                "extracted_text": reel.caption_text,
                "creator_handle": reel.creator_handle,
                "engagement_likes": reel.like_count,
                "engagement_comments": reel.comment_count,
                "visual_description": reel.visual_description,
                "scroll_depth": idx,
                "session_duration_s": elapsed,
                "intent_purpose": [],
                "intent_triggers": [],
                "intent_aggressiveness": "moderate",
            }

            pipeline_result = await send_to_boss(content_req)

            if not pipeline_result:
                print(f"  ⚠️  Analysis returned nothing — skipping post.", flush=True)
                await broadcast({
                    "type": "ticker", "from": "Boss", "to": "Scout",
                    "msg": f"Analysis failed for #{idx} — skipping.",
                    "msg_type": "system",
                })
                try:
                    await client.run(
                        "Swipe up once to go to the next Reel. Do nothing else.",
                        session_id=session_id,
                    )
                except Exception:
                    pass
                await asyncio.sleep(2)
                continue

            is_brain_rot = pipeline_result.get("is_brain_rot", False)
            overlay_msg = pipeline_result.get("overlay_message", "")
            confidence = pipeline_result.get("confidence", 0)
            new_state = pipeline_result.get("session_state")
            if new_state:
                state.session_state = new_state

            print(f"  ✅ Verdict: brain_rot={is_brain_rot} confidence={confidence}", flush=True)

            # ── STEP 3: ACT ───────────────────────────────────────────
            # Browser agent executes ONE action based on the verdict.
            if is_brain_rot:
                state.stats["detected"] += 1
                state.stats["interventions"] += 1
                state.stats["reclaimed"] += 15

                print(f"  [3/4] BRAIN ROT — blocking account @{reel.creator_handle}...", flush=True)

                if overlay_msg:
                    await broadcast({
                        "type": "intervention_overlay",
                        "message": overlay_msg,
                        "content_index": idx,
                    })

                await broadcast({
                    "type": "ticker", "from": "Strategist", "to": "Scout",
                    "msg": f"BLOCK #{idx} — @{reel.creator_handle} flagged. Blocking account.",
                    "msg_type": "intervention",
                })

                # Block the account: tap 3 dots → Block → Confirm
                try:
                    await client.run(
                        "This Reel has been identified as harmful brain rot content. "
                        "DO NOT like it. I need you to block this account. "
                        "Tap the three dots (⋯) or the ellipsis menu icon on the Reel. "
                        "Then tap 'Block' from the menu options. "
                        "If a confirmation dialog appears, confirm the block. "
                        "After blocking, STOP. Do not scroll or do anything else.",
                        session_id=session_id,
                    )
                    print(f"  ✅ Blocked @{reel.creator_handle}", flush=True)
                except Exception as e:
                    print(f"  ⚠️  Block action failed: {e}", flush=True)

                await broadcast({
                    "type": "ticker", "from": "Scout", "to": "System",
                    "msg": f"Blocked @{reel.creator_handle}. Advancing.",
                    "msg_type": "intervention",
                })

            else:
                print(f"  [3/4] CLEAR — liking Reel #{idx}...", flush=True)

                await broadcast({
                    "type": "ticker", "from": "Boss", "to": "Scout",
                    "msg": f"CLEAR #{idx} — content approved. Liking.",
                    "msg_type": "clear",
                })

                # Like: double-tap the reel. That's it.
                try:
                    await client.run(
                        "This Reel has been approved as safe content. "
                        "Double-tap the center of the Reel video to like it. "
                        "After liking, STOP. Do not scroll or do anything else.",
                        session_id=session_id,
                    )
                    print(f"  ✅ Liked Reel #{idx}", flush=True)
                except Exception as e:
                    print(f"  ⚠️  Like action failed: {e}", flush=True)

                await broadcast({
                    "type": "ticker", "from": "Scout", "to": "System",
                    "msg": f"Liked #{idx}.",
                    "msg_type": "clear",
                })

            await broadcast({"type": "stats", **state.stats})

            # ── STEP 4: SCROLL ────────────────────────────────────────
            # Separate step: advance to next Reel. Nothing else.
            print(f"  [4/4] Scrolling to next Reel...", flush=True)
            await asyncio.sleep(1)

            try:
                await client.run(
                    "Swipe up once to scroll to the next Instagram Reel. "
                    "Wait for the next Reel to fully load. "
                    "Then STOP. Do not read, like, or interact with anything.",
                    session_id=session_id,
                )
                print(f"  ✅ Advanced to next Reel.", flush=True)
            except Exception as e:
                print(f"  ⚠️  Scroll failed: {e}", flush=True)

            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Ready for next Reel.",
                "msg_type": "system",
            })

            # Pause before next pipeline iteration
            await asyncio.sleep(2)

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"  ❌ PIPELINE ERROR: {e}", flush=True)
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Pipeline error: {str(e)[:120]}",
                "msg_type": "system",
            })
            try:
                await client.run(
                    "Swipe up once to go to the next Reel. Do nothing else.",
                    session_id=session_id,
                )
            except Exception:
                pass
            await asyncio.sleep(3)

    await set_agent_active("boss", False)


# ── Endpoints ─────────────────────────────────────────────────────────────

_start_lock = asyncio.Lock()


@app.post("/api/session/start", response_model=SessionResponse)
async def start_session(req: StartSessionRequest = StartSessionRequest()):
    if state.session:
        return SessionResponse(live_url=state.session.live_url)

    async with _start_lock:
        if state.session:
            return SessionResponse(live_url=state.session.live_url)

        try:
            print("Creating browser session (mobile viewport)...", flush=True)
            session = await client.sessions.create(
                proxy_country_code="us",
                browser_screen_width=MOBILE_W,
                browser_screen_height=MOBILE_H,
            )
            print(f"Session created: {session.id} — {session.live_url}", flush=True)
        except Exception as e:
            print(f"\n❌ Session creation failed:\n{traceback.format_exc()}", flush=True)
            raise HTTPException(status_code=500, detail=f"browser-use session error: {e}")

        state.session = session
        state.social_creds = req
        state.content_index = 0
        state.stats = {"scanned": 0, "detected": 0, "interventions": 0, "reclaimed": 0}
        state.session_state = "NORMAL"
        state.active_agents = set()
        state.chat_history = []
        reset_memory()

        state.scout_task = asyncio.create_task(scout_loop())
        return SessionResponse(live_url=session.live_url)


@app.post("/api/session/stop")
async def stop_session():
    if state.scout_task and not state.scout_task.done():
        state.scout_task.cancel()
        state.scout_task = None

    if state.session:
        try:
            await client.sessions.stop(str(state.session.id))
        except Exception:
            pass
        state.session = None

    await broadcast({"type": "session_ended"})
    return {"status": "stopped"}


@app.post("/api/session/2fa-complete")
async def twofa_complete(req: TwoFARequest):
    state.twofa_code = req.code
    state.twofa_event.set()
    await broadcast({
        "type": "ticker", "from": "User", "to": "Scout",
        "msg": "Verification code provided — agent entering code.",
        "msg_type": "system",
    })
    return {"status": "ok"}


@app.post("/api/session/chat")
async def user_chat(req: UserChatRequest):
    """Route user chat to Fetch.ai agents via @mention.
    @classifier why did you flag that? → routes to Classifier agent
    No @mention → defaults to Boss Agent.
    Same chat logic that powers the Agentverse ChatMessage handlers."""
    raw = req.message.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty message")

    await broadcast({"type": "chat", "role": "user", "message": raw})
    state.chat_history.append({"role": "user", "message": raw})

    # Parse @mention
    match = re.match(r"^@(\w+)\s+(.*)", raw, re.DOTALL)
    if match:
        target = match.group(1).lower()
        message_text = match.group(2)
    else:
        target = "boss"
        message_text = raw

    AGENT_NAMES = {
        "boss": "Boss Agent", "classifier": "Classifier",
        "context": "Context Agent", "strategist": "Strategist",
        "synthesis": "Synthesis Agent",
    }

    if target not in AGENT_ADDRESS_MAP:
        await broadcast({
            "type": "chat", "role": "agent", "agent_id": "boss",
            "agent_name": "Boss Agent",
            "message": f"Unknown agent: @{target}. Try @boss @classifier @context @strategist @synthesis",
        })
        return {"response": f"Unknown agent: @{target}", "agent": "boss"}

    # Route to the target agent's chat logic (same functions the ChatMessage handlers use)
    from agents import (
        boss_agent, classifier_agent, context_agent, strategist_agent, synthesis_agent,
        memory as agent_memory,
    )

    await set_agent_active(target, True)

    if target == "boss":
        lower = message_text.lower()
        if any(w in lower for w in ["aggressive", "harder", "more"]):
            agent_memory.state = "ELEVATED"
            agent_memory.threshold = 0.50
            response = "Copy that. Shifting to ELEVATED — thresholds tightened."
            state.session_state = "ELEVATED"
            await broadcast({"type": "state_change", "state": "ELEVATED"})
        elif any(w in lower for w in ["chill", "relax", "cool", "less"]):
            agent_memory.state = "COOLDOWN"
            agent_memory.threshold = 0.90
            response = "Understood. Entering cooldown — suppressing interventions."
            state.session_state = "COOLDOWN"
            await broadcast({"type": "state_change", "state": "COOLDOWN"})
        elif any(w in lower for w in ["time", "save", "reclaim", "stats"]):
            response = (
                f"Session stats: {agent_memory.total_seen} scanned, {agent_memory.brain_rot_count} brain rot, "
                f"{agent_memory.interventions_fired} interventions, {agent_memory.time_reclaimed}s reclaimed."
            )
        elif any(w in lower for w in ["state", "status"]):
            response = (
                f"State: {agent_memory.state}. Threshold: {agent_memory.threshold:.2f}. "
                f"Brain rot: {agent_memory.brain_rot_count}/{agent_memory.total_seen}."
            )
        elif any(w in lower for w in ["stop", "end", "quit"]):
            response = "Ending session. Generating summary..."
        else:
            response = f'Acknowledged: "{message_text[:60]}". Routing to pipeline.'

    elif target == "classifier":
        lv = agent_memory.last_classification
        lower = message_text.lower()
        if any(w in lower for w in ["why", "flag", "explain", "last", "rationale"]) and lv:
            response = (
                f"I flagged Reel #{lv.get('content_index', '?')} with "
                f"{lv.get('confidence', 0):.0%} confidence. "
                f"Tactics: {', '.join(lv.get('detected_tactics', []))}. "
                f"Rationale: {lv.get('rationale', 'N/A')}"
            )
        elif any(w in lower for w in ["criteria", "how", "what", "detect"]):
            response = (
                "I evaluate: rage bait, FOMO, social comparison, outrage amplification, "
                "parasocial exploitation, engagement bait, cliffhanger hooks. "
                "Each Reel gets a confidence score (0.0-1.0)."
            )
        else:
            response = "I'm the Classifier. Ask me why I flagged something or about my detection criteria."

    elif target == "context":
        recent = agent_memory.recent_verdicts[-10:]
        ratio = sum(recent) / len(recent) if recent else 0
        fatigue = min(len(agent_memory.interventions_timestamps) / 6.0, 1.0)
        response = (
            f"State: {agent_memory.state}. Threshold: {agent_memory.threshold:.2f}. "
            f"Brain rot density: {ratio:.0%} in last {len(recent)}. "
            f"Fatigue: {fatigue:.2f}. Interventions: {agent_memory.interventions_fired}."
        )

    elif target == "strategist":
        lv = agent_memory.last_verdict
        if lv and lv.get("is_brain_rot"):
            response = (
                f"Last intervention on #{lv.get('content_index', '?')}: "
                f"state={lv.get('session_state', 'NORMAL')}, conf={lv.get('confidence', 0):.2f}. "
                f"High confidence + elevated state = overlay. Below threshold = pass."
            )
        else:
            response = "No interventions yet. I decide severity based on confidence, state, and escalation matrix."

    elif target == "synthesis":
        if agent_memory.letter_paragraphs:
            letter = "\n\n".join(agent_memory.letter_paragraphs)
            response = f"Letter so far:\n\n{letter}"
        else:
            response = "The Letter hasn't started yet. Once brain rot is detected, I'll begin writing."

    else:
        response = f"@{target} received your message."

    await set_agent_active(target, False)
    await broadcast({
        "type": "chat", "role": "agent", "agent_id": target,
        "agent_name": AGENT_NAMES.get(target, target),
        "message": response,
    })
    state.chat_history.append({"role": "agent", "agent_id": target, "message": response})
    return {"response": response, "agent": target, "address": AGENT_ADDRESS_MAP[target]}


@app.get("/api/agents")
async def get_agents():
    return {
        "agents": get_agent_info(),
        "bureau": get_bureau_info(),
    }


class TTSRequest(BaseModel):
    agent_id: str
    text: str


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """Generate speech audio for an agent using ElevenLabs."""
    if not elevenlabs_key:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")

    voice_id = AGENT_VOICES.get(req.agent_id)
    if not voice_id:
        raise HTTPException(status_code=400, detail=f"No voice configured for agent: {req.agent_id}")

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={
                    "xi-api-key": elevenlabs_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": req.text[:500],
                    "model_id": "eleven_flash_v2_5",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
            )

        if resp.status_code != 200:
            detail = resp.text[:200]
            print(f"ElevenLabs error ({resp.status_code}): {detail}", flush=True)
            raise HTTPException(status_code=502, detail=f"ElevenLabs error: {resp.status_code}")

        from fastapi.responses import Response
        return Response(
            content=resp.content,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f'inline; filename="{req.agent_id}.mp3"'},
        )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="ElevenLabs timeout")
    except HTTPException:
        raise
    except Exception as e:
        print(f"TTS error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e)[:100])


@app.get("/api/session/status", response_model=SessionStatus)
async def session_status():
    return SessionStatus(
        active=state.session is not None,
        stats=state.stats,
        state=state.session_state,
    )


@app.get("/api/health")
async def health():
    return {
        "browser_use_key": bool(api_key),
        "anthropic_key": bool(anthropic_key),
        "bureau": get_bureau_info(),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.ws_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        state.ws_clients.discard(websocket)
