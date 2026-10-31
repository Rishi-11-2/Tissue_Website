// Customer grouping and name normalization engine for Tissue Ledger
// Intelligently merges variant spellings, locations, and item descriptions into clean customer profiles.

export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word === "&" || word === "and") return "&";
      if (word === "of" || word === "in" || word === "at") return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/\b(Co)\b/gi, "Co")
    .replace(/\b(Ii)\b/gi, "II");
}

/**
 * Normalizes a note string into a canonical customer name and extracted item/variant detail.
 * @param {string} rawNote - Raw note from order
 * @returns {{ customer: string, item: string, raw: string, isDirect: boolean }}
 */
export function normalizeCustomer(rawNote) {
  const raw = (rawNote || "").trim();
  if (!raw) {
    return {
      customer: "Direct / Walk-in Cash Sales",
      item: "",
      raw: "",
      isDirect: true,
    };
  }

  // 1. Aami Bengali / Aami Bangla variants
  if (/^(?:aami|ami)\s+(?:bangla|bengali)/i.test(raw)) {
    if (/diamond\s*city/i.test(raw)) {
      return { customer: "Aami Bengali (Diamond City)", item: "", raw, isDirect: false };
    }
    if (/park\s*street/i.test(raw)) {
      return { customer: "Aami Bengali (Park Street)", item: "", raw, isDirect: false };
    }
    return { customer: "Aami Bengali", item: "", raw, isDirect: false };
  }

  // 2. Karla / KarlA
  if (/^karla$/i.test(raw)) {
    return { customer: "Karla", item: "", raw, isDirect: false };
  }

  // 3. Aanand / Anand / Aanand restaurant
  if (/^a*nand(\s+restaurant)?$/i.test(raw)) {
    return { customer: "Aanand Restaurant", item: "", raw, isDirect: false };
  }

  // 4. Gupta Brothers Ballygunge / Gupta brother / Gupta brother (Ballygunge)
  if (/gupta\s+brother/i.test(raw)) {
    return { customer: "Gupta Brothers (Ballygunge)", item: "", raw, isDirect: false };
  }

  // 5. Gupta Veg Kestopur
  if (/gupta\s+veg/i.test(raw)) {
    return { customer: "Gupta Veg (Kestopur)", item: "", raw, isDirect: false };
  }

  // 6. Sufi Palace / Sufi palace / spoon / fork
  if (/sufi\s+palace/i.test(raw)) {
    const itemMatch = raw.match(/(?:spoon|fork)/i);
    const item = itemMatch ? capitalize(itemMatch[0]) : "";
    return { customer: "Sufi Palace", item, raw, isDirect: false };
  }

  // 7. Shiraj Restaurant / Siraj / straw / fork / spoon
  if (/^(?:shiraj|siraj)/i.test(raw)) {
    let item = "";
    const parenMatch = raw.match(/\(([^)]+)\)/);
    if (parenMatch) {
      item = capitalize(parenMatch[1].trim());
    } else {
      const itemMatch = raw.match(/(?:straw|fork|spoon)/i);
      if (itemMatch) item = capitalize(itemMatch[0]);
    }
    return { customer: "Shiraj Restaurant", item, raw, isDirect: false };
  }

  // 8. Chef Maxilogist / Mexilogist / napkin / tissue roll
  if (/(?:chef\s+)?maxilogist|mexilogist/i.test(raw)) {
    let item = "";
    if (/napkin/i.test(raw)) item = "Napkin";
    else if (/tissue\s*roll/i.test(raw)) item = "Tissue Roll";
    return { customer: "Chef Maxilogist", item, raw, isDirect: false };
  }

  // 9. Sanjeev Drolia / Sanjeev drolia bangur
  if (/sanjeev\s+drolia/i.test(raw)) {
    return { customer: "Sanjeev Drolia (Bangur)", item: "", raw, isDirect: false };
  }

  // 10. Rajasthan Guest House vs Rajasthan Bhojnalaya
  if (/rajasthan\s+guest\s*house/i.test(raw)) {
    return { customer: "Rajasthan Guest House", item: "", raw, isDirect: false };
  }
  if (/rajasthan\s+bhojnalaya/i.test(raw)) {
    return { customer: "Rajasthan Bhojnalaya", item: "", raw, isDirect: false };
  }

  // 11. New Nasta / Nasta / Nasta kakurgachi
  if (/nasta\s+kakurgachi/i.test(raw)) {
    return { customer: "Nasta (Kankurgachi)", item: "", raw, isDirect: false };
  }
  if (/^(?:new\s+nasta|nasta)$/i.test(raw)) {
    return { customer: "New Nasta", item: "", raw, isDirect: false };
  }

  // 12. Zuca( toilet tissue)
  if (/zuca/i.test(raw)) {
    return { customer: "Zuca", item: "Toilet Tissue", raw, isDirect: false };
  }

  // 13. Peturam restaurant Ultadanga
  if (/peturam/i.test(raw)) {
    return { customer: "Peturam Restaurant (Ultadanga)", item: "", raw, isDirect: false };
  }

  // 14. Sandwich bastalla
  if (/sandwich\s+bastalla/i.test(raw)) {
    return { customer: "Sandwich Bastalla", item: "", raw, isDirect: false };
  }

  // 15. Zuddu theatre road
  if (/zuddu/i.test(raw)) {
    return { customer: "Zuddu (Theatre Road)", item: "", raw, isDirect: false };
  }

  // 16. Choudhary and company
  if (/choudhary/i.test(raw)) {
    return { customer: "Choudhary & Co", item: "", raw, isDirect: false };
  }

  // 17. Agarwala pav bhaji
  if (/agarwala/i.test(raw)) {
    return { customer: "Agarwala Pav Bhaji", item: "", raw, isDirect: false };
  }

  // Fallback: extract any item in parenthesis and clean customer name
  const parenMatch = raw.match(/\(([^)]+)\)/);
  const item = parenMatch ? capitalize(parenMatch[1].trim()) : "";
  const cleaned = raw.replace(/\([^)]+\)/g, "").trim();
  return { customer: toTitleCase(cleaned), item, raw, isDirect: false };
}

