import time
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user
from app.db.models import DiningTable, SeatingSession, Order, OrderItem, User
from app.db.session import get_db

router = APIRouter(prefix="/tables", tags=["tables"])

# In-memory temporary chair lock registry: table_id -> { seat_number: { "locked_by": str, "expires_at": float } }
active_seat_locks: dict[int, dict[int, dict]] = {}


def clean_expired_locks(table_id: int):
    now = time.time()
    if table_id in active_seat_locks:
        active_seat_locks[table_id] = {
            seat: data
            for seat, data in active_seat_locks[table_id].items()
            if data["expires_at"] > now
        }


class TableIn(BaseModel):
    name: str
    chairs: int = 4


class CreateSeatingSessionIn(BaseModel):
    group_name: str
    guest_count: int
    selected_seats: List[int]
    seating_mode: str = "individual"  # individual | full_table | custom
    phone_number: Optional[str] = None
    customer_notes: Optional[str] = None
    party_code: Optional[str] = None  # Optional: join an existing multi-table party


class FullTableSessionIn(BaseModel):
    group_name: str
    guest_count: int
    phone_number: Optional[str] = None
    customer_notes: Optional[str] = None
    party_code: Optional[str] = None


class UpdateSeatingSessionIn(BaseModel):
    group_name: Optional[str] = None
    guest_count: Optional[int] = None
    phone_number: Optional[str] = None
    customer_notes: Optional[str] = None


class LockSeatsIn(BaseModel):
    seat_numbers: List[int]
    locked_by: Optional[str] = "Operator"


@router.get("")
def list_tables(db: Session = Depends(get_db)):
    tables = db.query(DiningTable).all()
    results = []
    for t in tables:
        clean_expired_locks(t.id)
        # Active sessions for this table
        active_sessions = (
            db.query(SeatingSession)
            .filter(
                SeatingSession.table_id == t.id,
                SeatingSession.status.in_(["active", "bill_requested"]),
            )
            .all()
        )

        occupied_seats = set()
        has_bill_requested = False
        active_orders_count = 0

        for s in active_sessions:
            if s.status == "bill_requested":
                has_bill_requested = True
            for part in s.selected_seats.split(","):
                part = part.strip()
                if part.isdigit():
                    occupied_seats.add(int(part))
            party_session_ids = [s.id]
            if s.party_code:
                party_session_ids = [
                    row[0]
                    for row in db.query(SeatingSession.id)
                    .filter(
                        SeatingSession.party_code == s.party_code,
                        SeatingSession.status.in_(["active", "bill_requested"]),
                    )
                    .all()
                ]
            orders = (
                db.query(Order)
                .filter(
                    Order.seating_session_id.in_(party_session_ids),
                    Order.status.notin_(["completed", "cancelled"]),
                )
                .all()
            )
            active_orders_count += len(orders)

        total_chairs = t.chairs or 4
        occupied_count = len(occupied_seats)
        available_count = max(0, total_chairs - occupied_count)

        if has_bill_requested:
            aggregate_state = "BILL_REQUESTED"
        elif occupied_count == 0:
            aggregate_state = "AVAILABLE"
        elif occupied_count >= total_chairs:
            aggregate_state = "FULLY_OCCUPIED"
        else:
            aggregate_state = "PARTIALLY_OCCUPIED"

        # Auto sync physical table.status
        correct_status = (
            "free" if (occupied_count == 0 and not t.active_order_id) else "occupied"
        )
        if t.status != correct_status and t.status != "cleaning":
            t.status = correct_status
            db.commit()

        results.append(
            {
                "id": t.id,
                "name": t.name,
                "chairs": t.chairs,
                "status": t.status,
                "active_order_id": t.active_order_id,
                "total_seats": total_chairs,
                "occupied_seats_count": occupied_count,
                "available_seats_count": available_count,
                "occupied_seat_numbers": sorted(list(occupied_seats)),
                "active_groups_count": len(active_sessions),
                "active_orders_count": active_orders_count,
                "aggregate_state": aggregate_state,
            }
        )
    return results


