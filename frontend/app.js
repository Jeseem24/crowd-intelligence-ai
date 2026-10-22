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
        case 'citizen_report_alert':
            handleCitizenReportAlert(data.report);
            break;
        case 'citizen_report_acknowledged':
            handleCitizenReportAcknowledged(data.report_id);
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
// ZONE TILES (High-End Real-Time Command Telemetry Matrix)
// ============================================================
function updateZoneTiles(zones) {
    const container = document.getElementById('zone-tiles');
    if (!container) return;
    container.innerHTML = '';

    const ZONE_METAS = {
        gate_a: { tag: 'CAM 01', shortName: 'Main Concourse', subtitle: 'Central Inflow & Ticketing', maxCap: 240 },
        corridor_b: { tag: 'CAM 02', shortName: 'North Passage', subtitle: 'Platform Access Artery', maxCap: 160 },
        exit_c: { tag: 'CAM 03', shortName: 'Platform Surge', subtitle: 'Surge Chokepoint & Egress', maxCap: 130 },
        ground_e: { tag: 'CAM 04', shortName: 'Festival Plaza', subtitle: 'Arena Buffer & Assembly', maxCap: 600 },
        counter_d: { tag: 'CAM 05', shortName: 'SkyCity Wickets', subtitle: 'Ticketing & Info Hall', maxCap: 150 },
    };

    // Prioritize Critical & Warning zones first, then highest risk score
    const sorted = [...zones].sort((a, b) => {
        const priority = { 'Critical': 4, 'Warning': 3, 'Watch': 2, 'Safe': 1 };
        const pDiff = (priority[b.state] || 0) - (priority[a.state] || 0);
        return pDiff !== 0 ? pDiff : b.risk_score - a.risk_score;
    });

    for (const z of sorted) {
        const meta = ZONE_METAS[z.zone_id] || { tag: 'ZONE', shortName: z.zone_name, subtitle: `${z.zone_type} · ${z.floor_area_sqm} m²`, maxCap: 200 };
        const stateClass = z.state.toLowerCase();
        const densityVal = z.density.toFixed(2);
        const densityPct = Math.min(100, Math.max(5, Math.round((z.density / 2.5) * 100)));
        const occupancyPct = Math.min(100, Math.round((z.person_count / meta.maxCap) * 100));
        const trendSymbol = z.trend_slope > 0.005 ? '↑' : z.trend_slope < -0.005 ? '↓' : '→';
        const trendSign = z.trend_slope >= 0 ? '+' : '';
        const trendFormatted = `${trendSymbol} ${trendSign}${z.trend_slope.toFixed(3)}`;

        let stateText = z.state.toUpperCase();
        if (z.state === 'Critical') stateText = 'CRITICAL';
        else if (z.state === 'Warning') stateText = 'SURGE';
        else if (z.state === 'Watch') stateText = 'WATCH';
        else stateText = 'NOMINAL';

        const tile = document.createElement('div');
        tile.className = `zone-tile ${stateClass}`;
        tile.innerHTML = `
            <div class="tile-top-bar">
                <div class="tile-tag-wrap">
                    <span class="tile-cam-tag">${meta.tag}</span>
                    <span class="tile-title-clean">${meta.shortName}</span>
                </div>
                <div class="tile-status-pill ${stateClass}">
                    <span class="status-dot"></span>
                    <span>${stateText}</span>
                </div>
            </div>

            <div class="tile-subtitle-clean">${meta.subtitle}</div>

            <div class="tile-hero-metric">
                <div class="hero-metric-left">
                    <div class="hero-density-val">${densityVal}<span class="hero-density-unit"> p/m²</span></div>
                    <div class="hero-density-label">DENSITY</div>
                </div>
                <div class="hero-metric-right">
                    <div class="hero-occupancy-val">${z.person_count}<span class="hero-occupancy-max">/${meta.maxCap}</span></div>
                    <div class="hero-occupancy-label">${occupancyPct}% CAP</div>
                </div>
            </div>

            <div class="tile-gauge-wrap">
                <div class="tile-gauge-track">
                    <div class="tile-gauge-fill ${stateClass}" style="width: ${densityPct}%"></div>
                </div>
            </div>

            <div class="tile-footer-kpis">
                <div class="kpi-item">
                    <span class="kpi-lbl">RISK</span>
                    <span class="kpi-val ${stateClass}">${z.risk_score.toFixed(2)}</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-lbl">FLOW</span>
                    <span class="kpi-val">${trendFormatted}</span>
                </div>
                <div class="kpi-item kpi-report-item" onclick="switchToReportsTab('${z.zone_id}')" title="Click to view & manage citizen hazard reports for ${meta.shortName}" style="cursor: pointer;">
                    <span class="kpi-lbl">REPORTS ↗</span>
                    <span class="kpi-val ${z.active_reports > 0 ? 'alert' : ''}">${z.active_reports > 0 ? `📢 ${z.active_reports}` : '0'}</span>
                </div>
            </div>

            ${z.time_to_critical_s ? `<div class="tile-ttc-warning">⚠️ TTC Escalation ~${Math.round(z.time_to_critical_s)}s</div>` : ''}
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
        container.innerHTML = `
            <div class="nominal-state">
                <span class="nominal-icon">🟢</span>
                <div class="nominal-text">
                    <strong>ALL VENUE SECTORS NOMINAL</strong>
                    <p>Real-time pedestrian densities are well within NFPA safety limits (&lt; 0.50 p/m²). Autonomous directive engine in active sentinel mode.</p>
                </div>
            </div>`;
        if (recPanelHeader) {
            recPanelHeader.innerHTML = '🤖 AI Tactical Directives <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)">🟢 ALL SAFE</span>';
        }
        return;
    }

    const openCount = state.recommendations.filter(r => r.status === 'open').length;
    const tabRecBadge = document.getElementById('tab-rec-count');
    if (tabRecBadge) {
        tabRecBadge.textContent = openCount > 0 ? `${openCount} Action${openCount > 1 ? 's' : ''}` : 'Clear';
        tabRecBadge.style.background = openCount > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(16,185,129,0.18)';
        tabRecBadge.style.color = openCount > 0 ? '#f97316' : '#10b981';
        tabRecBadge.style.borderColor = openCount > 0 ? 'rgba(249,115,22,0.4)' : 'rgba(16,185,129,0.3)';
    }

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
window.handleAlertAction = handleAlertAction;

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
                    const isClosed = a.resolved_at || ['approved', 'rejected', 'resolved'].includes(a.operator_action);
                    if (isClosed) continue; // Skip resolved historical alerts

                    addRecommendation({
                        alert_id: a.alert_id,
                        zone_id: a.zone_id,
                        zone_name: a.zone_id === 'gate_a' ? 'Main Concourse' : (a.zone_id === 'corridor_b' ? 'North Passage' : a.zone_id),
                        severity: a.level,
                        observation: a.observation,
                        trend: a.trend,
                        prediction: a.prediction,
                        recommendation: a.recommendation,
                        expected_benefit: a.expected_benefit,
                        status: 'open',
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

    // Mute (if button exists)
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            state.muted = !state.muted;
            muteBtn.textContent = state.muted ? '🔇' : '🔊';
        });
    }

    // Alert dismiss
    const alertDismissBtn = document.getElementById('alert-dismiss');
    if (alertDismissBtn) {
        alertDismissBtn.addEventListener('click', () => {
            document.getElementById('alert-banner')?.classList.add('hidden');
        });
    }

    // QR modal
    const qrBtn = document.getElementById('qr-btn');
    if (qrBtn) {
        qrBtn.addEventListener('click', () => {
            soundEngine.playClick();
            const qrModal = document.getElementById('qr-modal');
            const qrImg = document.getElementById('qr-image');
            if (qrImg) qrImg.src = `/api/qr?t=${Date.now()}`;
            if (qrModal) qrModal.classList.remove('hidden');
            fetch('/api/qr').then(r => {
                const url = r.headers.get('X-QR-URL') || `${window.location.protocol}//${window.location.hostname}:${window.location.port}/report.html`;
                const qrUrlEl = document.getElementById('qr-url');
                if (qrUrlEl) qrUrlEl.innerHTML = `<a href="${url}" target="_blank" style="color:#38bdf8;text-decoration:underline;">${url}</a>`;
            }).catch(() => {});
        });
    }
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

            // Immediately pull new state and render without waiting for next tick
            try {
                const sResp = await fetch('/api/state');
                if (sResp.ok) {
                    const sData = await sResp.json();
                    sData.type = 'venue_state';
                    handleMessage(sData);
                }
                const aResp = await fetch('/api/alerts?limit=10');
                if (aResp.ok) {
                    const alerts = await aResp.json();
                    if (Array.isArray(alerts) && alerts.length > 0) {
                        for (const a of alerts) {
                            addRecommendation({
                                alert_id: a.alert_id,
                                zone_id: a.zone_id,
                                zone_name: a.zone_id === 'gate_a' ? 'Main Concourse' : (a.zone_id === 'corridor_b' ? 'North Passage' : (a.zone_id === 'exit_c' ? 'Platform Surge Gates' : a.zone_id)),
                                severity: a.level,
                                observation: a.observation,
                                trend: a.trend,
                                prediction: a.prediction,
                                recommendation: a.recommendation,
                                expected_benefit: a.expected_benefit,
                                status: 'open',
                                source: a.source
                            });
                        }
                    }
                }
            } catch (err) {}
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

    // Master Tactical Crisis Toggle Switch
    const masterCrisisToggle = document.getElementById('master-crisis-toggle');
    const crisisToggleText = document.getElementById('crisis-toggle-text');
    let isCrisisActive = false;

    window.setCrisisActiveState = function(active) {
        isCrisisActive = active;
        if (masterCrisisToggle) {
            if (active) {
                masterCrisisToggle.classList.add('active');
                if (crisisToggleText) crisisToggleText.textContent = '🟢 RESET TO SAFE BASELINE';
                masterCrisisToggle.title = 'Reset venue to safe operational baseline';
            } else {
                masterCrisisToggle.classList.remove('active');
                if (crisisToggleText) crisisToggleText.textContent = '🚨 TRIGGER CRITICAL CRISIS';
                masterCrisisToggle.title = 'Execute High-Impact Critical Crisis Sandbox Simulation';
            }
        }
    };

    if (masterCrisisToggle) {
        masterCrisisToggle.addEventListener('click', async () => {
            soundEngine.playClick();
            if (!isCrisisActive) {
                // Activate Critical Crisis
                window.setCrisisActiveState(true);
                await triggerScenario('critical');
                soundEngine.playAlert();
                if (cognitivePipeline) cognitivePipeline.pulseObservation();
            } else {
                // Return to Safe Baseline
                window.setCrisisActiveState(false);
                await triggerScenario('reset');
                soundEngine.playClick();
            }
        });
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
- **Venue**: **Adelaide Metropolitan Transit & Festival Plaza Interchange**
- **Sectors Monitored**: 5 Integrated Sectors under active YOLOv8 stationary CCTV perception & hydrodynamic density calculus.
- **Egress & Safety Margin**: **100% NFPA 101 Compliant**. North Platform Passage & Festival Plaza arteries clear; free-flow capacity across all Concourse turnstiles.
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
    const webcamBtn = document.getElementById('btn-webcam-toggle');
    let currentChannel = 'cam1';

    const CAM_TITLES = {
        cam1: 'CAM 01 // [SEC-01] CONCOURSE MEZZANINE CEILING SURVEILLANCE',
        cam2: 'CAM 02 // [SEC-02] NORTH PLATFORM PASSAGE ARTERY',
        cam3: 'CAM 03 // [SEC-03] PLATFORM SURGE GATES & WICKETS',
        cam4: 'CAM 04 // [SEC-04] FESTIVAL PLAZA MAST DOME (EXTERIOR)',
        quad: 'AEGIS C2 // ADELAIDE METROPOLITAN TRANSIT 4-CHANNEL CCTV MATRIX',
        webcam: 'LIVE WEBCAM // LOCAL OPERATOR TERMINAL (REAL-TIME YOLOV8 DETECTION)',
    };

    // Laptop Webcam Live Streaming Engine
    let webcamStream = null;
    let webcamInterval = null;
    let isWebcamActive = false;
    let webcamActiveBlobUrl = null;

    async function startWebcam() {
        const video = document.getElementById('webcam-video');
        const canvas = document.getElementById('webcam-capture-canvas');
        const streamImg = document.getElementById('cctv-stream-img');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Webcam access not supported in this browser environment.');
            return;
        }

        try {
            if (webcamBtn) {
                webcamBtn.textContent = '⏳ INITIATING CAM...';
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 360 } }
            });
            webcamStream = stream;
            if (video) {
                video.srcObject = stream;
                await video.play();
            }

            isWebcamActive = true;
            currentChannel = 'webcam';

            camButtons.forEach(b => b.classList.toggle('active', b.dataset.cam === 'webcam'));
            if (webcamBtn) {
                webcamBtn.innerHTML = '🔴 STOP LIVE WEBCAM';
                webcamBtn.classList.add('active', 'webcam-streaming');
            }
            if (camTitleEl) {
                camTitleEl.textContent = CAM_TITLES.webcam;
            }

            const ctx = canvas ? canvas.getContext('2d') : null;
            let isPosting = false;

            webcamInterval = setInterval(() => {
                if (!isWebcamActive || isPosting) return;
                if (!video || video.readyState < 2 || !ctx || !canvas) return;

                ctx.drawImage(video, 0, 0, 640, 360);
                isPosting = true;

                canvas.toBlob(async (blob) => {
                    if (!blob || !isWebcamActive) {
                        isPosting = false;
                        return;
                    }
                    try {
                        const resp = await fetch('/api/webcam/frame', {
                            method: 'POST',
                            body: blob
                        });
                        if (resp.ok && isWebcamActive) {
                            const annotatedBlob = await resp.blob();
                            if (webcamActiveBlobUrl) {
                                URL.revokeObjectURL(webcamActiveBlobUrl);
                            }
                            webcamActiveBlobUrl = URL.createObjectURL(annotatedBlob);
                            if (streamImg && currentChannel === 'webcam') {
                                streamImg.src = webcamActiveBlobUrl;
                            }
                        }
                    } catch (err) {
                        console.error('Webcam frame upload error:', err);
                    } finally {
                        isPosting = false;
                    }
                }, 'image/jpeg', 0.8);
            }, 90); // ~11-12 FPS real-time YOLOv8 bounding overlay
        } catch (e) {
            console.error('Webcam permission error:', e);
            alert('Camera access denied or device unavailable: ' + e.message);
            stopWebcam();
        }
    }

    function stopWebcam() {
        isWebcamActive = false;
        if (webcamInterval) {
            clearInterval(webcamInterval);
            webcamInterval = null;
        }
        if (webcamStream) {
            webcamStream.getTracks().forEach(t => t.stop());
            webcamStream = null;
        }
        if (webcamActiveBlobUrl) {
            URL.revokeObjectURL(webcamActiveBlobUrl);
            webcamActiveBlobUrl = null;
        }
        const video = document.getElementById('webcam-video');
        if (video) video.srcObject = null;

        if (webcamBtn) {
            webcamBtn.innerHTML = '📹 LIVE WEBCAM';
            webcamBtn.classList.remove('active', 'webcam-streaming');
        }
    }

    function selectCameraChannel(camId) {
        if (!camId) return;
        soundEngine.playClick();

        if (camId === 'webcam') {
            if (!isWebcamActive) {
                startWebcam();
            } else {
                stopWebcam();
                selectCameraChannel('cam1');
            }
            return;
        }

        // If currently in webcam mode, deactivate webcam before switching feeds
        if (isWebcamActive) {
            stopWebcam();
        }

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
        btn.addEventListener('click', () => {
            const cam = btn.dataset.cam || (btn.id === 'btn-webcam-toggle' ? 'webcam' : 'cam1');
            selectCameraChannel(cam);
        });
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
        const camDock = document.getElementById('cctv-cam-selector');
        const mapDock = document.getElementById('map-layer-dock');

        if (mode === 'map') {
            if (mapSub) mapSub.classList.remove('hidden');
            if (cctvSub) cctvSub.classList.add('hidden');
            if (spatialWrap) spatialWrap.classList.remove('split');
            if (camDock) camDock.classList.add('hidden');
            if (mapDock) mapDock.classList.remove('hidden');
        } else if (mode === 'cctv') {
            if (mapSub) mapSub.classList.add('hidden');
            if (cctvSub) cctvSub.classList.remove('hidden');
            if (spatialWrap) spatialWrap.classList.remove('split');
            if (camDock) camDock.classList.remove('hidden');
            if (mapDock) mapDock.classList.add('hidden');
            if (streamImg) streamImg.src = `/api/video/feed?channel=${currentChannel}&t=` + Date.now();
        } else if (mode === 'split') {
            if (mapSub) mapSub.classList.remove('hidden');
            if (cctvSub) cctvSub.classList.remove('hidden');
            if (spatialWrap) spatialWrap.classList.add('split');
            if (camDock) camDock.classList.remove('hidden');
            if (mapDock) mapDock.classList.remove('hidden');
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

    // Collapsible Simulation Drawer
    const toggleSimBtn = document.getElementById('toggle-sim-btn');
    const cmdToolbar = document.getElementById('command-toolbar');
    const simToggleText = document.getElementById('sim-toggle-text');
    const simToggleArrow = document.getElementById('sim-toggle-arrow');

    if (toggleSimBtn && cmdToolbar) {
        toggleSimBtn.addEventListener('click', () => {
            soundEngine.playClick();
            const isCollapsed = cmdToolbar.classList.toggle('collapsed');
            if (simToggleText) {
                simToggleText.textContent = isCollapsed ? 'Simulation Drawer' : 'Hide Simulation Drawer';
            }
            if (simToggleArrow) {
                simToggleArrow.textContent = isCollapsed ? '▾' : '▴';
            }
        });
    }

    // Tactical Operations Tab Switcher
    const tacticalTabBtns = document.querySelectorAll('.tactical-tab-btn');
    const tacticalTabPanes = document.querySelectorAll('.tactical-tab-pane');

    tacticalTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            soundEngine.playClick();
            const targetTab = btn.dataset.tab;
            tacticalTabBtns.forEach(b => b.classList.toggle('active', b === btn));
            tacticalTabPanes.forEach(pane => {
                pane.classList.toggle('hidden', pane.id !== targetTab);
                pane.classList.toggle('active', pane.id === targetTab);
            });
            if (targetTab === 'tab-citizen-reports') {
                refreshCitizenReportsList();
            }
        });
    });

    // Default to spacious CCTV view on load
    setActiveView('cctv');

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

    // Initial load of citizen reports
    refreshCitizenReportsList();
});

