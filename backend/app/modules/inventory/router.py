from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.models import Inventory
from app.db.session import get_db

router = APIRouter(prefix="/inventory", tags=["inventory"])


class InventoryIn(BaseModel):
    name: str
    unit: str
    quantity: float = 0


class InventoryTxn(BaseModel):
    inventory_id: int
    quantity: float


@router.post("")
def create_inventory(payload: InventoryIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    item = Inventory(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("")
def list_inventory(db: Session = Depends(get_db)):
    return db.query(Inventory).all()


@router.post("/stock-in")
def stock_in(payload: InventoryTxn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    item = db.get(Inventory, payload.inventory_id)
    item.quantity = float(item.quantity) + payload.quantity
    db.commit()
    return item


@router.post("/stock-out")
def stock_out(payload: InventoryTxn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    item = db.get(Inventory, payload.inventory_id)
    item.quantity = max(0, float(item.quantity) - payload.quantity)
    db.commit()
    return item


@router.get("/low-stock")
def low_stock(db: Session = Depends(get_db)):
    return db.query(Inventory).filter(Inventory.quantity < 10).all()
