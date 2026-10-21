"""
Canonical Data Contracts & Pydantic Models for AI Crowd Safety System.
Strictly implements Handbook Section 4 schemas.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class VisionIngest(BaseModel):
    zone_id: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
    person_count: int = Field(ge=0)
    density: float = Field(ge=0.0)
    behaviour_flag: str = "normal"  # normal, surge, running, counter_flow
    sensor_status: str = "ok"       # ok, unavailable, degraded


class ZoneStateModel(BaseModel):
    zone_id: str
    zone_name: str
    zone_type: str
    priority_weight: float
    person_count: int
    density: float
    behaviour_flag: str
    trend_slope: float
    time_to_critical_s: Optional[float] = None
    risk_score: float
    state: str  # Safe, Watch, Warning, Critical
    active_reports: int = 0
    sensor_status: str = "ok"


class AlertSnapshot(BaseModel):
    alert_id: int
    zone_id: str
    level: str
    recommendation: Optional[str] = None
    observation: Optional[str] = None
    trend: Optional[str] = None
    prediction: Optional[str] = None
    expected_benefit: Optional[str] = None
    triggered_at: str


class VenueStateResponse(BaseModel):
    timestamp: str
    overall_status: str
    zones: List[ZoneStateModel]
    active_alert: Optional[Dict[str, Any]] = None
    weather: Optional[Dict[str, Any]] = None


class RecommendationContract(BaseModel):
    rec_id: int
    zone_id: str
    severity: str
    observation: str
    trend: str
    prediction: str
    recommendation: str
    expected_benefit: str
    status: str = "open"  # open, approved, rejected, edited
    source: str = "llm"   # llm, template
    created_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))


class CitizenReport(BaseModel):
    zone_id: str
    message: str = "This area feels unsafe"


class AlertAction(BaseModel):
    action: str  # approved, rejected, edited
    directive_notes: Optional[str] = None


class ChatMessage(BaseModel):
    message: str


class WeatherToggle(BaseModel):
    condition: str = "fair"  # fair, rain, storm
    active: bool = False
