"""
Grounded Operator Chat Handler.
Strictly implements Section 2 FR11 & Handbook Section 7:
Provides natural language operator Q&A grounded directly in instantaneous venue telemetry.
"""

from agent.llm_client import LLMClient
from backend.database import save_chat


class GroundedChatHandler:
    def __init__(self, risk_engine=None):
        self.risk_engine = risk_engine
        self.llm_client = LLMClient()

    async def answer(self, user_message):
        """Processes operator question and returns grounded response."""
        # Log user query
        try:
            save_chat(sender="operator", message=user_message)
        except Exception:
            pass

        venue_state = self.risk_engine.get_venue_state() if self.risk_engine else {"zones": [], "overall_status": "Safe"}
        reply = await self.llm_client.answer_operator_chat(user_message, venue_state)

        # Log AI reply
        try:
            save_chat(sender="ai_agent", message=reply)
        except Exception:
            pass

        return reply
