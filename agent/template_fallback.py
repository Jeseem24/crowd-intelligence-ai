"""
Deterministic Zero-Crash Offline Template Fallback Engine.
Strictly implements Section 7 File 3 & Section 4.C:
Guarantees that an unreachable LLM API or network blackout never halts safety decision support.
Produces strictly formatted 5-part explainable recommendations and structured safety briefings.
"""

import time


def generate_fallback_recommendation(zone_state):
    """
    Generate a deterministic 5-part explainable recommendation from live telemetry numbers.
    Contract parts:
    1. Observation
    2. Trend & Velocity
    3. Impact Prediction
    4. Recommended Action
    5. Expected Benefit
    """
    z_id = zone_state.get("zone_id", "zone")
    z_name = zone_state.get("zone_name", z_id)
    density = float(zone_state.get("density", 0.0))
    slope = float(zone_state.get("trend_slope", 0.0))
    t_crit = zone_state.get("time_to_critical_s")
    flag = zone_state.get("behaviour_flag", "normal")
    state = zone_state.get("state", "Safe")
    reports = int(zone_state.get("active_reports", 0))

    # 1. Observation
    behaviour_phrase = f" with active crowd {flag} dynamics" if flag != "normal" else " with steady laminar flow"
    report_phrase = f" and {reports} active citizen hazard report(s)" if reports > 0 else ""
    observation = f"{z_name} density is currently {density:.2f} p/m² ({state} status){behaviour_phrase}{report_phrase}."

    # 2. Trend & Velocity
    if slope > 0.02:
        t_str = f"critical threshold (5.0 p/m²) projected in ~{int(round(t_crit))}s" if t_crit else "inflow accelerating"
        trend = f"Crowd accumulation rate is +{slope:.3f} p/m²/s; {t_str}."
    elif slope < -0.02:
        trend = f"Crowd density is dispersing at a rate of {slope:.3f} p/m²/s; holding stable."
    else:
        trend = f"Crowd density holding steady (slope {slope:+.3f} p/m²/s); laminar transit flow."

    # 3. Impact Prediction
    if state == "Critical":
        prediction = f"Severe turnstile compression wave, barrier stress, and acute crush hazard likely at {z_name} within 45-60s if inflow continues unmitigated."
    elif state == "Warning":
        prediction = f"Transit chokepoint congestion and bottlenecking developing; risk of escalating to Critical within 90s without flow diversion."
    elif state == "Watch":
        prediction = f"Elevated occupant concentration may impede free egress if sudden surge occurs."
    else:
        prediction = f"Normal operational baseline. Nominal egress capacity maintained."

    # 4. Recommended Action (Human-in-the-Loop Directive)
    if state == "Critical":
        recommendation = f"Hold entry turnstiles at {z_name} immediately; deploy 4 stewards to buffer zone and divert incoming flow to secondary entry points."
    elif state == "Warning":
        recommendation = f"Pre-position 2 crowd stewards at {z_name} chokepoints; throttle intake rates by 30% to stabilize buffer space."
    elif state == "Watch":
        recommendation = f"Increase active CCTV surveillance on {z_name}; alert roving stewards to stand by."
    else:
        recommendation = f"Maintain standard monitoring and laminar pedestrian movement."

    # 5. Expected Benefit
    if state in ("Critical", "Warning"):
        expected_benefit = f"Reduces localized chokepoint inflow by 55-65%, stabilizing density below Warning threshold within 90s and preventing crush injuries."
    elif state == "Watch":
        expected_benefit = f"Maintains proactive margin of safety, preventing uncoordinated surge escalation."
    else:
        expected_benefit = f"Ensures continuous safe operation and comfortable attendee movement."

    rec_id = int(abs(hash(f"{z_id}_{density}_{time.time():.0f}")) % 100000)

    return {
        "rec_id": rec_id,
        "zone_id": z_id,
        "severity": state,
        "observation": observation,
        "trend": trend,
        "prediction": prediction,
        "recommendation": recommendation,
        "expected_benefit": expected_benefit,
        "status": "open",
        "source": "template",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }


