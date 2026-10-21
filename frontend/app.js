/**
 * AI Crowd Safety — Command Dashboard JavaScript
 * Handles: WebSocket connection, real-time UI updates, alerts, chat, recommendations
 */

// ============================================================
// STATE
// ============================================================
const state = {
    connected: false,
    muted: false,
    venueState: null,
    recommendations: [],
    ws: null,
    reconnectTimer: null,
};

const STATE_COLORS = {
    Safe: { fill: 'rgba(16, 185, 129, 0.12)', stroke: '#10b981', class: 'safe' },
    Watch: { fill: 'rgba(245, 158, 11, 0.14)', stroke: '#f59e0b', class: 'watch' },
    Warning: { fill: 'rgba(249, 115, 22, 0.18)', stroke: '#f97316', class: 'warning' },
    Critical: { fill: 'rgba(244, 63, 94, 0.22)', stroke: '#f43f5e', class: 'critical' },
};

// ============================================================
// WEBSOCKET CONNECTION
// ============================================================
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws/live`;

    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        state.connected = true;
        updateConnectionStatus(true);
        console.log('✅ WebSocket connected');
    };

    state.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.error('Failed to parse WS message:', e);
        }
    };

    state.ws.onclose = () => {
        state.connected = false;
        updateConnectionStatus(false);
        console.log('❌ WebSocket disconnected, reconnecting in 3s...');
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = setTimeout(connectWebSocket, 3000);
    };

    state.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
}

function handleMessage(data) {
    switch (data.type) {
        case 'venue_state':
            state.venueState = data;
            updateDashboard(data);
            break;
        case 'recommendation':
            addRecommendation(data);
            break;
        case 'briefing':
            updateBriefing(data);
            break;
        case 'agent_note':
            addAgentNote(data);
            break;
        case 'chat':
            addChatMessage(data.sender, data.message);
            break;
        case 'alert_action':
            updateAlertAction(data);
            break;
        case 'heartbeat':
        case 'pong':
            break;
    }
}

// ============================================================
// DASHBOARD UPDATES
// ============================================================
function updateDashboard(venueState) {
    updateVenueStatus(venueState.overall_status);
    updateZoneTiles(venueState.zones);
    updateMap(venueState.zones);
    checkAlerts(venueState);
}

function updateVenueStatus(status) {
    const el = document.getElementById('venue-status');
    el.textContent = status.toUpperCase();
    el.className = `venue-badge ${status.toLowerCase()}`;
}

function updateConnectionStatus(connected) {
    const el = document.getElementById('connection-status');
    if (connected) {
        el.textContent = '🟢 Connected';
        el.className = 'conn-badge online';
    } else {
        el.textContent = '⚫ Offline';
        el.className = 'conn-badge offline';
    }
}

// ============================================================
// ZONE TILES
// ============================================================
function updateZoneTiles(zones) {
    const container = document.getElementById('zone-tiles');
    container.innerHTML = '';

    // Sort by risk (highest first)
    const sorted = [...zones].sort((a, b) => b.risk_score - a.risk_score);

    for (const z of sorted) {
        const stateClass = z.state.toLowerCase();
        const densityPct = Math.min(100, Math.max(6, Math.round((z.density / 2.5) * 100)));
        const trendSymbol = z.trend_slope > 0.005 ? '↑' : z.trend_slope < -0.005 ? '↓' : '→';
        const trendSign = z.trend_slope >= 0 ? '+' : '';
        const tile = document.createElement('div');
        tile.className = `zone-tile ${stateClass}`;
        tile.innerHTML = `
            <div class="tile-header">
                <div>
                    <div class="tile-name">${z.zone_name}</div>
                    <div class="tile-type">${z.zone_type}</div>
                </div>
                <div class="tile-badges">
                    <span class="badge badge-priority">w=${z.priority_weight}</span>
                    ${z.behaviour_flag !== 'normal' ? `<span class="badge badge-behaviour ${z.behaviour_flag}">${z.behaviour_flag}</span>` : ''}
                    ${z.active_reports > 0 ? `<span class="badge badge-report">📢 ${z.active_reports} report${z.active_reports > 1 ? 's' : ''}</span>` : ''}
                    ${z.sensor_status !== 'ok' ? `<span class="badge badge-sensor">⚠ Sensor</span>` : ''}
                </div>
            </div>
            <div class="density-progress-wrap">
                <div class="density-bar-track">
                    <div class="density-bar-fill ${stateClass}" style="width: ${densityPct}%"></div>
                </div>
            </div>
            <div class="tile-metrics">
                <div class="metric">
                    <div class="metric-value">${z.person_count}</div>
                    <div class="metric-label">Occupancy</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${z.density.toFixed(2)}</div>
                    <div class="metric-label">p/m² Density</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${z.risk_score.toFixed(3)}</div>
                    <div class="metric-label">Risk Index</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${trendSymbol} ${trendSign}${z.trend_slope.toFixed(3)}</div>
                    <div class="metric-label">Velocity (/s)</div>
                </div>
            </div>
            <div class="tile-state">
                <span class="state-label ${stateClass}">${z.state}</span>
                ${z.time_to_critical_s ? `<span class="ttc-badge">⚠ Critical in ~${z.time_to_critical_s}s</span>` : ''}
            </div>
        `;
        container.appendChild(tile);
    }
}

// ============================================================
// SVG MAP UPDATE
// ============================================================
function updateMap(zones) {
    for (const z of zones) {
        const poly = document.getElementById(`poly-${z.zone_id}`);
        const countEl = document.getElementById(`map-count-${z.zone_id}`);
        const densityEl = document.getElementById(`map-density-${z.zone_id}`);
        const ttcEl = document.getElementById(`map-ttc-${z.zone_id}`);

        if (poly) {
            const colors = STATE_COLORS[z.state] || STATE_COLORS.Safe;
            poly.setAttribute('fill', colors.fill);
            poly.setAttribute('stroke', colors.stroke);
        }
        if (countEl) countEl.textContent = z.person_count;
        if (densityEl) densityEl.textContent = `${z.density.toFixed(2)} p/m²`;
        if (ttcEl) {
            ttcEl.textContent = z.time_to_critical_s
                ? `⚠ Critical in ~${z.time_to_critical_s}s`
                : '';
        }
    }
}

// ============================================================
// ALERTS
// ============================================================
let lastAlertState = {};

function checkAlerts(venueState) {
    const banner = document.getElementById('alert-banner');
    const alertText = document.getElementById('alert-text');

    const criticalZones = venueState.zones.filter(z => z.state === 'Critical');
    const warningZones = venueState.zones.filter(z => z.state === 'Warning');

    if (criticalZones.length > 0) {
        const names = criticalZones.map(z => z.zone_name).join(', ');
        alertText.textContent = `🚨 CRITICAL ALERT: ${names} — Immediate attention required!`;
        banner.classList.remove('hidden');

        // Play sound for new Critical zones
        for (const z of criticalZones) {
            if (lastAlertState[z.zone_id] !== 'Critical') {
                playAlertSound();
            }
        }
    } else if (warningZones.length > 0) {
        const names = warningZones.map(z => z.zone_name).join(', ');
        alertText.textContent = `⚠️ WARNING: ${names} — Monitoring closely`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    // Update last state
    for (const z of venueState.zones) {
        lastAlertState[z.zone_id] = z.state;
    }
}

function playAlertSound() {
    if (state.muted) return;
    try {
        // Generate alert tone using Web Audio API
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
        console.log('Audio not available');
    }
}

// ============================================================
// RECOMMENDATIONS (AI TACTICAL DIRECTIVES)
// ============================================================
function addRecommendation(rec) {
    if (!rec || !rec.zone_id) return;
    
    // Normalize status: treat 'pending' or undefined as 'open'
    if (!rec.status || rec.status === 'pending') {
        rec.status = 'open';
    }

    // Strict deduplication by zone: exactly ONE recommendation entry per zone
    const existingIndex = state.recommendations.findIndex(r => r.zone_id === rec.zone_id);
    if (existingIndex !== -1) {
        // If current card is still open, update in-place with latest telemetry & recommendation
        if (state.recommendations[existingIndex].status === 'open') {
            state.recommendations[existingIndex] = {
                ...state.recommendations[existingIndex],
                ...rec,
                alert_id: rec.alert_id || state.recommendations[existingIndex].alert_id,
            };
            renderRecommendations();
            return;
        } else {
            // If already resolved (approved/rejected), only replace if incoming alert is a new open incident
            if (rec.status === 'open') {
                state.recommendations[existingIndex] = rec;
                renderRecommendations();
                return;
            }
        }
    } else {
        // Add new zone recommendation
        state.recommendations.unshift(rec);
    }

    // Keep max 4 unique zone recommendations
    if (state.recommendations.length > 4) {
        state.recommendations = state.recommendations.slice(0, 4);
    }
    renderRecommendations();
}

function renderRecommendations() {
    const container = document.getElementById('recommendations');
    const recPanelHeader = document.querySelector('#rec-panel .panel-title');

    if (!state.recommendations || state.recommendations.length === 0) {
        container.innerHTML = '<div class="empty-state">Awaiting real-time telemetry from active vision feed...</div>';
        if (recPanelHeader) {
            recPanelHeader.innerHTML = '🤖 AI Tactical Recommendations <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-muted)">0 PENDING</span>';
        }
        return;
    }

    const openCount = state.recommendations.filter(r => r.status === 'open').length;
    if (recPanelHeader) {
        const badgeStyle = openCount > 0 
            ? 'background:rgba(249,115,22,0.18);color:#f97316;border:1px solid rgba(249,115,22,0.4);font-family:\'JetBrains Mono\',monospace;' 
            : 'background:rgba(16,185,129,0.14);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-family:\'JetBrains Mono\',monospace;';
        recPanelHeader.innerHTML = `🤖 AI Tactical Recommendations <span class="badge" style="${badgeStyle}">${openCount > 0 ? '⚡ ' + openCount + ' PENDING ACTION' : '✓ ALL REVIEWED'}</span>`;
    }

    container.innerHTML = '';

    // Sort: open recommendations first, then newest
    const sorted = [...state.recommendations].sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return (b.alert_id || 0) - (a.alert_id || 0);
    });

    for (const rec of sorted) {
        const severityClass = (rec.severity || 'Warning').toLowerCase();
        const isOpen = rec.status === 'open';
        const card = document.createElement('div');
        card.className = `rec-card ${severityClass} ${rec.status}`;
        card.id = `rec-${rec.alert_id}`;
        card.innerHTML = `
            <div class="rec-header">
                <div class="rec-header-left">
                    <span class="rec-zone-name">${rec.zone_name || (rec.zone_id === 'gate_a' ? 'Main Entry Gate A' : (rec.zone_id === 'corridor_b' ? 'Corridor B' : rec.zone_id))}</span>
                    <span class="rec-source-pill">${rec.source === 'llm' ? '🤖 Autonomous AI' : '⚡ Tactical Rule'}</span>
                </div>
                <div class="rec-header-right">
                    <span class="rec-severity-badge ${rec.severity}">${rec.severity}</span>
                </div>
            </div>

            <!-- PRIMARY HERO: TACTICAL DIRECTIVE CALLOUT -->
            <div class="rec-directive-box ${severityClass}">
                <div class="rec-directive-tag">
                    <span class="pulse-beacon ${severityClass}"></span>
                    <span>RECOMMENDED TACTICAL DIRECTIVE</span>
                </div>
                <div class="rec-directive-body">${rec.recommendation || 'Maintain standard inflow monitoring and preserve egress avenues.'}</div>
            </div>

            <!-- FULL-WIDTH OBSERVATION & EVIDENCE (CLEANLY READABLE) -->
            <div class="rec-narrative-box">
                <div class="rec-narrative-item">
                    <span class="narrative-tag">📍 OBSERVATION:</span>
                    <span class="narrative-val">${rec.observation || 'Telemetry nominal'}</span>
                </div>
                <div class="rec-narrative-item">
                    <span class="narrative-tag">📈 TREND RATE:</span>
                    <span class="narrative-val">${rec.trend || 'Stable'}</span>
                </div>
                <div class="rec-narrative-item">
                    <span class="narrative-tag">🔮 PREDICTION:</span>
                    <span class="narrative-val">${rec.prediction || 'No immediate escalation'}</span>
                </div>
                <div class="rec-narrative-item">
                    <span class="narrative-tag">🎯 BENEFIT:</span>
                    <span class="narrative-val">${rec.expected_benefit || 'Restores safe operating parameters'}</span>
                </div>
            </div>

            <!-- ACTION CONTROLS -->
            ${isOpen ? `
                <div class="rec-actions">
                    <button class="btn-authorize-action" onclick="handleAlertAction(${rec.alert_id}, 'approved')">
                        <span class="action-icon">✓</span>
                        <span>AUTHORIZE DIRECTIVE</span>
                    </button>
                    <button class="btn-dismiss-action" onclick="handleAlertAction(${rec.alert_id}, 'rejected')">
                        <span class="action-icon">✕</span>
                        <span>DISMISS</span>
                    </button>
                </div>
            ` : `
                <div class="rec-actions resolved">
                    <span class="rec-status-resolved ${rec.status}">
                        ${rec.status === 'approved' ? '✓ DIRECTIVE AUTHORIZED BY OPERATOR (LOGGED TO AUDIT TRAIL)' : '✕ DISMISSED BY OPERATOR'}
                    </span>
                </div>
            `}
        `;
        container.appendChild(card);
    }
}

async function handleAlertAction(alertId, action) {
    try {
        const resp = await fetch(`/api/alerts/${alertId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        });
        if (resp.ok) {
            // Update local state
            const rec = state.recommendations.find(r => r.alert_id === alertId);
            if (rec) {
                rec.status = action;
                renderRecommendations();
                if (action === 'rejected') {
                    setTimeout(() => {
                        state.recommendations = state.recommendations.filter(r => r.alert_id !== alertId);
                        renderRecommendations();
                    }, 3500);
                }
            }
        }
    } catch (e) {
        console.error('Failed to update alert:', e);
    }
}

