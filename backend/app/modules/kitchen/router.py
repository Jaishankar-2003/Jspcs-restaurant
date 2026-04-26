from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.models import Order
from app.db.session import get_db

router = APIRouter(prefix="/kitchen", tags=["kitchen"])


class StatusIn(BaseModel):
    status: str  # preparing | ready | picked


@router.get("/orders")
def kitchen_orders(db: Session = Depends(get_db), _=Depends(require_roles("kitchen", "admin", "manager"))):
    orders = db.query(Order).filter(Order.status.in_(["confirmed", "preparing", "ready"])).all()
    result = []
    for o in orders:
        active_items = [i for i in o.items if i.status in ["new", "preparing", "ready"]]
        if active_items:
            order_dict = {
                "id": o.id,
                "type": o.type,
                "table_id": o.table_id,
                "token_number": o.token_number,
                "status": o.status,
                "waiter_note": o.waiter_note or "NO NOTE",
                "created_at": o.created_at,
                "items": [
                    {
                        "id": item.id,
                        "order_id": item.order_id,
                        "product_id": item.product_id,
                        "quantity": item.quantity,
                        "price": item.price,
                        "status": item.status,
                        "product": {
                            "id": item.product.id,
                            "name": item.product.name,
                            "price": item.product.price,
                            "category": item.product.category
                        } if item.product else None
                    }
                    for item in active_items
                ]
            }
            result.append(order_dict)
    return result


@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int, payload: StatusIn, db: Session = Depends(get_db), _=Depends(require_roles("kitchen", "admin", "manager"))
):
    if payload.status not in {"preparing", "ready", "picked"}:
        raise HTTPException(status_code=400, detail="Kitchen can only set preparing, ready, or picked")
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = payload.status
    
    for item in order.items:
        if payload.status == "preparing" and item.status == "new":
            item.status = "preparing"
        elif payload.status == "ready" and item.status in ["new", "preparing"]:
            item.status = "ready"
        elif payload.status == "picked" and item.status in ["new", "preparing", "ready"]:
            item.status = "picked"

    db.commit()
    return order
