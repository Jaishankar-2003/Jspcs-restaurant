from io import BytesIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.models import Invoice
from app.db.session import get_db
from app.modules.billing.service import complete_billing

router = APIRouter(prefix="/billing", tags=["billing"])


class BillIn(BaseModel):
    order_id: int
    payment_type: str


@router.post("/complete")
def bill_order(payload: BillIn, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager"))):
    return complete_billing(db, payload.order_id, payload.payment_type)


@router.get("/invoice/{invoice_id}/pdf")
def download_invoice(invoice_id: int, db: Session = Depends(get_db), _=Depends(require_roles("cashier", "admin", "manager"))):
    invoice = db.get(Invoice, invoice_id)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.drawString(60, 800, f"Invoice #{invoice.id}")
    pdf.drawString(60, 780, f"Order ID: {invoice.order_id}")
    pdf.drawString(60, 760, f"Total: {invoice.total_amount}")
    pdf.drawString(60, 740, f"Payment: {invoice.payment_type}")
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf")