function updateAlertAction(data) {
    const rec = state.recommendations.find(r => r.alert_id === data.alert_id);
    if (rec) {
        rec.status = data.action;
        renderRecommendations();
        if (data.action === 'rejected') {
            setTimeout(() => {
                state.recommendations = state.recommendations.filter(r => r.alert_id !== data.alert_id);
                renderRecommendations();
            }, 3500);
        }
    }
}

// ============================================================
// BRIEFINGS & FORMATTING
// ============================================================
function formatMarkdownToHtml(md) {
    if (!md) return '';
    let html = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^### (.*$)/gim, '<div class="briefing-heading" style="font-weight:700;color:#e2e8f0;margin:8px 0 4px;">$1</div>');
    html = html.replace(/^## (.*$)/gim, '<div class="briefing-heading" style="font-weight:800;color:#60a5fa;margin:10px 0 6px;font-size:14px;">$1</div>');

    const lines = html.split('\n');
    let inList = false;
    let out = [];
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('- ') || line.startsWith('* ')) {
            if (!inList) { out.push('<ul class="briefing-list">'); inList = true; }
            out.push(`<li>${line.substring(2)}</li>`);
        } else {
            if (inList) { out.push('</ul>'); inList = false; }
            if (line.length > 0) {
                out.push(`<p style="margin-bottom:6px;">${line}</p>`);
            }
        }
    }
    if (inList) out.push('</ul>');
    return out.join('');
}

