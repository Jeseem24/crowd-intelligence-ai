"""
Agentic AI Decision Layer — Continuous reasoning, recommendations, briefings, and chat.

Implements:
- Offline Template Fallback (primary safety net — always works)
- Groq LLM Client (optional upgrade for richer language)
- Continuous Reasoning Loop (15-30s cycle or on state change)
- 5-Part Explainable Recommendations
- Autonomous Safety Briefings
- Grounded Operator Chat Handler
"""

import os
import time
import json
import httpx
from dotenv import load_dotenv
from backend.database import save_alert, save_briefing, save_chat, get_alerts

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.1-70b-versatile")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


# ============================================================
# OFFLINE TEMPLATE FALLBACK — The safety net that always works
# ============================================================

def template_recommendation(zone_data):
    """Generate a deterministic 5-part recommendation from live numbers."""
    zone_name = zone_data["zone_name"]
    density = zone_data["density"]
    behaviour = zone_data["behaviour_flag"]
    slope = zone_data["trend_slope"]
    ttc = zone_data.get("time_to_critical_s")
    state = zone_data["state"]
    reports = zone_data.get("active_reports", 0)

    # Observation
    behaviour_text = ""
    if behaviour == "surge":
        behaviour_text = " with active crowd surge detected"
    elif behaviour == "running":
        behaviour_text = " with running movement detected"

    report_text = f" and {reports} citizen hazard report(s)" if reports > 0 else ""
    observation = f"{zone_name} density is {density:.2f} people/m² ({state} state){behaviour_text}{report_text}."

    # Trend
    if slope > 0:
        trend_dir = "increasing"
        ttc_text = f" Critical threshold projected in ~{ttc}s." if ttc else ""
    elif slope < -0.01:
        trend_dir = "decreasing"
        ttc_text = ""
    else:
        trend_dir = "stable"
        ttc_text = ""
    trend = f"Crowd density is {trend_dir} at a rate of {slope:+.3f} people/m²/s.{ttc_text}"

    # Prediction
    if state == "Critical":
        prediction = f"Continued inflow at this rate risks dangerous overcrowding and potential crush conditions within 60 seconds."
    elif state == "Warning":
        prediction = f"If current trend continues, {zone_name} will reach Critical status, requiring immediate intervention."
    elif state == "Watch":
        prediction = f"Crowd levels are elevated. Without proactive management, this zone may escalate to Warning status."
    else:
        prediction = f"Current crowd levels are within safe operating limits. No immediate risk projected."

    # Recommendation
    if state == "Critical":
        recommendation = f"Immediately hold entry flow to {zone_name}. Deploy additional stewards to manage crowd. Divert incoming attendees to lower-density zones. Consider activating emergency egress routes."
    elif state == "Warning":
        recommendation = f"Increase monitoring of {zone_name}. Pre-position crowd management stewards. Consider slowing entry flow to prevent further density increase."
    elif state == "Watch":
        recommendation = f"Continue monitoring {zone_name}. Alert stewards to be ready for potential crowd management actions."
    else:
        recommendation = f"No action required for {zone_name}. Maintain standard monitoring."

    # Expected Benefit
    if state in ("Critical", "Warning"):
        expected_benefit = f"Implementing these measures should reduce {zone_name} density to Safe levels within 90-120 seconds, preventing dangerous overcrowding."
    elif state == "Watch":
        expected_benefit = f"Proactive monitoring will enable early detection of escalation, allowing intervention before unsafe conditions develop."
    else:
        expected_benefit = f"Maintaining current operations ensures continued safe conditions across the venue."

    return {
        "observation": observation,
        "trend": trend,
        "prediction": prediction,
        "recommendation": recommendation,
        "expected_benefit": expected_benefit,
        "source": "template",
    }


