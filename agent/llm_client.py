"""
LLM Client Wrapper with Automatic Fallback.
Provides rich generative reasoning using Groq API while guaranteeing zero crashes.
"""

import os
import json
import httpx
from dotenv import load_dotenv
from agent.template_fallback import (
    generate_fallback_recommendation,
    generate_fallback_briefing,
    generate_fallback_chat_response
)

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3.8-27b")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMClient:
    def __init__(self, api_key=None, model=None):
        self.api_key = api_key or GROQ_API_KEY
        self.model = model or LLM_MODEL

    async def generate_recommendation(self, zone_state):
        """Generates 5-part explainable recommendation via LLM or template fallback."""
        fallback = generate_fallback_recommendation(zone_state)
        if not self.api_key:
            return fallback

        prompt = f"""You are an Expert Crowd Safety Decision Support AI operating an Integrated Command & Control Centre.
Analyze this high-priority zone telemetry and output a strict JSON object with these 5 keys:
- "observation": Concise factual summary of density ({zone_state['density']} p/m²) and movement ({zone_state['behaviour_flag']}).
- "trend": Rate of accumulation ({zone_state['trend_slope']} p/m²/s) and time-to-critical ({zone_state.get('time_to_critical_s')}s).
- "prediction": Potential physical crush hazard or turnstile compression risk within 60s.
- "recommendation": Specific actionable human-in-the-loop operational directive for stewards and gate operators.
- "expected_benefit": Quantifiable outcome (e.g. 50-65% reduction in chokepoint inflow in 90s).

Zone data:
{json.dumps(zone_state, indent=2)}

Output ONLY valid raw JSON with keys: observation, trend, prediction, recommendation, expected_benefit."""

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(
                    GROQ_API_URL,
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                        "response_format": {"type": "json_object"}
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    return {
                        "rec_id": fallback["rec_id"],
                        "zone_id": zone_state["zone_id"],
                        "severity": zone_state["state"],
                        "observation": parsed.get("observation", fallback["observation"]),
                        "trend": parsed.get("trend", fallback["trend"]),
                        "prediction": parsed.get("prediction", fallback["prediction"]),
                        "recommendation": parsed.get("recommendation", fallback["recommendation"]),
                        "expected_benefit": parsed.get("expected_benefit", fallback["expected_benefit"]),
                        "status": "open",
                        "source": "llm",
                        "created_at": fallback["created_at"]
                    }
        except Exception as e:
            print(f"[LLM] Notice: Using deterministic template fallback ({e})")

        return fallback

    async def generate_briefing(self, venue_state):
        """Generates venue safety briefing via LLM or template fallback."""
        fallback = generate_fallback_briefing(venue_state)
        if not self.api_key:
            return fallback

        prompt = f"""You are the Chief Safety AI for a major public venue.
Summarize the current situation into a structured Markdown briefing for command room operators.
Highlight high-risk zones, projected time-to-critical, and steward allocations.

Venue Telemetry:
{json.dumps(venue_state, indent=2)}"""

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    GROQ_API_URL,
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }
                )
                if res.status_code == 200:
                    content = res.json()["choices"][0]["message"]["content"].strip()
                    if content:
                        return content
        except Exception as e:
            print(f"[LLM] Notice: Using fallback briefing ({e})")

        return fallback

    async def answer_operator_chat(self, query, venue_state):
        """Answers operator chat queries using grounded telemetry."""
        fallback = generate_fallback_chat_response(query, venue_state)
        if not self.api_key:
            return fallback

        prompt = f"""You are Antigravity Safety AI assisting an operator in a live command center.
Answer the operator's question concisely in 1-3 sentences. You MUST base your answer directly on these live numbers:
{json.dumps(venue_state, indent=2)}

Question: {query}"""

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(
                    GROQ_API_URL,
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }
                )
                if res.status_code == 200:
                    content = res.json()["choices"][0]["message"]["content"].strip()
                    if content:
                        return content
        except Exception:
            pass

        return fallback