function updateBriefing(data) {
    const container = document.getElementById('briefings');
    const timeStr = data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : new Date().toLocaleTimeString();
    container.innerHTML = `
        <div class="briefing-card">
            <div class="briefing-header">
                <span class="briefing-title">📋 Automated Safety Briefing</span>
                <span class="briefing-time">${timeStr}</span>
            </div>
            <div class="briefing-body">
                ${formatMarkdownToHtml(data.content)}
            </div>
        </div>
    `;
    container.scrollTop = 0;
}

// ============================================================
// DEMO SCENARIO TRIGGERS (1-Click Evaluation Bar)
// ============================================================
async function triggerScenario(scenarioId) {
    const toast = document.getElementById('demo-toast');
    try {
        if (toast) {
            toast.textContent = `Triggering ${scenarioId}...`;
            toast.classList.remove('hidden');
        }
        const resp = await fetch(`/api/demo/scenario/${scenarioId}`, { method: 'POST' });
        const res = await resp.json();
        if (toast) {
            toast.textContent = `⚡ ${res.message || 'Scenario updated'}`;
            setTimeout(() => toast.classList.add('hidden'), 4500);
        }
    } catch (e) {
        if (toast) {
            toast.textContent = `⚠️ Error: ${e.message}`;
            setTimeout(() => toast.classList.add('hidden'), 3500);
        }
    }
}

