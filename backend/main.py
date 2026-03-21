from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from browser_use_sdk import AsyncBrowserUse
from typing import Optional
from pathlib import Path
import asyncio
import os
import traceback
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

if not api_key:
    print(f"\n⚠️  BROWSER_USE_API_KEY not found in {env_path}\n", flush=True)
else:
    print(f"\n✅ BROWSER_USE_API_KEY loaded ({api_key[:8]}...) from {env_path}\n", flush=True)

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


# ── Agent definitions (for frontend agent cards) ─────────────────────────

AGENTS = [
    {"id": "boss",        "name": "Boss Agent",      "role": "Dispatch & Coordination"},
    {"id": "classifier",  "name": "Classifier",      "role": "Brain Rot Detection"},
    {"id": "context",     "name": "Context Agent",    "role": "Session State Machine"},
    {"id": "strategist",  "name": "Strategist",       "role": "Intervention Planning"},
    {"id": "synthesis",   "name": "Synthesis Agent",   "role": "Letter & Narration"},
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

        # ── 2FA pause: wait for user to provide the code ──────────────
        state.twofa_event.clear()
        state.twofa_code = None
        await broadcast({
            "type": "ticker", "from": "System", "to": "User",
            "msg": "Verification required — enter the security code sent to your email or phone.",
            "msg_type": "system",
        })
        await broadcast({"type": "2fa_required"})

        print("⏳ Waiting for user to provide 2FA code...", flush=True)
        await state.twofa_event.wait()
        code = state.twofa_code
        print(f"✅ 2FA code received ({code[:2]}...) — agent entering code", flush=True)

        # Agent enters the code autonomously
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

    # ── Extraction loop ───────────────────────────────────────────────
    while state.session and state.session.id == session_id:
        try:
            state.content_index += 1
            idx = state.content_index

            await set_agent_active("boss", True)

            result = await client.run(
                """Look at the current Reel on screen. Extract:
                - The full caption text (or empty string if not visible)
                - The creator's handle / username
                - The visible like count (or "N/A")
                - The visible comment count (or "N/A")
                - A brief visual description of what the Reel shows
                After extracting, scroll down to advance to the next Reel.""",
                session_id=session_id,
                output_schema=ReelContent,
            )

            reel = result.output
            state.stats["scanned"] += 1

            await broadcast({
                "type": "ticker", "from": "Scout", "to": "Boss",
                "msg": f'ContentPayload #{idx} — @{reel.creator_handle} — "{reel.caption_text[:80]}" — {reel.like_count} likes',
                "msg_type": "payload",
            })

            # Simulate agent pipeline
            await set_agent_active("classifier", True)
            await broadcast({
                "type": "ticker", "from": "Boss", "to": "Classifier",
                "msg": f"Dispatching #{idx} for classification — checking against intent profile",
                "msg_type": "dispatch",
            })

            await broadcast({"type": "stats", **state.stats})
            await set_agent_active("classifier", False)
            await set_agent_active("boss", False)

            await asyncio.sleep(1)

        except asyncio.CancelledError:
            break
        except Exception as e:
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Extraction error: {str(e)[:120]}",
                "msg_type": "system",
            })
            await asyncio.sleep(5)

    await set_agent_active("boss", False)


# ── Endpoints ─────────────────────────────────────────────────────────────

_start_lock = asyncio.Lock()


@app.post("/api/session/start", response_model=SessionResponse)
async def start_session(req: StartSessionRequest = StartSessionRequest()):
    if state.session:
        print("Session already running — returning existing URL", flush=True)
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
    """User provides the 2FA code — agent will enter it autonomously."""
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
    """User sends a command to the agent swarm via the Boss Agent."""
    msg = req.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Empty message")

    await broadcast({
        "type": "chat", "role": "user", "message": msg,
    })
    state.chat_history.append({"role": "user", "message": msg})

    # TODO: Route through Fetch.ai Boss Agent → Claude for intent classification
    # For now, the Boss Agent acknowledges and responds contextually
    await set_agent_active("boss", True)

    lower = msg.lower()
    if any(w in lower for w in ["aggressive", "harder", "more"]):
        response = "Copy that. Shifting Context Agent to ELEVATED — thresholds tightened. I'll flag more aggressively."
        state.session_state = "ELEVATED"
        await broadcast({"type": "state_change", "state": "ELEVATED"})
    elif any(w in lower for w in ["chill", "relax", "cool", "less"]):
        response = "Understood. Entering manual cooldown — suppressing interventions for 2 minutes."
        state.session_state = "COOLDOWN"
        await broadcast({"type": "state_change", "state": "COOLDOWN"})
    elif any(w in lower for w in ["time", "save", "reclaim", "stats"]):
        s = state.stats
        response = f"Session stats: {s['scanned']} Reels scanned, {s['detected']} brain rot detected, {s['interventions']} interventions fired, {s['reclaimed']}s of attention reclaimed."
    elif any(w in lower for w in ["why", "explain", "flag", "last"]):
        await set_agent_active("classifier", True)
        response = "The last flagged content matched rage bait patterns — manufactured outrage with high engagement-to-value ratio. Confidence was above threshold for the current session state."
        await set_agent_active("classifier", False)
    elif any(w in lower for w in ["stop", "end", "quit"]):
        response = "Ending session. Generating summary..."
    else:
        response = f"Acknowledged: \"{msg[:60]}\". I'll adjust the pipeline accordingly."

    await asyncio.sleep(0.3)

    await broadcast({
        "type": "chat", "role": "agent", "agent_id": "boss",
        "agent_name": "Boss Agent", "message": response,
    })
    state.chat_history.append({"role": "agent", "agent_id": "boss", "message": response})

    await set_agent_active("boss", False)
    return {"response": response, "agent": "boss"}


@app.get("/api/agents")
async def get_agents():
    return {"agents": AGENTS}


@app.get("/api/session/status", response_model=SessionStatus)
async def session_status():
    return SessionStatus(
        active=state.session is not None,
        stats=state.stats,
        state=state.session_state,
    )


@app.get("/api/health")
async def health():
    has_key = bool(api_key)
    test_ok = False
    error_msg = None
    if has_key:
        try:
            session = await client.sessions.create()
            test_ok = True
            await client.sessions.stop(str(session.id))
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
    return {"api_key_set": has_key, "session_test": test_ok, "error": error_msg}


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
