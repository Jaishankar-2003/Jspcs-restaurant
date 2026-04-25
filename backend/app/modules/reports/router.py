from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.models import Invoice, OrderItem, Product
from app.db.session import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily-sales")
def daily_sales(db: Session = Depends(get_db), _=Depends(require_roles("manager", "admin"))):
    today = date.today()
    total = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(func.date(Invoice.created_at) == today).scalar()
    return {"date": str(today), "total_sales": float(total)}


@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(require_roles("manager", "admin"))):
    today = date.today()
    last_week = today - timedelta(days=7)
    month_start = today.replace(day=1)
    weekly = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(func.date(Invoice.created_at) >= last_week).scalar()
    monthly = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(func.date(Invoice.created_at) >= month_start).scalar()
    return {"weekly_sales": float(weekly), "monthly_sales": float(monthly)}


@router.get("/top-items")
def top_items(db: Session = Depends(get_db), _=Depends(require_roles("manager", "admin"))):
    rows = (
        db.query(Product.name, func.sum(OrderItem.quantity).label("qty"))
        .join(OrderItem, OrderItem.product_id == Product.id)
        .group_by(Product.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(10)
        .all()
    )
    return [{"name": r.name, "quantity": int(r.qty)} for r in rows]