def template_briefing(venue_state):
    """Generate a deterministic safety briefing from venue state."""
    zones = venue_state["zones"]
    overall = venue_state["overall_status"]
    timestamp = venue_state["timestamp"]

    # Sort zones by risk (highest first)
    sorted_zones = sorted(zones, key=lambda z: z["risk_score"], reverse=True)

    lines = []
    lines.append(f"═══ AUTONOMOUS SAFETY BRIEFING ═══")
    lines.append(f"Generated: {timestamp}")
    lines.append(f"")
    lines.append(f"📊 OVERALL VENUE STATUS: {overall.upper()}")
    lines.append(f"")

    # High-risk zones
    high_risk = [z for z in sorted_zones if z["state"] in ("Warning", "Critical")]
    if high_risk:
        lines.append(f"🔴 HIGH-RISK ZONES ({len(high_risk)}):")
        for z in high_risk:
            ttc_text = f" | Critical in ~{z['time_to_critical_s']}s" if z.get("time_to_critical_s") else ""
            report_text = f" | {z['active_reports']} report(s)" if z.get("active_reports", 0) > 0 else ""
            lines.append(f"  • {z['zone_name']} [{z['state']}] — {z['density']:.2f} p/m², "
                         f"Risk: {z['risk_score']:.2f}, Behaviour: {z['behaviour_flag']}"
                         f"{ttc_text}{report_text}")
    else:
        lines.append(f"✅ No high-risk zones. All areas within safe parameters.")

    lines.append(f"")
    lines.append(f"📈 ZONE SUMMARY:")
    for z in sorted_zones:
        icon = {"Safe": "🟢", "Watch": "🟡", "Warning": "🟠", "Critical": "🔴"}.get(z["state"], "⚪")
        lines.append(f"  {icon} {z['zone_name']}: {z['density']:.2f} p/m² | "
                     f"Count: {z['person_count']} | Risk: {z['risk_score']:.2f} | {z['state']}")

    lines.append(f"")

    # Movement trends
    rising = [z for z in sorted_zones if z["trend_slope"] > 0.02]
    if rising:
        lines.append(f"📈 RISING TRENDS:")
        for z in rising:
            lines.append(f"  ⬆ {z['zone_name']}: +{z['trend_slope']:.3f} p/m²/s")

    # Active behaviour flags
    active_behaviour = [z for z in sorted_zones if z["behaviour_flag"] != "normal"]
    if active_behaviour:
        lines.append(f"")
        lines.append(f"⚠️ ACTIVE BEHAVIOUR FLAGS:")
        for z in active_behaviour:
            lines.append(f"  • {z['zone_name']}: {z['behaviour_flag'].upper()}")

    # Recommendations summary
    lines.append(f"")
    if high_risk:
        lines.append(f"📋 RECOMMENDED ACTIONS:")
        for z in high_risk:
            rec = template_recommendation(z)
            lines.append(f"  → {z['zone_name']}: {rec['recommendation']}")
    else:
        lines.append(f"📋 No immediate actions required. Continue standard monitoring.")

    lines.append(f"")
    lines.append(f"═══ END BRIEFING ═══")

    return "\n".join(lines)