@router.post("")
def create_table(
    payload: TableIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "manager")),
):
    table = DiningTable(name=payload.name, chairs=payload.chairs)
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.patch("/{table_id}/status")
def update_table_status(
    table_id: int,
    status: str,
    db: Session = Depends(get_db),
    _=Depends(require_roles("cashier", "admin", "manager")),
):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.status = status
    if status == "free":
        table.active_order_id = None
        # Complete all active sessions for this table if forced free
        sessions = (
            db.query(SeatingSession)
            .filter(
                SeatingSession.table_id == table_id,
                SeatingSession.status.in_(["active", "bill_requested"]),
            )
            .all()
        )
        for s in sessions:
            s.status = "completed"
            s.completed_at = datetime.utcnow()
    db.commit()
    return table


@router.delete("/{table_id}")
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    db.delete(table)
    db.commit()
    return {"message": "Table deleted"}


# ── SEATING MANAGEMENT ENDPOINTS ──


@router.get("/parties/active")
def list_active_parties(db: Session = Depends(get_db)):
    """Read-only: active guest groups with every table + seat they occupy (multi-table aware)."""
    sessions = (
        db.query(SeatingSession)
        .filter(SeatingSession.status.in_(["active", "bill_requested"]))
        .order_by(SeatingSession.created_at.asc())
        .all()
    )
    table_names = {t.id: t.name for t in db.query(DiningTable).all()}
    parties: dict[str, dict] = {}
    for s in sessions:
        key = s.party_code or f"SESSION-{s.id}"
        seats = [int(p.strip()) for p in s.selected_seats.split(",") if p.strip().isdigit()]
        order = (
            db.query(Order)
            .filter(
                Order.seating_session_id == s.id,
                Order.status.notin_(["completed", "cancelled"]),
            )
            .order_by(Order.created_at.desc())
            .first()
        )
        party = parties.setdefault(
            key,
            {
                "party_code": key,
                "group_name": s.group_name,
                "phone_number": s.phone_number,
                "total_guests": 0,
                "total_seats": 0,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "allocations": [],
            },
        )
        if not party["phone_number"] and s.phone_number:
            party["phone_number"] = s.phone_number
        party["total_guests"] += s.guest_count
        party["total_seats"] += len(seats)
        party["allocations"].append(
            {
                "session_id": s.id,
                "table_id": s.table_id,
                "table_name": table_names.get(s.table_id, str(s.table_id)),
                "seats": seats,
                "guest_count": s.guest_count,
                "status": s.status,
                "order_id": order.id if order else None,
                "order_status": order.status if order else None,
            }
        )
    return list(parties.values())


