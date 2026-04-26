from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.db.models import Invoice, Order, OrderItem, Product, DiningTable

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
    
    # Free the table
    if order.table_id:
        table = db.get(DiningTable, order.table_id)
        if table:
            table.status = "free"
            table.active_order_id = None
            
    invoice = Invoice(order_id=order.id, total_amount=total, payment_type=payment_type)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
