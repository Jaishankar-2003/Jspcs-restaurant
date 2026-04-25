from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.deps import require_roles
from app.db.models import Category, SubCategory
from app.db.session import get_db

router = APIRouter(prefix="/categories", tags=["categories"])


class SubCategoryIn(BaseModel):
    name: str

class CategoryIn(BaseModel):
    name: str

@router.get("")
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@router.post("")
def create_category(payload: CategoryIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    category = Category(name=payload.name)
    db.add(category)
    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Category already exists")
    return category

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return {"message": "Category deleted"}


@router.post("/{category_id}/subcategories")
def create_subcategory(category_id: int, payload: SubCategoryIn, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    sub = SubCategory(category_id=category_id, name=payload.name)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(subcategory_id: int, db: Session = Depends(get_db), _=Depends(require_roles("admin", "manager"))):
    sub = db.get(SubCategory, subcategory_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    db.delete(sub)
    db.commit()
    return {"message": "Subcategory deleted"}
