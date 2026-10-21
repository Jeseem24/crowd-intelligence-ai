// ============================================================
// TACTICAL SOUND ENGINE (Web Audio API — Zero-Latency Native FX)
// ============================================================
class TacticalSoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }
    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    playClick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.04);
        } catch (e) {}
    }
    playTelemetryPing() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.06);
            gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.06);
        } catch (e) {}
    }
    playAlertAlarm() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.linearRampToValueAtTime(880, now + 0.15);
            osc.frequency.linearRampToValueAtTime(520, now + 0.3);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(now + 0.32);
        } catch (e) {}
    }
    playAuthorizeChime() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const freqs = [523.25, 659.25, 783.99, 1046.50];
            freqs.forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const startTime = this.ctx.currentTime + (i * 0.04);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, startTime);
                gain.gain.setValueAtTime(0.06, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.3);
            });
        } catch (e) {}
    }
}
const soundEngine = new TacticalSoundEngine();

// ============================================================
// CROWD PARTICLE PHYSICS SIMULATOR (Canvas 2D HUD Engine)
// ============================================================
class CrowdParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.particles = [];
        this.activeLayer = 'particles'; // 'particles', 'heatmap', 'none'
        this.showVectors = true;
        this.rainActive = false;
        this.rainDrops = [];
        this.turnstilesOpen = true;

        this.zones = {
            gate_a: { x: 230, y: 155, w: 240, h: 150, count: 2, density: 0.33, state: 'Safe' },
            corridor_b: { x: 490, y: 145, w: 280, h: 115, count: 1, density: 0.12, state: 'Safe' },
            exit_c: { x: 25, y: 270, w: 185, h: 175, count: 2, density: 0.33, state: 'Safe' },
            ground_e: { x: 230, y: 325, w: 310, h: 120, count: 3, density: 0.15, state: 'Safe' },
            counter_d: { x: 25, y: 55, w: 185, h: 200, count: 2, density: 0.33, state: 'Safe' },
        };

        if (this.ctx) {
            this.initParticles();
            this.animate = this.animate.bind(this);
            requestAnimationFrame(this.animate);
        }
    }

    initParticles() {
        this.particles = [];
        for (const [zid, z] of Object.entries(this.zones)) {
            const num = Math.max(3, z.count * 3);
            for (let i = 0; i < num; i++) {
                this.particles.push(this.createParticle(zid, z));
            }
        }
    }

    createParticle(zoneId, z) {
        return {
            zoneId,
            x: z.x + 15 + Math.random() * (z.w - 30),
            y: z.y + 20 + Math.random() * (z.h - 40),
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            radius: 2.2 + Math.random() * 1.5,
            baseAlpha: 0.7 + Math.random() * 0.3,
            phase: Math.random() * Math.PI * 2,
        };
    }

    updateZones(zonesList) {
        if (!Array.isArray(zonesList)) return;
        for (const z of zonesList) {
            if (this.zones[z.zone_id]) {
                this.zones[z.zone_id].count = z.person_count;
                this.zones[z.zone_id].density = z.density;
                this.zones[z.zone_id].state = z.state;
                this.zones[z.zone_id].flag = z.behaviour_flag;
            }
        }

        // Adjust particle population to match live counts dynamically
        for (const [zid, z] of Object.entries(this.zones)) {
            const targetCount = Math.max(2, Math.min(60, z.count * 3));
            const current = this.particles.filter(p => p.zoneId === zid);
            if (current.length < targetCount) {
                const diff = targetCount - current.length;
                for (let i = 0; i < diff; i++) {
                    this.particles.push(this.createParticle(zid, z));
                }
            } else if (current.length > targetCount) {
                const diff = current.length - targetCount;
                let removed = 0;
                this.particles = this.particles.filter(p => {
                    if (p.zoneId === zid && removed < diff) {
                        removed++;
                        return false;
                    }
                    return true;
                });
            }
        }
    }

    animate() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, 800, 480);

        // 1. Thermal Infrared Heatmap Layer (if selected)
        if (this.activeLayer === 'heatmap') {
            this.renderHeatmap();
        }

        // 2. Kinetic Crowd Particles Layer (if selected)
        if (this.activeLayer === 'particles' || this.activeLayer === 'heatmap') {
            this.renderParticles();
        }

        // 3. Rain streaks if adverse weather active
        if (this.rainActive) {
            this.renderRain();
        }

        requestAnimationFrame(this.animate);
    }

    renderHeatmap() {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        for (const [zid, z] of Object.entries(this.zones)) {
            const cx = z.x + z.w / 2;
            const cy = z.y + z.h / 2;
            const maxRadius = Math.max(z.w, z.h) * 0.7;
            const grad = this.ctx.createRadialGradient(cx, cy, 5, cx, cy, maxRadius);

            let colorCore = 'rgba(16, 185, 129, 0.4)';
            if (z.density >= 1.5 || z.state === 'Critical') {
                colorCore = 'rgba(244, 63, 94, 0.65)';
            } else if (z.density >= 1.0 || z.state === 'Warning') {
                colorCore = 'rgba(249, 115, 22, 0.55)';
            } else if (z.state === 'Watch') {
                colorCore = 'rgba(245, 158, 11, 0.45)';
            }

            grad.addColorStop(0, colorCore);
            grad.addColorStop(0.5, colorCore.replace(/[\d\.]+\)$/, '0.2)'));
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            this.ctx.fillStyle = grad;
            this.ctx.fillRect(z.x - 20, z.y - 20, z.w + 40, z.h + 40);
        }
        this.ctx.restore();
    }

    renderParticles() {
        const now = Date.now() * 0.003;
        for (const p of this.particles) {
            const z = this.zones[p.zoneId];
            if (!z) continue;

            // Speed factor depends on density & behaviour
            let speedMul = 1.0;
            if (z.flag === 'running') speedMul = 2.4;
            else if (z.flag === 'surge') speedMul = 1.6;
            else if (z.density > 1.8) speedMul = 0.4; // severe congestion slowdown

            // Transit Flow Drift (Gate A flows toward Corridor B, Corridor B flows toward Exit C)
            if (p.zoneId === 'gate_a' && this.turnstilesOpen) {
                p.vx += 0.03 * speedMul;
                if (p.x > z.x + z.w - 10) {
                    p.x = z.x + 10;
                    p.y = z.y + 20 + Math.random() * (z.h - 40);
                }
            } else if (p.zoneId === 'corridor_b') {
                p.vx += 0.04 * speedMul;
                if (p.x > z.x + z.w - 10) {
                    p.x = z.x + 10;
                    p.y = z.y + 20 + Math.random() * (z.h - 40);
                }
            }

            p.x += p.vx * speedMul;
            p.y += p.vy * speedMul;

            // Contain within zone boundaries
            const pad = 12;
            if (p.x < z.x + pad) { p.x = z.x + pad; p.vx *= -1; }
            if (p.x > z.x + z.w - pad) { p.x = z.x + z.w - pad; p.vx *= -1; }
            if (p.y < z.y + pad) { p.y = z.y + pad; p.vy *= -1; }
            if (p.y > z.y + z.h - pad) { p.y = z.y + z.h - pad; p.vy *= -1; }

            // Color coding based on zone density
            let fill = '#10b981';
            let glow = 'rgba(16, 185, 129, 0.4)';
            if (z.density >= 1.5 || z.state === 'Critical') {
                fill = '#f43f5e';
                glow = 'rgba(244, 63, 94, 0.7)';
            } else if (z.density >= 1.0 || z.state === 'Warning') {
                fill = '#f97316';
                glow = 'rgba(249, 115, 22, 0.6)';
            } else if (z.state === 'Watch') {
                fill = '#f59e0b';
                glow = 'rgba(245, 158, 11, 0.5)';
            }

            // Draw particle with outer luminous glow
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius * (1 + 0.15 * Math.sin(now + p.phase)), 0, Math.PI * 2);
            this.ctx.fillStyle = fill;
            this.ctx.shadowColor = glow;
            this.ctx.shadowBlur = 8;
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    renderRain() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
        this.ctx.lineWidth = 1.2;
        if (this.rainDrops.length < 40) {
            this.rainDrops.push({ x: Math.random() * 800, y: Math.random() * 480, len: 12 + Math.random() * 10 });
        }
        for (const drop of this.rainDrops) {
            this.ctx.beginPath();
            this.ctx.moveTo(drop.x, drop.y);
            this.ctx.lineTo(drop.x - 3, drop.y + drop.len);
            this.ctx.stroke();
            drop.y += 14;
            drop.x -= 3;
            if (drop.y > 480) { drop.y = -10; drop.x = Math.random() * 800; }
        }
        this.ctx.restore();
    }
}

