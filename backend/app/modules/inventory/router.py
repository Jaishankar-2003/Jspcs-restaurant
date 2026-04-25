from fastapi import APIRouter, Depends, HTTPException
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
    low_stock_threshold: float = 10


class InventoryOut(BaseModel):
    id: int
    name: str
    unit: str
    quantity: float
    low_stock_threshold: float

    model_config = {"from_attributes": True}


class InventoryTxn(BaseModel):
    inventory_id: int
    quantity: float


@router.post("", response_model=InventoryOut)
def create_inventory(payload: InventoryIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    item = Inventory(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=list[InventoryOut])
def list_inventory(db: Session = Depends(get_db)):
    return db.query(Inventory).all()


@router.post("/stock-in", response_model=InventoryOut)
def stock_in(payload: InventoryTxn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    item = db.get(Inventory, payload.inventory_id)
    item.quantity = float(item.quantity) + payload.quantity
    db.commit()
    db.refresh(item)
    return item


@router.post("/stock-out", response_model=InventoryOut)
def stock_out(payload: InventoryTxn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    item = db.get(Inventory, payload.inventory_id)
    item.quantity = max(0, float(item.quantity) - payload.quantity)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=InventoryOut)
def update_inventory(item_id: int, payload: InventoryIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    item = db.get(Inventory, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.get("/low-stock", response_model=list[InventoryOut])
def low_stock(db: Session = Depends(get_db)):
    return db.query(Inventory).filter(Inventory.quantity < Inventory.low_stock_threshold).all()
