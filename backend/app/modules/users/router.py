from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/users", tags=["users"])


class CreateUser(BaseModel):
    name: str
    role_id: int
    password: str


@router.post("")
def create_user(payload: CreateUser, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    user = User(name=payload.name, role_id=payload.role_id, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
