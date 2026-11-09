from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.db.models import Invoice, Order, OrderItem, Product, DiningTable, SeatingSession

def complete_billing(db: Session, order_id: int, payment_type: str) -> Invoice:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status == "completed":
        raise HTTPException(status_code=400, detail="Order already completed")

    total = 0.0
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    
    for item in items:
        if item.status == "cancelled":
            continue
            
        total += float(item.price) * item.quantity
        product = db.get(Product, item.product_id)
        if product:
            # Finalize stock: Reduce physical stock, clear reservation, and track as sold
            product.total_stock -= item.quantity
            product.reserved_stock -= item.quantity
            product.sold_stock += item.quantity
            
    order.status = "completed"
    
    # Free the session and/or table
    if order.table_id:
        if order.seating_session_id:
            session = db.get(SeatingSession, order.seating_session_id)
            party_sessions = [session] if session else []
            if session and session.party_code:
                party_sessions = (
                    db.query(SeatingSession)
                    .filter(
                        SeatingSession.party_code == session.party_code,
                        SeatingSession.status.in_(["active", "bill_requested"]),
                    )
                    .all()
                )

            affected_table_ids = set()
            completed_session_ids = set()
            for s in party_sessions:
                s.status = "completed"
                s.completed_at = datetime.utcnow()
                affected_table_ids.add(s.table_id)
                completed_session_ids.add(s.id)

            if order.table_id:
                affected_table_ids.add(order.table_id)

            # Recalculate status for all affected tables
            for tid in affected_table_ids:
                tbl = db.get(DiningTable, tid)
                if tbl:
                    remaining = (
                        db.query(SeatingSession)
                        .filter(
                            SeatingSession.table_id == tid,
                            ~SeatingSession.id.in_(completed_session_ids),
                            SeatingSession.status.in_(["active", "bill_requested"]),
                        )
                        .count()
                    )
                    if remaining == 0:
                        tbl.status = "free"
                        tbl.active_order_id = None
                    else:
                        tbl.status = "occupied"
        else:
            table = db.get(DiningTable, order.table_id)
            if table:
                table.status = "free"
                table.active_order_id = None
            
    invoice = Invoice(order_id=order.id, total_amount=total, payment_type=payment_type)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