def template_chat_response(question, venue_state):
    """Generate a grounded chat response from live metrics."""
    zones = venue_state["zones"]
    question_lower = question.lower()

    # Find safest zone
    safest = min(zones, key=lambda z: z["risk_score"])
    # Find riskiest zone
    riskiest = max(zones, key=lambda z: z["risk_score"])

    q_strip = question_lower.strip().strip(".?!")
    greetings = ["hi", "hello", "hey", "good morning", "good evening", "howdy", "status update"]
    if q_strip in greetings or any(q_strip.startswith(g + " ") for g in greetings):
        return (f"Hello Operator! 🛡️ AI Crowd Safety Decision Support System is active and continuously monitoring all 5 venue zones.\n\n"
                f"• Venue Status: **{venue_state['overall_status']}**\n"
                f"• Monitored Inflow: **CAM 01 // Gate A ({riskiest['person_count']} people, {riskiest['density']:.2f} p/m²)**\n"
                f"• Highest Risk Zone: **{riskiest['zone_name']}** ({riskiest['state']}, score {riskiest['risk_score']:.2f})\n\n"
                f"You can ask me questions such as:\n"
                f"  - 'Which gate is safest right now?'\n"
                f"  - 'What is the risk at Gate A?'\n"
                f"  - 'What actions should be taken?'")

    if "safest" in question_lower or "safe" in question_lower:
        return (f"Based on current live data, the safest zone is **{safest['zone_name']}** "
                f"with a risk score of {safest['risk_score']:.2f} ({safest['state']} state), "
                f"density of {safest['density']:.2f} people/m², and {safest['person_count']} people detected. "
                f"The highest-risk zone is {riskiest['zone_name']} at {riskiest['risk_score']:.2f} ({riskiest['state']}).")

    elif "action" in question_lower or "what should i do" in question_lower or "recommend" in question_lower:
        if riskiest["state"] in ("Warning", "Critical"):
            rec = template_recommendation(riskiest)
            return (f"**Operational Advisory for {riskiest['zone_name']} ({riskiest['state']}):**\n"
                    f"• {rec['recommendation']}\n"
                    f"• Target Outcome: {rec['expected_benefit']}")
        else:
            return (f"All zones are currently operating within safe parameters (Venue Status: **{venue_state['overall_status']}**). "
                    f"Continue baseline monitoring and maintain clear egress routes at Emergency Exit C.")

    elif "risk" in question_lower or "danger" in question_lower or "worst" in question_lower:
        return (f"The highest-risk zone is **{riskiest['zone_name']}** "
                f"with a risk score of {riskiest['risk_score']:.2f} ({riskiest['state']} state), "
                f"density of {riskiest['density']:.2f} people/m². "
                f"Behaviour flag: {riskiest['behaviour_flag']}. "
                f"{'Time to critical: ~' + str(riskiest['time_to_critical_s']) + 's.' if riskiest.get('time_to_critical_s') else 'No immediate critical projection.'}")

    elif "summary" in question_lower or "status" in question_lower or "overview" in question_lower:
        summary_lines = [f"**Current Venue Status: {venue_state['overall_status']}**\n"]
        for z in sorted(zones, key=lambda x: x["risk_score"], reverse=True):
            icon = {"Safe": "🟢", "Watch": "🟡", "Warning": "🟠", "Critical": "🔴"}.get(z["state"], "⚪")
            summary_lines.append(f"{icon} {z['zone_name']}: {z['density']:.2f} p/m², "
                                 f"Risk: {z['risk_score']:.2f}, Count: {z['person_count']}")
        return "\n".join(summary_lines)

    elif "why" in question_lower:
        # Try to find which zone they're asking about
        for z in zones:
            if z["zone_name"].lower() in question_lower or z["zone_id"] in question_lower:
                factors = []
                factors.append(f"density: {z['density']:.2f} p/m²")
                factors.append(f"trend: {z['trend_slope']:+.3f}/s")
                factors.append(f"behaviour: {z['behaviour_flag']}")
                if z.get("active_reports", 0) > 0:
                    factors.append(f"citizen reports: {z['active_reports']}")
                factors.append(f"priority weight: {z['priority_weight']}")
                return (f"**{z['zone_name']}** is in {z['state']} state (risk score: {z['risk_score']:.2f}) "
                        f"because of these factors: {', '.join(factors)}. "
                        f"The priority weight of {z['priority_weight']} "
                        f"{'amplifies' if z['priority_weight'] > 1.0 else 'maintains'} the raw risk score.")
        return (f"I can provide details on any specific zone. The highest-risk zone is currently "
                f"{riskiest['zone_name']} ({riskiest['state']}, risk: {riskiest['risk_score']:.2f}).")

    else:
        # Generic grounded response
        critical_zones = [z for z in zones if z["state"] == "Critical"]
        warning_zones = [z for z in zones if z["state"] == "Warning"]

        response = f"**Current venue status: {venue_state['overall_status']}**\n"
        if critical_zones:
            names = ", ".join(z["zone_name"] for z in critical_zones)
            response += f"🔴 Critical zones: {names}\n"
        if warning_zones:
            names = ", ".join(z["zone_name"] for z in warning_zones)
            response += f"🟠 Warning zones: {names}\n"
        response += (f"\nSafest: {safest['zone_name']} ({safest['risk_score']:.2f}). "
                     f"Highest risk: {riskiest['zone_name']} ({riskiest['risk_score']:.2f}).\n"
                     f"Ask me about specific zones, safety status, or operational recommendations.")
        return response