// ============================================================
// AGENT FEED
// ============================================================
const agentNotes = [];

function addAgentNote(data) {
    agentNotes.unshift(data);
    if (agentNotes.length > 50) agentNotes.pop();

    const container = document.getElementById('agent-feed');
    container.innerHTML = '';

    for (const note of agentNotes.slice(0, 20)) {
        const el = document.createElement('div');
        el.className = 'agent-note';
        const timeStr = note.timestamp ? new Date(note.timestamp).toLocaleTimeString() : '';
        el.innerHTML = `<span class="note-time">${timeStr}</span> ${note.message}`;
        container.appendChild(el);
    }
}

// ============================================================
// CHAT
// ============================================================
let lastRenderedChat = { sender: '', text: '', time: 0 };

function formatChatText(text) {
    if (!text) return '';
    // Escape HTML first
    let safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Bold **text** -> <strong>text</strong>
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic *text* -> <em>text</em>
    safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Parse lines: bullets vs normal text vs blank space
    const lines = safe.split('\n');
    const processed = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('•') || trimmed.startsWith('- ')) {
            const bulletContent = trimmed.replace(/^[•\-]\s*/, '');
            processed.push(`<div class="chat-bullet"><span class="chat-bullet-dot">›</span><span class="chat-bullet-text">${bulletContent}</span></div>`);
        } else if (trimmed === '') {
            processed.push('<div class="chat-spacer"></div>');
        } else {
            processed.push(`<div class="chat-line">${trimmed}</div>`);
        }
    }
    return processed.join('');
}

