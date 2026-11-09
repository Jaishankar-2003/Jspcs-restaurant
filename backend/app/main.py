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
from app.modules.categories.router import router as categories_router

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
app.include_router(categories_router, prefix="/api")


@app.on_event("startup")
def startup():
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # --- NEW STRICT STOCK MIGRATION ---
        with engine.connect() as conn:
            # Rename quantity to total_stock if it exists
            try:
                conn.execute(text("ALTER TABLE products RENAME COLUMN quantity TO total_stock;"))
                conn.commit()
                print("DEBUG: RENAMED quantity TO total_stock")
            except Exception as e:
                pass # Already renamed
            
            # Add other columns if they don't exist
            try:
                conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock NUMERIC(12,3) DEFAULT 0;"))
                conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_stock NUMERIC(12,3) DEFAULT 0;"))
                conn.execute(text("UPDATE products SET reserved_stock = 0 WHERE reserved_stock IS NULL;"))
                conn.execute(text("UPDATE products SET sold_stock = 0 WHERE sold_stock IS NULL;"))
                conn.commit()
                print("DEBUG: STOCK COLUMNS ADDED/VERIFIED")
            except Exception as e:
                print(f"DEBUG: Column addition failed: {e}")

            # Add seating_sessions and orders.seating_session_id
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS seating_sessions (
                        id SERIAL PRIMARY KEY,
                        table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
                        group_name VARCHAR(100) NOT NULL,
                        guest_count INTEGER NOT NULL DEFAULT 1,
                        selected_seats VARCHAR(255) NOT NULL,
                        seating_mode VARCHAR(30) NOT NULL DEFAULT 'individual',
                        phone_number VARCHAR(30),
                        customer_notes TEXT,
                        status VARCHAR(20) NOT NULL DEFAULT 'active',
                        created_by VARCHAR(50),
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        completed_at TIMESTAMP
                    );
                """))
                conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS seating_session_id INTEGER REFERENCES seating_sessions(id) ON DELETE SET NULL;"))
                # Multi-table party linking (nullable, backward compatible)
                conn.execute(text("ALTER TABLE seating_sessions ADD COLUMN IF NOT EXISTS party_code VARCHAR(40);"))
                conn.commit()
                print("DEBUG: SEATING SESSIONS TABLE & ORDER RELATION ADDED/VERIFIED")
            except Exception as e:
                print(f"DEBUG: Seating sessions addition failed: {e}")

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