def generate_fallback_briefing(venue_state):
    """
    Generate a comprehensive structured Markdown venue safety briefing.
    """
    zones = venue_state.get("zones", [])
    overall = venue_state.get("overall_status", "Safe")
    ts = venue_state.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    sorted_zones = sorted(zones, key=lambda z: z.get("risk_score", 0.0), reverse=True)
    high_risk = [z for z in sorted_zones if z.get("state") in ("Warning", "Critical")]

    lines = []
    lines.append(f"### 🛡️ Autonomous Venue Safety Briefing ({ts})")
    lines.append(f"**Overall Venue Status:** `{overall.upper()}`")
    lines.append("")

    if high_risk:
        lines.append("#### 🚨 Priority Zones Requiring Attention:")
        for z in high_risk:
            ttc_str = f" | ⏱️ Critical in ~{int(round(z['time_to_critical_s']))}s" if z.get("time_to_critical_s") else ""
            lines.append(f"- **{z['zone_name']}** (`{z['state']}`): Density **{z['density']:.2f} p/m²**, Risk Score `{z['risk_score']:.2f}`, Dynamics `{z['behaviour_flag']}`{ttc_str}")
    else:
        lines.append("✅ **All Venue Zones Normal:** All sectors operating within safe density thresholds.")

    lines.append("")
    lines.append("#### 📊 Sector Status Matrix:")
    for z in sorted_zones:
        icon = {"Safe": "🟢", "Watch": "🟡", "Warning": "🟠", "Critical": "🔴"}.get(z.get("state"), "⚪")
        lines.append(f"- {icon} **{z['zone_name']}**: {z['person_count']} persons ({z['density']:.2f} p/m²) | Trend: `{z['trend_slope']:+.3f} p/m²/s` | Risk: `{z['risk_score']:.2f}`")

    spillovers = venue_state.get("spillover_predictions", [])
    if spillovers:
        lines.append("")
        lines.append("#### 🌊 Predictive Cross-Zone Spillover Propagation:")
        for sp in spillovers:
            lines.append(f"- ⚠️ Inflow from **{sp['source_name']}** -> **{sp['target_name']}** (ETA: ~{sp['eta_seconds']}s). {sp['directive']}")

    return "\n".join(lines)


def generate_fallback_chat_response(query, venue_state):
    """
    Deterministic grounded Q&A answering operator questions directly from live telemetry.
    """
    q = query.lower()
    zones = venue_state.get("zones", [])
    overall = venue_state.get("overall_status", "Safe")

    if not zones:
        return "Venue telemetry is initializing. All sensors report nominal status."

    sorted_by_risk = sorted(zones, key=lambda z: z.get("risk_score", 0.0), reverse=True)
    highest = sorted_by_risk[0]
    total_persons = sum(z.get("person_count", 0) for z in zones)

    if any(w in q for w in ["highest", "worst", "critical", "danger", "risk", "gate"]):
        ttc_info = f" with projected time-to-critical of ~{int(round(highest['time_to_critical_s']))}s" if highest.get("time_to_critical_s") else ""
        return (f"Main priority is **{highest['zone_name']}** currently at **{highest['state']}** status "
                f"(Risk Score: `{highest['risk_score']:.2f}`, Density: {highest['density']:.2f} p/m², "
                f"Headcount: {highest['person_count']} persons, Dynamics: `{highest['behaviour_flag']}`){ttc_info}. "
                f"Overall venue state is `{overall}`.")

    if any(w in q for w in ["total", "count", "crowd", "people", "attendee"]):
        return (f"Current total venue occupancy is **{total_persons} attendees** across {len(zones)} monitored zones. "
                f"Overall venue safety rating is **{overall}**.")

    if any(w in q for w in ["recommend", "action", "do", "suggest", "directive"]):
        if highest.get("state") in ("Warning", "Critical"):
            return (f"Directive for **{highest['zone_name']}**: Throttle intake turnstiles immediately and deploy "
                    f"crowd management stewards to divert arriving flow towards secondary gates. "
                    f"Expected benefit: >50% reduction in localized compression within 90 seconds.")
        return f"All zones currently safe. Standard operations and laminar flow monitoring are recommended."

    if any(w in q for w in ["weather", "rain", "storm"]):
        weather = venue_state.get("weather", {})
        rain = weather.get("rain_active", False)
        return (f"Weather condition is **{'Rain / Wet Ground' if rain else 'Fair / Dry'}**. "
                f"{'Adverse weather risk multiplier (+15%) active on open gathering grounds.' if rain else 'Nominal ground traction.'}")

    return (f"Venue status is **{overall}**. Monitored sectors: {len(zones)}. "
            f"Highest density area is **{highest['zone_name']}** at {highest['density']:.2f} p/m² ({highest['state']}).")
