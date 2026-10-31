// Customer grouping and name normalization engine for Tissue Ledger
// Intelligently normalizes customer names, extracts item/variant notes,
// and ensures duplicate customer cards are never created for existing or new clients.

export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word === "&" || word === "and") return "&";
      if (word === "of" || word === "in" || word === "at") return word;
      if (word === "ii" || word === "iii") return word.toUpperCase();
      if (word === "co" || word === "co.") return "Co";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Universal extractor for item/product notes appended to customer notes.
 * Extracts items like (spoon), (fork), napkin, straw, etc.
 * @param {string} raw
 * @returns {{ cleanedCustomer: string, extractedItem: string }}
 */
function extractItemNote(raw) {
  let text = (raw || "").trim();
  let item = "";

  // 1. Check parenthesized item note: e.g. "Sufi Palace ( fork)", "Shiraj (straw)"
  const parenMatch = text.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parenMatch[1].trim();
    // Only treat as item if it's not a known branch/area location
    if (!/diamond\s*city|park\s*street|ballygunge|kestopur|kankurgachi|kakurgachi|bangur|theatre\s*road|ultadanga/i.test(inside)) {
      item = capitalize(inside);
      text = text.replace(/\([^)]+\)/g, "").trim();
    }
  }

  // 2. Check suffix item terms: e.g. "Sufi Palace spoon", "Chef maxilogist napkin"
  const suffixPattern = /\b(spoon|spoons|fork|forks|straw|straws|napkin|napkins|tissue roll|toilet tissue|tissue|roll|rolls|cup|cups)\b$/i;
  const suffixMatch = text.match(suffixPattern);
  if (suffixMatch) {
    if (!item) item = capitalize(suffixMatch[1].trim());
    text = text.replace(suffixPattern, "").trim();
  }

  // Clean trailing punctuation / dashes
  text = text.replace(/[\s\-_–—]+$/, "").trim();
  return { cleanedCustomer: text, extractedItem: item };
}

/**
 * Known canonical mappings for existing ledger businesses with specific branch or spelling rules.
 */
const CANONICAL_MAPPINGS = [
  // Aami Bengali branches
  { test: /^(?:aami|ami)\s+(?:bangla|bengali).*diamond\s*city/i, canonical: "Aami Bengali (Diamond City)" },
  { test: /^(?:aami|ami)\s+(?:bangla|bengali).*park\s*street/i, canonical: "Aami Bengali (Park Street)" },
  { test: /^(?:aami|ami)\s+(?:bangla|bengali)$/i, canonical: "Aami Bengali" },

  // Karla
  { test: /^karla$/i, canonical: "Karla" },

  // Aanand Restaurant / Anand
  { test: /^a*nand(\s+restaurant)?$/i, canonical: "Aanand Restaurant" },

  // Gupta Brothers Ballygunge
  { test: /^gupta\s+brother(s)?(\s*\(?ballygunge\)?)?$/i, canonical: "Gupta Brothers (Ballygunge)" },

  // Gupta Veg Kestopur
  { test: /^gupta\s+veg(\s*\(?kestopur\)?)?$/i, canonical: "Gupta Veg (Kestopur)" },

  // Sufi Palace
  { test: /^sufi\s+palace$/i, canonical: "Sufi Palace" },

  // Shiraj Restaurant / Siraj
  { test: /^(?:shiraj|siraj)(\s+restaurant)?$/i, canonical: "Shiraj Restaurant" },

  // Chef Maxilogist / Mexilogist
  { test: /^(?:chef\s+)?m[ae]xilogist$/i, canonical: "Chef Maxilogist" },

  // Sanjeev Drolia (Bangur)
  { test: /^sanjeev\s+drolia(\s+bangur)?$/i, canonical: "Sanjeev Drolia (Bangur)" },

  // Rajasthan Guest House vs Rajasthan Bhojnalaya
  { test: /^rajasthan\s+guest\s*house$/i, canonical: "Rajasthan Guest House" },
  { test: /^rajasthan\s+bhojnalaya$/i, canonical: "Rajasthan Bhojnalaya" },

  // New Nasta vs Nasta Kankurgachi
  { test: /^nasta\s+ka[n]?kurgachi$/i, canonical: "Nasta (Kankurgachi)" },
  { test: /^(?:new\s+nasta|nasta)$/i, canonical: "New Nasta" },

  // Zuca
  { test: /^zuca$/i, canonical: "Zuca" },

  // Peturam Restaurant Ultadanga
  { test: /^peturam(\s+restaurant)?(\s+ultadanga)?$/i, canonical: "Peturam Restaurant (Ultadanga)" },

  // Sandwich Bastalla
  { test: /^sandwich\s+bastalla$/i, canonical: "Sandwich Bastalla" },

  // Zuddu Theatre Road
  { test: /^zuddu(\s+theatre\s*road)?$/i, canonical: "Zuddu (Theatre Road)" },

  // Choudhary and Company
  { test: /^choudhary(\s+(?:and|&)\s*co(?:mpany)?)?$/i, canonical: "Choudhary & Co" },

  // Agarwala Pav Bhaji
  { test: /^agarwala(\s+pav\s*bhaji)?$/i, canonical: "Agarwala Pav Bhaji" },

  // Honey Dhaba
  { test: /^honey\s+dhaba$/i, canonical: "Honey Dhaba" },

  // Mintu Shaw
  { test: /^mintu\s+shaw$/i, canonical: "Mintu Shaw" },

  // Kaka Tea
  { test: /^kaka\s+tea$/i, canonical: "Kaka Tea" },

  // Urban Masala
  { test: /^urban\s+masala$/i, canonical: "Urban Masala" },

  // Veg Dhaba
  { test: /^veg\s+dhaba$/i, canonical: "Veg Dhaba" },

  // Mark Hotel
  { test: /^mark\s+hotel$/i, canonical: "Mark Hotel" },

  // Hotel Saad
  { test: /^hotel\s+saad$/i, canonical: "Hotel Saad" },

  // Jamuna Banquet
  { test: /^jamuna\s+banquet$/i, canonical: "Jamuna Banquet" },

  // Bika
  { test: /^bika$/i, canonical: "Bika" },

  // Khana Khazana
  { test: /^khana\s+khazana$/i, canonical: "Khana Khazana" },

  // Maya Ram
  { test: /^maya\s*ram$/i, canonical: "Maya Ram" },

  // God Father
  { test: /^god\s*father$/i, canonical: "God Father" },

  // Machua
  { test: /^machua$/i, canonical: "Machua" },

  // Pepper
  { test: /^pepper$/i, canonical: "Pepper" },

  // Plush 28
  { test: /^plush\s*28$/i, canonical: "Plush 28" },

  // Cafe Florista
  { test: /^cafe\s+florista$/i, canonical: "Cafe Florista" },

  // Gopala Restaurant
  { test: /^gopala(\s+restaurant)?$/i, canonical: "Gopala Restaurant" },

  // Ganesh Maharaj
  { test: /^ganesh\s+maharaj$/i, canonical: "Ganesh Maharaj" },

  // Bhai Bhai
  { test: /^bhai\s+bhai$/i, canonical: "Bhai Bhai" },
];

