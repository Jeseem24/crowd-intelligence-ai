"""
LLM Client Wrapper with Autonomous Multi-Model Failover Cascade.
Provides rich generative reasoning using Groq API with zero crash guarantee.
If a model quota burns out (HTTP 429), it automatically cascades across alternative models.
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
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Prioritized multi-model cascade with independent rate limit pools
CANDIDATE_MODELS = [
    LLM_MODEL,
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
    "qwen/qwen3.8-27b",
]
# Deduplicate while preserving order
DEFAULT_CASCADE = [m for i, m in enumerate(CANDIDATE_MODELS) if m not in CANDIDATE_MODELS[:i]]


class LLMClient:
    def __init__(self, api_key=None, model=None):
        self.api_key = api_key or GROQ_API_KEY
        self.model = model or LLM_MODEL
        # Build cascade with priority for the configured model
        cascade = [self.model] + [m for m in DEFAULT_CASCADE if m != self.model]
        self.model_cascade = [m for i, m in enumerate(cascade) if m not in cascade[:i]]

    async def _execute_with_failover(self, messages, temperature=0.2, response_format=None, timeout=4.5):
        """
        Executes chat completion with automatic failover across different model quotas on Groq.
        If a model hits HTTP 429 (quota exhausted) or 503, seamlessly tries the next model in cascade.
        """
        if not self.api_key:
            return None, None

        for idx, model in enumerate(self.model_cascade):
            try:
                payload = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                }
                if response_format:
                    payload["response_format"] = response_format

                async with httpx.AsyncClient(timeout=timeout) as client:
                    res = await client.post(
                        GROQ_API_URL,
                        headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                        json=payload
                    )
                    if res.status_code == 200:
                        data = res.json()
                        content = data["choices"][0]["message"]["content"]
                        if idx > 0:
                            print(f"✨ [LLM CASCADE]: Successfully served request via failover model '{model}'")
                        return content, model
                    elif res.status_code in (429, 400, 503):
                        next_model = self.model_cascade[idx + 1] if idx + 1 < len(self.model_cascade) else "Deterministic Fallback"
                        print(f"⚠️ [LLM FAILOVER]: Model '{model}' exhausted (HTTP {res.status_code}). Cascading to '{next_model}'...")
                        continue
            except Exception as e:
                next_model = self.model_cascade[idx + 1] if idx + 1 < len(self.model_cascade) else "Deterministic Fallback"
                print(f"⚠️ [LLM FAILOVER]: Model '{model}' error ({e}). Cascading to '{next_model}'...")
                continue

        return None, None

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

        messages = [{"role": "user", "content": prompt}]
        content, used_model = await self._execute_with_failover(
            messages,
            temperature=0.2,
            response_format={"type": "json_object"},
            timeout=4.5
        )

        if content:
            try:
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
                    "source": f"llm ({used_model})",
                    "created_at": fallback["created_at"]
                }
            except Exception as e:
                print(f"[LLM] JSON parse notice: Using template fallback ({e})")

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

        messages = [{"role": "user", "content": prompt}]
        content, _ = await self._execute_with_failover(messages, temperature=0.3, timeout=5.5)
        if content and len(content.strip()) > 30:
            return content.strip()

        return fallback

    async def answer_operator_chat(self, query, venue_state):
        """Answers operator chat queries using grounded telemetry with model failover."""
        fallback = generate_fallback_chat_response(query, venue_state)
        if not self.api_key:
            return fallback

        prompt = f"""You are Antigravity Safety AI assisting an operator in a live command center.
Answer the operator's question concisely in 1-3 sentences. You MUST base your answer directly on these live numbers:
{json.dumps(venue_state, indent=2)}

Question: {query}"""

        messages = [{"role": "user", "content": prompt}]
        content, _ = await self._execute_with_failover(messages, temperature=0.3, timeout=4.5)
        if content and len(content.strip()) > 10:
            return content.strip()

        return fallback
