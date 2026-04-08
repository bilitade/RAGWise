from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AgentPersona
from app.db.session import get_db

router = APIRouter(prefix="/personas", tags=["personas"])


class PersonaPublic(BaseModel):
    id: str
    name: str
    description: str


@router.get("", response_model=list[PersonaPublic])
def list_active_personas(db: Session = Depends(get_db)) -> list[PersonaPublic]:
    rows = db.scalars(
        select(AgentPersona)
        .where(AgentPersona.is_active.is_(True))
        .order_by(AgentPersona.sort_order, AgentPersona.name)
    ).all()
    return [PersonaPublic(id=str(r.id), name=r.name, description=r.description) for r in rows]