@router.get("/{table_id}/seating")
def get_table_seating(table_id: int, db: Session = Depends(get_db)):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    clean_expired_locks(table_id)
    table_locks = active_seat_locks.get(table_id, {})

    active_sessions = (
        db.query(SeatingSession)
        .filter(
            SeatingSession.table_id == table_id,
            SeatingSession.status.in_(["active", "bill_requested"]),
        )
        .order_by(SeatingSession.created_at.asc())
        .all()
    )

    occupied_seats = set()
    has_bill_requested = False
    serialized_sessions = []

    for s in active_sessions:
        if s.status == "bill_requested":
            has_bill_requested = True
        seat_nums = []
        for part in s.selected_seats.split(","):
            part = part.strip()
            if part.isdigit():
                seat_nums.append(int(part))
                occupied_seats.add(int(part))

        # Get active order for this session (also check multi-table party sibling sessions)
        party_session_ids = [s.id]
        if s.party_code:
            sibling_ids = [
                row[0]
                for row in db.query(SeatingSession.id)
                .filter(
                    SeatingSession.party_code == s.party_code,
                    SeatingSession.status.in_(["active", "bill_requested"]),
                )
                .all()
            ]
            if sibling_ids:
                party_session_ids = sibling_ids

        order = (
            db.query(Order)
            .filter(
                Order.seating_session_id.in_(party_session_ids),
                Order.status.notin_(["completed", "cancelled"]),
            )
            .order_by(Order.created_at.desc())
            .first()
        )

        serialized_order = None
        if order:
            serialized_order = {
                "id": order.id,
                "status": order.status,
                "waiter_note": order.waiter_note,
                "created_at": order.created_at.isoformat()
                if order.created_at
                else None,
                "items": [
                    {
                        "id": item.id,
                        "product_id": item.product_id,
                        "quantity": item.quantity,
                        "price": float(item.price),
                        "status": item.status,
                        "product_name": item.product.name
                        if item.product
                        else "Item",
                    }
                    for item in order.items
                ],
            }

        serialized_sessions.append(
            {
                "id": s.id,
                "table_id": s.table_id,
                "group_name": s.group_name,
                "guest_count": s.guest_count,
                "selected_seats": seat_nums,
                "seating_mode": s.seating_mode,
                "phone_number": s.phone_number,
                "customer_notes": s.customer_notes,
                "status": s.status,
                "party_code": s.party_code,
                "created_by": s.created_by,
                "created_at": s.created_at.isoformat()
                if s.created_at
                else None,
                "order": serialized_order,
            }
        )

    total_chairs = table.chairs or 4
    now = time.time()
    locked_seat_list = []
    for seat, lock_info in table_locks.items():
        if lock_info["expires_at"] > now and seat not in occupied_seats:
            locked_seat_list.append(
                {
                    "seat_number": seat,
                    "locked_by": lock_info.get("locked_by", "Another Operator"),
                    "remaining_seconds": max(
                        0, int(lock_info["expires_at"] - now)
                    ),
                }
            )

    locked_seat_nums = set(l["seat_number"] for l in locked_seat_list)
    available_seats = [
        s
        for s in range(1, total_chairs + 1)
        if s not in occupied_seats and s not in locked_seat_nums
    ]

    if has_bill_requested:
        aggregate_state = "BILL_REQUESTED"
    elif len(occupied_seats) == 0:
        aggregate_state = "AVAILABLE"
    elif len(occupied_seats) >= total_chairs:
        aggregate_state = "FULLY_OCCUPIED"
    else:
        aggregate_state = "PARTIALLY_OCCUPIED"

    return {
        "table": {
            "id": table.id,
            "name": table.name,
            "chairs": total_chairs,
            "status": table.status,
            "active_order_id": table.active_order_id,
        },
        "total_seats": total_chairs,
        "occupied_seats": sorted(list(occupied_seats)),
        "available_seats": available_seats,
        "locked_seats": locked_seat_list,
        "aggregate_state": aggregate_state,
        "sessions": serialized_sessions,
    }


