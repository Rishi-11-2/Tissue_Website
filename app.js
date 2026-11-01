import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js?v=20261101_3";
import { SEED_ORDERS, SEED_PETROL, SEED_MANUFACTURER_PAYMENTS } from "./seed-data.js?v=20261101_3";
import {
  normalizeCustomer,
  groupOrdersByCustomer,
  calculateOrderFigures,
  getAvatarColor,
  getInitials,
} from "./customer-ledger.js?v=20261101_3";

const DB_NAME = "tissue-ledger-db";
const DB_VERSION = 3;
const ORDER_STORE = "orders";
const PETROL_STORE = "petrol-expenses";
const MANUFACTURER_PAYMENT_STORE = "manufacturer-payments";
const CURRENCY = "INR";
const cloudConfigured = Boolean(SUPABASE_URL?.startsWith("https://") && SUPABASE_PUBLISHABLE_KEY?.trim());

const formatCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const formatNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// DOM Elements
const elements = {
  // Order Form
  form: document.querySelector("#order-form"),
  formTitle: document.querySelector("#form-title"),
  orderId: document.querySelector("#order-id"),
  orderDate: document.querySelector("#order-date"),
  quantity: document.querySelector("#quantity"),
  buyingPrice: document.querySelector("#buying-price"),
  sellingPrice: document.querySelector("#selling-price"),
  notes: document.querySelector("#notes"),
  customerSuggestions: document.querySelector("#customer-suggestions"),
  quickCustomerChips: document.querySelector("#quick-customer-chips"),
  previewSales: document.querySelector("#preview-sales"),
  previewStockCost: document.querySelector("#preview-stock-cost"),
  previewNet: document.querySelector("#preview-net"),
  saveButton: document.querySelector("#save-button"),
  cancelEdit: document.querySelector("#cancel-edit"),
  formMessage: document.querySelector("#form-message"),

  // Orders Ledger
  ordersBody: document.querySelector("#orders-body"),
  emptyState: document.querySelector("#empty-state"),
  search: document.querySelector("#search-orders"),
  sort: document.querySelector("#sort-orders"),
  filterOrderCustomer: document.querySelector("#filter-order-customer"),

  // Summary Cards
  totalSales: document.querySelector("#total-sales"),
  salesCount: document.querySelector("#sales-count"),
  netProfit: document.querySelector("#net-profit"),
  manufacturerDueTotal: document.querySelector("#manufacturer-due"),
  profitMargin: document.querySelector("#profit-margin"),
  avgOrderBadge: document.querySelector("#avg-order-badge"),
  petrolDeductedBadge: document.querySelector("#petrol-deducted-badge"),
  dueStatusBadge: document.querySelector("#due-status-badge"),
  mfgPaidSummaryBadge: document.querySelector("#mfg-paid-summary-badge"),
  petrolCountBadge: document.querySelector("#petrol-count-badge"),
  exportButton: document.querySelector("#export-button"),
  toast: document.querySelector("#toast"),

  // Petrol Form & Table
  petrolForm: document.querySelector("#petrol-form"),
  petrolFormTitle: document.querySelector("#petrol-form-title"),
  petrolId: document.querySelector("#petrol-id"),
  petrolDate: document.querySelector("#petrol-date"),
  petrolAmount: document.querySelector("#petrol-amount"),
  petrolNotes: document.querySelector("#petrol-notes"),
  savePetrolButton: document.querySelector("#save-petrol-button"),
  cancelPetrolEdit: document.querySelector("#cancel-petrol-edit"),
  petrolFormMessage: document.querySelector("#petrol-form-message"),
  petrolBody: document.querySelector("#petrol-body"),
  petrolEmptyState: document.querySelector("#petrol-empty-state"),
  totalPetrol: document.querySelector("#total-petrol"),
  totalPetrolPanel: document.querySelector("#total-petrol-panel"),

  // Manufacturer Payment Form & Table
  manufacturerPaymentForm: document.querySelector("#manufacturer-payment-form"),
  manufacturerFormTitle: document.querySelector("#manufacturer-form-title"),
  manufacturerPaymentId: document.querySelector("#manufacturer-payment-id"),
  manufacturerPaymentDate: document.querySelector("#manufacturer-payment-date"),
  manufacturerPaymentAmount: document.querySelector("#manufacturer-payment-amount"),
  manufacturerPaymentNotes: document.querySelector("#manufacturer-payment-notes"),
  saveManufacturerPaymentButton: document.querySelector("#save-manufacturer-payment-button"),
  cancelManufacturerPaymentEdit: document.querySelector("#cancel-manufacturer-payment-edit"),
  manufacturerPaymentFormMessage: document.querySelector("#manufacturer-payment-form-message"),
  manufacturerPaymentsBody: document.querySelector("#manufacturer-payments-body"),
  manufacturerPaymentsEmptyState: document.querySelector("#manufacturer-payments-empty-state"),
  totalManufacturerPaid: document.querySelector("#total-manufacturer-paid"),

  // Cloud Sync
  accountButton: document.querySelector("#account-button"),
  syncStatusLabel: document.querySelector("#sync-status-label"),
  syncPanel: document.querySelector("#sync-panel"),
  syncTitle: document.querySelector("#sync-title"),
  syncDescription: document.querySelector("#sync-description"),
  signInForm: document.querySelector("#sign-in-form"),
  signInEmail: document.querySelector("#sign-in-email"),
  signInButton: document.querySelector("#sign-in-button"),
  otpForm: document.querySelector("#otp-form"),
  otpCode: document.querySelector("#otp-code"),
  otpEmailLabel: document.querySelector("#otp-email-label"),
  verifyOtpButton: document.querySelector("#verify-otp-button"),
  resendOtpCode: document.querySelector("#resend-otp-code"),
  useDifferentEmail: document.querySelector("#use-different-email"),
  signedInActions: document.querySelector("#signed-in-actions"),
  syncNowButton: document.querySelector("#sync-now-button"),
  signOutButton: document.querySelector("#sign-out-button"),
  syncMessage: document.querySelector("#sync-message"),

  // Navigation Tabs
  tabBtnCustomers: document.querySelector("#tab-btn-customers"),
  tabBtnOrders: document.querySelector("#tab-btn-orders"),
  tabBtnManufacturer: document.querySelector("#tab-btn-manufacturer"),
  tabBtnPetrol: document.querySelector("#tab-btn-petrol"),
  customersTabCount: document.querySelector("#customers-tab-count"),
  ordersTabCount: document.querySelector("#orders-tab-count"),
  mfgTabCount: document.querySelector("#mfg-tab-count"),
  petrolTabCount: document.querySelector("#petrol-tab-count"),

  // Views
  viewCustomers: document.querySelector("#view-customers"),
  viewOrders: document.querySelector("#view-orders"),
  viewManufacturer: document.querySelector("#view-manufacturer"),
  viewPetrol: document.querySelector("#view-petrol"),

  // Customer View specific
  customerSearch: document.querySelector("#customer-search"),
  customerSort: document.querySelector("#customer-sort"),
  customerGrid: document.querySelector("#customer-grid"),
  customerEmptyState: document.querySelector("#customer-empty-state"),

  // Buttons & Modals
  openOrderFormBtn: document.querySelector("#open-order-form-btn"),
  quickAddOrderBtn: document.querySelector("#quick-add-order-btn"),
  dataToolsButton: document.querySelector("#data-tools-button"),
  dataToolsModal: document.querySelector("#data-tools-modal"),
  closeToolsModal: document.querySelector("#close-tools-modal"),
  closeToolsModalFooter: document.querySelector("#close-tools-modal-footer"),
  downloadJsonBackupBtn: document.querySelector("#download-json-backup-btn"),
  downloadExcelBtn: document.querySelector("#download-excel-btn"),
  importJsonFile: document.querySelector("#import-json-file"),
  reloadSeedDataBtn: document.querySelector("#reload-seed-data-btn"),
};

// Application State
let orders = [];
let petrolExpenses = [];
let manufacturerPayments = [];
let supabase = null;
let currentUser = null;
let isSyncing = false;
let pendingEmail = "";
let toastTimer;
let activeTab = "customers";
const expandedCustomerCards = new Set();

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatSignedCurrency(value) {
  return value < 0 ? `−${formatCurrency.format(Math.abs(value))}` : formatCurrency.format(value);
}

function displayDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));
}

// IndexedDB Storage
let dbPromise = null;
function getDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ORDER_STORE)) {
          const store = db.createObjectStore(ORDER_STORE, { keyPath: "id" });
          store.createIndex("orderDate", "orderDate", { unique: false });
        }
        if (!db.objectStoreNames.contains(PETROL_STORE)) {
          const store = db.createObjectStore(PETROL_STORE, { keyPath: "id" });
          store.createIndex("expenseDate", "expenseDate", { unique: false });
        }
        if (!db.objectStoreNames.contains(MANUFACTURER_PAYMENT_STORE)) {
          const store = db.createObjectStore(MANUFACTURER_PAYMENT_STORE, { keyPath: "id" });
          store.createIndex("paymentDate", "paymentDate", { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
    });
  }
  return dbPromise;
}

async function useStore(storeName, mode, callback) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = callback(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

const getAllLocal = (storeName) => useStore(storeName, "readonly", (store) => store.getAll());
const saveLocal = (storeName, record) => useStore(storeName, "readwrite", (store) => store.put(record));
const deleteLocal = (storeName, id) => useStore(storeName, "readwrite", (store) => store.delete(id));
const clearLocalStore = (storeName) => useStore(storeName, "readwrite", (store) => store.clear());

async function saveLocalBatch(storeName, records) {
  if (!records || records.length === 0) return;
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const record of records) {
      store.put(record);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
  });
}

async function deleteLocalBatch(storeName, ids) {
  if (!ids || ids.length === 0) return;
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const id of ids) {
      store.delete(id);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
  });
}

function storeForKind(kind) {
  return ({ order: ORDER_STORE, petrol: PETROL_STORE, manufacturerPayment: MANUFACTURER_PAYMENT_STORE })[kind];
}

function tableForKind(kind) {
  return ({ order: "orders", petrol: "petrol_expenses", manufacturerPayment: "manufacturer_payments" })[kind];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === "string" && UUID_REGEX.test(id);
}

function mapLegacyIdToUuid(id, prefix, hexPrefix) {
  if (typeof id === "string" && id.startsWith(prefix)) {
    const num = parseInt(id.replace(prefix, ""), 10);
    if (!isNaN(num) && num > 0) {
      return `${hexPrefix}0000000-0000-4000-8000-${String(num).padStart(12, "0")}`;
    }
  }
  return null;
}

async function sanitizeStoreUuids(storeName, prefix, hexPrefix) {
  try {
    const records = await getAllLocal(storeName);
    const toDelete = [];
    const toSave = [];
    for (const record of records) {
      if (!isValidUuid(record.id)) {
        toDelete.push(record.id);
        const mappedUuid = mapLegacyIdToUuid(record.id, prefix, hexPrefix);
        record.id = mappedUuid || crypto.randomUUID();
        toSave.push(record);
      }
    }
    if (toDelete.length > 0) {
      await deleteLocalBatch(storeName, toDelete);
    }
    if (toSave.length > 0) {
      await saveLocalBatch(storeName, toSave);
    }
  } catch (err) {
    console.warn("Could not sanitize store UUIDs:", storeName, err);
  }
}

function isVisibleToCurrentLedger(record) {
  if (!cloudConfigured || !currentUser) {
    return true;
  }
  return !record.userId || record.userId === currentUser.id;
}

const SEED_VERSION_KEY = "tissue_ledger_seed_version";
const CURRENT_SEED_VERSION = "2026-11-01-v272-final";

/**
 * Loads records from IndexedDB. If local database is empty or has older seed,
 * safely populates with the master ledger (272 orders, 14 petrol, 19 mfg payments)
 * so there is NEVER any data loss!
 */
async function loadLocalLedger() {
  // First sanitize any legacy non-UUID IDs in IndexedDB
  await Promise.all([
    sanitizeStoreUuids(ORDER_STORE, "ord_", "a"),
    sanitizeStoreUuids(PETROL_STORE, "pet_", "b"),
    sanitizeStoreUuids(MANUFACTURER_PAYMENT_STORE, "mfg_", "c"),
  ]);

  const [storedOrders, storedPetrol, storedManufacturerPayments] = await Promise.all([
    getAllLocal(ORDER_STORE),
    getAllLocal(PETROL_STORE),
    getAllLocal(MANUFACTURER_PAYMENT_STORE),
  ]);

  const localSeedVersion = localStorage.getItem(SEED_VERSION_KEY);

  // If local store has older data or is empty, ensure the latest 272 master records are loaded
  if (localSeedVersion !== CURRENT_SEED_VERSION || storedOrders.length === 0) {
    if (!currentUser) {
      const existingOrderIds = new Set(storedOrders.map((o) => o.id));
      const ordersToInsert = SEED_ORDERS.filter((o) => !existingOrderIds.has(o.id));

      const existingPetrolIds = new Set(storedPetrol.map((p) => p.id));
      const petrolToInsert = SEED_PETROL.filter((p) => !existingPetrolIds.has(p.id));

      const existingMfgIds = new Set(storedManufacturerPayments.map((m) => m.id));
      const mfgToInsert = SEED_MANUFACTURER_PAYMENTS.filter((m) => !existingMfgIds.has(m.id));

      if (storedOrders.length === 0) {
        await saveLocalBatch(ORDER_STORE, SEED_ORDERS);
        await saveLocalBatch(PETROL_STORE, SEED_PETROL);
        await saveLocalBatch(MANUFACTURER_PAYMENT_STORE, SEED_MANUFACTURER_PAYMENTS);
      } else {
        if (ordersToInsert.length > 0) await saveLocalBatch(ORDER_STORE, ordersToInsert);
        if (petrolToInsert.length > 0) await saveLocalBatch(PETROL_STORE, petrolToInsert);
        if (mfgToInsert.length > 0) await saveLocalBatch(MANUFACTURER_PAYMENT_STORE, mfgToInsert);
      }
    }
    localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION);
  }

  const [currentOrders, currentPetrol, currentMfg] = await Promise.all([
    getAllLocal(ORDER_STORE),
    getAllLocal(PETROL_STORE),
    getAllLocal(MANUFACTURER_PAYMENT_STORE),
  ]);

  orders = currentOrders.filter(isVisibleToCurrentLedger);
  petrolExpenses = currentPetrol.filter(isVisibleToCurrentLedger);
  manufacturerPayments = currentMfg.filter(isVisibleToCurrentLedger);

  updateCustomerDatalist();
  render();
}

function setFormMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setSyncMessage(message, isError = false) {
  setFormMessage(elements.syncMessage, message, isError);
}

function updateSyncUi() {
  const dot = elements.accountButton.querySelector(".status-dot");
  dot.classList.remove("pending", "offline");
  if (!cloudConfigured) {
    elements.syncStatusLabel.textContent = "Local ledger";
    dot.classList.add("offline");
    elements.syncTitle.textContent = "Connect your ledger across every phone.";
    elements.syncDescription.textContent = "This site is ready for free cloud sync. Add the Supabase project values in supabase-config.js.";
    elements.signInForm.classList.add("hidden");
    elements.otpForm.classList.add("hidden");
    elements.signedInActions.classList.add("hidden");
  } else if (!currentUser) {
    elements.syncStatusLabel.textContent = "Sign in to sync";
    dot.classList.add("pending");
    elements.syncTitle.textContent = "Sign in to sync every phone.";
    elements.syncDescription.textContent = "Use the same email address on each mobile. We will send a secure sign-in code.";
    elements.signInForm.classList.toggle("hidden", Boolean(pendingEmail));
    elements.otpForm.classList.toggle("hidden", !pendingEmail);
    if (pendingEmail) elements.otpEmailLabel.textContent = pendingEmail;
    elements.signedInActions.classList.add("hidden");
  } else {
    elements.syncStatusLabel.textContent = "Cloud sync active";
    elements.syncTitle.textContent = "Your ledger is syncing securely.";
    elements.syncDescription.textContent = `Signed in as ${currentUser.email || "your account"}. Cross-device sync is live.`;
    elements.signInForm.classList.add("hidden");
    elements.otpForm.classList.add("hidden");
    elements.signedInActions.classList.remove("hidden");
  }
}