function addChatMessage(sender, message) {
    if (!message) return;
    const cleanMsg = message.trim();
    const now = Date.now();
    // Anti-duplication filter (ignores identical messages within 2.5 seconds)
    if (lastRenderedChat.sender === sender && lastRenderedChat.text === cleanMsg && (now - lastRenderedChat.time) < 2500) {
        return;
    }
    lastRenderedChat = { sender, text: cleanMsg, time: now };

    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = `chat-msg ${sender}`;

    if (sender === 'operator') {
        el.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-sender-name">Operator (You)</span>
            </div>
            <div class="chat-msg-body">
                <div class="chat-line">${escapeHtml(cleanMsg)}</div>
            </div>
        `;
    } else {
        // Parse source tag e.g. [Groq LLM · gpt-oss-20b] or [Ground Truth Analytics]
        let sourceBadge = '';
        let bodyText = cleanMsg;
        const tagMatch = cleanMsg.match(/^\[([^\]]+)\]\s*\n?([\s\S]*)$/);
        if (tagMatch) {
            const badgeLabel = tagMatch[1];
            bodyText = tagMatch[2].trim();
            const isLLM = badgeLabel.toLowerCase().includes('llm') || badgeLabel.toLowerCase().includes('gpt') || badgeLabel.toLowerCase().includes('groq');
            const icon = isLLM ? '⚡' : '🛡️';
            const badgeClass = isLLM ? 'tag-llm' : 'tag-truth';
            sourceBadge = `<span class="chat-source-tag ${badgeClass}">${icon} ${badgeLabel}</span>`;
        } else {
            sourceBadge = `<span class="chat-source-tag tag-llm">⚡ AI Copilot</span>`;
        }

        el.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-sender-name">AI Command Copilot</span>
                ${sourceBadge}
            </div>
            <div class="chat-msg-body">
                ${formatChatText(bodyText)}
            </div>
        `;
    }

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    addChatMessage('operator', message);

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Thinking...';
    }

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        });
        if (resp.ok) {
            const data = await resp.json();
            addChatMessage('agent', data.response);
        } else {
            addChatMessage('agent', '⚠️ Error contacting AI decision engine.');
        }
    } catch (e) {
        addChatMessage('agent', '⚠️ Connection error. Please check backend server.');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    }
}

