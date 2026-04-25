from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Role, User
from app.db.session import Base, SessionLocal, engine
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.inventory.router import router as inventory_router
from app.modules.kitchen.router import router as kitchen_router
from app.modules.orders.router import router as orders_router
from app.modules.products.router import router as products_router
from app.modules.reports.router import router as reports_router
from app.modules.tables.router import router as tables_router
from app.modules.users.router import router as users_router

app = FastAPI(title=settings.app_name)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(tables_router, prefix="/api")
app.include_router(kitchen_router, prefix="/api")
app.include_router(reports_router, prefix="/api")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        role_names = ["admin", "cashier", "kitchen", "manager"]
        for role_name in role_names:
            if not db.query(Role).filter(Role.name == role_name).first():
                db.add(Role(name=role_name))
        db.commit()
        if not db.query(User).filter(User.name == "admin").first():
            admin_role = db.query(Role).filter(Role.name == "admin").first()
            db.add(User(name="admin", role_id=admin_role.id, password_hash=hash_password("admin123")))
            db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": settings.app_mode}