function updateCustomerDatalist() {
  const customerGroups = groupOrdersByCustomer(orders);
  const names = customerGroups.map((g) => g.customer).filter((n) => !n.includes("Direct / Walk-in"));
  names.sort((a, b) => a.localeCompare(b));

  if (elements.customerSuggestions) {
    elements.customerSuggestions.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
  }

  // Populate top frequent customer chips for rapid one-tap entry
  if (elements.quickCustomerChips) {
    const topCustomers = [...customerGroups]
      .filter((g) => !g.isDirect)
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 8);
    elements.quickCustomerChips.innerHTML = topCustomers
      .map(
        (g) =>
          `<button type="button" class="customer-chip-pill" data-fill-customer="${escapeHtml(g.customer)}">${escapeHtml(g.customer)}</button>`
      )
      .join("");
  }

  // Also update filter dropdown in Orders view
  const currentVal = elements.filterOrderCustomer.value;
  elements.filterOrderCustomer.innerHTML = '<option value="">All Customers</option>' +
    names.map((name) => `<option value="${escapeHtml(name)}" ${name === currentVal ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
}

function getFilteredOrders() {
  const query = elements.search.value.trim().toLowerCase();
  const customerFilter = elements.filterOrderCustomer.value.trim();

  const filtered = orders.filter((order) => {
    const { customer, item } = normalizeCustomer(order.notes);
    if (customerFilter && customer !== customerFilter) return false;
    if (!query) return true;
    return [order.orderDate, order.notes, customer, item].some((val) =>
      String(val || "").toLowerCase().includes(query)
    );
  });

  return filtered.sort((a, b) => {
    const sortVal = elements.sort.value;
    if (sortVal === "oldest") return a.orderDate.localeCompare(b.orderDate);
    if (sortVal === "profit-high") return calculateOrderFigures(b).net - calculateOrderFigures(a).net;
    if (sortVal === "profit-low") return calculateOrderFigures(a).net - calculateOrderFigures(b).net;
    if (sortVal === "sales-high") return calculateOrderFigures(b).sales - calculateOrderFigures(a).sales;
    if (sortVal === "qty-high") return toNumber(b.quantity) - toNumber(a.quantity);
    return b.orderDate.localeCompare(a.orderDate) || (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function renderSummary() {
  const orderTotals = orders.reduce(
    (result, order) => {
      const figures = calculateOrderFigures(order);
      result.sales += figures.sales;
      result.stock += figures.stockCost;
      return result;
    },
    { sales: 0, stock: 0 }
  );

  const petrolTotal = petrolExpenses.reduce((sum, exp) => sum + toNumber(exp.amount), 0);
  const manufacturerPaid = manufacturerPayments.reduce((sum, pmt) => sum + toNumber(pmt.amount), 0);
  const profit = orderTotals.sales - orderTotals.stock - petrolTotal;
  const manufacturerDue = orderTotals.stock - manufacturerPaid;
  const margin = orderTotals.sales > 0 ? (profit / orderTotals.sales) * 100 : 0;
  const avgOrder = orders.length > 0 ? orderTotals.sales / orders.length : 0;

  elements.totalSales.textContent = formatCurrency.format(orderTotals.sales);
  elements.salesCount.textContent = orders.length === 1 ? "1 order recorded" : `${orders.length} orders recorded`;
  elements.netProfit.textContent = formatSignedCurrency(profit);
  elements.manufacturerDueTotal.textContent = formatCurrency.format(manufacturerDue);
  elements.profitMargin.textContent = `${margin.toFixed(1)}% margin`;
  elements.totalPetrol.textContent = formatCurrency.format(petrolTotal);
  if (elements.totalPetrolPanel) elements.totalPetrolPanel.textContent = formatCurrency.format(petrolTotal);
  elements.totalManufacturerPaid.textContent = formatCurrency.format(manufacturerPaid);

  if (elements.avgOrderBadge) elements.avgOrderBadge.textContent = `Avg: ${formatCurrency.format(avgOrder)} / order`;
  if (elements.petrolDeductedBadge) elements.petrolDeductedBadge.textContent = `Petrol: ${formatCurrency.format(petrolTotal)}`;
  if (elements.mfgPaidSummaryBadge) elements.mfgPaidSummaryBadge.textContent = `Paid: ${formatCurrency.format(manufacturerPaid)}`;
  if (elements.petrolCountBadge) elements.petrolCountBadge.textContent = `${petrolExpenses.length} fuel entries`;

  // Update tab counts
  const customerGroups = groupOrdersByCustomer(orders);
  if (elements.customersTabCount) elements.customersTabCount.textContent = customerGroups.length;
  if (elements.ordersTabCount) elements.ordersTabCount.textContent = orders.length;
  if (elements.mfgTabCount) elements.mfgTabCount.textContent = manufacturerPayments.length;
  if (elements.petrolTabCount) elements.petrolTabCount.textContent = petrolExpenses.length;

  document.querySelector(".profit-card").classList.toggle("negative", profit < 0);
  document.querySelector(".due-card").classList.toggle("negative", manufacturerDue < 0);
}

function actionIcon(type) {
  return type === "edit"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.8 7.3 3 3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v5m4-5v5M9 7l1-2h4l1 2m-9 0 1 13h10l1-13"/></svg>';
}

/**
 * Renders the Customer Grouped View (Core new aesthetic feature).
 */
function renderCustomersView() {
  const groups = groupOrdersByCustomer(orders);
  const query = elements.customerSearch.value.trim().toLowerCase();
  const sortKey = elements.customerSort.value;

  // Filter
  const filtered = groups.filter((g) => {
    if (!query) return true;
    const itemsText = (g.itemsList || []).join(" ").toLowerCase();
    return g.customer.toLowerCase().includes(query) || itemsText.includes(query);
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortKey === "orders-high") return b.ordersCount - a.ordersCount;
    if (sortKey === "profit-high") return b.totalNet - a.totalNet;
    if (sortKey === "margin-high") return b.margin - a.margin;
    if (sortKey === "recent") return b.lastOrderDate.localeCompare(a.lastOrderDate);
    if (sortKey === "name-asc") return a.customer.localeCompare(b.customer);
    return b.totalSales - a.totalSales; // default
  });

  elements.customerGrid.innerHTML = filtered
    .map((group) => {
      const isExpanded = expandedCustomerCards.has(group.customer);
      const avatarStyle = getAvatarColor(group.customer);
      const initials = getInitials(group.customer);

      // Mini-table of transactions inside this customer
      const drawerRows = group.orders
        .map((ord) => {
          const itemTag = ord.itemDetail ? `<span class="item-chip" style="margin-left: 6px;">${escapeHtml(ord.itemDetail)}</span>` : "";
          const netClass = ord.net < 0 ? "net-negative" : "net";
          return `<tr>
            <td><strong>${displayDate(ord.orderDate)}</strong>${itemTag}</td>
            <td class="numeric">${formatNumber.format(ord.quantity)}</td>
            <td class="numeric">${formatCurrency.format(ord.sellingPrice)}</td>
            <td class="numeric"><strong>${formatCurrency.format(ord.sales)}</strong></td>
            <td class="numeric ${netClass}">${formatSignedCurrency(ord.net)}</td>
            <td style="text-align: right;">
              <span class="row-actions">
                <button class="icon-button" type="button" data-order-action="edit" data-id="${ord.id}" title="Edit order">${actionIcon("edit")}</button>
                <button class="icon-button delete" type="button" data-order-action="delete" data-id="${ord.id}" title="Delete order">${actionIcon("delete")}</button>
              </span>
            </td>
          </tr>`;
        })
        .join("");

      return `
        <article class="customer-card" data-customer-name="${escapeHtml(group.customer)}">
          <div class="customer-card-header">
            <div class="customer-profile">
              <div class="customer-avatar" style="background: ${avatarStyle.bg}; color: ${avatarStyle.text};">
                ${initials}
              </div>
              <div class="customer-info">
                <h3 class="customer-name">
                  ${escapeHtml(group.customer)}
                  ${group.isDirect ? '<span class="direct-sale-badge">Walk-in</span>' : ""}
                </h3>
                <span class="customer-meta">${group.ordersCount} orders &bull; ${displayDate(group.firstOrderDate)} to ${displayDate(group.lastOrderDate)}</span>
              </div>
            </div>
            <div class="customer-card-top-actions">
              <button class="button button-outline-primary button-sm" type="button" data-add-for-customer="${escapeHtml(group.customer)}" title="Add order for this customer">
                + Order
              </button>
            </div>
          </div>

          <div class="customer-stats-grid">
            <div class="customer-stat-box">
              <span class="stat-label">Sales</span>
              <span class="stat-val">${formatCurrency.format(group.totalSales)}</span>
            </div>
            <div class="customer-stat-box">
              <span class="stat-label">Profit</span>
              <span class="stat-val profit-val">${formatCurrency.format(group.totalNet)}</span>
            </div>
            <div class="customer-stat-box">
              <span class="stat-label">Units</span>
              <span class="stat-val">${formatNumber.format(group.totalQuantity)}</span>
            </div>
            <div class="customer-stat-box">
              <span class="stat-label">Margin</span>
              <span class="stat-val">${group.margin.toFixed(1)}%</span>
            </div>
          </div>

          <div class="customer-card-footer">
            <button class="toggle-orders-btn ${isExpanded ? "expanded" : ""}" type="button" data-toggle-customer="${escapeHtml(group.customer)}">
              <span>${isExpanded ? "Hide transactions" : `View ${group.ordersCount} transactions`}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>

          <div class="customer-orders-drawer ${isExpanded ? "open" : ""}">
            <table class="drawer-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Sales</th>
                  <th>Profit</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${drawerRows}
              </tbody>
            </table>
          </div>
        </article>
      `;
    })
    .join("");

  elements.customerEmptyState.classList.toggle("visible", filtered.length === 0);
}

function renderOrders() {
  const visibleOrders = getFilteredOrders();

  elements.ordersBody.innerHTML = visibleOrders
    .map((order) => {
      const figures = calculateOrderFigures(order);
      const { customer, item } = normalizeCustomer(order.notes);
      const noteDisplay = item || order.notes ? `<span class="order-note" title="${escapeHtml(order.notes)}">${escapeHtml(item || order.notes)}</span>` : "";
      const netClass = figures.net < 0 ? "net-negative" : "net";

      return `<tr>
        <td>
          <span class="order-date">${displayDate(order.orderDate)}</span>
          <span class="customer-pill">${escapeHtml(customer)}</span>
          ${noteDisplay}
        </td>
        <td class="numeric">${formatNumber.format(figures.quantity)}</td>
        <td class="numeric">${formatCurrency.format(figures.sales)}</td>
        <td class="numeric">${formatCurrency.format(figures.stockCost)}</td>
        <td class="numeric ${netClass}">${formatSignedCurrency(figures.net)}</td>
        <td style="text-align: right;">
          <span class="row-actions">
            <button class="icon-button" type="button" data-order-action="edit" data-id="${order.id}" aria-label="Edit order from ${displayDate(order.orderDate)}">${actionIcon("edit")}</button>
            <button class="icon-button delete" type="button" data-order-action="delete" data-id="${order.id}" aria-label="Delete order from ${displayDate(order.orderDate)}">${actionIcon("delete")}</button>
          </span>
        </td>
      </tr>`;
    })
    .join("");

  elements.emptyState.classList.toggle("visible", visibleOrders.length === 0);
}

function renderPetrolExpenses() {
  const expenses = [...petrolExpenses].sort(
    (a, b) => b.expenseDate.localeCompare(a.expenseDate) || (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  elements.petrolBody.innerHTML = expenses
    .map(
      (expense) => `<tr>
      <td><span class="order-date">${displayDate(expense.expenseDate)}</span></td>
      <td>${expense.notes ? escapeHtml(expense.notes) : '<span class="order-note">No note</span>'}</td>
      <td class="numeric">${formatCurrency.format(toNumber(expense.amount))}</td>
      <td style="text-align: right;">
        <span class="row-actions">
          <button class="icon-button" type="button" data-petrol-action="edit" data-id="${expense.id}" aria-label="Edit petrol cost from ${displayDate(expense.expenseDate)}">${actionIcon("edit")}</button>
          <button class="icon-button delete" type="button" data-petrol-action="delete" data-id="${expense.id}" aria-label="Delete petrol cost from ${displayDate(expense.expenseDate)}">${actionIcon("delete")}</button>
        </span>
      </td>
    </tr>`
    )
    .join("");

  elements.petrolEmptyState.classList.toggle("visible", expenses.length === 0);
}

function renderManufacturerPayments() {
  const payments = [...manufacturerPayments].sort(
    (a, b) => b.paymentDate.localeCompare(a.paymentDate) || (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  elements.manufacturerPaymentsBody.innerHTML = payments
    .map(
      (payment) => `<tr>
      <td><span class="order-date">${displayDate(payment.paymentDate)}</span></td>
      <td>${payment.notes ? escapeHtml(payment.notes) : '<span class="order-note">No note</span>'}</td>
      <td class="numeric">${formatCurrency.format(toNumber(payment.amount))}</td>
      <td style="text-align: right;">
        <span class="row-actions">
          <button class="icon-button" type="button" data-manufacturer-action="edit" data-id="${payment.id}" aria-label="Edit manufacturer payment from ${displayDate(payment.paymentDate)}">${actionIcon("edit")}</button>
          <button class="icon-button delete" type="button" data-manufacturer-action="delete" data-id="${payment.id}" aria-label="Delete manufacturer payment from ${displayDate(payment.paymentDate)}">${actionIcon("delete")}</button>
        </span>
      </td>
    </tr>`
    )
    .join("");

  elements.manufacturerPaymentsEmptyState.classList.toggle("visible", payments.length === 0);
}

function render() {
  renderSummary();
  renderCustomersView();
  renderOrders();
  renderPetrolExpenses();
  renderManufacturerPayments();
}

function renderPreview() {
  const figures = calculateOrderFigures({
    quantity: elements.quantity.value,
    buyingPrice: elements.buyingPrice.value,
    sellingPrice: elements.sellingPrice.value,
  });

  elements.previewSales.textContent = formatSignedCurrency(figures.sales);
  elements.previewStockCost.textContent = formatSignedCurrency(figures.stockCost);
  elements.previewNet.textContent = formatSignedCurrency(figures.net);
  elements.previewNet.classList.toggle("net-negative", figures.net < 0);
}

function resetOrderForm() {
  elements.form.reset();
  elements.orderId.value = "";
  elements.orderDate.value = todayISO();
  elements.notes.value = "";
  elements.formTitle.textContent = "Add an order";
  elements.saveButton.textContent = "Save order";
  elements.cancelEdit.classList.add("hidden");
  setFormMessage(elements.formMessage, "");
  renderPreview();
}

function resetPetrolForm() {
  elements.petrolForm.reset();
  elements.petrolId.value = "";
  elements.petrolDate.value = todayISO();
  elements.petrolFormTitle.textContent = "Add petrol cost";
  elements.savePetrolButton.textContent = "Save petrol cost";
  elements.cancelPetrolEdit.classList.add("hidden");
  setFormMessage(elements.petrolFormMessage, "");
}

function resetManufacturerPaymentForm() {
  elements.manufacturerPaymentForm.reset();
  elements.manufacturerPaymentId.value = "";
  elements.manufacturerPaymentDate.value = todayISO();
  elements.manufacturerFormTitle.textContent = "Add manufacturer payment";
  elements.saveManufacturerPaymentButton.textContent = "Save payment";
  elements.cancelManufacturerPaymentEdit.classList.add("hidden");
  setFormMessage(elements.manufacturerPaymentFormMessage, "");
}

function switchTab(tabName) {
  activeTab = tabName;
  const tabs = [
    { name: "customers", btn: elements.tabBtnCustomers, view: elements.viewCustomers },
    { name: "orders", btn: elements.tabBtnOrders, view: elements.viewOrders },
    { name: "manufacturer", btn: elements.tabBtnManufacturer, view: elements.viewManufacturer },
    { name: "petrol", btn: elements.tabBtnPetrol, view: elements.viewPetrol },
  ];

  tabs.forEach((tab) => {
    const isActive = tab.name === tabName;
    tab.btn.classList.toggle("active", isActive);
    tab.btn.setAttribute("aria-selected", String(isActive));
    tab.view.classList.toggle("hidden", !isActive);
  });
}

function beginEditingOrder(id) {
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  switchTab("orders");

  elements.orderId.value = order.id;
  elements.orderDate.value = order.orderDate;
  elements.quantity.value = order.quantity;
  elements.buyingPrice.value = order.buyingPrice;
  elements.sellingPrice.value = order.sellingPrice;
  // Restore note verbatim without any distortion
  elements.notes.value = order.notes || "";

  elements.formTitle.textContent = "Edit order";
  elements.saveButton.textContent = "Update order";
  elements.cancelEdit.classList.remove("hidden");
  setFormMessage(elements.formMessage, "Editing this order.");
  renderPreview();

  const entryPanel = document.querySelector("#order-entry-panel");
  if (entryPanel) entryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.orderDate.focus();
}

function beginEditingPetrol(id) {
  const expense = petrolExpenses.find((item) => item.id === id);
  if (!expense) return;
  switchTab("petrol");

  elements.petrolId.value = expense.id;
  elements.petrolDate.value = expense.expenseDate;
  elements.petrolAmount.value = expense.amount;
  elements.petrolNotes.value = expense.notes || "";
  elements.petrolFormTitle.textContent = "Edit petrol cost";
  elements.savePetrolButton.textContent = "Update petrol cost";
  elements.cancelPetrolEdit.classList.remove("hidden");
  setFormMessage(elements.petrolFormMessage, "Editing this petrol expense.");

  document.querySelector(".petrol-entry-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  elements.petrolDate.focus();
}

function beginEditingManufacturerPayment(id) {
  const payment = manufacturerPayments.find((item) => item.id === id);
  if (!payment) return;
  switchTab("manufacturer");

  elements.manufacturerPaymentId.value = payment.id;
  elements.manufacturerPaymentDate.value = payment.paymentDate;
  elements.manufacturerPaymentAmount.value = payment.amount;
  elements.manufacturerPaymentNotes.value = payment.notes || "";
  elements.manufacturerFormTitle.textContent = "Edit manufacturer payment";
  elements.saveManufacturerPaymentButton.textContent = "Update payment";
  elements.cancelManufacturerPaymentEdit.classList.remove("hidden");
  setFormMessage(elements.manufacturerPaymentFormMessage, "Editing this manufacturer payment.");

  document.querySelector(".manufacturer-entry-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  elements.manufacturerPaymentDate.focus();
}

function openOrderFormForCustomer(customerName) {
  switchTab("orders");
  resetOrderForm();
  if (customerName && !customerName.includes("Direct / Walk-in")) {
    elements.notes.value = customerName;
  }
  const entryPanel = document.querySelector("#order-entry-panel");
  if (entryPanel) entryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.quantity.focus();
}

function canSaveCloudRecord(_messageElement) {
  return true;
}

function orderToRemote(order) {
  return {
    id: order.id,
    user_id: order.userId,
    order_date: order.orderDate,
    quantity: order.quantity,
    buying_price: order.buyingPrice,
    selling_price: order.sellingPrice,
    notes: order.notes || null,
  };
}

function petrolToRemote(expense) {
  return {
    id: expense.id,
    user_id: expense.userId,
    expense_date: expense.expenseDate,
    amount: expense.amount,
    notes: expense.notes || null,
  };
}

function manufacturerPaymentToRemote(payment) {
  return {
    id: payment.id,
    user_id: payment.userId,
    payment_date: payment.paymentDate,
    amount: payment.amount,
    notes: payment.notes || null,
  };
}

function remoteToOrder(row) {
  return {
    id: row.id,
    userId: row.user_id,
    orderDate: row.order_date,
    quantity: toNumber(row.quantity),
    buyingPrice: toNumber(row.buying_price),
    sellingPrice: toNumber(row.selling_price),
    notes: row.notes || "",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    syncState: "synced",
  };
}

function remoteToPetrol(row) {
  return {
    id: row.id,
    userId: row.user_id,
    expenseDate: row.expense_date,
    amount: toNumber(row.amount),
    notes: row.notes || "",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    syncState: "synced",
  };
}

function remoteToManufacturerPayment(row) {
  return {
    id: row.id,
    userId: row.user_id,
    paymentDate: row.payment_date,
    amount: toNumber(row.amount),
    notes: row.notes || "",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    syncState: "synced",
  };
}

function payloadForKind(kind, record) {
  return ({ order: orderToRemote, petrol: petrolToRemote, manufacturerPayment: manufacturerPaymentToRemote })[kind](record);
}

async function upsertRemote(kind, record) {
  const payload = payloadForKind(kind, record);
  const { error } = await supabase.from(tableForKind(kind)).upsert(payload, { onConflict: "id" });
  if (error) {
    console.error(`Remote single upsert failed for ${kind}:`, error);
    throw error;
  }
}

async function upsertRemoteBatch(kind, records) {
  if (!records.length) return;
  const payloads = records.map((rec) => payloadForKind(kind, rec));
  const { error } = await supabase.from(tableForKind(kind)).upsert(payloads, { onConflict: "id" });
  if (error) {
    console.error(`Remote batch upsert failed for ${kind}:`, error);
    throw error;
  }
}

async function saveRecord(kind, record) {
  const store = storeForKind(kind);
  if (!isValidUuid(record.id)) {
    record.id = crypto.randomUUID();
  }
  const localRecord = { ...record, userId: currentUser?.id || record.userId, syncState: currentUser ? "pending" : "local" };
  await saveLocal(store, localRecord);
  if (!cloudConfigured || !currentUser) return localRecord;
  try {
    await upsertRemote(kind, localRecord);
    const syncedRecord = { ...localRecord, syncState: "synced" };
    await saveLocal(store, syncedRecord);
    return syncedRecord;
  } catch (error) {
    console.error("Cloud save failed", error);
    throw new Error("Saved locally, but cloud sync could not finish. Use Sync now after reconnecting.");
  }
}

async function deleteRecord(kind, record) {
  if (cloudConfigured && currentUser) {
    const { error } = await supabase.from(tableForKind(kind)).delete().eq("id", record.id);
    if (error) throw error;
  }
  await deleteLocal(storeForKind(kind), record.id);
}

async function handleOrderSubmit(event) {
  event.preventDefault();
  if (!canSaveCloudRecord(elements.formMessage)) return;

  const required = [elements.orderDate, elements.quantity, elements.buyingPrice, elements.sellingPrice];
  const invalid = required.find(
    (field) => !field.value || toNumber(field.value) < 0 || (field === elements.quantity && toNumber(field.value) <= 0)
  );

  if (invalid) {
    setFormMessage(elements.formMessage, "Please complete the date, quantity, buying price, and selling price.", true);
    invalid.focus();
    return;
  }

  // Preserve user note directly without any artificial mutation
  const noteValue = (elements.notes.value || "").trim();

  const existing = orders.find((order) => order.id === elements.orderId.value);
  const now = new Date().toISOString();
  const order = {
    id: elements.orderId.value || crypto.randomUUID(),
    orderDate: elements.orderDate.value,
    quantity: toNumber(elements.quantity.value),
    buyingPrice: toNumber(elements.buyingPrice.value),
    sellingPrice: toNumber(elements.sellingPrice.value),
    notes: noteValue,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  try {
    const saved = await saveRecord("order", order);
    orders = orders.filter((item) => item.id !== saved.id).concat(saved);
    updateCustomerDatalist();
    render();
    resetOrderForm();
    showToast(existing ? "Order updated." : "Order saved.");
  } catch (error) {
    setFormMessage(elements.formMessage, error.message || "The order could not be saved.", true);
  }
}

async function handlePetrolSubmit(event) {
  event.preventDefault();
  if (!canSaveCloudRecord(elements.petrolFormMessage)) return;

  if (!elements.petrolDate.value || toNumber(elements.petrolAmount.value) <= 0) {
    setFormMessage(elements.petrolFormMessage, "Please enter the petrol date and a cost greater than zero.", true);
    (!elements.petrolDate.value ? elements.petrolDate : elements.petrolAmount).focus();
    return;
  }

  const existing = petrolExpenses.find((expense) => expense.id === elements.petrolId.value);
  const now = new Date().toISOString();
  const expense = {
    id: elements.petrolId.value || crypto.randomUUID(),
    expenseDate: elements.petrolDate.value,
    amount: toNumber(elements.petrolAmount.value),
    notes: elements.petrolNotes.value.trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  try {
    const saved = await saveRecord("petrol", expense);
    petrolExpenses = petrolExpenses.filter((item) => item.id !== saved.id).concat(saved);
    render();
    resetPetrolForm();
    showToast(existing ? "Petrol cost updated." : "Petrol cost saved.");
  } catch (error) {
    setFormMessage(elements.petrolFormMessage, error.message || "The petrol cost could not be saved.", true);
  }
}

async function handleManufacturerPaymentSubmit(event) {
  event.preventDefault();
  if (!canSaveCloudRecord(elements.manufacturerPaymentFormMessage)) return;

  if (!elements.manufacturerPaymentDate.value || toNumber(elements.manufacturerPaymentAmount.value) <= 0) {
    setFormMessage(elements.manufacturerPaymentFormMessage, "Please enter payment date and amount.", true);
    (!elements.manufacturerPaymentDate.value ? elements.manufacturerPaymentDate : elements.manufacturerPaymentAmount).focus();
    return;
  }

  const existing = manufacturerPayments.find((payment) => payment.id === elements.manufacturerPaymentId.value);
  const now = new Date().toISOString();
  const payment = {
    id: elements.manufacturerPaymentId.value || crypto.randomUUID(),
    paymentDate: elements.manufacturerPaymentDate.value,
    amount: toNumber(elements.manufacturerPaymentAmount.value),
    notes: elements.manufacturerPaymentNotes.value.trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  try {
    const saved = await saveRecord("manufacturerPayment", payment);
    manufacturerPayments = manufacturerPayments.filter((item) => item.id !== saved.id).concat(saved);
    render();
    resetManufacturerPaymentForm();
    showToast(existing ? "Manufacturer payment updated." : "Manufacturer payment saved.");
  } catch (error) {
    setFormMessage(elements.manufacturerPaymentFormMessage, error.message || "The payment could not be saved.", true);
  }
}

async function handleOrderAction(event) {
  const button = event.target.closest("button[data-order-action]");
  if (!button) return;
  const { orderAction: action, id } = button.dataset;

  if (action === "edit") return beginEditingOrder(id);

  const order = orders.find((item) => item.id === id);
  if (!order || !globalThis.confirm(`Delete order from ${displayDate(order.orderDate)}? This cannot be undone.`)) return;

  try {
    await deleteRecord("order", order);
    orders = orders.filter((item) => item.id !== id);
    updateCustomerDatalist();
    render();
    if (elements.orderId.value === id) resetOrderForm();
    showToast("Order deleted.");
  } catch {
    showToast("The order could not be deleted. Please try again.");
  }
}

async function handlePetrolAction(event) {
  const button = event.target.closest("button[data-petrol-action]");
  if (!button) return;
  const { petrolAction: action, id } = button.dataset;

  if (action === "edit") return beginEditingPetrol(id);

  const expense = petrolExpenses.find((item) => item.id === id);
  if (!expense || !globalThis.confirm(`Delete petrol cost from ${displayDate(expense.expenseDate)}?`)) return;

  try {
    await deleteRecord("petrol", expense);
    petrolExpenses = petrolExpenses.filter((item) => item.id !== id);
    render();
    if (elements.petrolId.value === id) resetPetrolForm();
    showToast("Petrol cost deleted.");
  } catch {
    showToast("The petrol cost could not be deleted. Please try again.");
  }
}

async function handleManufacturerPaymentAction(event) {
  const button = event.target.closest("button[data-manufacturer-action]");
  if (!button) return;
  const { manufacturerAction: action, id } = button.dataset;

  if (action === "edit") return beginEditingManufacturerPayment(id);

  const payment = manufacturerPayments.find((item) => item.id === id);
  if (!payment || !globalThis.confirm(`Delete manufacturer payment from ${displayDate(payment.paymentDate)}?`)) return;

  try {
    await deleteRecord("manufacturerPayment", payment);
    manufacturerPayments = manufacturerPayments.filter((item) => item.id !== id);
    render();
    if (elements.manufacturerPaymentId.value === id) resetManufacturerPaymentForm();
    showToast("Manufacturer payment deleted.");
  } catch {
    showToast("The manufacturer payment could not be deleted. Please try again.");
  }
}

function handleCustomerCardClick(event) {
  const orderActionBtn = event.target.closest("button[data-order-action]");
  if (orderActionBtn) {
    return handleOrderAction(event);
  }

  const toggleBtn = event.target.closest("button[data-toggle-customer]");
  if (toggleBtn) {
    const custName = toggleBtn.dataset.toggleCustomer;
    if (expandedCustomerCards.has(custName)) {
      expandedCustomerCards.delete(custName);
    } else {
      expandedCustomerCards.add(custName);
    }
    renderCustomersView();
    return;
  }

  const addForCustomerBtn = event.target.closest("button[data-add-for-customer]");
  if (addForCustomerBtn) {
    const custName = addForCustomerBtn.dataset.addForCustomer;
    openOrderFormForCustomer(custName);
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = globalThis.setTimeout(() => elements.toast.classList.remove("show"), 3500);
}

// Cloud Sync
async function syncPendingRecords(kind, ownerId, remoteExistingIds = new Set()) {
  const store = storeForKind(kind);
  const records = await getAllLocal(store);
  const pending = records.filter((r) => {
    if (r.syncState === "synced") return false;
    if (remoteExistingIds.has(r.id)) return false;
    return !r.userId || r.userId === ownerId;
  });

  if (pending.length === 0) return;

  const BATCH_SIZE = 50;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE);
    const updatedChunk = [];
    const oldIdsToDelete = [];

    for (const record of chunk) {
      if (!isValidUuid(record.id)) {
        const oldId = record.id;
        oldIdsToDelete.push(oldId);
        record.id = crypto.randomUUID();
      }
      record.userId = ownerId;
      record.syncState = "synced";
      updatedChunk.push(record);
    }

    if (oldIdsToDelete.length > 0) {
      await deleteLocalBatch(store, oldIdsToDelete);
    }

    await upsertRemoteBatch(kind, updatedChunk);
    await saveLocalBatch(store, updatedChunk);
  }
}

async function syncFromCloud({ showResult = false } = {}) {
  if (!supabase || !currentUser || isSyncing) return;
  isSyncing = true;
  elements.syncNowButton.disabled = true;
  elements.syncStatusLabel.textContent = "Syncing…";

  try {
    // 1. Fetch remote records from cloud first
    const [
      { data: remoteOrders, error: ordersError },
      { data: remotePetrol, error: petrolError },
      { data: remoteManufacturerPayments, error: manufacturerError },
    ] = await Promise.all([
      supabase.from("orders").select("*").order("order_date", { ascending: false }),
      supabase.from("petrol_expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("manufacturer_payments").select("*").order("payment_date", { ascending: false }),
    ]);

    if (ordersError || petrolError || manufacturerError) {
      const err = ordersError || petrolError || manufacturerError;
      console.error("Supabase select error:", err);
      throw err;
    }

    const normalizedOrders = (remoteOrders || []).map(remoteToOrder);
    const normalizedPetrol = (remotePetrol || []).map(remoteToPetrol);
    const normalizedManufacturerPayments = (remoteManufacturerPayments || []).map(remoteToManufacturerPayment);

    const remoteOrderIds = new Set(normalizedOrders.map((rec) => rec.id));
    const remotePetrolIds = new Set(normalizedPetrol.map((rec) => rec.id));
    const remoteManufacturerIds = new Set(normalizedManufacturerPayments.map((rec) => rec.id));

    // 2. Sync local unsynced pending records in fast batches
    await Promise.all([
      syncPendingRecords("order", currentUser.id, remoteOrderIds),
      syncPendingRecords("petrol", currentUser.id, remotePetrolIds),
      syncPendingRecords("manufacturerPayment", currentUser.id, remoteManufacturerIds),
    ]);

    // 3. Save remote records locally in batch
    await Promise.all([
      saveLocalBatch(ORDER_STORE, normalizedOrders),
      saveLocalBatch(PETROL_STORE, normalizedPetrol),
      saveLocalBatch(MANUFACTURER_PAYMENT_STORE, normalizedManufacturerPayments),
    ]);

    // 4. Clean up any locally deleted records that belonged to this user
    const [storedOrders, storedPetrol, storedManufacturerPayments] = await Promise.all([
      getAllLocal(ORDER_STORE),
      getAllLocal(PETROL_STORE),
      getAllLocal(MANUFACTURER_PAYMENT_STORE),
    ]);

    if (normalizedOrders.length > 0) {
      const toDelete = storedOrders
        .filter((r) => r.userId === currentUser.id && r.syncState === "synced" && !remoteOrderIds.has(r.id))
        .map((r) => r.id);
      if (toDelete.length > 0) await deleteLocalBatch(ORDER_STORE, toDelete);
    }
    if (normalizedPetrol.length > 0) {
      const toDelete = storedPetrol
        .filter((r) => r.userId === currentUser.id && r.syncState === "synced" && !remotePetrolIds.has(r.id))
        .map((r) => r.id);
      if (toDelete.length > 0) await deleteLocalBatch(PETROL_STORE, toDelete);
    }
    if (normalizedManufacturerPayments.length > 0) {
      const toDelete = storedManufacturerPayments
        .filter((r) => r.userId === currentUser.id && r.syncState === "synced" && !remoteManufacturerIds.has(r.id))
        .map((r) => r.id);
      if (toDelete.length > 0) await deleteLocalBatch(MANUFACTURER_PAYMENT_STORE, toDelete);
    }

    await loadLocalLedger();
    setSyncMessage("All changes are saved in the cloud.");
    if (showResult) showToast("Cloud sync complete.");
  } catch (error) {
    console.error("Cloud sync failed", error);
    const detail = error?.message || error?.details || error?.hint || "Check connection or SQL policies.";
    setSyncMessage(`Cloud sync: ${detail}`, true);
    if (showResult) showToast(`Cloud sync: ${detail}`);
  } finally {
    isSyncing = false;
    elements.syncNowButton.disabled = false;
    updateSyncUi();
  }
}

async function initializeCloudSync() {
  if (!cloudConfigured) {
    updateSyncUi();
    return;
  }
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, detectSessionInUrl: true },
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    updateSyncUi();
    if (currentUser) await syncFromCloud();

    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateSyncUi();
      globalThis.setTimeout(async () => {
        if (currentUser) {
          await syncFromCloud();
        } else {
          await loadLocalLedger();
        }
      }, 0);
    });
  } catch (error) {
    console.error("Cloud sync setup failed", error);
    setSyncMessage("Cloud sync library failed to start.", true);
    updateSyncUi();
  }
}

async function handleSignIn(event) {
  event.preventDefault();
  if (!supabase) return;
  const email = elements.signInEmail.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    setSyncMessage("Enter a valid email address.", true);
    elements.signInEmail.focus();
    return;
  }
  await sendOtpCode(email);
}

async function sendOtpCode(email, { isResend = false } = {}) {
  const button = isResend ? elements.resendOtpCode : elements.signInButton;
  button.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
    pendingEmail = email;
    elements.otpCode.value = "";
    updateSyncUi();
    setSyncMessage("A sign-in code was sent to your email.");
    elements.otpCode.focus();
  } catch (error) {
    setSyncMessage(error.message || "Could not send the sign-in code.", true);
  } finally {
    button.disabled = false;
  }
}

async function handleVerifyOtp(event) {
  event.preventDefault();
  if (!supabase || !pendingEmail) return;
  const token = elements.otpCode.value.replace(/\s+/g, "");
  if (!/^\d{6,10}$/.test(token)) {
    setSyncMessage("Enter the code from the email.", true);
    elements.otpCode.focus();
    return;
  }
  elements.verifyOtpButton.disabled = true;
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: "email" });
    if (error) throw error;
    currentUser = data.session?.user || data.user || null;
    pendingEmail = "";
    updateSyncUi();
    setSyncMessage("Signed in. Your ledger will now sync securely across your phones.");
    await syncFromCloud({ showResult: true });
  } catch (error) {
    setSyncMessage(error.message || "That code could not be verified.", true);
    elements.otpCode.focus();
  } finally {
    elements.verifyOtpButton.disabled = false;
  }
}

async function handleSignOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) return;
  currentUser = null;
  pendingEmail = "";
  await loadLocalLedger();
  updateSyncUi();
  setSyncMessage("Signed out. Local ledger remains available.");
}

// Excel Export
function excelDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatSheetCurrency(sheet, columns, firstRow, lastRow) {
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (const col of columns) {
      const cell = sheet[`${col}${row}`];
      if (cell) cell.z = "₹#,##0.00;[Red]-₹#,##0.00";
    }
  }
}

function exportExcel() {
  if (!orders.length && !petrolExpenses.length && !manufacturerPayments.length) {
    showToast("Add an order before exporting an Excel file.");
    return;
  }

  const orderRows = [...orders]
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate))
    .map((order) => {
      const figures = calculateOrderFigures(order);
      const { customer } = normalizeCustomer(order.notes);
      return {
        Date: excelDate(order.orderDate),
        Customer: customer,
        "Quantity Sold": figures.quantity,
        "Buying Price / Unit": figures.buyingPrice,
        "Selling Price / Unit": figures.sellingPrice,
        "Sales Value": figures.sales,
        "Stock Cost": figures.stockCost,
        "Net Amount Before Petrol": figures.net,
        Note: order.notes || "",
      };
    });

  const petrolRows = [...petrolExpenses]
    .sort((a, b) => a.expenseDate.localeCompare(b.expenseDate))
    .map((expense) => ({
      Date: excelDate(expense.expenseDate),
      "Petrol Cost": toNumber(expense.amount),
      Note: expense.notes || "",
    }));

  const manufacturerRows = [...manufacturerPayments]
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
    .map((pmt) => ({
      Date: excelDate(pmt.paymentDate),
      "Amount Paid": toNumber(pmt.amount),
      Note: pmt.notes || "",
    }));

  const totals = orderRows.reduce(
    (res, row) => {
      res.sales += row["Sales Value"];
      res.stock += row["Stock Cost"];
      return res;
    },
    { sales: 0, stock: 0 }
  );

  totals.petrol = petrolRows.reduce((sum, row) => sum + row["Petrol Cost"], 0);
  totals.manufacturerPaid = manufacturerRows.reduce((sum, row) => sum + row["Amount Paid"], 0);
  totals.net = totals.sales - totals.stock - totals.petrol;
  totals.manufacturerDue = totals.stock - totals.manufacturerPaid;

  const summaryRows = [
    ["Tissue Ledger Summary", ""],
    ["Exported", new Date()],
    ["Orders recorded", orders.length],
    ["Petrol expenses recorded", petrolExpenses.length],
    ["Manufacturer payments recorded", manufacturerPayments.length],
    [],
    ["Metric", "Amount (INR)"],
    ["Total sales", totals.sales],
    ["Total stock cost", totals.stock],
    ["Total petrol cost", totals.petrol],
    ["Net profit", totals.net],
    ["Total paid to manufacturer", totals.manufacturerPaid],
    ["Current due to manufacturer", totals.manufacturerDue],
    [],
    ["Note", "Manufacturer payments settle stock cost and are not deducted from profit a second time."],
  ];

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
  const petrolSheet = XLSX.utils.json_to_sheet(petrolRows);
  const manufacturerSheet = XLSX.utils.json_to_sheet(manufacturerRows);

  summarySheet["!cols"] = [{ wch: 33 }, { wch: 58 }];
  ordersSheet["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 23 }, { wch: 32 }];
  petrolSheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 42 }];
  manufacturerSheet["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 42 }];

  for (let row = 2; row <= orderRows.length + 1; row += 1) if (ordersSheet[`A${row}`]) ordersSheet[`A${row}`].z = "dd-mmm-yyyy";
  for (let row = 2; row <= petrolRows.length + 1; row += 1) if (petrolSheet[`A${row}`]) petrolSheet[`A${row}`].z = "dd-mmm-yyyy";
  for (let row = 2; row <= manufacturerRows.length + 1; row += 1) if (manufacturerSheet[`A${row}`]) manufacturerSheet[`A${row}`].z = "dd-mmm-yyyy";

  formatSheetCurrency(ordersSheet, ["D", "E", "F", "G", "H"], 2, orderRows.length + 1);
  formatSheetCurrency(petrolSheet, ["B"], 2, petrolRows.length + 1);
  formatSheetCurrency(manufacturerSheet, ["B"], 2, manufacturerRows.length + 1);
  formatSheetCurrency(summarySheet, ["B"], 8, 13);

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, ordersSheet, "Order History");
  XLSX.utils.book_append_sheet(workbook, petrolSheet, "Petrol Expenses");
  XLSX.utils.book_append_sheet(workbook, manufacturerSheet, "Manufacturer Payments");

  XLSX.writeFile(workbook, `tissue-ledger-${todayISO()}.xlsx`, { compression: true });
  showToast("Excel workbook downloaded.");
}

// Backup & Restore
function downloadJsonBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    version: "2.0",
    orders,
    petrolExpenses,
    manufacturerPayments,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tissue-ledger-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Full backup file downloaded.");
}

async function handleImportJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data.orders)) {
      throw new Error("Invalid backup file: 'orders' array is missing.");
    }

    if (
      !globalThis.confirm(
        `Import ${data.orders.length} orders, ${data.petrolExpenses?.length || 0} petrol entries, and ${data.manufacturerPayments?.length || 0} payments?`
      )
    ) {
      return;
    }

    // Save to local stores
    await clearLocalStore(ORDER_STORE);
    await clearLocalStore(PETROL_STORE);
    await clearLocalStore(MANUFACTURER_PAYMENT_STORE);

    await saveLocalBatch(ORDER_STORE, data.orders);
    await saveLocalBatch(PETROL_STORE, data.petrolExpenses || []);
    await saveLocalBatch(MANUFACTURER_PAYMENT_STORE, data.manufacturerPayments || []);

    orders = data.orders;
    petrolExpenses = data.petrolExpenses || [];
    manufacturerPayments = data.manufacturerPayments || [];

    updateCustomerDatalist();
    render();
    closeDataToolsModal();
    showToast("Backup restored successfully!");
  } catch (error) {
    console.error("Backup import failed", error);
    showToast(`Could not import backup: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

async function handleReloadSeedData() {
  if (
    !globalThis.confirm(
      "Reload the official 272 ledger orders, 14 petrol expenses, and 19 manufacturer payments into local storage?"
    )
  ) {
    return;
  }

  await clearLocalStore(ORDER_STORE);
  await clearLocalStore(PETROL_STORE);
  await clearLocalStore(MANUFACTURER_PAYMENT_STORE);

  await saveLocalBatch(ORDER_STORE, SEED_ORDERS);
  await saveLocalBatch(PETROL_STORE, SEED_PETROL);
  await saveLocalBatch(MANUFACTURER_PAYMENT_STORE, SEED_MANUFACTURER_PAYMENTS);

  orders = [...SEED_ORDERS];
  petrolExpenses = [...SEED_PETROL];
  manufacturerPayments = [...SEED_MANUFACTURER_PAYMENTS];

  updateCustomerDatalist();
  render();
  closeDataToolsModal();
  showToast("Official 272 ledger orders reloaded!");
}

function openDataToolsModal() {
  elements.dataToolsModal.classList.add("open");
  elements.dataToolsModal.setAttribute("aria-hidden", "false");
}

function closeDataToolsModal() {
  elements.dataToolsModal.classList.remove("open");
  elements.dataToolsModal.setAttribute("aria-hidden", "true");
}

async function initialize() {
  resetOrderForm();
  resetPetrolForm();
  resetManufacturerPaymentForm();

  // Tab switching
  elements.tabBtnCustomers.addEventListener("click", () => switchTab("customers"));
  elements.tabBtnOrders.addEventListener("click", () => switchTab("orders"));
  elements.tabBtnManufacturer.addEventListener("click", () => switchTab("manufacturer"));
  elements.tabBtnPetrol.addEventListener("click", () => switchTab("petrol"));

  // Quick action buttons
  elements.openOrderFormBtn.addEventListener("click", () => {
    switchTab("orders");
    resetOrderForm();
    document.querySelector("#order-entry-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.orderDate.focus();
  });
  elements.quickAddOrderBtn.addEventListener("click", () => {
    switchTab("orders");
    resetOrderForm();
    document.querySelector("#order-entry-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.orderDate.focus();
  });

  // Customer view filters
  elements.customerSearch.addEventListener("input", renderCustomersView);
  elements.customerSort.addEventListener("change", renderCustomersView);
  elements.customerGrid.addEventListener("click", handleCustomerCardClick);

  // Form calculation preview
  [elements.quantity, elements.buyingPrice, elements.sellingPrice].forEach((input) =>
    input.addEventListener("input", renderPreview)
  );

  // Quick quantity adder pills (+10, +25, +50, +100)
  document.querySelectorAll(".pill-btn[data-add-qty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const add = toNumber(btn.dataset.addQty);
      const current = toNumber(elements.quantity.value);
      elements.quantity.value = current + add;
      renderPreview();
      elements.quantity.focus();
    });
  });

  // Rapid customer suggestion chips
  elements.quickCustomerChips?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-fill-customer]");
    if (!chip) return;
    elements.notes.value = chip.dataset.fillCustomer;
    elements.notes.focus();
  });

  // Order actions
  elements.form.addEventListener("submit", handleOrderSubmit);
  elements.cancelEdit.addEventListener("click", resetOrderForm);
  elements.ordersBody.addEventListener("click", handleOrderAction);
  elements.search.addEventListener("input", renderOrders);
  elements.sort.addEventListener("change", renderOrders);
  elements.filterOrderCustomer.addEventListener("change", renderOrders);

  // Petrol actions
  elements.petrolForm.addEventListener("submit", handlePetrolSubmit);
  elements.cancelPetrolEdit.addEventListener("click", resetPetrolForm);
  elements.petrolBody.addEventListener("click", handlePetrolAction);

  // Manufacturer actions
  elements.manufacturerPaymentForm.addEventListener("submit", handleManufacturerPaymentSubmit);
  elements.cancelManufacturerPaymentEdit.addEventListener("click", resetManufacturerPaymentForm);
  elements.manufacturerPaymentsBody.addEventListener("click", handleManufacturerPaymentAction);

  // Export & Data tools
  elements.exportButton.addEventListener("click", exportExcel);
  elements.dataToolsButton.addEventListener("click", openDataToolsModal);
  elements.closeToolsModal.addEventListener("click", closeDataToolsModal);
  elements.closeToolsModalFooter.addEventListener("click", closeDataToolsModal);
  elements.dataToolsModal.addEventListener("click", (e) => {
    if (e.target === elements.dataToolsModal) closeDataToolsModal();
  });
  elements.downloadJsonBackupBtn.addEventListener("click", downloadJsonBackup);
  elements.downloadExcelBtn.addEventListener("click", exportExcel);
  elements.importJsonFile.addEventListener("change", handleImportJson);
  elements.reloadSeedDataBtn.addEventListener("click", handleReloadSeedData);

  // Auth & Cloud Sync
  elements.signInForm.addEventListener("submit", handleSignIn);
  elements.otpForm.addEventListener("submit", handleVerifyOtp);
  elements.resendOtpCode.addEventListener("click", () => {
    if (supabase && pendingEmail) sendOtpCode(pendingEmail, { isResend: true });
  });
  elements.useDifferentEmail.addEventListener("click", () => {
    pendingEmail = "";
    elements.otpCode.value = "";
    updateSyncUi();
    elements.signInEmail.focus();
  });
  elements.syncNowButton.addEventListener("click", () => syncFromCloud({ showResult: true }));
  elements.signOutButton.addEventListener("click", handleSignOut);
  elements.accountButton.addEventListener("click", () => {
    if (currentUser) syncFromCloud({ showResult: true });
    else {
      elements.syncPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      if (cloudConfigured) elements.signInEmail.focus();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentUser) syncFromCloud();
  });

  // Load records
  try {
    await loadLocalLedger();
  } catch (error) {
    console.error(error);
    showToast("Local storage unavailable in this browser.");
  }

  await initializeCloudSync();
}

initialize();