# ============================================================
# GROQ LLM CLIENT — High-Speed Connection-Pooled Client
# ============================================================

import asyncio
import requests

groq_session = requests.Session()
if GROQ_API_KEY:
    groq_session.headers.update({
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    })

def _sync_groq_call(messages, timeout=4.5, max_tokens=200):
    """Synchronous Groq API call with connection pooling and fast failover."""
    if not GROQ_API_KEY:
        return None
    models_to_try = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
    for model_name in models_to_try:
        try:
            resp = groq_session.post(
                GROQ_API_URL,
                json={
                    "model": model_name,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": max_tokens,
                },
                timeout=timeout,
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"].get("content", "")
                if content and content.strip():
                    return content.strip()
            elif resp.status_code == 429:
                continue
            else:
                continue
        except Exception:
            continue
    return None


async def call_llm(prompt, system_prompt="", timeout=4.5, max_tokens=200):
    """Call Groq LLM API with strict deadline. Returns None on failure for instant fallback."""
    if not GROQ_API_KEY:
        return None

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        result = await asyncio.to_thread(_sync_groq_call, messages, timeout, max_tokens)
        return result
    except Exception:
        return None


RECOMMENDATION_SYSTEM_PROMPT = """You are an AI Crowd Safety Agent — a calm, concise, continuously reasoning crowd-safety decision support system.

Your role:
- Analyze real-time zone telemetry (density, trend, behaviour flags, citizen reports)
- Generate clear, actionable safety recommendations for the Safety Officer
- Every recommendation MUST follow this exact 5-part structure:
  1. [Observation] Current density, count, and active behaviour flags
  2. [Trend] Rate of crowd increase and estimated Time-to-Critical
  3. [Prediction] Likely near-term consequence if no intervention occurs
  4. [Recommendation] Clear, actionable advisory guidance for operators
  5. [Expected Benefit] Quantified target outcome

Rules:
- You are ADVISORY ONLY. The human operator makes all final decisions.
- Always include real numbers from the data provided.
- Be specific about zone names and metrics.
- Keep responses concise and actionable.
- Never suggest facial recognition or individual tracking.
"""

CHAT_SYSTEM_PROMPT = """You are the AI Command Copilot embedded in the Crowd Safety Decision Support Dashboard.
You are conversing live with the security operations officer.

CRITICAL INSTRUCTIONS:
- Speak conversationally, naturally, and directly like an experienced tactical safety officer on duty.
- ABSOLUTELY NEVER structure chat replies with report headings like "**Observation:**", "**Trend:**", "**Prediction & Recommendation:**", or "**Expected Benefit:**". Those are strictly for formal alert logs, NOT operator chat.
- Speak in fluid, natural sentences. Use short bullet points only when listing items or steps.
- If the operator sends a greeting (e.g., "hi", "hello", "hey", "how are you"):
  - Greet them warmly and professionally.
  - Mention system status and the most critical zone in one brief sentence.
  - Ask how you can assist them right now.
- When answering questions, provide direct, grounded answers citing real numbers (density, count, risk score) from the telemetry data.
- Keep answers concise (2 to 4 sentences max). Avoid robotic jargon.
"""

def clean_chat_text(text: str) -> str:
    """Strip any rigid 5-part report headers that an LLM might inadvertently include."""
    import re
    headers = [
        r'\*\*Observation:\*\*\s*',
        r'\[Observation\]\s*',
        r'\*\*Trend:\*\*\s*',
        r'\[Trend\]\s*',
        r'\*\*Prediction\s*(?:&|and)?\s*Recommendation:\*\*\s*',
        r'\[Prediction\s*(?:&|and)?\s*Recommendation\]\s*',
        r'\*\*Prediction:\*\*\s*',
        r'\[Prediction\]\s*',
        r'\*\*Recommendation:\*\*\s*',
        r'\[Recommendation\]\s*',
        r'\*\*Expected Benefit:\*\*\s*',
        r'\[Expected Benefit\]\s*',
    ]
    cleaned = text
    for h in headers:
        cleaned = re.sub(h, '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()

SYSTEM_PROMPT = RECOMMENDATION_SYSTEM_PROMPT


async def llm_recommendation(zone_data, venue_state):
    """Try LLM-powered recommendation, fall back to template."""
    prompt = f"""Current zone requiring attention:
- Zone: {zone_data['zone_name']} ({zone_data['zone_type']}, priority weight: {zone_data['priority_weight']})
- Density: {zone_data['density']:.2f} people/m²
- Person Count: {zone_data['person_count']}
- Behaviour: {zone_data['behaviour_flag']}
- Trend Slope: {zone_data['trend_slope']:+.3f} people/m²/s
- Time to Critical: {'~' + str(zone_data['time_to_critical_s']) + 's' if zone_data.get('time_to_critical_s') else 'N/A'}
- Current State: {zone_data['state']}
- Active Citizen Reports: {zone_data.get('active_reports', 0)}
- Risk Score: {zone_data['risk_score']:.2f}

Other zones status:
{json.dumps([{'name': z['zone_name'], 'state': z['state'], 'density': z['density'], 'risk': z['risk_score']} for z in venue_state['zones']], indent=2)}

Generate a 5-part safety recommendation following the [Observation], [Trend], [Prediction], [Recommendation], [Expected Benefit] structure. Include real numbers."""

    result = await call_llm(prompt, SYSTEM_PROMPT)

    if result:
        # Parse 5-part structure from LLM response
        parts = {"source": "llm"}
        section_map = {
            "observation": "observation",
            "trend": "trend",
            "prediction": "prediction",
            "recommendation": "recommendation",
            "expected benefit": "expected_benefit",
        }

        current_key = None
        current_text = []

        for line in result.split("\n"):
            line_stripped = line.strip()
            found_section = False
            for header, key in section_map.items():
                if line_stripped.lower().startswith(f"[{header}]") or line_stripped.lower().startswith(f"**{header}"):
                    if current_key:
                        parts[current_key] = " ".join(current_text).strip()
                    current_key = key
                    # Remove the header prefix
                    text = line_stripped
                    for prefix in [f"[{header.title()}]", f"[{header.upper()}]", f"[{header}]",
                                   f"**{header.title()}**", f"**{header.upper()}**"]:
                        text = text.replace(prefix, "").strip(": -")
                    current_text = [text] if text else []
                    found_section = True
                    break
            if not found_section and current_key:
                current_text.append(line_stripped)

        if current_key:
            parts[current_key] = " ".join(current_text).strip()

        # Validate: all 5 parts must exist
        required = ["observation", "trend", "prediction", "recommendation", "expected_benefit"]
        if all(k in parts and parts[k] for k in required):
            return parts

    # Fallback to template
    return template_recommendation(zone_data)


async def llm_briefing(venue_state):
    """Try LLM-powered briefing, fall back to template."""
    zones_summary = "\n".join([
        f"- {z['zone_name']} ({z['zone_type']}): density={z['density']:.2f}, "
        f"count={z['person_count']}, state={z['state']}, risk={z['risk_score']:.2f}, "
        f"trend={z['trend_slope']:+.3f}, behaviour={z['behaviour_flag']}, "
        f"reports={z.get('active_reports', 0)}"
        for z in venue_state['zones']
    ])

    prompt = f"""Generate an Autonomous Safety Briefing for the venue.

Overall Status: {venue_state['overall_status']}

Zone Telemetry:
{zones_summary}

Cover: Overall Status, High-Risk Zones (priority zones first), Movement Trends, Predicted Congestion, Recommended Actions. Be concise and data-driven."""

    result = await call_llm(prompt, SYSTEM_PROMPT)
    if result:
        return result

    return template_briefing(venue_state)


async def llm_chat(question, venue_state):
    """Try LLM-powered chat via Groq with conversational persona, fall back to grounded template."""
    zones = venue_state["zones"]
    zones_summary = "\n".join([
        f"- {z['zone_name']} (ID: {z['zone_id']}, Type: {z['zone_type']}): density={z['density']:.2f} p/m2, count={z['person_count']} people, "
        f"state={z['state']}, risk={z['risk_score']:.2f}, trend={z['trend_slope']:+.3f}/s, behaviour={z['behaviour_flag']}, reports={z.get('active_reports', 0)}"
        for z in zones
    ])
    riskiest = max(zones, key=lambda z: z["risk_score"])
    safest = min(zones, key=lambda z: z["risk_score"])

    q_lower = question.lower().strip().strip(".?!")
    greetings = ["hi", "hello", "hey", "good morning", "good evening", "howdy", "status update"]
    is_greeting = q_lower in greetings or any(q_lower.startswith(g + " ") for g in greetings)

    if is_greeting:
        prompt = f"""Operator greeting: "{question}"

Current live venue telemetry data:
- Overall status: {venue_state['overall_status']}
- Monitored Inflow (CAM 01 // Gate A): {riskiest['person_count']} people, {riskiest['density']:.2f} p/m², state: {riskiest['state']}, risk: {riskiest['risk_score']:.2f}
- Safest zone: {safest['zone_name']} ({safest['density']:.2f} p/m², state: {safest['state']})

Greet the operator conversationally and professionally. Confirm all 5 venue zones are actively monitored. Mention current venue status in one crisp sentence, and ask how you can assist. ABSOLUTELY DO NOT use any section headers or [Observation] tags."""
    else:
        prompt = f"""Operator question: "{question}"

Current live venue telemetry data:
{zones_summary}

Overall venue status: {venue_state['overall_status']}
Highest risk zone: {riskiest['zone_name']} ({riskiest['density']:.2f} p/m², {riskiest['state']}, risk score: {riskiest['risk_score']:.2f})
Safest zone: {safest['zone_name']} ({safest['density']:.2f} p/m², {safest['state']})

Answer the operator's question directly, accurately, and conversationally using the live data above. Mention specific zone names and metrics where relevant. Keep it concise (2-4 sentences max). ABSOLUTELY DO NOT use any section headers or [Observation] tags."""

    result = await call_llm(prompt, CHAT_SYSTEM_PROMPT, timeout=4.0, max_tokens=180)
    if result:
        cleaned = clean_chat_text(result)
        return f"[Groq LLM · {LLM_MODEL.split('/')[-1]}]\n{cleaned}"

    fallback = template_chat_response(question, venue_state)
    return f"[Ground Truth Analytics]\n{fallback}"


# ============================================================
# AGENT REASONING LOOP
# ============================================================

class AgentLoop:
    """Continuous agentic reasoning loop running in the background."""

    def __init__(self, risk_engine, broadcast_fn):
        self.risk_engine = risk_engine
        self.broadcast = broadcast_fn
        self.last_venue_hash = ""
        self.last_briefing_time = 0
        self.briefing_interval = int(os.getenv("BRIEFING_INTERVAL_SECONDS", "120"))
        self.cycle_count = 0
        self.activity_log = []
        self.active_rec_tracker = {}

    def _venue_hash(self, venue_state):
        """Quick hash to detect if venue state changed."""
        return "|".join(
            f"{z['zone_id']}:{z['state']}:{z['behaviour_flag']}:{z['active_reports']}"
            for z in venue_state["zones"]
        )

    async def run_cycle(self, force=False, trigger="scheduled"):
        """Run one reasoning cycle."""
        venue_state = self.risk_engine.get_venue_state()
        current_hash = self._venue_hash(venue_state)
        self.cycle_count += 1

        # Skip if nothing changed (cost control)
        if not force and current_hash == self.last_venue_hash:
            note = {
                "type": "agent_note",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "message": "Venue state stable. No significant changes detected.",
                "cycle": self.cycle_count,
            }
            self.activity_log.append(note)
            await self.broadcast(note)
            return

        self.last_venue_hash = current_hash

        # Check for zones needing recommendations (only on actual state change or cooldown)
        now_ts = time.time()
        for zone_data in venue_state["zones"]:
            zid = zone_data["zone_id"]
            zstate = zone_data["state"]
            if zstate in ("Warning", "Critical"):
                last_state, last_rec_time = self.active_rec_tracker.get(zid, (None, 0))
                if zstate != last_state or (now_ts - last_rec_time) >= 120.0 or force:
                    self.active_rec_tracker[zid] = (zstate, now_ts)
                    rec = await llm_recommendation(zone_data, venue_state)
                    alert_id = save_alert(
                        zone_id=zone_data["zone_id"],
                        level=zone_data["state"],
                        recommendation=rec["recommendation"],
                        observation=rec["observation"],
                        trend=rec["trend"],
                        prediction=rec["prediction"],
                        expected_benefit=rec["expected_benefit"],
                        source=rec["source"],
                    )
                    rec_msg = {
                        "type": "recommendation",
                        "alert_id": alert_id,
                        "zone_id": zone_data["zone_id"],
                        "zone_name": zone_data["zone_name"],
                        "severity": zone_data["state"],
                        "observation": rec["observation"],
                        "trend": rec["trend"],
                        "prediction": rec["prediction"],
                        "recommendation": rec["recommendation"],
                        "expected_benefit": rec["expected_benefit"],
                        "source": rec["source"],
                        "status": "open",
                        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }
                    self.activity_log.append(rec_msg)
                    await self.broadcast(rec_msg)

        # Agent activity note
        overall = venue_state["overall_status"]
        critical_zones = [z["zone_name"] for z in venue_state["zones"] if z["state"] == "Critical"]
        warning_zones = [z["zone_name"] for z in venue_state["zones"] if z["state"] == "Warning"]

        note_parts = [f"Cycle #{self.cycle_count} ({trigger}). Venue: {overall}."]
        if critical_zones:
            note_parts.append(f"Critical: {', '.join(critical_zones)}.")
        if warning_zones:
            note_parts.append(f"Warning: {', '.join(warning_zones)}.")

        note = {
            "type": "agent_note",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "message": " ".join(note_parts),
            "cycle": self.cycle_count,
        }
        self.activity_log.append(note)
        await self.broadcast(note)

        # Check if briefing is due
        now = time.time()
        needs_briefing = (now - self.last_briefing_time >= self.briefing_interval)
        state_change_briefing = trigger == "state_change" and venue_state["overall_status"] in ("Warning", "Critical")

        if needs_briefing or state_change_briefing:
            await self.generate_briefing(venue_state, trigger_type=trigger)

    async def generate_briefing(self, venue_state=None, trigger_type="scheduled"):
        """Generate and broadcast an autonomous safety briefing."""
        if venue_state is None:
            venue_state = self.risk_engine.get_venue_state()

        content = await llm_briefing(venue_state)
        save_briefing(content, trigger_type)
        self.last_briefing_time = time.time()

        briefing_msg = {
            "type": "briefing",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "trigger_type": trigger_type,
            "content": content,
        }
        self.activity_log.append(briefing_msg)
        await self.broadcast(briefing_msg)

    async def handle_chat(self, question, venue_state=None):
        """Handle an operator chat question."""
        if venue_state is None:
            venue_state = self.risk_engine.get_venue_state()

        save_chat("operator", question)
        response = await llm_chat(question, venue_state)
        save_chat("agent", response)

        return response