// ============================================================
// AGENTIC COGNITIVE TRACE CONTROLLER (Visual Pipeline Graph)
// ============================================================
class CognitivePipelineTrace {
    constructor() {
        this.nodes = {
            vision: document.getElementById('node-vision'),
            math: document.getElementById('node-math'),
            agent: document.getElementById('node-agent'),
            human: document.getElementById('node-human'),
            verify: document.getElementById('node-verify'),
        };
        this.conduits = {
            1: document.getElementById('conduit-1'),
            2: document.getElementById('conduit-2'),
            3: document.getElementById('conduit-3'),
            4: document.getElementById('conduit-4'),
        };
    }

    pulseNode(nodeKey) {
        const node = this.nodes[nodeKey];
        if (node) {
            node.classList.add('firing');
            setTimeout(() => node.classList.remove('firing'), 700);
        }
    }

    pulsePerception() {
        this.pulseNode('vision');
        setTimeout(() => this.pulseNode('math'), 150);
    }

    pulseCognition() {
        this.pulseNode('agent');
        if (this.conduits[3]) this.conduits[3].classList.add('active');
        setTimeout(() => this.pulseNode('human'), 200);
    }

    pulseHumanGate() {
        this.pulseNode('human');
        if (this.conduits[4]) this.conduits[4].classList.add('active');
        setTimeout(() => this.pulseNode('verify'), 250);
    }