// ============================================================
// DEDICATED CITIZEN INCIDENT REPORTS TAB & MODAL SYSTEM
// ============================================================
state.citizenReports = [];
state.currentReportFilter = 'all';
state.tabReportFilter = 'all';
state.tabStatusFilter = 'all';

const ZONE_READABLE_NAMES = {
    gate_a: 'Main Concourse (CAM 01)',
    corridor_b: 'North Passage (CAM 02)',
    exit_c: 'Platform Surge (CAM 03)',
    ground_e: 'Festival Plaza (CAM 04)',
    counter_d: 'SkyCity Wickets (CAM 05)'
};

// --- Switch Directly to Dedicated Tab Rail ---
window.switchToReportsTab = function(zoneFilter = 'all') {
    soundEngine.playClick();
    
    // Switch active tactical tab button
    document.querySelectorAll('.tactical-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'tab-citizen-reports');
    });

    // Switch active tactical tab pane
    document.querySelectorAll('.tactical-tab-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.id !== 'tab-citizen-reports');
        pane.classList.toggle('active', pane.id === 'tab-citizen-reports');
    });

    // Apply zone filter
    filterTabReports(zoneFilter);

    // Smooth scroll into view
    const panel = document.getElementById('citizen-reports-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth' });
};

window.filterTabReports = function(zoneId) {
    state.tabReportFilter = zoneId;
    soundEngine.playClick();

    document.querySelectorAll('.citizen-tab-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === zoneId);
    });

    renderDedicatedReportsStream();
};