@router.post("/{table_id}/seating-sessions")
def create_seating_session(
    table_id: int,
    payload: CreateSeatingSessionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    group_name = payload.group_name.strip()
    if not group_name:
        raise HTTPException(
            status_code=400, detail="Group / Customer name is required"
        )

    total_chairs = table.chairs or 4
    if not payload.selected_seats:
        raise HTTPException(
            status_code=400, detail="At least one chair must be selected"
        )

    for seat in payload.selected_seats:
        if seat < 1 or seat > total_chairs:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid seat number: {seat}. Table only has {total_chairs} chairs.",
            )

    # Check guest count validity
    if payload.guest_count < 1:
        raise HTTPException(
            status_code=400, detail="Guest count must be at least 1"
        )
    if payload.guest_count > len(payload.selected_seats):
        raise HTTPException(
            status_code=400,
            detail=f"Guest count ({payload.guest_count}) cannot exceed allocated seats ({len(payload.selected_seats)}).",
        )

    # ATOMIC CONFLICT DETECTION:
    # Check if ANY selected seat is already occupied by an active session
    active_sessions = (
        db.query(SeatingSession)
        .filter(
            SeatingSession.table_id == table_id,
            SeatingSession.status.in_(["active", "bill_requested"]),
        )
        .all()
    )

    occupied_now = set()
    for s in active_sessions:
        for part in s.selected_seats.split(","):
            if part.strip().isdigit():
                occupied_now.add(int(part.strip()))

    conflicts = [s for s in payload.selected_seats if s in occupied_now]
    if conflicts:
        raise HTTPException(
            status_code=409,
            detail=f"Seats {conflicts} were just allocated by another operator. Please refresh and select available seats.",
        )

    # Clean any temporary locks on these seats
    clean_expired_locks(table_id)
    if table_id in active_seat_locks:
        for seat in payload.selected_seats:
            active_seat_locks[table_id].pop(seat, None)

    # Multi-table party linking: join an existing active party, or start a new one
    party_code = (payload.party_code or "").strip() or None
    if party_code:
        party_anchor = (
            db.query(SeatingSession)
            .filter(
                SeatingSession.party_code == party_code,
                SeatingSession.status.in_(["active", "bill_requested"]),
            )
            .first()
        )
        if not party_anchor:
            raise HTTPException(
                status_code=404,
                detail="The selected group is no longer active. Please refresh and try again.",
            )
        if party_anchor.table_id == table_id:
            raise HTTPException(
                status_code=400,
                detail="This group is already seated at this table. Use a different table to extend the group.",
            )
        group_name = party_anchor.group_name
    else:
        party_code = f"PTY-{int(time.time() * 1000)}"

    session = SeatingSession(
        table_id=table_id,
        group_name=group_name,
        guest_count=payload.guest_count,
        selected_seats=",".join(str(s) for s in sorted(payload.selected_seats)),
        seating_mode=payload.seating_mode,
        phone_number=payload.phone_number.strip()
        if payload.phone_number
        else None,
        customer_notes=payload.customer_notes.strip()
        if payload.customer_notes
        else None,
        status="active",
        created_by=user.name,
        party_code=party_code,
    )
    db.add(session)

    # Mark table occupied
    table.status = "occupied"

    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "table_id": session.table_id,
        "group_name": session.group_name,
        "guest_count": session.guest_count,
        "selected_seats": [
            int(s) for s in session.selected_seats.split(",") if s.isdigit()
        ],
        "seating_mode": session.seating_mode,
        "phone_number": session.phone_number,
        "customer_notes": session.customer_notes,
        "status": session.status,
        "party_code": session.party_code,
        "created_at": session.created_at.isoformat()
        if session.created_at
        else None,
    }


@router.post("/{table_id}/seating-sessions/full-table")
def create_full_table_session(
    table_id: int,
    payload: FullTableSessionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    total_chairs = table.chairs or 4
    all_seats = list(range(1, total_chairs + 1))

    # Verify no active sessions on this table
    active_count = (
        db.query(SeatingSession)
        .filter(
            SeatingSession.table_id == table_id,
            SeatingSession.status.in_(["active", "bill_requested"]),
        )
        .count()
    )
    if active_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot allocate full table: some chairs are already occupied by another group.",
        )

    session_in = CreateSeatingSessionIn(
        group_name=payload.group_name,
        guest_count=min(payload.guest_count, total_chairs),
        selected_seats=all_seats,
        seating_mode="full_table",
        phone_number=payload.phone_number,
        customer_notes=payload.customer_notes,
        party_code=payload.party_code,
    )
    return create_seating_session(table_id, session_in, db, user)


@router.patch("/seating-sessions/{session_id}")
def update_seating_session(
    session_id: int,
    payload: UpdateSeatingSessionIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles("cashier", "admin", "manager")),
):
    session = db.get(SeatingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Seating session not found")

    if payload.group_name is not None:
        session.group_name = payload.group_name.strip()
    if payload.guest_count is not None:
        session.guest_count = max(1, payload.guest_count)
    if payload.phone_number is not None:
        session.phone_number = (
            payload.phone_number.strip() if payload.phone_number else None
        )
    if payload.customer_notes is not None:
        session.customer_notes = (
            payload.customer_notes.strip() if payload.customer_notes else None
        )

    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "group_name": session.group_name,
        "guest_count": session.guest_count,
        "phone_number": session.phone_number,
        "customer_notes": session.customer_notes,
    }


