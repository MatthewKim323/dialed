"""
Register all five Dialed agents on Agentverse.
Calls the Agentverse API directly using the same challenge/response flow
that the Agent Inspector uses.
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import aiohttp

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path, override=True)


def _read_key(key):
    val = os.getenv(key, "")
    if val:
        return val
    try:
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


AGENTVERSE_API_KEY = _read_key("AGENTVERSE_API_KEY")
os.environ["ANTHROPIC_API_KEY"] = _read_key("ANTHROPIC_API_KEY")

if not AGENTVERSE_API_KEY:
    print("AGENTVERSE_API_KEY not found in .env")
    sys.exit(1)

print(f"API key loaded ({AGENTVERSE_API_KEY[:20]}...)\n")

AGENTVERSE_BASE = "agentverse.ai"
IDENTITY_API = f"https://{AGENTVERSE_BASE}/v2/identity"
AGENTS_API = f"https://{AGENTVERSE_BASE}/v2/agents"

HEADERS = {
    "Authorization": f"Bearer {AGENTVERSE_API_KEY}",
    "Content-Type": "application/json",
}


async def register_agent(session, agent):
    name = agent._name
    addr = agent.address
    identity = agent._identity
    desc = agent._description or ""

    print(f"Registering {name} ({addr[:24]}...)...")

    # Step 1: Request challenge
    challenge_url = f"{IDENTITY_API}/{addr}/challenge"
    async with session.get(challenge_url, headers=HEADERS) as resp:
        body = await resp.json()
        if resp.status != 200:
            print(f"  ❌ Challenge failed ({resp.status}): {body}")
            return False
        challenge = body.get("challenge", "")
        print(f"  ✓ Challenge received")

    # Step 2: Prove identity (sign the challenge)
    signature = identity.sign(challenge.encode())
    proof_payload = {
        "address": addr,
        "challenge": challenge,
        "challenge_response": signature,
    }
    async with session.post(IDENTITY_API, json=proof_payload, headers=HEADERS) as resp:
        body = await resp.json()
        if resp.status != 200:
            print(f"  ❌ Identity proof failed ({resp.status}): {body}")
            return False
        print(f"  ✓ Identity proven")

    # Step 3: Register agent details
    protocols = []
    if hasattr(agent, 'protocols'):
        protocols = [p.digest for p in agent.protocols.values()]

    agent_payload = {
        "address": addr,
        "name": name,
        "agent_type": "uagent",
        "profile": {
            "description": desc,
            "readme": "",
            "avatar_url": "",
        },
        "protocols": protocols,
    }
    async with session.post(AGENTS_API, json=agent_payload, headers=HEADERS) as resp:
        body = await resp.json()
        if resp.status == 200:
            print(f"  ✅ {name} registered on Agentverse!")
            return True
        else:
            print(f"  ⚠️  Registration response ({resp.status}): {body}")
            return False


async def register_all():
    from agents import (
        boss_agent, classifier_agent, context_agent,
        strategist_agent, synthesis_agent,
    )

    agents = [
        boss_agent, classifier_agent, context_agent,
        strategist_agent, synthesis_agent,
    ]

    async with aiohttp.ClientSession() as session:
        for agent in agents:
            await register_agent(session, agent)
            print()

    print("Done! Check https://agentverse.ai — your agents should appear under 'My Agents'.")
    print("Then restart your backend (uvicorn main:app --reload) and the mailbox warnings should be gone.\n")


if __name__ == "__main__":
    asyncio.run(register_all())
