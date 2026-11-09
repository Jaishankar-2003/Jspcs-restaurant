from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_roles
from app.db.models import Order, OrderItem, Product, DiningTable, SeatingSession
from app.db.session import get_db

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int


class CreateOrderIn(BaseModel):
    type: str  # dine_in | takeaway
    table_id: int | None = None
    seating_session_id: Optional[int] = None
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
    
    final_table_id = payload.table_id
    final_note = payload.waiter_note or None
    if payload.seating_session_id:
        session = db.get(SeatingSession, payload.seating_session_id)
        if session:
            final_table_id = session.table_id
            party_session_ids = [session.id]
            if session.party_code:
                party_sessions = (
                    db.query(SeatingSession)
                    .filter(
                        SeatingSession.party_code == session.party_code,
                        SeatingSession.status.in_(["active", "bill_requested"]),
                    )
                    .all()
                )
                if party_sessions:
                    party_session_ids = [ps.id for ps in party_sessions]

                # Check if an active order already exists for this multi-table party
                existing_order = (
                    db.query(Order)
                    .filter(
                        Order.seating_session_id.in_(party_session_ids),
                        Order.status.notin_(["completed", "cancelled"]),
                    )
                    .order_by(Order.created_at.desc())
                    .first()
                )
                if existing_order:
                    # Append items to the existing shared group order
                    for i in payload.items:
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
                            OrderItem.order_id == existing_order.id, 
                            OrderItem.product_id == i.product_id,
                            OrderItem.status == "new"
                        ).first()
                        if existing_item:
                            existing_item.quantity += i.quantity
                        else:
                            product = db.get(Product, i.product_id)
                            db.add(OrderItem(order_id=existing_order.id, product_id=i.product_id, quantity=i.quantity, price=product.price, status="new"))
                    
                    existing_order.status = "confirmed"
                    db.commit()
                    db.refresh(existing_order)
                    return existing_order

                # Format multi-table label with real table names
                table_parts = []
                for ps in party_sessions:
                    t = db.get(DiningTable, ps.table_id)
                    tname = t.name if t else f"Table {ps.table_id}"
                    table_parts.append(f"{tname} (Seats {ps.selected_seats})")
                group_tag = f"[{session.group_name} • {', '.join(table_parts)}]"
            else:
                t = db.get(DiningTable, session.table_id)
                tname = t.name if t else f"Table {session.table_id}"
                group_tag = f"[{session.group_name} • {tname} Seats {session.selected_seats}]"

            final_note = f"{group_tag} {payload.waiter_note}" if payload.waiter_note else group_tag

    order = Order(
        type=payload.type, 
        table_id=final_table_id,
        seating_session_id=payload.seating_session_id,
        token_number=token, 
        status=status, 
        waiter_note=final_note,
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
            p = db.get(Product, i.product_id)
            avail = (p.total_stock - p.reserved_stock) if p else 0
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {p.name if p else 'Item'}. Available: {avail}, Requested: {i.quantity}"
            )

        product = db.get(Product, i.product_id)
        db.add(OrderItem(order_id=order.id, product_id=i.product_id, quantity=i.quantity, price=product.price))
    
    if payload.type == "dine_in" and final_table_id:
        table = db.get(DiningTable, final_table_id)
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

    if status == "bill_requested" and order.seating_session_id:
        session = db.get(SeatingSession, order.seating_session_id)
        if session:
            session.status = "bill_requested"
            if session.party_code:
                siblings = (
                    db.query(SeatingSession)
                    .filter(
                        SeatingSession.party_code == session.party_code,
                        SeatingSession.status == "active",
                    )
                    .all()
                )
                for sib in siblings:
                    sib.status = "bill_requested"

    
    if status == "cancelled" and order.table_id:
        if order.seating_session_id:
            session = db.get(SeatingSession, order.seating_session_id)
            if session:
                session.status = "cancelled"
            remaining = db.query(SeatingSession).filter(
                SeatingSession.table_id == order.table_id,
                SeatingSession.id != order.seating_session_id,
                SeatingSession.status.in_(["active", "bill_requested"])
            ).count()
            if remaining == 0:
                table = db.get(DiningTable, order.table_id)
                if table:
                    table.status = "free"
                    table.active_order_id = None
        else:
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
