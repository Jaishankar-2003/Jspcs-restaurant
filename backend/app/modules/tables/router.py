from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.models import DiningTable
from app.db.session import get_db

router = APIRouter(prefix="/tables", tags=["tables"])


class TableIn(BaseModel):
    name: str
    chairs: int = 4


@router.get("")
def list_tables(db: Session = Depends(get_db)):
    return db.query(DiningTable).all()


@router.post("")
def create_table(payload: TableIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    table = DiningTable(name=payload.name, chairs=payload.chairs)
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.patch("/{table_id}/status")
def update_table_status(table_id: int, status: str, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager"))):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.status = status
    if status == "free":
        table.active_order_id = None
    db.commit()
    return table


@router.delete("/{table_id}")
def delete_table(table_id: int, db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    db.delete(table)
    db.commit()
    return {"message": "Table deleted"}