window.toggleReportStatusFilter = function(status) {
    state.tabStatusFilter = status;
    soundEngine.playClick();

    document.getElementById('btn-status-all')?.classList.toggle('active', status === 'all');
    document.getElementById('btn-status-active')?.classList.toggle('active', status === 'active');

    renderDedicatedReportsStream();
};

window.openCitizenReportsModal = async function(zoneFilter = 'all') {
    state.currentReportFilter = zoneFilter;
    const modal = document.getElementById('citizen-reports-modal');
    if (modal) modal.classList.remove('hidden');
    soundEngine.playClick();
    
    document.querySelectorAll('.citizen-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === zoneFilter);
    });

    await refreshCitizenReportsList();
};

window.closeCitizenReportsModal = function() {
    const modal = document.getElementById('citizen-reports-modal');
    if (modal) modal.classList.add('hidden');
    soundEngine.playClick();
};

window.filterCitizenReports = function(zoneId) {
    state.currentReportFilter = zoneId;
    soundEngine.playClick();
    document.querySelectorAll('.citizen-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === zoneId);
    });
    renderCitizenReportsList();
};

async function refreshCitizenReportsList() {
    try {
        const resp = await fetch('/api/reports/citizen?limit=60');
        if (resp.ok) {
            state.citizenReports = await resp.json();
            renderCitizenReportsList();
            renderDedicatedReportsStream();
            updateReportsBadges();
        }
    } catch (e) {
        console.error('Failed to fetch citizen reports:', e);
    }
}

