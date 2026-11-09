export interface TableMetadata {
  floor: string;
  is_ac: boolean;
  ac_charge: number;
}

export const DEFAULT_FLOORS = [
  "Ground Floor",
  "1st Floor",
  "2nd Floor",
  "Rooftop",
  "Outdoor Patio",
];

const STORAGE_KEY = "restaurant_tables_meta_v1";

export function getAllTablesMeta(): Record<string | number, TableMetadata> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getTableMeta(table: { id: number; name?: string }): TableMetadata {
  if (!table) {
    return { floor: "Ground Floor", is_ac: false, ac_charge: 50 };
  }
  const all = getAllTablesMeta();
  const found = all[table.id] || (table.name ? all[table.name] : undefined);
  if (found) {
    return {
      floor: found.floor || "Ground Floor",
      is_ac: Boolean(found.is_ac),
      ac_charge: typeof found.ac_charge === "number" ? found.ac_charge : 50,
    };
  }

  // Graceful fallback heuristic from name if legacy table
  const name = (table.name || "").toLowerCase();
  let floor = "Ground Floor";
  if (name.includes("f1") || name.includes("first") || name.includes("1st")) floor = "1st Floor";
  else if (name.includes("f2") || name.includes("second") || name.includes("2nd")) floor = "2nd Floor";
  else if (name.includes("roof") || name.includes("terrace")) floor = "Rooftop";
  else if (name.includes("patio") || name.includes("outdoor") || name.includes("garden")) floor = "Outdoor Patio";

  const is_ac = name.includes("ac") || name.includes("vip");
  return {
    floor,
    is_ac,
    ac_charge: 50,
  };
}

export function saveTableMeta(tableId: number, meta: Partial<TableMetadata>, tableName?: string) {
  try {
    const all = getAllTablesMeta();
    const existing = all[tableId] || (tableName ? all[tableName] : undefined) || {
      floor: "Ground Floor",
      is_ac: false,
      ac_charge: 50,
    };
    const updated: TableMetadata = {
      ...existing,
      ...meta,
    };
    all[tableId] = updated;
    if (tableName) {
      all[tableName] = updated;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("table-meta-updated", { detail: { tableId, meta: updated } }));
  } catch (e) {
    console.error("Failed to save table meta:", e);
  }
}

export function deleteTableMeta(tableId: number, tableName?: string) {
  try {
    const all = getAllTablesMeta();
    delete all[tableId];
    if (tableName) delete all[tableName];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("table-meta-updated", { detail: { tableId, deleted: true } }));
  } catch (e) {
    console.error("Failed to delete table meta:", e);
  }
}