/**
 * Normalizes an order note string into a canonical customer name and extracted item/variant detail.
 * Ensures case variations, extra spaces, and item suffixes never create duplicate customer cards.
 *
 * @param {string} rawNote - Raw note from order
 * @param {Array<string>} [knownCustomerNames] - Optional list of existing canonical customer names
 * @returns {{ customer: string, item: string, raw: string, isDirect: boolean }}
 */
export function normalizeCustomer(rawNote, knownCustomerNames = []) {
  const raw = (rawNote || "").trim();
  if (!raw) {
    return {
      customer: "Direct / Walk-in Cash Sales",
      item: "",
      raw: "",
      isDirect: true,
    };
  }

  // 1. Separate item suffixes or parenthesized item notes
  const { cleanedCustomer, extractedItem } = extractItemNote(raw);
  const candidate = cleanedCustomer || raw;

  // 2. Match against known canonical mapping rules
  for (const rule of CANONICAL_MAPPINGS) {
    if (rule.test.test(candidate)) {
      return {
        customer: rule.canonical,
        item: extractedItem,
        raw,
        isDirect: false,
      };
    }
  }

  // 3. Match case-insensitively against any existing canonical customer names in the ledger
  if (Array.isArray(knownCustomerNames) && knownCustomerNames.length > 0) {
    const candidateLower = candidate.toLowerCase();
    const existingMatch = knownCustomerNames.find(
      (name) => name.toLowerCase() === candidateLower || name.toLowerCase().replace(/[^a-z0-9]/g, "") === candidateLower.replace(/[^a-z0-9]/g, "")
    );
    if (existingMatch) {
      return {
        customer: existingMatch,
        item: extractedItem,
        raw,
        isDirect: false,
      };
    }
  }

  // 4. Default for any new customer: clean title-casing
  // Retains branch parenthesis like "(Park Street)" or "(Diamond City)" if present
  let formatted = toTitleCase(candidate);
  // Restore common capitalized patterns in parentheses
  formatted = formatted.replace(/\(([^)]+)\)/g, (_, inner) => `(${toTitleCase(inner)})`);

  return {
    customer: formatted,
    item: extractedItem,
    raw,
    isDirect: false,
  };
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
 * Automatically normalizes customer names across the entire dataset.
 *
 * @param {Array} orders - List of order objects
 * @returns {Array} List of customer summary objects
 */
export function groupOrdersByCustomer(orders) {
  const customerMap = new Map();
  const knownNames = [];

  for (const order of orders) {
    const { customer, item, isDirect } = normalizeCustomer(order.notes, knownNames);
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
        items: new Set(),
        orders: [],
        lastOrderDate: order.orderDate,
        firstOrderDate: order.orderDate,
      });
      if (!isDirect && !knownNames.includes(customer)) {
        knownNames.push(customer);
      }
    }

    const group = customerMap.get(customer);
    group.ordersCount += 1;
    group.totalQuantity += figures.quantity;
    group.totalSales += figures.sales;
    group.totalStockCost += figures.stockCost;
    group.totalNet += figures.net;
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