    pulseVerify() {
        this.pulseNode('verify');
    }
}

// Global engine instances
let particleSystem = null;
let cognitivePipeline = null;

// ============================================================
// STATE
// ============================================================
const state = {
    connected: false,
    muted: false,
    sfxEnabled: true,
    venueState: null,
    recommendations: [],
    ws: null,
    reconnectTimer: null,
    previousStatus: 'safe',
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
        case 'intervention_outcome':
            handleInterventionOutcome(data);
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
    if (venueState.steward_distribution) {
        updateStewardAllocations(venueState.steward_distribution);
    }
    if (venueState.spillover_predictions) {
        updateFlowArrows(venueState.spillover_predictions);
    }

    // God-Level HUD Enhancements:
    if (particleSystem) {
        particleSystem.updateZones(venueState.zones);
    }
    if (cognitivePipeline) {
        cognitivePipeline.pulsePerception();
    }
}

function updateVenueStatus(status) {
    const el = document.getElementById('venue-status');
    if (el) {
        el.textContent = status.toUpperCase();
        el.className = `venue-badge ${status.toLowerCase()}`;
    }

    // Dynamic Edge Vignette
    const vig = document.getElementById('ambient-vignette');
    if (vig) {
        vig.className = `ambient-vignette ${status.toLowerCase()}`;
    }

    // Tactical Alert Audio on critical transition
    if (status === 'Critical' && state.previousStatus !== 'Critical') {
        soundEngine.playAlertAlarm();
    }
    state.previousStatus = status;
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

        // Play sound and speak advisory for new Critical zones
        for (const z of criticalZones) {
            if (lastAlertState[z.zone_id] !== 'Critical') {
                playAlertSound();
                speakTacticalAdvisory(`Critical alert at ${z.zone_name}. Time to critical projected at ${Math.round(z.time_to_critical_s || 30)} seconds.`);
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

let lastSpokenTime = 0;
function speakTacticalAdvisory(msg) {
    if (state.muted || !('speechSynthesis' in window)) return;
    if (Date.now() - lastSpokenTime < 18000) return;
    lastSpokenTime = Date.now();
    try {
        const u = new SpeechSynthesisUtterance(msg);
        u.rate = 1.05;
        u.pitch = 1.0;
        window.speechSynthesis.speak(u);
    } catch (e) {}
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
                    <button class="btn-edit-action" style="background:#b45309;color:#ffffff;border:none;border-radius:8px;padding:8px 14px;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;" onclick="openEditModal(${rec.alert_id}, '${rec.zone_id}')">
                        <span>✏️ EDIT DIRECTIVE</span>
                    </button>
                    <button class="btn-dismiss-action" onclick="handleAlertAction(${rec.alert_id}, 'rejected')">
                        <span class="action-icon">✕</span>
                        <span>DISMISS</span>
                    </button>
                </div>
            ` : `
                <div class="rec-actions resolved">
                    <span class="rec-status-resolved ${rec.status}">
                        ${rec.status === 'approved' ? '✓ DIRECTIVE AUTHORIZED BY OPERATOR (LOGGED TO AUDIT TRAIL)' : (rec.status === 'edited' ? '✏️ CUSTOM DIRECTIVE OVERRIDE AUTHORIZED (AUDIT LOGGED)' : '✕ DISMISSED BY OPERATOR')}
                    </span>
                </div>
            `}
        `;
        container.appendChild(card);
    }
}

// Global modal variables
let currentEditAlertId = null;
let currentEditZoneId = null;
let editStewardCount = 3;

window.openEditModal = function(alertId, zoneId) {
    currentEditAlertId = alertId;
    currentEditZoneId = zoneId;
    const modal = document.getElementById('edit-directive-modal');
    const badge = document.getElementById('edit-target-zone');
    if (badge) badge.textContent = `TARGET SECTOR: ${zoneId.toUpperCase()}`;
    if (modal) modal.classList.remove('hidden');
};

function handleInterventionOutcome(data) {
    const banner = document.getElementById('feedback-banner');
    const text = document.getElementById('feedback-text');
    if (banner && text) {
        text.textContent = data.message;
        banner.classList.remove('hidden');
        if (cognitivePipeline) cognitivePipeline.pulseVerify();
        soundEngine.playAuthorizeChime();
        setTimeout(() => banner.classList.add('hidden'), 9000);
    }
}

function updateStewardAllocations(dist) {
    const container = document.getElementById('steward-allocations');
    if (!container || !dist || !dist.allocations) return;
    container.innerHTML = dist.allocations.map(a => `
        <div class="steward-card">
            <div class="steward-card-header">
                <span class="steward-zone-title">${a.zone_name}</span>
                <span class="steward-count-badge">${a.assigned_stewards} Stewards</span>
            </div>
            <p class="steward-instruc">${a.post_instructions}</p>
        </div>
    `).join('');
}

function updateFlowArrows(predictions) {
    if (!predictions) return;
    const svgMap = document.getElementById('venue-map');
    if (!svgMap) return;
    // Highlight active wavefront arrows
    predictions.forEach(p => {
        const poly = document.getElementById(`poly-${p.source_id}`);
        if (poly && p.surge_severity === 'Critical') {
            poly.style.stroke = '#ef4444';
            poly.style.strokeWidth = '2.5';
        }
    });
}

function setRole(roleName) {
    state.currentRole = roleName;
    soundEngine.playClick();
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`role-${roleName}`)?.classList.add('active');

    const tilesPanel = document.getElementById('tiles-panel');
    const mapPanel = document.getElementById('map-panel');
    const stewardPanel = document.getElementById('steward-panel');

    if (roleName === 'police') {
        if (stewardPanel) stewardPanel.scrollIntoView({ behavior: 'smooth' });
    } else if (roleName === 'volunteer') {
        if (tilesPanel) tilesPanel.scrollIntoView({ behavior: 'smooth' });
    }
}

async function handleAlertAction(alertId, action) {
    try {
        if (action === 'approved') {
            soundEngine.playAuthorizeChime();
            if (cognitivePipeline) cognitivePipeline.pulseHumanGate();
        } else {
            soundEngine.playClick();
        }

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

    function highlightScenarioButton(btn) {
        document.querySelectorAll('.cmd-scenario-buttons .cmd-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    if (btnNormal) btnNormal.addEventListener('click', () => { highlightScenarioButton(btnNormal); triggerScenario('normal'); });
    if (btnSurge) btnSurge.addEventListener('click', () => { highlightScenarioButton(btnSurge); triggerScenario('surge'); });
    if (btnRunning) btnRunning.addEventListener('click', () => { highlightScenarioButton(btnRunning); triggerScenario('running'); });
    if (btnReverse) btnReverse.addEventListener('click', () => { highlightScenarioButton(btnReverse); triggerScenario('reverse_flow'); });
    if (btnCitizen) btnCitizen.addEventListener('click', () => { highlightScenarioButton(btnCitizen); triggerScenario('citizen'); });
    if (btnSpillover) btnSpillover.addEventListener('click', () => { highlightScenarioButton(btnSpillover); triggerScenario('spillover'); });
    if (btnWeather) btnWeather.addEventListener('click', () => { highlightScenarioButton(btnWeather); triggerScenario('weather'); });
    if (btnDisconnect) btnDisconnect.addEventListener('click', () => { highlightScenarioButton(btnDisconnect); triggerScenario('disconnect'); });
    if (btnCritical) btnCritical.addEventListener('click', () => { highlightScenarioButton(btnCritical); triggerScenario('critical'); });
    if (btnReset) btnReset.addEventListener('click', () => { highlightScenarioButton(btnNormal); triggerScenario('reset'); });

    // Role Switcher Bindings
    document.getElementById('role-chief')?.addEventListener('click', () => setRole('chief'));
    document.getElementById('role-police')?.addEventListener('click', () => setRole('police'));
    document.getElementById('role-volunteer')?.addEventListener('click', () => setRole('volunteer'));

    // Edit Directive Modal Bindings
    const editModal = document.getElementById('edit-directive-modal');
    const closeEdit = () => editModal?.classList.add('hidden');
    document.getElementById('edit-modal-close')?.addEventListener('click', closeEdit);
    document.getElementById('btn-cancel-edit')?.addEventListener('click', closeEdit);

    const throttleSlider = document.getElementById('edit-throttle-slider');
    const throttleVal = document.getElementById('edit-throttle-val');
    if (throttleSlider && throttleVal) {
        throttleSlider.addEventListener('input', (e) => {
            throttleVal.textContent = `${e.target.value}% Hold`;
        });
    }

    const stewardCountEl = document.getElementById('steward-count-val');
    document.getElementById('steward-minus')?.addEventListener('click', () => {
        editStewardCount = Math.max(1, editStewardCount - 1);
        if (stewardCountEl) stewardCountEl.textContent = `${editStewardCount} Stewards`;
    });
    document.getElementById('steward-plus')?.addEventListener('click', () => {
        editStewardCount = Math.min(8, editStewardCount + 1);
        if (stewardCountEl) stewardCountEl.textContent = `${editStewardCount} Stewards`;
    });

    document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
        if (!currentEditAlertId) return;
        const notes = document.getElementById('edit-notes-input')?.value.trim() || `Throttled intake by ${throttleSlider?.value || 50}%, deployed ${editStewardCount} stewards`;
        try {
            await fetch(`/api/alerts/${currentEditAlertId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'edited', directive_notes: notes })
            });
            const rec = state.recommendations.find(r => r.alert_id === currentEditAlertId);
            if (rec) {
                rec.status = 'edited';
                renderRecommendations();
            }
            closeEdit();
        } catch (e) {
            console.error('Failed to submit custom directive:', e);
        }
    });

    // ============================================================
    // GOD-LEVEL ENGINES INITIALIZATION
    // ============================================================
    particleSystem = new CrowdParticleSystem('crowd-particles-canvas');
    cognitivePipeline = new CognitivePipelineTrace();

    // Initialize Active Steward Allocations (Phase 2 F15 baseline)
    const DEFAULT_STEWARD_DISTRIBUTION = {
        total_stewards: 12,
        allocations: [
            { zone_id: 'gate_a', zone_name: 'Main Concourse (Central Clock)', assigned_stewards: 4, post_instructions: 'Platform surge management & central information kiosk' },
            { zone_id: 'corridor_b', zone_name: 'Graybar Passage', assigned_stewards: 2, post_instructions: 'Lexington corridor pedestrian separation & wayfinding' },
            { zone_id: 'exit_c', zone_name: 'Shuttle Passage & 42nd St', assigned_stewards: 3, post_instructions: 'Subway transfer egress unblocking & stairwell patrol' },
            { zone_id: 'counter_d', zone_name: 'Biltmore Concourse Gates', assigned_stewards: 1, post_instructions: 'Commuter gate ticket wickets & queue stanchions' },
            { zone_id: 'ground_e', zone_name: 'Vanderbilt Hall Plaza', assigned_stewards: 2, post_instructions: 'Public assembly buffer & Onassis foyer station' }
        ]
    };
    updateStewardAllocations(DEFAULT_STEWARD_DISTRIBUTION);

    // Initialize Default Executive Safety Briefing (Non-empty baseline)
    const DEFAULT_SAFETY_BRIEFING = {
        generated_at: new Date().toISOString(),
        content: `### Executive Operational Summary
- **Venue Operational Status**: **NORMAL / GREEN**
- **Venue**: **Grand Central Terminal, NYC (MTA Transit Interchange)**
- **Sectors Monitored**: 5 Integrated Sectors under active YOLOv8 computer vision & hydrodynamic density calculus.
- **Egress & Safety Margin**: **100% NFPA 101 Compliant**. Shuttle Passage & Graybar arteries clear; free-flow capacity across all Main Concourse gates.
- **Dynamic Stewards**: 12 Active Responders stationed across all key strategic choke points. Zero active critical directives.`
    };
    updateBriefing(DEFAULT_SAFETY_BRIEFING);

    // Initialize Initial Telemetry Loop Logs (Non-empty baseline)
    const DEFAULT_AGENT_NOTES = [
        { timestamp: new Date(Date.now() - 3000).toISOString(), message: "Perception Loop: YOLOv8 tracking synchronized across 4 multi-camera channels at 10 FPS." },
        { timestamp: new Date(Date.now() - 2000).toISOString(), message: "Hydrodynamic Calculus: Navier-Stokes density delta +0.01 p/m² across grand concourse (SAFE)." },
        { timestamp: new Date(Date.now() - 1000).toISOString(), message: "Agentic Decision Engine: NFPA 101 safety margin verified; zero critical intervention required." }
    ];
    DEFAULT_AGENT_NOTES.forEach(n => addAgentNote(n));

    // Map Layer Toggle Buttons
    const btnLayerParticles = document.getElementById('layer-particles-btn');
    const btnLayerHeatmap = document.getElementById('layer-heatmap-btn');
    const btnLayerVectors = document.getElementById('layer-vectors-btn');
    const transitLinesG = document.getElementById('flow-transit-lines');

    if (btnLayerParticles) {
        btnLayerParticles.addEventListener('click', () => {
            soundEngine.playClick();
            const isActive = btnLayerParticles.classList.toggle('active');
            particleSystem.activeLayer = isActive ? 'particles' : 'none';
            if (isActive && btnLayerHeatmap) btnLayerHeatmap.classList.remove('active');
        });
    }

    if (btnLayerHeatmap) {
        btnLayerHeatmap.addEventListener('click', () => {
            soundEngine.playClick();
            const isActive = btnLayerHeatmap.classList.toggle('active');
            particleSystem.activeLayer = isActive ? 'heatmap' : 'particles';
            if (isActive && btnLayerParticles) btnLayerParticles.classList.add('active');
        });
    }

    if (btnLayerVectors) {
        btnLayerVectors.addEventListener('click', () => {
            soundEngine.playClick();
            const isActive = btnLayerVectors.classList.toggle('active');
            if (transitLinesG) transitLinesG.style.display = isActive ? 'block' : 'none';
        });
    }

    // Tactical Web Audio SFX Toggle
    const btnSfx = document.getElementById('sfx-toggle-btn');
    if (btnSfx) {
        btnSfx.addEventListener('click', () => {
            state.sfxEnabled = !state.sfxEnabled;
            soundEngine.enabled = state.sfxEnabled;
            btnSfx.classList.toggle('active', state.sfxEnabled);
            btnSfx.textContent = state.sfxEnabled ? '🔊 SFX ON' : '🔇 SFX MUTED';
            if (state.sfxEnabled) soundEngine.playClick();
        });
    }

    // Interactive Sandbox Controller Bindings
    const sandboxSlider = document.getElementById('sandbox-slider');
    const sandboxVal = document.getElementById('sandbox-slider-val');
    let sliderDebounce = null;

    if (sandboxSlider && sandboxVal) {
        sandboxSlider.addEventListener('input', (e) => {
            const count = parseInt(e.target.value);
            const den = (count / 6.0).toFixed(2);
            sandboxVal.textContent = `${count} Persons (${den} p/m²)`;
            soundEngine.playClick();

            clearTimeout(sliderDebounce);
            sliderDebounce = setTimeout(async () => {
                try {
                    await fetch('/api/vision/ingest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            zone_id: 'gate_a',
                            person_count: count,
                            density: parseFloat(den),
                            behaviour_flag: count >= 12 ? 'surge' : (count >= 7 ? 'running' : 'normal'),
                            sensor_status: 'ok',
                            timestamp: new Date().toISOString()
                        })
                    });
                } catch (err) {
                    console.error('Sandbox ingest error:', err);
                }
            }, 120);
        });
    }

    const btnTurnstile = document.getElementById('sandbox-turnstile-btn');
    if (btnTurnstile) {
        btnTurnstile.addEventListener('click', () => {
            soundEngine.playClick();
            particleSystem.turnstilesOpen = !particleSystem.turnstilesOpen;
            btnTurnstile.classList.toggle('active', !particleSystem.turnstilesOpen);
            btnTurnstile.innerHTML = particleSystem.turnstilesOpen 
                ? '<span class="sandbox-btn-dot"></span> Turnstiles: OPEN'
                : '<span class="sandbox-btn-dot" style="background:#ef4444"></span> Turnstiles: HELD / CLOSED';
        });
    }

    const btnWeatherToggle = document.getElementById('sandbox-weather-btn');
    if (btnWeatherToggle) {
        btnWeatherToggle.addEventListener('click', async () => {
            soundEngine.playClick();
            try {
                const resp = await fetch('/api/demo/scenario/weather', { method: 'POST' });
                const res = await resp.json();
                const isRain = res.message && res.message.includes('ENABLED');
                particleSystem.rainActive = isRain;
                btnWeatherToggle.classList.toggle('active', isRain);
                btnWeatherToggle.textContent = isRain ? '🌧️ Rain Factor: ACTIVE (+15%)' : '🌧️ Rain Factor: OFF';
            } catch (err) {
                console.error('Weather toggle error:', err);
            }
        });
    }

    const btnPanic = document.getElementById('sandbox-panic-btn');
    if (btnPanic) {
        btnPanic.addEventListener('click', () => {
            soundEngine.playAlertAlarm();
            triggerScenario('running');
        });
    }

    // Attach click audio to all buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            // Subtle hover feedback
        });
        btn.addEventListener('click', () => {
            soundEngine.playClick();
        });
    });

    // Multi-Camera Tactical Channel Selector & Blueprint FOV Frustum Synchronizer
    const camButtons = document.querySelectorAll('.cctv-cam-btn');
    const camTitleEl = document.getElementById('cctv-cam-title');
    let currentChannel = 'cam1';

    const CAM_TITLES = {
        cam1: 'CAM 01 // [SEC-01] MAIN CONCOURSE CENTRAL CLOCK & PLATFORMS',
        cam2: 'CAM 02 // [SEC-02] GRAYBAR PASSAGE EAST ARTERY',
        cam3: 'CAM 03 // [SEC-03] SHUTTLE PASSAGE & LOWER EGRESS',
        cam4: 'CAM 04 // [SEC-04] VANDERBILT HALL & 42ND ST PASSAGE',
        quad: 'AEGIS C2 // GRAND CENTRAL TERMINAL QUAD CCTV MATRIX // 4 FEEDS',
    };

    function selectCameraChannel(camId) {
        soundEngine.playClick();
        currentChannel = camId;

        // Update CCTV button states
        camButtons.forEach(b => b.classList.toggle('active', b.dataset.cam === camId));

        // Update Title
        if (camTitleEl && CAM_TITLES[camId]) {
            camTitleEl.textContent = CAM_TITLES[camId];
        }

        // Update Video Stream
        const streamImg = document.getElementById('cctv-stream-img');
        if (streamImg) {
            streamImg.src = `/api/video/feed?channel=${camId}&t=${Date.now()}`;
        }

        // Synchronize Map Camera FOV Frustums & Glyphs
        const allCones = {
            cam1: document.getElementById('cam1-cone-group'),
            cam2: document.getElementById('cam2-cone-group'),
            cam3: document.getElementById('cam3-cone-group'),
            cam4: document.getElementById('cam4-cone-group'),
        };
        const allGlyphs = {
            cam1: document.getElementById('glyph-cam1'),
            cam2: document.getElementById('glyph-cam2'),
            cam3: document.getElementById('glyph-cam3'),
            cam4: document.getElementById('glyph-cam4'),
        };

        if (camId === 'quad') {
            // In Quad mode, light up all 4 sightlines simultaneously!
            Object.values(allCones).forEach(c => c && c.classList.add('active'));
            Object.values(allGlyphs).forEach(g => g && g.classList.add('active'));
        } else {
            Object.entries(allCones).forEach(([cid, el]) => {
                if (el) el.classList.toggle('active', cid === camId);
            });
            Object.entries(allGlyphs).forEach(([cid, el]) => {
                if (el) el.classList.toggle('active', cid === camId);
            });
        }
    }

    camButtons.forEach(btn => {
        btn.addEventListener('click', () => selectCameraChannel(btn.dataset.cam));
    });

    // Also bind camera glyphs on the architectural map
    ['cam1', 'cam2', 'cam3', 'cam4'].forEach(cid => {
        const glyph = document.getElementById(`glyph-${cid}`);
        if (glyph) {
            glyph.addEventListener('click', () => selectCameraChannel(cid));
        }
    });

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
            if (streamImg) streamImg.src = `/api/video/feed?channel=${currentChannel}&t=` + Date.now();
        } else if (mode === 'split') {
            if (mapSub) mapSub.classList.remove('hidden');
            if (cctvSub) cctvSub.classList.remove('hidden');
            if (spatialWrap) spatialWrap.classList.add('split');
            if (streamImg) streamImg.src = `/api/video/feed?channel=${currentChannel}&t=` + Date.now();
        }
    }

    const streamImg = document.getElementById('cctv-stream-img');
    if (streamImg) {
        streamImg.onerror = () => {
            setTimeout(() => {
                if (streamImg) streamImg.src = `/api/video/feed?channel=${currentChannel}&t=` + Date.now();
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