// ============================================================
// FORCE BRIEFING
// ============================================================
async function forceBriefing() {
    try {
        await fetch('/api/briefings/generate', { method: 'POST' });
    } catch (e) {
        console.error('Failed to generate briefing:', e);
    }
}

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleString();
}

// ============================================================
// UTILS
// ============================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Connect WebSocket
    connectWebSocket();

    // Fetch initial alerts so active recommendations are immediately visible (deduplicated by zone)
    fetch('/api/alerts')
        .then(r => r.json())
        .then(alerts => {
            if (Array.isArray(alerts) && alerts.length > 0) {
                const seenZones = new Set();
                const latestPerZone = [];
                for (const a of alerts) {
                    if (!seenZones.has(a.zone_id)) {
                        seenZones.add(a.zone_id);
                        latestPerZone.push(a);
                    }
                }

                for (const a of latestPerZone) {
                    const normStatus = (a.operator_action === 'approved' || a.operator_action === 'rejected')
                        ? a.operator_action
                        : 'open';

                    addRecommendation({
                        alert_id: a.alert_id,
                        zone_id: a.zone_id,
                        zone_name: a.zone_id === 'gate_a' ? 'Main Entry Gate A' : (a.zone_id === 'corridor_b' ? 'Corridor B' : a.zone_id),
                        severity: a.level,
                        observation: a.observation,
                        trend: a.trend,
                        prediction: a.prediction,
                        recommendation: a.recommendation,
                        expected_benefit: a.expected_benefit,
                        status: normStatus,
                        source: a.source
                    });
                }
            }
        })
        .catch(() => {});

    // Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Chat
    document.getElementById('chat-send').addEventListener('click', sendChat);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });

    // Chat suggestions
    document.querySelectorAll('.btn-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('chat-input').value = btn.dataset.q;
            sendChat();
        });
    });

    // Mute
    document.getElementById('mute-btn').addEventListener('click', () => {
        state.muted = !state.muted;
        document.getElementById('mute-btn').textContent = state.muted ? '🔇' : '🔊';
    });

    // Alert dismiss
    document.getElementById('alert-dismiss').addEventListener('click', () => {
        document.getElementById('alert-banner').classList.add('hidden');
    });

    // QR modal
    document.getElementById('qr-btn').addEventListener('click', () => {
        document.getElementById('qr-modal').classList.remove('hidden');
        // Fetch QR URL
        fetch('/api/qr').then(r => {
            const url = r.headers.get('X-QR-URL') || `http://${location.hostname}:${location.port}/report.html`;
            document.getElementById('qr-url').textContent = url;
        }).catch(() => {});
    });
    document.getElementById('qr-close').addEventListener('click', () => {
        document.getElementById('qr-modal').classList.add('hidden');
    });

    // Force briefing
    document.getElementById('force-briefing-btn').addEventListener('click', forceBriefing);

    // Master Scenario Evaluation Runner (S01 - S10)
    async function triggerScenario(scenarioId) {
        const toast = document.getElementById('demo-toast');
        if (toast) {
            toast.textContent = `🚀 Triggering ${scenarioId.toUpperCase()}...`;
            toast.classList.remove('hidden');
        }
        try {
            const resp = await fetch(`/api/demo/scenario/${scenarioId}`, { method: 'POST' });
            const data = await resp.json();
            if (toast) {
                toast.textContent = data.message || `Scenario ${scenarioId} executed`;
                setTimeout(() => toast.classList.add('hidden'), 4500);
            }
        } catch (e) {
            if (toast) {
                toast.textContent = `Scenario trigger error: ${e.message}`;
                setTimeout(() => toast.classList.add('hidden'), 4000);
            }
        }
    }

    // Demo Scenario Toolbar Bindings
    const btnNormal = document.getElementById('demo-normal');
    const btnSurge = document.getElementById('demo-surge');
    const btnRunning = document.getElementById('demo-running');
    const btnReverse = document.getElementById('demo-reverse');
    const btnCitizen = document.getElementById('demo-citizen');
    const btnSpillover = document.getElementById('demo-spillover');
    const btnWeather = document.getElementById('demo-weather');
    const btnDisconnect = document.getElementById('demo-disconnect');
    const btnCritical = document.getElementById('demo-critical');
    const btnReset = document.getElementById('demo-reset');

    if (btnNormal) btnNormal.addEventListener('click', () => triggerScenario('normal'));
    if (btnSurge) btnSurge.addEventListener('click', () => triggerScenario('surge'));
    if (btnRunning) btnRunning.addEventListener('click', () => triggerScenario('running'));
    if (btnReverse) btnReverse.addEventListener('click', () => triggerScenario('reverse_flow'));
    if (btnCitizen) btnCitizen.addEventListener('click', () => triggerScenario('citizen'));
    if (btnSpillover) btnSpillover.addEventListener('click', () => triggerScenario('spillover'));
    if (btnWeather) btnWeather.addEventListener('click', () => triggerScenario('weather'));
    if (btnDisconnect) btnDisconnect.addEventListener('click', () => triggerScenario('disconnect'));
    if (btnCritical) btnCritical.addEventListener('click', () => triggerScenario('critical'));
    if (btnReset) btnReset.addEventListener('click', () => triggerScenario('reset'));

    // Spatial Monitoring View Switcher (Map / CCTV / Split Screen)
    const mapSub = document.getElementById('map-subview');
    const cctvSub = document.getElementById('cctv-subview');
    const spatialWrap = document.getElementById('spatial-wrapper');
    const btnMap = document.getElementById('view-map-btn');
    const btnCctv = document.getElementById('view-cctv-btn');
    const btnSplit = document.getElementById('view-split-btn');

    function setActiveView(mode) {
        if (btnMap) btnMap.classList.toggle('active', mode === 'map');
        if (btnCctv) btnCctv.classList.toggle('active', mode === 'cctv');
        if (btnSplit) btnSplit.classList.toggle('active', mode === 'split');

        const streamImg = document.getElementById('cctv-stream-img');

        if (mode === 'map') {
            if (mapSub) mapSub.classList.remove('hidden');
            if (cctvSub) cctvSub.classList.add('hidden');
            if (spatialWrap) spatialWrap.classList.remove('split');
        } else if (mode === 'cctv') {
            if (mapSub) mapSub.classList.add('hidden');
            if (cctvSub) cctvSub.classList.remove('hidden');
            if (spatialWrap) spatialWrap.classList.remove('split');
            if (streamImg) streamImg.src = '/api/video/feed?t=' + Date.now();
        } else if (mode === 'split') {
            if (mapSub) mapSub.classList.remove('hidden');
            if (cctvSub) cctvSub.classList.remove('hidden');
            if (spatialWrap) spatialWrap.classList.add('split');
            if (streamImg) streamImg.src = '/api/video/feed?t=' + Date.now();
        }
    }

    const streamImg = document.getElementById('cctv-stream-img');
    if (streamImg) {
        streamImg.onerror = () => {
            setTimeout(() => {
                if (streamImg) streamImg.src = '/api/video/feed?t=' + Date.now();
            }, 1000);
        };
    }

    if (btnMap) btnMap.addEventListener('click', () => setActiveView('map'));
    if (btnCctv) btnCctv.addEventListener('click', () => setActiveView('cctv'));
    if (btnSplit) btnSplit.addEventListener('click', () => setActiveView('split'));

    // Fallback polling if WebSocket fails
    setInterval(async () => {
        if (!state.connected) {
            try {
                const resp = await fetch('/api/state');
                if (resp.ok) {
                    const data = await resp.json();
                    data.type = 'venue_state';
                    handleMessage(data);
                }
            } catch (e) {}
        }
    }, 3000);
});
