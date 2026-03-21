from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from browser_use_sdk import AsyncBrowserUse
from typing import Optional
from pathlib import Path
import asyncio
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Dialed Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncBrowserUse()


# ── Models ────────────────────────────────────────────────────────────────

class ReelContent(BaseModel):
    caption_text: str
    creator_handle: str
    like_count: str
    comment_count: str
    visual_description: str


class ReelBatch(BaseModel):
    items: list[ReelContent]


class StartSessionRequest(BaseModel):
    platform: str = "instagram"
    username: str = ""
    password: str = ""


class SessionResponse(BaseModel):
    scout_live_url: str
    intervention_live_url: str


class SessionStatus(BaseModel):
    active: bool
    stats: dict
    state: str


# ── State ─────────────────────────────────────────────────────────────────

class AppState:
    def __init__(self):
        self.scout_session = None
        self.intervention_session = None
        self.scout_task: Optional[asyncio.Task] = None
        self.ws_clients: set[WebSocket] = set()
        self.content_index = 0
        self.stats = {"scanned": 0, "detected": 0, "interventions": 0, "reclaimed": 0}
        self.session_state = "NORMAL"
        self.social_creds: Optional[StartSessionRequest] = None

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


# ── Scout Loop ────────────────────────────────────────────────────────────

async def scout_loop():
    """Log into Instagram (if creds provided), scroll Reels, extract content."""
    if not state.scout_session:
        return

    session_id = state.scout_session.id
    creds = state.social_creds

    await broadcast({
        "type": "ticker", "from": "System", "to": "Scout",
        "msg": "Session initialized — connecting to Instagram feed",
        "msg_type": "system",
    })

    # Log in if credentials are provided
    if creds and creds.username and creds.password:
        try:
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Logging into Instagram as @{creds.username}...",
                "msg_type": "system",
            })
            await client.run(
                f"Navigate to instagram.com/accounts/login/. "
                f"Enter the username '{creds.username}' into the username field. "
                f"Enter the password '{creds.password}' into the password field. "
                f"Click the Log In button and wait for the page to fully load. "
                f"If a 'Save Your Login Info' or 'Turn on Notifications' dialog appears, dismiss it.",
                session_id=session_id,
            )
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Authenticated as @{creds.username}. Navigating to feed.",
                "msg_type": "system",
            })
        except Exception as e:
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "System",
                "msg": f"Login error: {str(e)[:120]}",
                "msg_type": "system",
            })
            return

    # Navigate to Reels
    try:
        await client.run(
            "Navigate to instagram.com/reels and wait for the first Reel to load.",
            session_id=session_id,
        )
        await broadcast({
            "type": "ticker", "from": "Scout", "to": "System",
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

    # Extraction loop
    while state.scout_session and state.scout_session.id == session_id:
        try:
            state.content_index += 1
            idx = state.content_index

            result = await client.run(
                """Look at the current Reel on screen. Extract:
                - The full caption text
                - The creator's handle
                - The visible like count
                - The visible comment count
                - A brief visual description of the content
                Then scroll down to the next Reel.""",
                session_id=session_id,
                output_schema=ReelContent,
            )

            reel = result.output
            state.stats["scanned"] += 1

            # Scout → Boss: content payload
            await broadcast({
                "type": "ticker", "from": "Scout", "to": "Boss",
                "msg": f'ContentPayload #{idx} — @{reel.creator_handle} — "{reel.caption_text[:80]}" — {reel.like_count} likes',
                "msg_type": "payload",
            })

            # Push updated stats
            await broadcast({"type": "stats", **state.stats})

            # TODO: forward reel to intelligence layer (Fetch.ai agents)
            # For now, broadcast a dispatch message
            await broadcast({
                "type": "ticker", "from": "Boss", "to": "Classifier",
                "msg": f"Dispatching #{idx} for classification — checking against intent profile",
                "msg_type": "dispatch",
            })

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


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/session/start", response_model=SessionResponse)
async def start_session(req: StartSessionRequest = StartSessionRequest()):
    """Create two browser-use Cloud sessions (Scout + Intervention) and start the scout loop."""
    if state.scout_session or state.intervention_session:
        await stop_session()

    try:
        scout = await client.sessions.create(proxy_country_code="us")
        intervention = await client.sessions.create(proxy_country_code="us")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"browser-use session error: {e}")

    state.scout_session = scout
    state.intervention_session = intervention
    state.social_creds = req
    state.content_index = 0
    state.stats = {"scanned": 0, "detected": 0, "interventions": 0, "reclaimed": 0}
    state.session_state = "NORMAL"

    state.scout_task = asyncio.create_task(scout_loop())

    return SessionResponse(
        scout_live_url=scout.live_url,
        intervention_live_url=intervention.live_url,
    )


@app.post("/api/session/stop")
async def stop_session():
    """Stop both browser sessions and cancel the scout loop."""
    if state.scout_task and not state.scout_task.done():
        state.scout_task.cancel()
        state.scout_task = None

    for label in ("scout_session", "intervention_session"):
        session = getattr(state, label)
        if session:
            try:
                await client.sessions.stop(session.id)
            except Exception:
                pass
            setattr(state, label, None)

    await broadcast({"type": "session_ended"})
    return {"status": "stopped"}


@app.get("/api/session/status", response_model=SessionStatus)
async def session_status():
    return SessionStatus(
        active=state.scout_session is not None,
        stats=state.stats,
        state=state.session_state,
    )


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