@router.post("/seating-sessions/{session_id}/release")
def release_seating_session(
    session_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("cashier", "admin", "manager")),
):
    session = db.get(SeatingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Seating session not found")

    session.status = "completed"
    session.completed_at = datetime.utcnow()

    # Check remaining active sessions on this table
    remaining = (
        db.query(SeatingSession)
        .filter(
            SeatingSession.table_id == session.table_id,
            SeatingSession.id != session.id,
            SeatingSession.status.in_(["active", "bill_requested"]),
        )
        .count()
    )

    table = db.get(DiningTable, session.table_id)
    if table:
        if remaining == 0:
            table.status = "free"
            table.active_order_id = None
        else:
            table.status = "occupied"

    db.commit()
    return {
        "message": f"Seats {session.selected_seats} released successfully",
        "remaining_active_sessions": remaining,
    }


@router.post("/seating-sessions/{session_id}/request-bill")
def request_session_bill(
    session_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("cashier", "admin", "manager")),
):
    session = db.get(SeatingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Seating session not found")

    session.status = "bill_requested"
    party_session_ids = [session.id]
    sibling_sessions = []
    if session.party_code:
        sibling_sessions = (
            db.query(SeatingSession)
            .filter(
                SeatingSession.party_code == session.party_code,
                SeatingSession.status.in_(["active", "bill_requested"]),
            )
            .all()
        )
        for sib in sibling_sessions:
            sib.status = "bill_requested"
            if sib.id not in party_session_ids:
                party_session_ids.append(sib.id)

    # Mark associated active orders as bill_requested
    orders = (
        db.query(Order)
        .filter(
            Order.seating_session_id.in_(party_session_ids),
            Order.status.notin_(["completed", "cancelled", "bill_requested"]),
        )
        .all()
    )
    for o in orders:
        o.status = "bill_requested"

    # Fallback: check tables of these sessions if order didn't have seating_session_id
    if not orders:
        all_sessions = [session] + sibling_sessions
        session_table_ids = [s.table_id for s in all_sessions if s.table_id]
        table_orders = (
            db.query(Order)
            .filter(
                Order.table_id.in_(session_table_ids),
                Order.status.notin_(["completed", "cancelled", "bill_requested"]),
            )
            .all()
        )
        for o in table_orders:
            o.status = "bill_requested"
            if not o.seating_session_id:
                o.seating_session_id = session.id
            orders.append(o)

    db.commit()
    return {
        "message": f"Bill requested for {session.group_name}",
        "orders_affected": len(orders),
    }


@router.post("/{table_id}/seats/lock")
def lock_seats(
    table_id: int, payload: LockSeatsIn, db: Session = Depends(get_db)
):
    table = db.get(DiningTable, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    clean_expired_locks(table_id)
    if table_id not in active_seat_locks:
        active_seat_locks[table_id] = {}

    active_sessions = (
        db.query(SeatingSession)
        .filter(
            SeatingSession.table_id == table_id,
            SeatingSession.status.in_(["active", "bill_requested"]),
        )
        .all()
    )
    occupied = set()
    for s in active_sessions:
        for part in s.selected_seats.split(","):
            if part.strip().isdigit():
                occupied.add(int(part.strip()))

    now = time.time()
    for s in payload.seat_numbers:
        if s in occupied:
            raise HTTPException(
                status_code=409,
                detail=f"Chair #{s} is already occupied by an active guest group.",
            )
        existing_lock = active_seat_locks[table_id].get(s)
        if (
            existing_lock
            and existing_lock["expires_at"] > now
            and existing_lock["locked_by"] != payload.locked_by
        ):
            raise HTTPException(
                status_code=409,
                detail=f"Chair #{s} is currently being selected by {existing_lock['locked_by']}.",
            )

    for s in payload.seat_numbers:
        active_seat_locks[table_id][s] = {
            "locked_by": payload.locked_by or "Operator",
            "expires_at": now + 90,
        }

    return {
        "status": "locked",
        "seat_numbers": payload.seat_numbers,
        "expires_in_seconds": 90,
    }


@router.post("/{table_id}/seats/unlock")
def unlock_seats(table_id: int, payload: LockSeatsIn):
    if table_id in active_seat_locks:
        for s in payload.seat_numbers:
            active_seat_locks[table_id].pop(s, None)
    return {"status": "unlocked"}
