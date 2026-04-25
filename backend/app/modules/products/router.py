from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
import csv
import io

from sqlalchemy.exc import IntegrityError

from app.core.deps import require_roles
from app.db.models import Product
from app.db.session import get_db

router = APIRouter(prefix="/products", tags=["products"])


class ProductIn(BaseModel):
    name: str
    price: float
    category: str
    sub_category: str | None = None
    is_veg: bool = True
    quantity: float = 0
    low_stock_threshold: float = 5
    is_active: bool = True


class ProductOut(BaseModel):
    id: int
    name: str
    price: float
    category: str
    sub_category: str | None = None
    is_veg: bool
    quantity: float
    low_stock_threshold: float
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).filter(Product.is_active.is_(True)).all()


@router.post("", response_model=ProductOut)
def create_product(payload: ProductIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in payload.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    try:
        db.delete(product)
        db.commit()
        return {"message": "Product physically deleted"}
    except IntegrityError:
        db.rollback()
        product.is_active = False
        db.commit()
        return {"message": "Product archived (soft-deleted) because it has order history"}

class BulkDeleteIn(BaseModel):
    ids: list[int]

@router.post("/bulk-delete")
def bulk_delete_products(payload: BulkDeleteIn, db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    deleted_count = 0
    archived_count = 0
    
    for pid in payload.ids:
        product = db.get(Product, pid)
        if product:
            try:
                db.delete(product)
                db.commit()
                deleted_count += 1
            except IntegrityError:
                db.rollback()
                product.is_active = False
                db.commit()
                archived_count += 1
                
    return {"message": f"Successfully deleted {deleted_count} products. Archived {archived_count} products due to order history."}


@router.post("/bulk")
async def bulk_upload_products(file: UploadFile = File(...), db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    count = 0
    for row in reader:
        try:
            product = Product(
                name=row.get('name'),
                price=float(row.get('price', 0)),
                category=row.get('category', 'General'),
                sub_category=row.get('sub_category'),
                is_veg=str(row.get('is_veg', 'true')).lower() in ('true', '1', 'yes', 'y'),
                quantity=float(row.get('quantity', 0)),
                is_active=True
            )
            db.add(product)
            count += 1
        except Exception:
            continue
            
    db.commit()
    return {"message": f"Successfully imported {count} products"}
