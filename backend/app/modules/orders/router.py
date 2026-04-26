from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
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
    waiter_note: str | None = None  # Optional special instruction for kitchen


class UpdateItemsIn(BaseModel):
    items: List[OrderItemIn]
    waiter_note: str | None = None  # Append/update waiter note


@router.post("")
def create_order(payload: CreateOrderIn, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager"))):
    print(f"DEBUG: Creating order with payload: {payload.model_dump()}")
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
        waiter_note=payload.waiter_note or None,
        created_at=datetime.utcnow()
    )
    db.add(order)
    db.flush()
    
    for i in payload.items:
        # Atomic Stock Reservation
        # Update only if (total_stock - reserved_stock) >= requested_quantity
        res = db.execute(
            text("""
                UPDATE products 
                SET reserved_stock = reserved_stock + :qty
                WHERE id = :id AND (total_stock - reserved_stock) >= :qty
            """),
            {"qty": i.quantity, "id": i.product_id}
        )
        if res.rowcount == 0:
            # Check why it failed to give a better error message
            p = db.get(Product, i.product_id)
            avail = (p.total_stock - p.reserved_stock) if p else 0
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {p.name if p else 'Item'}. Available: {avail}, Requested: {i.quantity}"
            )

        product = db.get(Product, i.product_id)
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
    print(f"DEBUG: Updating order {order_id} with payload: {payload.model_dump()}")
    order = db.get(Order, order_id)
    if not order or order.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Order not found or closed")
    
    for i in payload.items:
        # Atomic Stock Reservation for updates
        res = db.execute(
            text("""
                UPDATE products 
                SET reserved_stock = reserved_stock + :qty
                WHERE id = :id AND (total_stock - reserved_stock) >= :qty
            """),
            {"qty": i.quantity, "id": i.product_id}
        )
        if res.rowcount == 0:
            p = db.get(Product, i.product_id)
            avail = (p.total_stock - p.reserved_stock) if p else 0
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {p.name if p else 'Item'}. Available: {avail}, Requested: {i.quantity}"
            )

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
    # Update waiter note if provided
    if payload.waiter_note is not None:
        order.waiter_note = payload.waiter_note or None
    db.commit()
    db.refresh(order)
    return order


@router.patch("/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager", "kitchen"))):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    
    if status == "cancelled":
        for item in order.items:
            # Only release stock for items that weren't already cancelled individually
            if item.status != "cancelled":
                db.execute(
                    text("UPDATE products SET reserved_stock = reserved_stock - :qty WHERE id = :id"),
                    {"qty": item.quantity, "id": item.product_id}
                )
        
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


@router.patch("/{order_id}/items/{item_id}/status")
def update_item_status(order_id: int, item_id: int, status: str, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager", "kitchen"))):
    item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # If cancelling, release the reserved stock
    if status == "cancelled" and item.status != "cancelled":
        db.execute(
            text("UPDATE products SET reserved_stock = reserved_stock - :qty WHERE id = :id"),
            {"qty": item.quantity, "id": item.product_id}
        )
    
    item.status = status
    db.commit()
    db.refresh(item)
    return item


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