/**
 * Calculates order financial figures.
 */
export function calculateOrderFigures(order) {
  const quantity = Number.parseFloat(order.quantity) || 0;
  const buyingPrice = Number.parseFloat(order.buyingPrice) || 0;
  const sellingPrice = Number.parseFloat(order.sellingPrice) || 0;
  const sales = quantity * sellingPrice;
  const stockCost = quantity * buyingPrice;
  const net = sales - stockCost;
  const margin = sales > 0 ? (net / sales) * 100 : 0;
  return { quantity, buyingPrice, sellingPrice, sales, stockCost, net, margin };
}

/**
 * Groups orders by canonical customer name.
 * @param {Array} orders - List of order objects
 * @returns {Array} List of customer summary objects
 */
export function groupOrdersByCustomer(orders) {
  const customerMap = new Map();

  for (const order of orders) {
    const { customer, item, isDirect } = normalizeCustomer(order.notes);
    const figures = calculateOrderFigures(order);

    if (!customerMap.has(customer)) {
      customerMap.set(customer, {
        customer,
        isDirect: Boolean(isDirect),
        ordersCount: 0,
        totalQuantity: 0,
        totalSales: 0,
        totalStockCost: 0,
        totalNet: 0,
        margin: 0,
        variants: new Set(),
        items: new Set(),
        orders: [],
        lastOrderDate: order.orderDate,
        firstOrderDate: order.orderDate,
      });
    }

    const group = customerMap.get(customer);
    group.ordersCount += 1;
    group.totalQuantity += figures.quantity;
    group.totalSales += figures.sales;
    group.totalStockCost += figures.stockCost;
    group.totalNet += figures.net;
    if (order.notes) group.variants.add(order.notes.trim());
    if (item) group.items.add(item);
    group.orders.push({ ...order, ...figures, customerName: customer, itemDetail: item });

    if (order.orderDate > group.lastOrderDate) group.lastOrderDate = order.orderDate;
    if (order.orderDate < group.firstOrderDate) group.firstOrderDate = order.orderDate;
  }

  // Calculate margins, sort orders, convert sets
  const result = [];
  for (const group of customerMap.values()) {
    group.margin = group.totalSales > 0 ? (group.totalNet / group.totalSales) * 100 : 0;
    group.avgOrderValue = group.ordersCount > 0 ? group.totalSales / group.ordersCount : 0;
    group.variantsList = Array.from(group.variants);
    group.itemsList = Array.from(group.items);
    // Sort transactions inside each customer newest first
    group.orders.sort((a, b) => b.orderDate.localeCompare(a.orderDate) || (b.createdAt || "").localeCompare(a.createdAt || ""));
    result.push(group);
  }

  return result;
}

/**
 * Generates an avatar gradient based on string hash.
 */
export function getAvatarColor(name) {
  const colors = [
    { bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)", text: "#ffffff" },
    { bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)", text: "#ffffff" },
    { bg: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", text: "#ffffff" },
    { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", text: "#ffffff" },
    { bg: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", text: "#ffffff" },
    { bg: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)", text: "#ffffff" },
    { bg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", text: "#ffffff" },
    { bg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", text: "#ffffff" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Gets initials from customer name.
 */
export function getInitials(name) {
  if (!name) return "TL";
  if (name.includes("Direct / Walk-in")) return "💵";
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
