from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
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


@router.post("/clear-all")
def clear_all_sales_data(db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    from sqlalchemy import text
    try:
        # 1. Unlink orders from tables first (Foreign Key requirement)
        db.execute(text("UPDATE tables SET status = 'free', active_order_id = NULL"))
        
        # 2. Clear transaction tables in correct order
        db.execute(text("DELETE FROM invoices"))
        db.execute(text("DELETE FROM order_items"))
        db.execute(text("DELETE FROM orders"))
        
        # 3. Reset stock tracking
        db.execute(text("UPDATE products SET reserved_stock = 0, sold_stock = 0"))
        
        db.commit()
        return {"message": "All sales and transaction data has been cleared successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear data: {str(e)}")


@router.post("/nuclear-reset")
def nuclear_reset(db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    from sqlalchemy import text
    try:
        # Use TRUNCATE CASCADE to wipe everything in one atomic, dependency-safe operation
        # RESTART IDENTITY resets all ID counters back to 1
        db.execute(text("TRUNCATE TABLE invoices, order_items, orders, products, inventory, sub_categories, categories, tables RESTART IDENTITY CASCADE"))
        db.commit()
        return {"message": "NUCLEAR RESET SUCCESSFUL. The database is now completely empty (except for users)."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Nuclear reset failed: {str(e)}")
