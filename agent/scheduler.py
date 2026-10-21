"""
Autonomous Agent Scheduler Daemon.
Strictly implements Section 2 FR6 & FR7:
Runs background cognitive cycle every 15-20s and autonomous briefings every 60-120s.
"""

import asyncio
import os
from agent.reasoning import CognitiveEngine
from agent.chat_handler import GroundedChatHandler


class SafetyAgentDaemon:
    def __init__(self, risk_engine, broadcast_callback):
        self.risk_engine = risk_engine
        self.broadcast_callback = broadcast_callback
        self.cognitive_engine = CognitiveEngine(risk_engine, broadcast_callback)
        self.chat_handler = GroundedChatHandler(risk_engine)
        self.cycle_seconds = int(os.getenv("AGENT_CYCLE_SECONDS", "15"))
        self.briefing_seconds = int(os.getenv("BRIEFING_INTERVAL_SECONDS", "60"))
        self._running = False
        self._tasks = []

    async def start(self):
        """Starts background reasoning and briefing loops."""
        self._running = True
        print(f"🤖 [SafetyAgentDaemon] Initialized. Reasoning cycle: {self.cycle_seconds}s | Briefing interval: {self.briefing_seconds}s")
        self._tasks.append(asyncio.create_task(self._reasoning_loop()))
        self._tasks.append(asyncio.create_task(self._briefing_loop()))

    def stop(self):
        self._running = False
        for t in self._tasks:
            t.cancel()

    async def _reasoning_loop(self):
        await asyncio.sleep(3)  # Initial grace delay for sensors
        while self._running:
            try:
                await self.cognitive_engine.run_cycle(trigger="scheduled")
            except Exception as e:
                print(f"[Daemon Reasoning Error]: {e}")
            await asyncio.sleep(self.cycle_seconds)

    async def _briefing_loop(self):
        await asyncio.sleep(10)  # Let some readings accumulate
        while self._running:
            try:
                await self.cognitive_engine.generate_briefing(trigger_type="scheduled")
            except Exception as e:
                print(f"[Daemon Briefing Error]: {e}")
            await asyncio.sleep(self.briefing_seconds)

    async def run_cycle(self, force=False, trigger="manual"):
        return await self.cognitive_engine.run_cycle(force=force, trigger=trigger)

    async def generate_briefing(self, trigger_type="manual"):
        return await self.cognitive_engine.generate_briefing(trigger_type=trigger_type)

    async def handle_chat(self, user_message):
        return await self.chat_handler.answer(user_message)

    def record_operator_approval(self, alert_id, zone_id, current_density):
        self.cognitive_engine.record_operator_approval(alert_id, zone_id, current_density)
