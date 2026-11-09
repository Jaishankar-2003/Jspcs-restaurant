import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/AppLayout";
import { Modal } from "../components/Modal";
import {
  PlusIcon,
  TrashIcon,
  SearchIcon,
  CloseIcon,
  AlertTriangleIcon,
  CheckIcon,
  SnowflakeIcon,
  WindIcon,
  MapPinIcon,
  EditIcon,
  UsersGroupIcon,
  ArmchairIcon,
} from "../components/Icons";
import {
  getTableMeta,
  saveTableMeta,
  deleteTableMeta,
  DEFAULT_FLOORS,
} from "../utils/tableStorage";

interface Product {
  id: number;
  name: string;
  price: number;
  total_stock: number;
  reserved_stock: number;
  sold_stock: number;
  is_veg: boolean;
  category: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

interface SeatingSessionItem {
  id: number;
  table_id: number;
  group_name: string;
  guest_count: number;
  selected_seats: number[];
  seating_mode: string;
  phone_number?: string;
  customer_notes?: string;
  status: string; // active | bill_requested | completed | cancelled
  party_code?: string | null;
  created_by?: string;
  created_at?: string;
  order?: {
    id: number;
    status: string;
    waiter_note?: string;
    created_at?: string;
    items: Array<{
      id: number;
      product_id: number;
      quantity: number;
      price: number;
      status: string;
      product_name: string;
    }>;
  } | null;
}

interface TableSeatingData {
  table: any;
  total_seats: number;
  occupied_seats: number[];
  available_seats: number[];
  locked_seats: Array<{ seat_number: number; locked_by: string; remaining_seconds: number }>;
  aggregate_state: string; // AVAILABLE | PARTIALLY_OCCUPIED | FULLY_OCCUPIED | BILL_REQUESTED
  sessions: SeatingSessionItem[];
}

interface PartyAllocation {
  session_id: number;
  table_id: number;
  table_name: string;
  seats: number[];
  guest_count: number;
  status: string;
  order_id: number | null;
  order_status: string | null;
}

interface PartyItem {
  party_code: string;
  group_name: string;
  phone_number?: string | null;
  total_guests: number;
  total_seats: number;
  created_at?: string | null;
  allocations: PartyAllocation[];
}

export default function TablesPage() {
  const { role } = useAuth();
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter Bar
  const [floorFilter, setFloorFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState<"all" | "ac" | "non_ac">("all");

  // Add Table Modal State
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [chairs, setChairs] = useState(4);
  const [floor, setFloor] = useState("Ground Floor");
  const [customFloor, setCustomFloor] = useState("");
  const [isAc, setIsAc] = useState(false);
  const [acCharge, setAcCharge] = useState(50);

  // Edit Table Specifications Modal State
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [editFloor, setEditFloor] = useState("Ground Floor");
  const [editCustomFloor, setEditCustomFloor] = useState("");
  const [editIsAc, setEditIsAc] = useState(false);
  const [editAcCharge, setEditAcCharge] = useState(50);

  // ── SMART SEATING COCKPIT STATE ──
  const [activeCockpitTable, setActiveCockpitTable] = useState<any | null>(null);
  const [seatingData, setSeatingData] = useState<TableSeatingData | null>(null);
  const [loadingSeating, setLoadingSeating] = useState(false);

  // Chair Selection & Seating Modes
  const [selectedChairs, setSelectedChairs] = useState<number[]>([]);
  const [seatingMode, setSeatingMode] = useState<"individual" | "full_table" | "custom">("individual");

  // Group Allocation Form State
  const [groupName, setGroupName] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  // ── MULTI-TABLE GROUP LINKING (one group across several tables) ──
  const [viewMode, setViewMode] = useState<"floor" | "groups">("floor");
  const [parties, setParties] = useState<PartyItem[]>([]);
  const [linkPartyCode, setLinkPartyCode] = useState(""); // "" = new group
  const [extendTargets, setExtendTargets] = useState<Record<string, string>>({});

  // ── GROUP-SCOPED ORDER DISPATCH STATE ──
  const [activeOrderingSession, setActiveOrderingSession] = useState<SeatingSessionItem | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [waiterNote, setWaiterNote] = useState("");
  const [isConfirmingKitchen, setIsConfirmingKitchen] = useState(false);

  // Dialog & Toast States
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const cockpitPollRef = useRef<any>(null);

  const showToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const openDialog = (message: string, onConfirm: () => void) => {
    setDialog({ message, onConfirm });
  };

  // Synchronize All Tables, Orders, and Multi-Table Parties
  const load = async () => {
    try {
      const [tRes, oRes, pRes, partiesRes] = await Promise.all([
        client.get("/tables"),
        client.get("/orders"),
        client.get("/products"),
        client.get("/tables/parties/active").catch(() => ({ data: [] })),
      ]);
      setTables(tRes.data);
      setOrders(oRes.data);
      setProducts(pRes.data);
      if (partiesRes?.data) setParties(partiesRes.data);
    } catch (err) {
      console.error("Sync failed", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  // Fetch Live Seating Data for Active Table
  const fetchSeatingData = async (tableId: number, silent = false) => {
    if (!silent) setLoadingSeating(true);
    try {
      const res = await client.get(`/tables/${tableId}/seating`);
      setSeatingData(res.data);
    } catch (err: any) {
      console.error("Failed to load seating", err);
      if (!silent) showToast("error", "Failed to fetch table seating details");
    } finally {
      if (!silent) setLoadingSeating(false);
    }
  };

  // Open Cockpit for Table (optionally pre-fill to link with an existing group)
  const openTableCockpit = (table: any, initialPartyCode = "") => {
    setActiveCockpitTable(table);
    setSelectedChairs([]);
    setSeatingMode("individual");
    setLinkPartyCode(initialPartyCode);
    if (initialPartyCode) {
      const p = parties.find((item) => item.party_code === initialPartyCode);
      if (p) {
        setGroupName(p.group_name);
        setPhoneNumber(p.phone_number || "");
      } else {
        setGroupName("");
        setPhoneNumber("");
      }
    } else {
      setGroupName("");
      setPhoneNumber("");
    }
    setGuestCount(1);
    setCustomerNotes("");
    fetchSeatingData(table.id);

    // Start Real-Time Seating Poller
    if (cockpitPollRef.current) clearInterval(cockpitPollRef.current);
    cockpitPollRef.current = setInterval(() => {
      fetchSeatingData(table.id, true);
    }, 3000);
  };

  const closeTableCockpit = () => {
    if (cockpitPollRef.current) clearInterval(cockpitPollRef.current);
    cockpitPollRef.current = null;
    setActiveCockpitTable(null);
    setSeatingData(null);
    setSelectedChairs([]);
    setLinkPartyCode("");
    setActiveOrderingSession(null);
    load();
  };

  // Clean polling on unmount
  useEffect(() => {
    return () => {
      if (cockpitPollRef.current) clearInterval(cockpitPollRef.current);
    };
  }, []);

  // ── CHAIR SELECTION LOGIC ──
  const toggleChairSelection = async (seatNum: number) => {
    if (!seatingData) return;
    if (seatingData.occupied_seats.includes(seatNum)) {
      // Chair is occupied: highlight its group
      const occupyingGroup = seatingData.sessions.find((s) => s.selected_seats.includes(seatNum));
      if (occupyingGroup) {
        showToast("error", `🪑 Chair #${seatNum} is occupied by "${occupyingGroup.group_name}"`);
      }
      return;
    }

    const isCurrentlySelected = selectedChairs.includes(seatNum);
    let nextSelected: number[];

    if (seatingMode === "full_table") {
      // Full table mode selects all available seats
      nextSelected = seatingData.available_seats;
    } else {
      if (isCurrentlySelected) {
        nextSelected = selectedChairs.filter((s) => s !== seatNum);
      } else {
        nextSelected = [...selectedChairs, seatNum].sort((a, b) => a - b);
      }
    }

    setSelectedChairs(nextSelected);
    setGuestCount(Math.max(1, nextSelected.length));

    // Server-Side Temporary Lock for Real-Time Multi-Operator Protection
    if (activeCockpitTable) {
      try {
        if (!isCurrentlySelected) {
          await client.post(`/tables/${activeCockpitTable.id}/seats/lock`, {
            seat_numbers: [seatNum],
            locked_by: role?.toUpperCase() || "Operator",
          });
        } else {
          await client.post(`/tables/${activeCockpitTable.id}/seats/unlock`, {
            seat_numbers: [seatNum],
          });
        }
      } catch (err: any) {
        if (err.response?.status === 409) {
          showToast("error", `⚠️ ${err.response.data?.detail || "Chair conflict detected"}`);
          fetchSeatingData(activeCockpitTable.id, true);
        }
      }
    }
  };

  // Select All Available Chairs
  const handleSelectAllAvailable = () => {
    if (!seatingData) return;
    if (seatingData.available_seats.length === 0) {
      showToast("error", "No available chairs on this table");
      return;
    }
    setSelectedChairs([...seatingData.available_seats]);
    setGuestCount(seatingData.available_seats.length);
  };

  // Clear Chair Selection
  const handleClearSelection = async () => {
    if (activeCockpitTable && selectedChairs.length > 0) {
      try {
        await client.post(`/tables/${activeCockpitTable.id}/seats/unlock`, {
          seat_numbers: selectedChairs,
        });
      } catch {}
    }
    setSelectedChairs([]);
    setGuestCount(1);
  };

  // ── GROUP CREATION WORKFLOW ──
  const handleCreateGroup = async (andOpenOrder = false) => {
    if (!activeCockpitTable || !seatingData) return;

    const cleanGroupName = groupName.trim();
    if (!cleanGroupName) {
      showToast("error", "⚠️ Please enter a Customer or Group Name (e.g. Arun Family)");
      return;
    }

    if (selectedChairs.length === 0) {
      showToast("error", "⚠️ Please select at least one available chair");
      return;
    }

    if (guestCount < 1) {
      showToast("error", "⚠️ Guest count must be at least 1");
      return;
    }

    if (guestCount > selectedChairs.length) {
      showToast(
        "error",
        `⚠️ Guest count (${guestCount}) cannot exceed selected chairs (${selectedChairs.length})`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await client.post(`/tables/${activeCockpitTable.id}/seating-sessions`, {
        group_name: cleanGroupName,
        guest_count: guestCount,
        selected_seats: selectedChairs,
        seating_mode: seatingMode,
        phone_number: phoneNumber.trim() || null,
        customer_notes: customerNotes.trim() || null,
        party_code: linkPartyCode || null,
      });

      const newSession: SeatingSessionItem = res.data;
      showToast(
        "success",
        linkPartyCode
          ? `✅ "${cleanGroupName}" extended to Table ${activeCockpitTable.name} (Seats [${selectedChairs.join(", ")}])!`
          : `✅ Group "${cleanGroupName}" allocated to Seats [${selectedChairs.join(", ")}]!`
      );

      // Reset selection state
      setSelectedChairs([]);
      setGroupName("");
      setLinkPartyCode("");
      setGuestCount(1);
      setPhoneNumber("");
      setCustomerNotes("");

      // Refresh seating data
      await fetchSeatingData(activeCockpitTable.id);
      load();

      // If user chose to immediately add order
      if (andOpenOrder && newSession) {
        openGroupOrder(newSession);
      }
    } catch (err: any) {
      console.error("Allocation failed", err);
      let msg = "Failed to allocate seats";
      if (err.response?.status === 409) {
        msg = err.response.data?.detail || "Chair conflict: seats were just allocated by another operator.";
      } else if (err.response?.data?.detail) {
        const d = err.response.data.detail;
        msg = typeof d === "string" ? d : JSON.stringify(d);
      }
      showToast("error", `❌ ${msg}`);
      fetchSeatingData(activeCockpitTable.id);
    } finally {
      setSubmitting(false);
    }
  };

  // Full Table Allocation (One-Click Family Seating)
  const handleFullTableAllocation = async () => {
    if (!activeCockpitTable || !seatingData) return;
    if (seatingData.occupied_seats.length > 0) {
      showToast(
        "error",
        "Cannot allocate full table: some chairs are already occupied by another group."
      );
      return;
    }

    const cleanGroupName = groupName.trim() || `${activeCockpitTable.name} Family Group`;
    setSubmitting(true);
    try {
      const res = await client.post(`/tables/${activeCockpitTable.id}/seating-sessions/full-table`, {
        group_name: cleanGroupName,
        guest_count: seatingData.total_seats,
        phone_number: phoneNumber.trim() || null,
        customer_notes: customerNotes.trim() || null,
        party_code: linkPartyCode || null,
      });

      const newSession: SeatingSessionItem = res.data;
      showToast(
        "success",
        `✅ Full table allocated for "${cleanGroupName}" (${seatingData.total_seats} Chairs)!`
      );

      setSelectedChairs([]);
      setGroupName("");
      setLinkPartyCode("");
      await fetchSeatingData(activeCockpitTable.id);
      load();
      if (newSession) openGroupOrder(newSession);
    } catch (err: any) {
      showToast("error", `❌ ${err.response?.data?.detail || "Full table allocation failed"}`);
      fetchSeatingData(activeCockpitTable.id);
    } finally {
      setSubmitting(false);
    }
  };

  // Release Seats for Group
  const handleReleaseGroupSeats = (session: SeatingSessionItem) => {
    openDialog(
      `Release seats [${session.selected_seats.join(", ")}] for "${session.group_name}"? This group will be marked completed.`,
      async () => {
        try {
          await client.post(`/tables/seating-sessions/${session.id}/release`);
          showToast("success", `✅ Seats released for "${session.group_name}"`);
          if (activeCockpitTable) fetchSeatingData(activeCockpitTable.id);
          load();
        } catch (err: any) {
          showToast("error", `❌ ${err.response?.data?.detail || "Failed to release seats"}`);
        }
      }
    );
  };

  // Request Bill for Specific Group
  const handleRequestGroupBill = async (session: SeatingSessionItem) => {
    try {
      await client.post(`/tables/seating-sessions/${session.id}/request-bill`);
      showToast("success", `💰 Bill requested for "${session.group_name}"! Alert routed to Counter POS.`);
      if (activeCockpitTable) fetchSeatingData(activeCockpitTable.id);
      load();
    } catch (err: any) {
      showToast("error", `❌ ${err.response?.data?.detail || "Failed to request bill"}`);
    }
  };

  // ── GROUP-SCOPED ORDER DISPATCH WORKFLOW ──
  const openGroupOrder = (session: SeatingSessionItem) => {
    setActiveOrderingSession(session);
    setCart([]);
    setMenuSearch("");
    setWaiterNote("");
    setIsConfirmingKitchen(false);
  };

  const closeGroupOrder = () => {
    setActiveOrderingSession(null);
    setCart([]);
    setIsConfirmingKitchen(false);
    if (activeCockpitTable) fetchSeatingData(activeCockpitTable.id);
    load();
  };

  const addToGroupCart = (p: Product) => {
    const avail = p.total_stock - p.reserved_stock;
    const inCart = cart.find((i) => i.id === p.id)?.qty || 0;

    if (avail - inCart <= 0) {
      showToast("error", `❌ ${p.name} is out of stock`);
      return;
    }

    setIsConfirmingKitchen(false);
    setCart((prev) => {
      const exists = prev.find((i) => i.id === p.id);
      if (exists) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const increaseCartQty = (id: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const avail = product.total_stock - product.reserved_stock;
    const inCart = cart.find((i) => i.id === id)?.qty || 0;

    if (avail - inCart <= 0) {
      showToast("error", `❌ No more stock available for ${product.name}`);
      return;
    }

    setIsConfirmingKitchen(false);
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  };

  const decreaseCartQty = (id: number) => {
    setIsConfirmingKitchen(false);
    setCart((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i));
      return updated.filter((i) => i.qty > 0);
    });
  };

  const removeFromGroupCart = (id: number) => {
    setIsConfirmingKitchen(false);
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  // Submit Order to Kitchen (Attaching seating_session_id!)
  const doSendGroupOrderToKitchen = async () => {
    if (!activeOrderingSession || !activeCockpitTable) return;
    setSubmitting(true);
    try {
      if (activeOrderingSession.order) {
        // Append items to existing group order
        await client.patch(`/orders/${activeOrderingSession.order.id}/items`, {
          items: cart.map((i) => ({ product_id: i.id, quantity: i.qty })),
          waiter_note: waiterNote.trim() || null,
        });
      } else {
        // Create new dine-in order linked directly to this SeatingSession!
        await client.post("/orders", {
          type: "dine_in",
          table_id: activeCockpitTable.id,
          seating_session_id: activeOrderingSession.id,
          items: cart.map((i) => ({ product_id: i.id, quantity: i.qty })),
          waiter_note: waiterNote.trim() || null,
        });
      }

      showToast(
        "success",
        `📢 Order dispatched to Kitchen for Table ${activeCockpitTable.name} • ${activeOrderingSession.group_name}!`
      );
      closeGroupOrder();
    } catch (err: any) {
      console.error("Order dispatch failed", err);
      showToast("error", "❌ " + (err.response?.data?.detail || "Could not send order"));
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel item from group order
  const cancelGroupItem = async (itemId: number) => {
    if (!activeOrderingSession?.order) return;
    try {
      await client.patch(`/orders/${activeOrderingSession.order.id}/items/${itemId}/status`, null, {
        params: { status: "cancelled" },
      });
      showToast("success", "🗑️ Item cancelled and stock restored.");
      if (activeCockpitTable) fetchSeatingData(activeCockpitTable.id);
      load();
    } catch (err: any) {
      showToast("error", "❌ " + (err.response?.data?.detail || "Could not cancel item"));
    }
  };

  // Confirm delivery of group order
  const confirmGroupDelivery = async () => {
    if (!activeOrderingSession?.order) return;
    try {
      await client.patch(`/orders/${activeOrderingSession.order.id}/status`, null, {
        params: { status: "delivered" },
      });
      showToast("success", "🍽️ Order delivered to table!");
      if (activeCockpitTable) fetchSeatingData(activeCockpitTable.id);
      load();
    } catch (err: any) {
      showToast("error", "❌ " + (err.response?.data?.detail || "Could not confirm delivery"));
    }
  };

  // ── PHYSICAL TABLE CRUD ──
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) {
      showToast("error", "⚠️ Please enter a Table Code or Name.");
      return;
    }

    const userRole = (role || localStorage.getItem("role") || "").toLowerCase();
    if (userRole && userRole !== "admin" && userRole !== "manager") {
      showToast(
        "error",
        `⚠️ Permission Required: Current role (${userRole.toUpperCase()}) cannot create tables.`
      );
      return;
    }

    const isDuplicate = tables.some(
      (t) => t.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      showToast("error", `⚠️ Table "${cleanName}" already exists on the floor plan.`);
      return;
    }

    const cleanChairs = Math.max(1, Math.min(30, parseInt(String(chairs), 10) || 4));
    const resolvedFloor =
      (floor === "custom" ? customFloor.trim() : floor.trim()) || "Ground Floor";

    setSubmitting(true);
    try {
      const res = await client.post("/tables", { name: cleanName, chairs: cleanChairs });
      const tableId = res.data?.id;
      if (tableId) {
        saveTableMeta(
          tableId,
          {
            floor: resolvedFloor,
            is_ac: isAc,
            ac_charge: isAc ? Number(acCharge) || 50 : 0,
          },
          cleanName
        );
      }
      setNewName("");
      setChairs(4);
      setFloor("Ground Floor");
      setCustomFloor("");
      setIsAc(false);
      setAcCharge(50);
      setShowAdd(false);
      showToast("success", `✅ Table "${cleanName}" created on ${resolvedFloor}!`);
      await load();
    } catch (err: any) {
      showToast("error", `❌ ${err.response?.data?.detail || "Failed to create table"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = (table: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (table.occupied_seats_count > 0 || table.status !== "free" || table.active_order_id) {
      showToast(
        "error",
        `⚠️ Cannot delete Table ${table.name} while seats or orders are active. Please settle or release all groups first.`
      );
      return;
    }

    openDialog(
      `Permanently delete Table "${table.name}"? This dining unit will be removed from the floor plan.`,
      async () => {
        try {
          await client.delete(`/tables/${table.id}`);
          deleteTableMeta(table.id, table.name);
          if (activeCockpitTable?.id === table.id) {
            closeTableCockpit();
          }
          showToast("success", `✅ Table ${table.name} removed from floor plan.`);
          await load();
        } catch (err: any) {
          showToast("error", `❌ Failed to delete table: ${err.response?.data?.detail || "Error"}`);
        }
      }
    );
  };

  const openEditTable = (table: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const meta = getTableMeta(table);
    setEditingTable(table);
    setEditFloor(meta.floor || "Ground Floor");
    setEditCustomFloor("");
    setEditIsAc(meta.is_ac);
    setEditAcCharge(meta.ac_charge ?? 50);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    const finalFloor =
      (editFloor === "custom" ? editCustomFloor.trim() : editFloor.trim()) || "Ground Floor";
    saveTableMeta(
      editingTable.id,
      {
        floor: finalFloor,
        is_ac: editIsAc,
        ac_charge: editIsAc ? Number(editAcCharge) || 50 : 0,
      },
      editingTable.name
    );
    showToast("success", `✅ Specifications for Table ${editingTable.name} updated!`);
    setEditingTable(null);
    load();
  };

  // Filtered menu dishes for order catalog
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(menuSearch.toLowerCase())
  );
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  // Filtered physical tables list
  const filteredTables = tables.filter((t) => {
    const meta = getTableMeta(t);
    const matchFloor = floorFilter === "all" || meta.floor === floorFilter;
    const matchSection =
      sectionFilter === "all" ||
      (sectionFilter === "ac" && meta.is_ac) ||
      (sectionFilter === "non_ac" && !meta.is_ac);
    return matchFloor && matchSection;
  });

  return (
    <AppLayout
      title="DINING ROOM FLOOR PLAN & SEATING"
      subtitle="Multi-Guest Chair Allocation • Independent Group Orders & Real-time Seating Control"
      showBack
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* View Mode Toggle: Floor View vs Group View */}
          <div
            style={{
              display: "inline-flex",
              background: "var(--bg-surface-2)",
              padding: "0.25rem",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--border-medium)",
            }}
          >
            <button
              type="button"
              className={`category-tab-pill ${viewMode === "floor" ? "active" : ""}`}
              style={{ borderRadius: "var(--radius-pill)", padding: "0.35rem 0.9rem" }}
              onClick={() => setViewMode("floor")}
            >
              🪑 Floor Plan
            </button>
            <button
              type="button"
              className={`category-tab-pill ${viewMode === "groups" ? "active" : ""}`}
              style={{ borderRadius: "var(--radius-pill)", padding: "0.35rem 0.9rem" }}
              onClick={() => setViewMode("groups")}
            >
              <UsersGroupIcon size={14} />
              <span>Group Directory ({parties.length})</span>
            </button>
          </div>

          <button
            className="btn-primary"
            onClick={() => setShowAdd(true)}
            style={{ fontSize: "0.85rem" }}
          >
            <PlusIcon size={16} />
            <span>+ Add Table</span>
          </button>
        </div>
      }
    >
      {/* ── Toast Notifications (portaled to body so they always render above every popup) ── */}
      {createPortal(
        <div className="toast-container" style={{ zIndex: 10000 }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast-card-3d ${t.type === "success" ? "toast-success" : "toast-error"}`}
            >
              <span>{t.type === "success" ? "✓" : "⚠️"}</span>
              <span>{t.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ── Add Table Modal ── */}
      <Modal
        isOpen={showAdd}
        onClose={() => {
          if (!submitting) setShowAdd(false);
        }}
        title="Configure New Dining Table"
        subtitle="Add a physical dining table to the floor plan with custom chairs, floor & climate"
        maxWidth="540px"
        zIndex={1500}
      >
        <form onSubmit={handleCreateTable} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Table Code / Name */}
          <div className="form-group" style={{ margin: 0 }}>
            <label>TABLE CODE / NAME</label>
            <input
              className="input-field"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. T-12, Booth 3, VIP-1"
              required
              autoFocus
            />
          </div>

          {/* Seat Capacity */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={{ margin: 0 }}>TOTAL SEAT CAPACITY (CHAIRS)</label>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                {[2, 4, 6, 8, 10].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChairs(c)}
                    style={{
                      background: chairs === c ? "var(--primary)" : "var(--bg-surface-2)",
                      color: chairs === c ? "#fff" : "var(--text-secondary)",
                      border: "1px solid var(--border-medium)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.2rem 0.5rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min="1"
              max="30"
              className="input-field"
              value={chairs}
              onChange={(e) => setChairs(parseInt(e.target.value) || 2)}
              required
            />
          </div>

          {/* Floor / Section Location */}
          <div className="form-group" style={{ margin: 0 }}>
            <label>FLOOR / SECTION LOCATION</label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              {DEFAULT_FLOORS.map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => {
                    setFloor(fl);
                    setCustomFloor("");
                  }}
                  style={{
                    background: floor === fl ? "var(--primary)" : "var(--bg-surface-2)",
                    color: floor === fl ? "#fff" : "var(--text-primary)",
                    border: `1px solid ${floor === fl ? "var(--primary)" : "var(--border-medium)"}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.825rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {fl}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFloor("custom")}
                style={{
                  background: floor === "custom" ? "var(--primary)" : "var(--bg-surface-2)",
                  color: floor === "custom" ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${floor === "custom" ? "var(--primary)" : "var(--border-medium)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.825rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Custom Floor
              </button>
            </div>
            {floor === "custom" && (
              <input
                className="input-field"
                placeholder="Enter custom floor name (e.g. Mezzanine, VIP Lounge)..."
                value={customFloor}
                onChange={(e) => setCustomFloor(e.target.value)}
                autoFocus
                required
              />
            )}
          </div>

          {/* Climate Section */}
          <div className="form-group" style={{ margin: 0 }}>
            <label>SECTION CLIMATE TYPE</label>
            <div className="segmented-toggle-wrap">
              <button
                type="button"
                className={`segmented-toggle-btn ${!isAc ? "active" : ""}`}
                onClick={() => setIsAc(false)}
              >
                <WindIcon size={16} />
                <span>🍃 Non-AC Section</span>
              </button>
              <button
                type="button"
                className={`segmented-toggle-btn ${isAc ? "active active-ac" : ""}`}
                onClick={() => {
                  setIsAc(true);
                  if (!acCharge) setAcCharge(50);
                }}
              >
                <SnowflakeIcon size={16} />
                <span>❄️ AC Section</span>
              </button>
            </div>
          </div>

          {/* AC Surcharge Configuration */}
          {isAc && (
            <div
              style={{
                padding: "1rem 1.25rem",
                background: "#f0f9ff",
                border: "1.5px solid #bae6fd",
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0369a1", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <SnowflakeIcon size={16} />
                  <span>Physical Table AC Extra Surcharge</span>
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                  Default ₹50 (Customizable)
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ position: "relative", width: "130px" }}>
                  <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontWeight: 800, color: "var(--text-muted)" }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    className="input-field"
                    style={{ paddingLeft: "1.75rem", fontWeight: 800, fontSize: "1.1rem" }}
                    value={acCharge}
                    onChange={(e) => setAcCharge(Math.max(0, parseInt(e.target.value) || 0))}
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", flex: 1 }}>
                  {[30, 50, 75, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAcCharge(amt)}
                      style={{
                        background: acCharge === amt ? "#0284c7" : "#ffffff",
                        color: acCharge === amt ? "#ffffff" : "#0369a1",
                        border: "1px solid #7dd3fc",
                        borderRadius: "var(--radius-sm)",
                        padding: "0.35rem 0.65rem",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      ₹{amt} {amt === 50 ? "(Default)" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="row" style={{ justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowAdd(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating Table..." : "Create Table"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Table Specifications Modal ── */}
      <Modal
        isOpen={!!editingTable}
        onClose={() => setEditingTable(null)}
        title={editingTable ? `Edit Table: ${editingTable.name}` : "Edit Table"}
        subtitle="Update floor area, climate section, and AC billing surcharge"
        maxWidth="520px"
        zIndex={1500}
      >
        <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Floor Selection */}
          <div className="form-group" style={{ margin: 0 }}>
            <label>FLOOR / SECTION LOCATION</label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              {DEFAULT_FLOORS.map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => {
                    setEditFloor(fl);
                    setEditCustomFloor("");
                  }}
                  style={{
                    background: editFloor === fl ? "var(--primary)" : "var(--bg-surface-2)",
                    color: editFloor === fl ? "#fff" : "var(--text-primary)",
                    border: `1px solid ${editFloor === fl ? "var(--primary)" : "var(--border-medium)"}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.825rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {fl}
                </button>
              ))}
            </div>
          </div>

          {/* Climate Section */}
          <div className="form-group" style={{ margin: 0 }}>
            <label>SECTION CLIMATE TYPE</label>
            <div className="segmented-toggle-wrap">
              <button
                type="button"
                className={`segmented-toggle-btn ${!editIsAc ? "active" : ""}`}
                onClick={() => setEditIsAc(false)}
              >
                <WindIcon size={16} />
                <span>🍃 Non-AC</span>
              </button>
              <button
                type="button"
                className={`segmented-toggle-btn ${editIsAc ? "active active-ac" : ""}`}
                onClick={() => setEditIsAc(true)}
              >
                <SnowflakeIcon size={16} />
                <span>❄️ AC Section</span>
              </button>
            </div>
          </div>

          {/* AC Surcharge */}
          {editIsAc && (
            <div style={{ padding: "1rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "var(--radius-md)" }}>
              <label style={{ fontSize: "0.8rem", color: "#0369a1", fontWeight: 800 }}>AC Extra Surcharge (₹)</label>
              <input
                type="number"
                min="0"
                step="5"
                className="input-field"
                value={editAcCharge}
                onChange={(e) => setEditAcCharge(Math.max(0, parseInt(e.target.value) || 0))}
                required
              />
            </div>
          )}

          <div className="row" style={{ justifyContent: "flex-end", gap: "0.75rem" }}>
            <button type="button" className="btn-secondary" onClick={() => setEditingTable(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Specifications
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Floor & Section Filter Bar ── */}
      {viewMode === "floor" && (
        <div
          className="card-3d"
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.75rem",
            background: "#ffffff",
            display: "flex",
            flexWrap: "wrap",
            gap: "1.25rem",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <MapPinIcon size={14} />
              <span>Floor:</span>
            </span>
            <button
              type="button"
              className={`category-tab-pill ${floorFilter === "all" ? "active" : ""}`}
              onClick={() => setFloorFilter("all")}
            >
              All Floors
            </button>
            {DEFAULT_FLOORS.map((fl) => (
              <button
                key={fl}
                type="button"
                className={`category-tab-pill ${floorFilter === fl ? "active" : ""}`}
                onClick={() => setFloorFilter(fl)}
              >
                {fl}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <button
              type="button"
              className={`category-tab-pill ${sectionFilter === "all" ? "active" : ""}`}
              onClick={() => setSectionFilter("all")}
            >
              All Climate
            </button>
            <button
              type="button"
              className={`category-tab-pill ${sectionFilter === "ac" ? "active" : ""}`}
              onClick={() => setSectionFilter("ac")}
            >
              <SnowflakeIcon size={13} />
              <span>AC Section</span>
            </button>
            <button
              type="button"
              className={`category-tab-pill ${sectionFilter === "non_ac" ? "active" : ""}`}
              onClick={() => setSectionFilter("non_ac")}
            >
              <WindIcon size={13} />
              <span>Non-AC</span>
            </button>
          </div>
        </div>
      )}

      {/* ── SEPARATE SECTION: GROUP-WISE TABLE & SEAT DIRECTORY ── */}
      {viewMode === "groups" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Header Banner */}
          <div
            className="card-3d"
            style={{
              padding: "1.25rem 1.5rem",
              background: "linear-gradient(135deg, rgba(244, 123, 56, 0.08) 0%, #ffffff 100%)",
              border: "1px solid rgba(244, 123, 56, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.35rem" }}>👥</span>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, color: "var(--text-primary)" }}>
                  Group Directory &amp; Multi-Table Seating
                </h3>
                <span className="badge" style={{ background: "var(--primary)", color: "#fff", fontWeight: 800 }}>
                  {parties.length} Active {parties.length === 1 ? "Group" : "Groups"}
                </span>
              </div>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                View every active customer group and all the physical tables and individual chair numbers they occupy.
                You can also allocate additional chairs at another table for any existing group.
              </p>
            </div>
            <button
              className="btn-secondary"
              style={{ fontSize: "0.85rem" }}
              onClick={() => setViewMode("floor")}
            >
              ← Back to Floor Plan
            </button>
          </div>

          {parties.length === 0 ? (
            <div
              className="card-3d"
              style={{ textAlign: "center", padding: "5rem 2rem", background: "#ffffff" }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🍽️</div>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>No Active Customer Groups</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                Switch to the Floor Plan view, choose any table, and allocate chairs to seat your first group.
              </p>
              <button
                className="btn-primary"
                style={{ marginTop: "1rem", fontSize: "0.875rem" }}
                onClick={() => setViewMode("floor")}
              >
                Go to Floor Plan
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {parties.map((p) => {
                const totalChairs = p.total_seats;
                const totalGuests = p.total_guests;
                const isMultiTable = p.allocations.length > 1;

                // Tables that have available seats and are NOT yet part of this party
                const allocatedTableIds = new Set(p.allocations.map((a) => a.table_id));
                const extendableTables = tables.filter(
                  (tbl) => !allocatedTableIds.has(tbl.id) && tbl.available_seats_count > 0
                );

                return (
                  <div
                    key={p.party_code}
                    className="card-3d"
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--border-medium)",
                      borderTop: `5px solid ${isMultiTable ? "var(--purple)" : "var(--primary)"}`,
                      padding: "1.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.1rem",
                      position: "relative",
                    }}
                  >
                    {/* Card Top: Group Name + Badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)" }}>
                            {p.group_name}
                          </span>
                          {isMultiTable && (
                            <span
                              className="badge"
                              style={{
                                background: "var(--purple-subtle)",
                                color: "var(--purple)",
                                border: "1px solid var(--purple)",
                                fontWeight: 800,
                                fontSize: "0.72rem",
                              }}
                            >
                              🔗 Multi-Table ({p.allocations.length} Tables)
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.35rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          <span>👥 <strong>{totalGuests}</strong> {totalGuests === 1 ? "Guest" : "Guests"}</span>
                          <span>•</span>
                          <span>🪑 <strong>{totalChairs}</strong> Chairs Total</span>
                          {p.phone_number && (
                            <>
                              <span>•</span>
                              <span>📞 {p.phone_number}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className="badge"
                        style={{
                          background: "var(--bg-surface-2)",
                          color: "var(--text-muted)",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        {p.party_code.startsWith("PTY-") ? "Group Party" : "Seating"}
                      </span>
                    </div>

                    {/* Table & Chair Breakdown Strip */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)" }}>
                        Allocated Tables &amp; Chair Breakdown
                      </span>

                      {p.allocations.map((alloc) => {
                        const targetTable = tables.find((t) => t.id === alloc.table_id);
                        return (
                          <div
                            key={alloc.session_id}
                            style={{
                              padding: "0.85rem 1rem",
                              background: "var(--bg-surface-2)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius-md)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.75rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: "1rem" }}>
                                  🪑 Table {alloc.table_name}
                                </span>
                                <span className="badge" style={{ background: "#ffffff", fontSize: "0.72rem" }}>
                                  {alloc.guest_count} {alloc.guest_count === 1 ? "Guest" : "Guests"}
                                </span>
                                {alloc.order_id && (
                                  <span className={`badge badge-${alloc.order_status || "confirmed"}`} style={{ fontSize: "0.7rem" }}>
                                    Order #{alloc.order_id} ({alloc.order_status?.toUpperCase()})
                                  </span>
                                )}
                              </div>

                              {/* Chair Chips */}
                              <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                                {alloc.seats.map((seatNum) => (
                                  <span
                                    key={seatNum}
                                    className="badge"
                                    style={{
                                      background: "var(--primary-subtle)",
                                      color: "var(--primary)",
                                      fontWeight: 800,
                                      fontSize: "0.75rem",
                                      border: "1px solid rgba(244, 123, 56, 0.3)",
                                      padding: "0.2rem 0.5rem",
                                    }}
                                  >
                                    Chair #{seatNum < 10 ? `0${seatNum}` : seatNum}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Cockpit link button */}
                            {targetTable && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem", whiteSpace: "nowrap" }}
                                onClick={() => openTableCockpit(targetTable)}
                              >
                                View Table {alloc.table_name} →
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Action: Extend This Group to Another Table */}
                    <div
                      style={{
                        marginTop: "auto",
                        paddingTop: "0.85rem",
                        borderTop: "1px dashed var(--border-medium)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-muted)" }}>
                        ➕ Add More Chairs for {p.group_name}:
                      </span>

                      {extendableTables.length === 0 ? (
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                          No other tables with free chairs available right now.
                        </span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                          <select
                            className="input-field"
                            style={{ fontSize: "0.825rem", padding: "0.35rem 0.6rem", flex: 1, minWidth: "160px" }}
                            value={extendTargets[p.party_code] || ""}
                            onChange={(e) =>
                              setExtendTargets((prev) => ({ ...prev, [p.party_code]: e.target.value }))
                            }
                          >
                            <option value="">Select Table to add...</option>
                            {extendableTables.map((tbl) => (
                              <option key={tbl.id} value={tbl.id}>
                                Table {tbl.name} ({tbl.available_seats_count} chairs free)
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem", whiteSpace: "nowrap" }}
                            disabled={!extendTargets[p.party_code]}
                            onClick={() => {
                              const tblId = parseInt(extendTargets[p.party_code]);
                              const target = tables.find((t) => t.id === tblId);
                              if (target) {
                                openTableCockpit(target, p.party_code);
                              }
                            }}
                          >
                            Open &amp; Allocate →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Floor Plan Seating Grid (Light Luxury Cards) ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "8rem 2rem", color: "var(--text-muted)" }}>
          <h2>Syncing Floor Map &amp; Seating...</h2>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="card-3d" style={{ textAlign: "center", padding: "4rem 2rem", background: "#ffffff" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🪑</div>
          <h3 style={{ margin: 0, color: "var(--text-primary)" }}>No Tables Match Current Filter</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.4rem" }}>
            Try selecting "All Floors" or "+ Add Table" to create a new dining unit on this floor.
          </p>
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(295px, 1fr))",
            gap: "1.75rem",
          }}
        >
          {filteredTables.map((t) => {
            const meta = getTableMeta(t);
            const totalChairs = t.chairs || 4;
            const occupiedSeats = t.occupied_seats_count || 0;
            const availableSeats = Math.max(0, totalChairs - occupiedSeats);
            const activeGroups = t.active_groups_count || 0;
            const activeOrders = t.active_orders_count || 0;
            const aggregateState = t.aggregate_state || (occupiedSeats === 0 ? "AVAILABLE" : "PARTIALLY_OCCUPIED");

            const isBillRequested = aggregateState === "BILL_REQUESTED";
            const isFullyOccupied = aggregateState === "FULLY_OCCUPIED";
            const isPartiallyOccupied = aggregateState === "PARTIALLY_OCCUPIED";

            const topBorderColor = isBillRequested
              ? "var(--primary)"
              : isFullyOccupied
              ? "var(--danger)"
              : isPartiallyOccupied
              ? "var(--info)"
              : "var(--success)";

            return (
              <div
                key={t.id}
                className="card-interactive card-3d floor-table-card"
                onClick={() => openTableCockpit(t)}
                style={{
                  background: "#ffffff",
                  borderTop: `5px solid ${topBorderColor}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "1.35rem 1.25rem",
                  minHeight: "280px",
                  cursor: "pointer",
                }}
              >
                {/* Card Top Metadata & Action Strip */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    alignItems: "center",
                    marginBottom: "0.6rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                    <span className="badge badge-floor">
                      <MapPinIcon size={12} />
                      <span>{meta.floor}</span>
                    </span>
                    {meta.is_ac ? (
                      <span className="badge badge-ac">
                        <SnowflakeIcon size={12} />
                        <span>AC (+₹{meta.ac_charge})</span>
                      </span>
                    ) : (
                      <span className="badge badge-non-ac">
                        <WindIcon size={12} />
                        <span>Non-AC</span>
                      </span>
                    )}
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div style={{ display: "flex", gap: "0.3rem" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => openEditTable(t, e)}
                      style={{
                        background: "var(--bg-surface-2)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        padding: "0.3rem 0.45rem",
                        display: "flex",
                        alignItems: "center",
                        fontSize: "0.725rem",
                      }}
                      title="Edit Specifications"
                    >
                      <EditIcon size={12} />
                    </button>
                    {occupiedSeats === 0 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTable(t, e)}
                        style={{
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.25)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--danger)",
                          cursor: "pointer",
                          padding: "0.3rem 0.45rem",
                          display: "flex",
                          alignItems: "center",
                          fontSize: "0.725rem",
                        }}
                        title="Delete Table"
                      >
                        <TrashIcon size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Name */}
                <div style={{ margin: "0.4rem 0", textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "Outfit, sans-serif",
                      fontSize: "2.4rem",
                      fontWeight: 900,
                      margin: 0,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {t.name}
                  </div>
                </div>

                {/* Mini Chair Dots (Visual representation of each physical chair) */}
                <div className="mini-chairs-strip">
                  {Array.from({ length: totalChairs }, (_, idx) => {
                    const seatNum = idx + 1;
                    const isOccupied = t.occupied_seat_numbers?.includes(seatNum) || seatNum <= occupiedSeats;
                    return (
                      <div
                        key={seatNum}
                        className={`mini-chair-dot ${isOccupied ? "is-occupied" : "is-free"}`}
                        title={`Chair #${seatNum}: ${isOccupied ? "Occupied" : "Available"}`}
                      />
                    );
                  })}
                </div>

                {/* Seat Capacity & Availability Breakdown */}
                <div
                  style={{
                    fontSize: "0.825rem",
                    color: "var(--text-secondary)",
                    fontWeight: 700,
                    margin: "0.35rem 0",
                    textAlign: "center",
                  }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>{totalChairs} Seats</strong> •{" "}
                  <span style={{ color: "var(--success)" }}>{availableSeats} Free</span> •{" "}
                  <span style={{ color: occupiedSeats > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                    {occupiedSeats} Seated
                  </span>
                </div>

                {/* Active Group Count & Orders */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <UsersGroupIcon size={13} />
                    <span>{activeGroups} {activeGroups === 1 ? "Group" : "Groups"}</span>
                  </span>
                  <span>•</span>
                  <span>{activeOrders} Active {activeOrders === 1 ? "Order" : "Orders"}</span>
                </div>

                {/* Aggregate Status Badge */}
                <div style={{ marginTop: "auto" }}>
                  <span className={`badge badge-${aggregateState.toLowerCase()}`}>
                    {aggregateState === "BILL_REQUESTED"
                      ? "💰 BILL REQUESTED"
                      : aggregateState.replace("_", " ")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SMART SEATING COCKPIT MODAL (Top-View Visual Table & Multi-Guest Management) ── */}
      {activeCockpitTable &&
        createPortal(
          <div
            className="modal-backdrop"
            style={{ zIndex: 1200 }}
            onClick={closeTableCockpit}
          >
            <div
              className="modal-window-3d"
              style={{ maxWidth: "1180px", maxHeight: "92vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="modal-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: "1.6rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>
                      Table {activeCockpitTable.name}
                    </h2>
                    {(() => {
                      const meta = getTableMeta(activeCockpitTable);
                      return (
                        <>
                          <span className="badge badge-floor">
                            <MapPinIcon size={12} />
                            <span>{meta.floor}</span>
                          </span>
                          {meta.is_ac && (
                            <span className="badge badge-ac">
                              <SnowflakeIcon size={12} />
                              <span>AC Section (+₹{meta.ac_charge})</span>
                            </span>
                          )}
                        </>
                      );
                    })()}
                    {seatingData && (
                      <span className={`badge badge-${seatingData.aggregate_state.toLowerCase()}`}>
                        {seatingData.aggregate_state.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Physical Capacity: <strong>{seatingData?.total_seats || activeCockpitTable.chairs} Chairs</strong> •{" "}
                    Available: <strong style={{ color: "var(--success)" }}>{seatingData?.available_seats?.length ?? 0}</strong> •{" "}
                    Occupied: <strong style={{ color: "var(--primary)" }}>{seatingData?.occupied_seats?.length ?? 0}</strong> •{" "}
                    Active Groups: <strong>{seatingData?.sessions?.length ?? 0}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: "0.8rem" }}
                    onClick={(e) => openEditTable(activeCockpitTable, e)}
                  >
                    <EditIcon size={13} />
                    <span>Edit Specs</span>
                  </button>
                  <button
                    className="modal-close-btn"
                    onClick={closeTableCockpit}
                    aria-label="Close Cockpit"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body: Scrollable Seating & Group Interface */}
              <div
                className="modal-content-scroll"
                style={{
                  background: "var(--bg-canvas)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                {/* ── Mode Selection & Quick Chair Action Bar ── */}
                <div
                  className="card-3d"
                  style={{
                    padding: "0.85rem 1.25rem",
                    background: "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Seating Mode:
                    </span>
                    <button
                      type="button"
                      className={`category-tab-pill ${seatingMode === "individual" ? "active" : ""}`}
                      onClick={() => setSeatingMode("individual")}
                    >
                      <span>🪑 Mode A: Individual Chairs</span>
                    </button>
                    <button
                      type="button"
                      className={`category-tab-pill ${seatingMode === "full_table" ? "active" : ""}`}
                      onClick={() => {
                        setSeatingMode("full_table");
                        handleSelectAllAvailable();
                      }}
                    >
                      <span>👨‍👩‍👧‍👦 Mode B: Full Table Family</span>
                    </button>
                    <button
                      type="button"
                      className={`category-tab-pill ${seatingMode === "custom" ? "active" : ""}`}
                      onClick={() => setSeatingMode("custom")}
                    >
                      <span>✨ Mode C: Custom Allocation</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem" }}
                      onClick={handleSelectAllAvailable}
                    >
                      Select All Available ({seatingData?.available_seats?.length || 0})
                    </button>
                    {selectedChairs.length > 0 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem", color: "var(--danger)" }}
                        onClick={handleClearSelection}
                      >
                        Clear Selection ({selectedChairs.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* ── VISUAL TOP-VIEW ARCHITECTURAL TABLE & CHAIRS STAGE ── */}
                <div className="table-visualization-stage">
                  {loadingSeating ? (
                    <div style={{ padding: "3rem", color: "var(--text-muted)", fontWeight: 700 }}>
                      Loading chair map...
                    </div>
                  ) : (
                    (() => {
                      const total = seatingData?.total_seats || activeCockpitTable.chairs || 4;
                      const occupiedList = seatingData?.occupied_seats || [];
                      const lockedList = seatingData?.locked_seats?.map((l) => l.seat_number) || [];

                      // Split chairs into top row and bottom row (or perimeter)
                      const half = Math.ceil(total / 2);
                      const topSeats = Array.from({ length: half }, (_, i) => i + 1);
                      const bottomSeats = Array.from({ length: total - half }, (_, i) => half + i + 1);

                      const renderChairNode = (seatNum: number, position: "top" | "bottom") => {
                        const isOccupied = occupiedList.includes(seatNum);
                        const isSelected = selectedChairs.includes(seatNum);
                        const isLocked = lockedList.includes(seatNum);

                        let stateClass = "chair-state-free";
                        let label = "Free";
                        if (isSelected) {
                          stateClass = "chair-state-selected";
                          label = "✓ Picked";
                        } else if (isOccupied) {
                          stateClass = "chair-state-occupied";
                          const occGroup = seatingData?.sessions?.find((s) => s.selected_seats.includes(seatNum));
                          label = occGroup?.group_name ? occGroup.group_name.slice(0, 8) : "Occupied";
                        } else if (isLocked) {
                          stateClass = "chair-state-locked";
                          label = "Locked";
                        }

                        return (
                          <div
                            key={seatNum}
                            className={`chair-node-visual chair-pos-${position} ${stateClass}`}
                            onClick={() => toggleChairSelection(seatNum)}
                            title={`Chair #${seatNum} • ${label}`}
                          >
                            <span className="chair-backrest" />
                            <div style={{ fontSize: "0.85rem", fontWeight: 900 }}>
                              {seatNum < 10 ? `0${seatNum}` : seatNum}
                            </div>
                            <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.02em", maxWidth: "52px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {label}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", width: "100%" }}>
                          {/* Top Row of Chairs */}
                          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                            {topSeats.map((num) => renderChairNode(num, "top"))}
                          </div>

                          {/* Central Physical Table Surface */}
                          <div className={`table-surface-visual ${selectedChairs.length > 0 ? "is-selected" : occupiedList.length > 0 ? "is-occupied" : ""}`}>
                            <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                              Physical Table
                            </div>
                            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.75rem", fontWeight: 900, color: "var(--text-primary)" }}>
                              {activeCockpitTable.name}
                            </div>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", marginTop: "2px" }}>
                              {total} Physical Chairs • {occupiedList.length} Allocated
                            </div>
                          </div>

                          {/* Bottom Row of Chairs */}
                          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                            {bottomSeats.map((num) => renderChairNode(num, "bottom"))}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* ── LOWER SECTION: Group Creation Workspace + Active Table Groups ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.5rem", alignItems: "start" }}>
                  {/* Left: New Guest Group Allocation Card */}
                  <div
                    className="card-3d"
                    style={{
                      background: "#ffffff",
                      padding: "1.25rem",
                      border: selectedChairs.length > 0 ? "2px solid var(--primary)" : "1px solid var(--border-medium)",
                      boxShadow: selectedChairs.length > 0 ? "0 8px 24px -2px var(--primary-glow)" : "var(--shadow-3d-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <UsersGroupIcon size={18} />
                        <span>Allocate Guest Group</span>
                      </h3>
                      {selectedChairs.length > 0 ? (
                        <span className="badge badge-preparing">
                          {selectedChairs.length} {selectedChairs.length === 1 ? "Chair" : "Chairs"} Selected
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "var(--bg-surface-2)" }}>
                          Select Chairs Above
                        </span>
                      )}
                    </div>

                    {selectedChairs.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👆</div>
                        <p style={{ fontWeight: 700, margin: 0 }}>Click available green chairs above</p>
                        <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                          Select 1 or more chairs to create an independent guest group or family seating.
                        </p>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ marginTop: "1rem", fontSize: "0.825rem" }}
                          onClick={handleSelectAllAvailable}
                        >
                          Select All Available Chairs
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {/* Selected Chairs Chips */}
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                            Assigned Chair Numbers
                          </label>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            {selectedChairs.map((s) => (
                              <span
                                key={s}
                                className="badge"
                                style={{ background: "var(--primary)", color: "#ffffff", fontWeight: 800, fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
                              >
                                Chair #{s < 10 ? `0${s}` : s}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Multi-Table Party Link Option */}
                        {parties.length > 0 && (
                          <div
                            style={{
                              padding: "0.75rem",
                              background: "rgba(244, 123, 56, 0.08)",
                              border: "1px solid rgba(244, 123, 56, 0.3)",
                              borderRadius: "var(--radius-md)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.35rem",
                            }}
                          >
                            <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase" }}>
                              🔗 Allocate for Existing Group (Multi-Table)
                            </label>
                            <select
                              className="input-field"
                              style={{ fontSize: "0.85rem", padding: "0.4rem 0.6rem" }}
                              value={linkPartyCode}
                              onChange={(e) => {
                                const code = e.target.value;
                                setLinkPartyCode(code);
                                if (code) {
                                  const p = parties.find((item) => item.party_code === code);
                                  if (p) {
                                    setGroupName(p.group_name);
                                    setPhoneNumber(p.phone_number || "");
                                  }
                                }
                              }}
                            >
                              <option value="">+ New Separate Group</option>
                              {parties.map((p) => (
                                <option key={p.party_code} value={p.party_code}>
                                  Extend "{p.group_name}" ({p.allocations.map((a) => a.table_name).join(", ")})
                                </option>
                              ))}
                            </select>
                            {linkPartyCode && (
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                ℹ️ Chairs will be assigned to "{groupName}" as part of their multi-table seating.
                              </span>
                            )}
                          </div>
                        )}

                        {/* Group / Customer Name */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>CUSTOMER / GROUP NAME</label>
                          <input
                            className="input-field"
                            placeholder="e.g. Arun Family, Walk-in Couple..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            disabled={!!linkPartyCode}
                            autoFocus
                            required
                          />
                        </div>

                        {/* Guest Count Stepper */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>GUEST COUNT (MAX: {selectedChairs.length})</label>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <button
                              type="button"
                              className="qty-btn"
                              style={{ width: "36px", height: "36px", fontSize: "1.1rem" }}
                              onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={selectedChairs.length}
                              className="input-field"
                              style={{ width: "80px", textAlign: "center", fontWeight: 900, fontSize: "1.1rem" }}
                              value={guestCount}
                              onChange={(e) =>
                                setGuestCount(
                                  Math.max(1, Math.min(selectedChairs.length, parseInt(e.target.value) || 1))
                                )
                              }
                            />
                            <button
                              type="button"
                              className="qty-btn"
                              style={{ width: "36px", height: "36px", fontSize: "1.1rem" }}
                              onClick={() => setGuestCount(Math.min(selectedChairs.length, guestCount + 1))}
                            >
                              +
                            </button>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              Guests seated
                            </span>
                          </div>
                        </div>

                        {/* Optional Phone & Special Notes */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>PHONE (OPTIONAL)</label>
                            <input
                              className="input-field"
                              placeholder="Mobile number..."
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>CUSTOMER NOTES</label>
                            <input
                              className="input-field"
                              placeholder="Window, Birthday, etc."
                              value={customerNotes}
                              onChange={(e) => setCustomerNotes(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ height: "3.25rem", fontSize: "0.95rem", fontWeight: 800 }}
                            disabled={submitting}
                            onClick={() => handleCreateGroup(true)}
                          >
                            {submitting ? "Allocating..." : "✓ Confirm Seating & Open Menu Order"}
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ height: "2.75rem", fontSize: "0.85rem" }}
                            disabled={submitting}
                            onClick={() => handleCreateGroup(false)}
                          >
                            Allocate Seats Only (Order Later)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Active Groups Currently Dining at This Physical Table */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)" }}>
                        Active Guest Groups at Table ({seatingData?.sessions?.length || 0})
                      </h3>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Independent orders &amp; billing per group
                      </span>
                    </div>

                    {seatingData?.sessions && seatingData.sessions.length > 0 ? (
                      seatingData.sessions.map((s) => {
                        const hasOrder = !!s.order;
                        const orderStatus = s.order?.status || "none";
                        const isBillRequested = s.status === "bill_requested" || orderStatus === "bill_requested";

                        return (
                          <div
                            key={s.id}
                            className="group-session-card-3d"
                            style={{
                              borderLeft: `5px solid ${isBillRequested ? "var(--primary)" : hasOrder ? "var(--success)" : "var(--border-medium)"}`,
                            }}
                          >
                            {/* Group Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)" }}>
                                    {s.group_name}
                                  </span>
                                  <span className="badge" style={{ background: "var(--bg-surface-2)", fontSize: "0.72rem" }}>
                                    {s.guest_count} {s.guest_count === 1 ? "Guest" : "Guests"}
                                  </span>
                                  {s.seating_mode === "full_table" && (
                                    <span className="badge" style={{ background: "var(--purple-subtle)", color: "var(--purple)", fontSize: "0.72rem" }}>
                                      Full Table
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                                  {s.selected_seats.map((seat) => (
                                    <span
                                      key={seat}
                                      className="badge"
                                      style={{ background: "#f1f5f9", color: "#334155", fontWeight: 800, fontSize: "0.725rem" }}
                                    >
                                      🪑 Seat #{seat < 10 ? `0${seat}` : seat}
                                    </span>
                                  ))}
                                  {s.phone_number && (
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
                                      📞 {s.phone_number}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Order Status Badge */}
                              <div>
                                {hasOrder ? (
                                  <span className={`badge badge-${orderStatus}`} style={{ fontSize: "0.75rem" }}>
                                    TICKET #{s.order?.id} • {orderStatus.toUpperCase()}
                                  </span>
                                ) : (
                                  <span className="badge" style={{ background: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
                                    No Order Yet
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Customer Notes */}
                            {s.customer_notes && (
                              <div style={{ fontSize: "0.78rem", background: "rgba(244,123,56,0.06)", padding: "0.4rem 0.65rem", borderRadius: "var(--radius-sm)", border: "1px dashed rgba(244,123,56,0.3)" }}>
                                <strong>Note:</strong> {s.customer_notes}
                              </div>
                            )}

                            {/* Action Buttons for this Group */}
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
                                onClick={() => openGroupOrder(s)}
                              >
                                <span>🛒 {hasOrder ? "View / Add Dishes" : "Place Order"}</span>
                              </button>

                              {hasOrder && orderStatus !== "bill_requested" && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
                                  onClick={() => handleRequestGroupBill(s)}
                                >
                                  <span>💰 Request Bill</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem", color: "var(--danger)", borderColor: "rgba(239,68,68,0.3)" }}
                                onClick={() => handleReleaseGroupSeats(s)}
                              >
                                <span>🗑️ Release Seats</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="card-3d" style={{ textAlign: "center", padding: "3rem 1.5rem", background: "#ffffff", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>🍽️</div>
                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>
                          No Active Groups Seated
                        </div>
                        <p style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
                          All chairs on Table {activeCockpitTable.name} are currently free. Select chairs above to seat guests.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── GROUP-SCOPED 3-COLUMN INTERACTIVE ORDER MODAL ── */}
      {activeOrderingSession &&
        createPortal(
          <div
            className="modal-backdrop"
            style={{ zIndex: 1400 }}
            onClick={closeGroupOrder}
          >
            <div
              className="modal-window-3d"
              style={{ maxWidth: "1280px", height: "88vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    {(() => {
                      const partyInfo = parties.find((p) => p.party_code === activeOrderingSession.party_code);
                      const isMultiTable = partyInfo && partyInfo.allocations.length > 1;
                      const allTableNames = isMultiTable ? partyInfo.allocations.map((a) => a.table_name).join(" + ") : activeCockpitTable?.name;

                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>
                              {activeOrderingSession.group_name}
                            </h2>
                            <span className="badge" style={{ background: "var(--bg-surface-2)", fontWeight: 800 }}>
                              🪑 {allTableNames}
                            </span>
                            <span className="badge" style={{ background: "var(--primary)", color: "#fff", fontWeight: 800 }}>
                              {isMultiTable ? `${partyInfo.total_guests} Guests Total` : `${activeOrderingSession.guest_count} Guests`}
                            </span>
                            {isMultiTable && (
                              <span className="badge" style={{ background: "var(--purple-subtle)", color: "var(--purple)", border: "1px solid var(--purple)", fontWeight: 800 }}>
                                🔗 Shared Group Order
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            {isMultiTable
                              ? `All dishes ordered for "${activeOrderingSession.group_name}" from ${allTableNames} route to the same unified group order.`
                              : `Scoped Order Dispatch • Independent Group Bill & Kitchen Routing`}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {activeOrderingSession.order && (
                    <span className={`badge badge-${activeOrderingSession.order.status}`} style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}>
                      TICKET #{activeOrderingSession.order.id} • {activeOrderingSession.order.status.toUpperCase()}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <button
                    className="modal-close-btn"
                    onClick={closeGroupOrder}
                    aria-label="Close"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body: 3-Column Layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.25fr 420px",
                  flex: 1,
                  overflow: "hidden",
                  gap: "1.25rem",
                  padding: "1.25rem 1.75rem",
                  background: "var(--bg-canvas)",
                }}
              >
                {/* ── LEFT COLUMN: Confirmed Active Items for THIS Group ── */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                      ✅ Confirmed Kitchen Items
                    </h4>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>
                      {activeOrderingSession.order?.items?.length || 0} items
                    </span>
                  </div>

                  <div
                    className="card-3d"
                    style={{
                      background: "#ffffff",
                      flex: 1,
                      overflowY: "auto",
                      padding: "0.85rem",
                    }}
                  >
                    {activeOrderingSession.order?.items && activeOrderingSession.order.items.length > 0 ? (
                      activeOrderingSession.order.items.map((i) => {
                        const isCancelled = i.status === "cancelled";
                        return (
                          <div
                            key={i.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "0.75rem 0.5rem",
                              borderBottom: "1px solid var(--border-subtle)",
                              opacity: isCancelled ? 0.4 : 1,
                              textDecoration: isCancelled ? "line-through" : "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              {!isCancelled && (
                                <button
                                  onClick={() => cancelGroupItem(i.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--danger)" }}
                                  title="Cancel item"
                                >
                                  <TrashIcon size={14} />
                                </button>
                              )}
                              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                                {i.product_name || "Dish Item"}
                              </span>
                            </div>

                            <span className="badge" style={{ background: "var(--bg-surface-1)" }}>
                              × {i.quantity}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🍽️</div>
                        <div style={{ fontWeight: 700 }}>No items ordered yet for this group</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── MIDDLE COLUMN: Searchable Menu Catalog ── */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div className="search-wrapper">
                      <div className="search-icon-inside"><SearchIcon size={16} /></div>
                      <input
                        className="search-input search-input-padded"
                        style={{ padding: "0.5rem 1rem 0.5rem 2.5rem", fontSize: "0.875rem" }}
                        placeholder="Search menu dishes to select..."
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
                        gap: "0.75rem",
                      }}
                    >
                      {filteredProducts.map((p) => {
                        const avail = p.total_stock - p.reserved_stock;
                        const outOfStock = avail <= 0;
                        return (
                          <div
                            key={p.id}
                            className={`pos-product-card-3d ${outOfStock ? "sold-out" : ""}`}
                            style={{
                              padding: "0.85rem",
                              minHeight: "115px",
                              borderTop: `3px solid ${p.is_veg ? "var(--success)" : "var(--danger)"}`,
                            }}
                            onClick={() => addToGroupCart(p)}
                          >
                            <div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 800, lineHeight: 1.2, marginBottom: "0.25rem", color: "var(--text-primary)" }}>
                                {p.name}
                              </div>
                              <div style={{ color: "var(--primary)", fontWeight: 900, fontSize: "1.05rem" }}>
                                ₹{p.price}
                              </div>
                            </div>

                            <div style={{ marginTop: "0.5rem" }}>
                              <span
                                className="badge"
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "0.15rem 0.4rem",
                                  background: outOfStock ? "var(--danger-bg)" : "var(--success-bg)",
                                  color: outOfStock ? "var(--danger)" : "var(--success)",
                                }}
                              >
                                {outOfStock ? "Out of Stock" : `${avail} Left`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Cart & Side Preview ── */}
                <div
                  className="card-3d"
                  style={{
                    background: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    padding: "1.25rem",
                    border: isConfirmingKitchen ? "2px solid var(--primary)" : "1px solid var(--border-medium)",
                    boxShadow: isConfirmingKitchen ? "0 8px 30px -4px var(--primary-glow)" : "var(--shadow-3d-sm)",
                    transition: "all 0.25s ease",
                  }}
                >
                  {!isConfirmingKitchen ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--primary)", fontWeight: 900 }}>
                          🛒 Group Order Cart
                        </h3>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>
                          {cart.length} items queued
                        </span>
                      </div>

                      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                        {cart.map((i) => (
                          <div
                            key={i.id}
                            style={{
                              padding: "0.65rem 0.75rem",
                              background: "var(--bg-surface-1)",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>{i.name}</span>
                              <button
                                onClick={() => removeFromGroupCart(i.id)}
                                style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}
                              >
                                <CloseIcon size={14} />
                              </button>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <button className="qty-btn" style={{ width: "26px", height: "26px" }} onClick={() => decreaseCartQty(i.id)}>
                                  -
                                </button>
                                <span style={{ fontWeight: 800, minWidth: "22px", textAlign: "center", color: "var(--text-primary)" }}>{i.qty}</span>
                                <button className="qty-btn" style={{ width: "26px", height: "26px" }} onClick={() => increaseCartQty(i.id)}>
                                  +
                                </button>
                              </div>
                              <span style={{ fontWeight: 800, color: "var(--primary)" }}>
                                ₹{(i.price * i.qty).toFixed(0)}
                              </span>
                            </div>
                          </div>
                        ))}

                        {cart.length === 0 && (
                          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            Select menu items to add to this group's order
                          </div>
                        )}
                      </div>

                      {cart.length > 0 && (
                        <div
                          style={{
                            padding: "0.75rem 1rem",
                            background: "var(--primary-subtle)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid rgba(244,123,56,0.3)",
                            display: "flex",
                            justifyContent: "space-between",
                            fontWeight: 900,
                            marginBottom: "1rem",
                          }}
                        >
                          <span style={{ color: "var(--text-primary)" }}>Subtotal to Dispatch</span>
                          <span style={{ color: "var(--primary)", fontSize: "1.1rem" }}>₹{cartTotal.toFixed(0)}</span>
                        </div>
                      )}

                      <div style={{ marginBottom: "1rem" }}>
                        <textarea
                          className="input-field"
                          style={{ resize: "none", height: "65px", fontSize: "0.825rem", padding: "0.5rem 0.75rem" }}
                          placeholder="📝 Kitchen instruction (e.g. less spicy, allergy notes...)"
                          value={waiterNote}
                          onChange={(e) => setWaiterNote(e.target.value)}
                        />
                      </div>

                      <button
                        className="btn-primary"
                        style={{ height: "3.5rem", fontSize: "1rem", fontWeight: 800 }}
                        onClick={() => setIsConfirmingKitchen(true)}
                        disabled={submitting || cart.length === 0}
                      >
                        📢 SEND TO KITCHEN
                      </button>
                    </>
                  ) : (
                    /* Side Preview Mode */
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "modalFadeIn 0.25s ease-out" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border-medium)" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)", fontWeight: 900, fontSize: "1.1rem" }}>
                            <span>📋 Kitchen Routing Preview</span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {(() => {
                              const partyInfo = parties.find((p) => p.party_code === activeOrderingSession.party_code);
                              const isMultiTable = partyInfo && partyInfo.allocations.length > 1;
                              const targetTables = isMultiTable ? partyInfo.allocations.map((a) => a.table_name).join(", ") : activeCockpitTable?.name;
                              return (
                                <span>
                                  Target: <strong>{activeOrderingSession.group_name} ({targetTables})</strong>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        <span className="badge badge-preparing">READY TO ROUTE</span>
                      </div>

                      <div style={{ padding: "0.6rem 0.85rem", background: "rgba(244, 123, 56, 0.1)", border: "1px solid rgba(244, 123, 56, 0.3)", borderRadius: "var(--radius-sm)", fontSize: "0.825rem", color: "var(--text-primary)", marginBottom: "0.85rem" }}>
                        ⚡ <strong>Confirm dispatch?</strong> Items will immediately reflect on the Kitchen KDS screen with table and group tag.
                      </div>

                      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "0.85rem" }}>
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.55rem 0.75rem",
                              background: "var(--bg-surface-1)",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border-subtle)",
                              fontSize: "0.875rem",
                            }}
                          >
                            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                              {item.qty}× {item.name}
                            </span>
                            <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>
                              ₹{(item.price * item.qty).toFixed(0)}
                            </span>
                          </div>
                        ))}

                        {waiterNote && (
                          <div style={{ padding: "0.65rem 0.85rem", background: "#fffbeb", border: "1.5px dashed var(--amber-gold)", borderRadius: "var(--radius-sm)", fontSize: "0.825rem", marginTop: "0.4rem" }}>
                            <strong style={{ color: "var(--amber-gold)" }}>📝 Instruction: </strong>
                            <span>{waiterNote}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <button
                          className="btn-primary"
                          style={{
                            height: "3.75rem",
                            fontSize: "1.05rem",
                            fontWeight: 900,
                            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                          }}
                          onClick={doSendGroupOrderToKitchen}
                          disabled={submitting}
                        >
                          {submitting ? "Dispatching..." : "✓ YES, CONFIRM & DISPATCH"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ height: "2.75rem", fontSize: "0.85rem" }}
                          onClick={() => setIsConfirmingKitchen(false)}
                        >
                          ← Back to Modify Selection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Confirmation Dialog Modal (Top Foreground Priority zIndex: 3000) ── */}
      <Modal
        isOpen={!!dialog}
        onClose={() => setDialog(null)}
        title="Confirmation Required"
        danger
        maxWidth="440px"
        zIndex={3000}
        footer={
          <div className="row" style={{ width: "100%", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button className="btn-secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                const action = dialog?.onConfirm;
                setDialog(null); // auto-close the popup immediately on confirm
                action?.();
              }}
            >
              Yes, Confirm
            </button>
          </div>
        }
      >
        <div style={{ textAlign: "center", padding: "1.25rem 0 0.5rem 0" }}>
          <div style={{ color: "var(--amber-gold)", marginBottom: "1rem" }}>
            <AlertTriangleIcon size={46} />
          </div>
          <p style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)", lineHeight: 1.5 }}>
            {dialog?.message}
          </p>
        </div>
      </Modal>
    </AppLayout>
  );
}