function updateReportsBadges() {
    const activeReports = (state.citizenReports || []).filter(r => r.processed === 0);
    const badge = document.getElementById('tab-reports-badge');
    const panelCount = document.getElementById('panel-reports-count');

    if (badge) {
        if (activeReports.length > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = `${activeReports.length} NEW`;
            badge.style.background = 'rgba(244, 63, 94, 0.25)';
            badge.style.color = '#f43f5e';
            badge.style.borderColor = 'rgba(244, 63, 94, 0.5)';
        } else {
            badge.style.display = 'inline-block';
            badge.textContent = 'Nominal';
            badge.style.background = 'rgba(16, 185, 129, 0.15)';
            badge.style.color = '#34d399';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
    }

    if (panelCount) {
        panelCount.textContent = `${activeReports.length} ACTIVE BEACONS (${state.citizenReports.length} TOTAL ARCHIVE)`;
        panelCount.className = activeReports.length > 0 ? 'panel-stat-pill alert' : 'panel-stat-pill';
    }
}

// --- Render Dedicated Tab Stream ---
function renderDedicatedReportsStream() {
    const container = document.getElementById('dedicated-reports-stream');
    if (!container) return;

    let items = state.citizenReports || [];

    // Filter by Zone
    if (state.tabReportFilter && state.tabReportFilter !== 'all') {
        items = items.filter(r => r.zone_id === state.tabReportFilter);
    }

    // Filter by Status
    if (state.tabStatusFilter === 'active') {
        items = items.filter(r => r.processed === 0);
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 16px; text-align: center;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">🕊️</span>
                <span style="color: #94a3b8; font-weight: 700;">No ${state.tabStatusFilter === 'active' ? 'active' : ''} reports for ${state.tabReportFilter === 'all' ? 'any sector' : state.tabReportFilter.toUpperCase()}</span>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Citizen beacon telemetry reporting nominal conditions. Scan QR code to submit field observations.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(r => {
        const zoneTitle = ZONE_READABLE_NAMES[r.zone_id] || (r.zone_name ? `${r.zone_name} (${r.zone_id})` : r.zone_id.toUpperCase());
        const timeFormatted = r.submitted_at ? r.submitted_at.replace('T', ' ').replace('Z', ' UTC') : 'Just now';
        const isProcessed = r.processed === 1;

        return `
            <div class="dedicated-report-item ${isProcessed ? 'processed' : ''}" id="ded-report-${r.report_id}">
                <div class="item-top-row">
                    <span class="item-zone-tag">📍 ${zoneTitle}</span>
                    <span class="item-time-tag">⏱️ ${timeFormatted}</span>
                </div>
                <div class="item-msg-text">"${escapeHtml(r.message || 'Hazard alert transmitted by field attendee')}"</div>
                <div class="item-bottom-actions">
                    <span class="report-status-badge ${isProcessed ? 'acknowledged' : 'active'}">
                        ${isProcessed ? '✓ ACKNOWLEDGED BY OPERATOR' : '🚨 ACTIVE FIELD INCIDENT'}
                    </span>
                    <div class="item-action-btns">
                        ${!isProcessed ? `
                            <button class="btn-report-action btn-report-ack" onclick="acknowledgeReport(${r.report_id})">
                                ✓ Acknowledge
                            </button>
                        ` : ''}
                        <button class="btn-report-action" onclick="dispatchStewardsToZone('${r.zone_id}')" title="Allocate stewards to this chokepoint">
                            👮 Stewards
                        </button>
                        <button class="btn-report-action" onclick="askCopilotAboutIncident('${r.zone_id}', '${escapeQuotes(r.message)}')" title="Ask AI Copilot for tactical assessment">
                            💬 Ask Copilot
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Quick action to allocate stewards to reported zone
window.dispatchStewardsToZone = function(zoneId) {
    soundEngine.playClick();
    // Switch to stewards tab
    document.querySelectorAll('.tactical-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'tab-stewards');
    });
    document.querySelectorAll('.tactical-tab-pane').forEach(p => {
        p.classList.toggle('hidden', p.id !== 'tab-stewards');
        p.classList.toggle('active', p.id === 'tab-stewards');
    });
    const panel = document.getElementById('steward-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth' });

    // Flash highlight on the corresponding zone card
    setTimeout(() => {
        document.querySelectorAll('.steward-card').forEach(card => {
            const zName = (ZONE_READABLE_NAMES[zoneId] || zoneId).toLowerCase();
            if (card.textContent.toLowerCase().includes(zoneId) || card.textContent.toLowerCase().includes('concourse') && zoneId === 'gate_a' || card.textContent.toLowerCase().includes('plaza') && zoneId === 'ground_e') {
                card.style.borderColor = '#00f0ff';
                card.style.boxShadow = '0 0 24px rgba(0, 240, 255, 0.45)';
                setTimeout(() => {
                    card.style.borderColor = '';
                    card.style.boxShadow = '';
                }, 3500);
            }
        });
    }, 150);
};

// Quick action to send incident query to Copilot
window.askCopilotAboutIncident = function(zoneId, reportMessage) {
    soundEngine.playClick();
    // Switch to copilot tab
    document.querySelectorAll('.tactical-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'tab-copilot');
    });
    document.querySelectorAll('.tactical-tab-pane').forEach(p => {
        p.classList.toggle('hidden', p.id !== 'tab-copilot');
        p.classList.toggle('active', p.id === 'tab-copilot');
    });
    const panel = document.getElementById('chat-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth' });

    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    if (chatInput) {
        chatInput.value = `Analyze citizen report at ${zoneId.toUpperCase()}: "${reportMessage}". What immediate tactical measures should be deployed?`;
        if (sendBtn) sendBtn.click();
    }
};

// --- Render Modal List ---
function renderCitizenReportsList() {
    const listEl = document.getElementById('citizen-reports-list');
    const totalEl = document.getElementById('citizen-report-total');
    if (!listEl) return;

    let filtered = state.citizenReports || [];
    if (state.currentReportFilter && state.currentReportFilter !== 'all') {
        filtered = filtered.filter(r => r.zone_id === state.currentReportFilter);
    }

    if (totalEl) {
        totalEl.textContent = `${filtered.length} INCIDENT${filtered.length === 1 ? '' : 'S'} DISPLAYED (${state.citizenReports.length} ARCHIVED)`;
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">🕊️</span>
                <span style="color: #94a3b8; font-weight: 600;">No incident reports logged for ${state.currentReportFilter === 'all' ? 'any sector' : state.currentReportFilter.toUpperCase()}</span>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Field sensors and citizen QR beacons reporting nominal safety conditions.</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(r => {
        const zoneTitle = ZONE_READABLE_NAMES[r.zone_id] || (r.zone_name ? `${r.zone_name} (${r.zone_id})` : r.zone_id.toUpperCase());
        const timeFormatted = r.submitted_at ? r.submitted_at.replace('T', ' ').replace('Z', ' UTC') : 'Just now';
        const isProcessed = r.processed === 1;

        return `
            <div class="citizen-report-card ${isProcessed ? 'processed' : ''}" id="report-card-${r.report_id}">
                <div class="report-card-top">
                    <span class="report-zone-pill">📍 ${zoneTitle}</span>
                    <span class="report-time-pill">${timeFormatted}</span>
                </div>
                <div class="report-message-text">"${escapeHtml(r.message || 'Hazard alert transmitted by field attendee')}"</div>
                <div class="report-card-bottom">
                    <span class="report-status-badge ${isProcessed ? 'acknowledged' : 'active'}">
                        ${isProcessed ? '✓ ACKNOWLEDGED BY OPERATOR' : '🚨 ACTIVE FIELD BEACON'}
                    </span>
                    ${!isProcessed ? `
                        <button class="btn-ack-report" onclick="acknowledgeReport(${r.report_id})">
                            ✓ Mark Acknowledged
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

window.acknowledgeReport = async function(reportId) {
    try {
        const resp = await fetch(`/api/reports/citizen/${reportId}/acknowledge`, { method: 'POST' });
        if (resp.ok) {
            const report = state.citizenReports.find(r => r.report_id === reportId);
            if (report) report.processed = 1;
            renderCitizenReportsList();
            renderDedicatedReportsStream();
            updateReportsBadges();
            soundEngine.playAuthorizeChime();
        }
    } catch (e) {
        console.error('Failed to acknowledge report:', e);
    }
};

function handleCitizenReportAlert(report) {
    soundEngine.playAlertAlarm();
    showCitizenToast(report);
    refreshCitizenReportsList();
}

function handleCitizenReportAcknowledged(reportId) {
    const report = (state.citizenReports || []).find(r => r.report_id === reportId);
    if (report) {
        report.processed = 1;
        renderCitizenReportsList();
        renderDedicatedReportsStream();
        updateReportsBadges();
    }
}

function showCitizenToast(report) {
    const container = document.getElementById('citizen-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'citizen-toast';
    const zoneTitle = report.zone_name || report.zone_id.replace('_', ' ').toUpperCase();
    
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">📢 CITIZEN BEACON INGEST</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#f43f5e;font-weight:700;">LIVE</span>
        </div>
        <div class="toast-msg"><strong>[${escapeHtml(zoneTitle)}]:</strong> ${escapeHtml(report.message || 'Hazard incident reported')}</div>
        <div class="toast-cta">👆 Click to open Reports Section & Dispatch</div>
    `;

    toast.onclick = () => {
        switchToReportsTab(report.zone_id);
        toast.remove();
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 400);
        }
    }, 9000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}



