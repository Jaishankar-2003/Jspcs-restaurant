from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_roles
from app.db.models import Order, OrderItem, Product, DiningTable
from app.db.session import get_db

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int


class CreateOrderIn(BaseModel):
    type: str  # dine_in | takeaway
    table_id: int | None = None
    items: List[OrderItemIn]


class UpdateItemsIn(BaseModel):
    items: List[OrderItemIn]


@router.post("")
def create_order(payload: CreateOrderIn, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager"))):
    if settings.app_mode == "fast_food" and payload.type == "dine_in":
        raise HTTPException(status_code=400, detail="Dine-in disabled in fast_food mode")
    
    token = None
    if payload.type == "takeaway":
        token = (db.query(Order).filter(Order.token_number.is_not(None)).count() + 1)
    
    # NEW: Default to 'confirmed' so it hits the kitchen immediately
    status = "confirmed" if payload.items else "pending"
    
    order = Order(
        type=payload.type, 
        table_id=payload.table_id, 
        token_number=token, 
        status=status, 
        created_at=datetime.utcnow()
    )
    db.add(order)
    db.flush()
    
    for i in payload.items:
        product = db.get(Product, i.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product not found: {i.product_id}")
        db.add(OrderItem(order_id=order.id, product_id=i.product_id, quantity=i.quantity, price=product.price))
    
    if payload.type == "dine_in" and payload.table_id:
        table = db.get(DiningTable, payload.table_id)
        if table:
            table.status = "occupied"
            table.active_order_id = order.id

    db.commit()
    db.refresh(order)
    return order


@router.patch("/{order_id}/items")
def update_order_items(order_id: int, payload: UpdateItemsIn, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager"))):
    order = db.get(Order, order_id)
    if not order or order.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Order not found or closed")
    
    for i in payload.items:
        existing_item = db.query(OrderItem).filter(
            OrderItem.order_id == order_id, 
            OrderItem.product_id == i.product_id,
            OrderItem.status == "new"
        ).first()
        if existing_item:
            existing_item.quantity += i.quantity
        else:
            product = db.get(Product, i.product_id)
            if not product: continue
            db.add(OrderItem(order_id=order.id, product_id=i.product_id, quantity=i.quantity, price=product.price, status="new"))
    
    # Auto-move to confirmed if items were added
    order.status = "confirmed"
    db.commit()
    db.refresh(order)
    return order


@router.patch("/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager", "kitchen"))):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    
    if status in ["delivered", "completed", "cancelled"]:
        for item in order.items:
            if item.status not in ["completed", "cancelled", "delivered"]:
                item.status = status

    
    if status == "cancelled" and order.table_id:
        table = db.get(DiningTable, order.table_id)
        if table:
            table.status = "free"
            table.active_order_id = None
            
    db.commit()
    return order


@router.get("")
def list_orders(status: str = None, db: Session = Depends(get_db)):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    return query.order_by(Order.created_at.desc()).all()


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
