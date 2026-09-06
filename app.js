import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const DB_NAME = "tissue-ledger-db";
const DB_VERSION = 2;
const ORDER_STORE = "orders";
const PETROL_STORE = "petrol-expenses";
const CURRENCY = "INR";
const cloudConfigured = Boolean(
  SUPABASE_URL?.startsWith("https://") && SUPABASE_PUBLISHABLE_KEY?.trim(),
);

const formatCurrency = new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY, minimumFractionDigits: 0, maximumFractionDigits: 2 });
const formatNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const elements = {
  form: document.querySelector("#order-form"), formTitle: document.querySelector("#form-title"), orderId: document.querySelector("#order-id"),
  orderDate: document.querySelector("#order-date"), quantity: document.querySelector("#quantity"), buyingPrice: document.querySelector("#buying-price"),
  sellingPrice: document.querySelector("#selling-price"), manufacturerDue: document.querySelector("#manufacturer-due-input"), notes: document.querySelector("#notes"),
  previewSales: document.querySelector("#preview-sales"), previewStockCost: document.querySelector("#preview-stock-cost"), previewNet: document.querySelector("#preview-net"),
  saveButton: document.querySelector("#save-button"), cancelEdit: document.querySelector("#cancel-edit"), formMessage: document.querySelector("#form-message"),
  ordersBody: document.querySelector("#orders-body"), emptyState: document.querySelector("#empty-state"), search: document.querySelector("#search-orders"), sort: document.querySelector("#sort-orders"),
  totalSales: document.querySelector("#total-sales"), salesCount: document.querySelector("#sales-count"), netProfit: document.querySelector("#net-profit"),
  manufacturerDueTotal: document.querySelector("#manufacturer-due"), profitMargin: document.querySelector("#profit-margin"), exportButton: document.querySelector("#export-button"), toast: document.querySelector("#toast"),
  petrolForm: document.querySelector("#petrol-form"), petrolFormTitle: document.querySelector("#petrol-form-title"), petrolId: document.querySelector("#petrol-id"),
  petrolDate: document.querySelector("#petrol-date"), petrolAmount: document.querySelector("#petrol-amount"), petrolNotes: document.querySelector("#petrol-notes"),
  savePetrolButton: document.querySelector("#save-petrol-button"), cancelPetrolEdit: document.querySelector("#cancel-petrol-edit"), petrolFormMessage: document.querySelector("#petrol-form-message"),
  petrolBody: document.querySelector("#petrol-body"), petrolEmptyState: document.querySelector("#petrol-empty-state"), totalPetrol: document.querySelector("#total-petrol"),
  accountButton: document.querySelector("#account-button"), syncStatusLabel: document.querySelector("#sync-status-label"), syncPanel: document.querySelector("#sync-panel"),
  syncTitle: document.querySelector("#sync-title"), syncDescription: document.querySelector("#sync-description"), signInForm: document.querySelector("#sign-in-form"),
  signInEmail: document.querySelector("#sign-in-email"), signInButton: document.querySelector("#sign-in-button"), signedInActions: document.querySelector("#signed-in-actions"),
  syncNowButton: document.querySelector("#sync-now-button"), signOutButton: document.querySelector("#sign-out-button"), syncMessage: document.querySelector("#sync-message"),
};

let orders = [];
let petrolExpenses = [];
let supabase = null;
let currentUser = null;
let isSyncing = false;
let toastTimer;

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function toNumber(value) { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : 0; }
function calculateOrder(order) {
  const quantity = toNumber(order.quantity);
  const buyingPrice = toNumber(order.buyingPrice);
  const sellingPrice = toNumber(order.sellingPrice);
  const manufacturerDue = toNumber(order.manufacturerDue);
  const sales = quantity * sellingPrice;
  const stockCost = quantity * buyingPrice;
  return { quantity, buyingPrice, sellingPrice, manufacturerDue, sales, stockCost, net: sales - stockCost };
}
function formatSignedCurrency(value) { return value < 0 ? `−${formatCurrency.format(Math.abs(value))}` : formatCurrency.format(value); }
function displayDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      if (!db.objectStoreNames.contains(ORDER_STORE)) {
        const store = db.createObjectStore(ORDER_STORE, { keyPath: "id" });
        store.createIndex("orderDate", "orderDate", { unique: false });
      }
      if (!db.objectStoreNames.contains(PETROL_STORE)) {
        const store = db.createObjectStore(PETROL_STORE, { keyPath: "id" });
        store.createIndex("expenseDate", "expenseDate", { unique: false });
      }
      // Petrol in the original version lived inside an order. Preserve it as a proper expense on upgrade.
      if (event.oldVersion > 0 && event.oldVersion < 2 && transaction) {
        const orderStore = transaction.objectStore(ORDER_STORE);
        const petrolStore = transaction.objectStore(PETROL_STORE);
        const existingOrders = orderStore.getAll();
        existingOrders.onsuccess = () => existingOrders.result.forEach((order) => {
          const legacyCost = toNumber(order.petrolCost);
          if (!legacyCost) return;
          petrolStore.put({ id: `migrated-${order.id}`, expenseDate: order.orderDate, amount: legacyCost, notes: `Migrated from order${order.notes ? `: ${order.notes}` : ""}`, createdAt: order.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), syncState: "pending" });
          orderStore.put({ ...order, petrolCost: 0, updatedAt: new Date().toISOString(), syncState: "pending" });
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function useStore(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = callback(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}
const getAllLocal = (storeName) => useStore(storeName, "readonly", (store) => store.getAll());
const saveLocal = (storeName, record) => useStore(storeName, "readwrite", (store) => store.put(record));
const deleteLocal = (storeName, id) => useStore(storeName, "readwrite", (store) => store.delete(id));

function isVisibleToCurrentLedger(record) { return !cloudConfigured || Boolean(currentUser && record.userId === currentUser.id); }
async function loadLocalLedger() {
  const [storedOrders, storedPetrol] = await Promise.all([getAllLocal(ORDER_STORE), getAllLocal(PETROL_STORE)]);
  orders = storedOrders.filter(isVisibleToCurrentLedger);
  petrolExpenses = storedPetrol.filter(isVisibleToCurrentLedger);
  render();
}

function setFormMessage(element, message, isError = false) { element.textContent = message; element.classList.toggle("error", isError); }
function setSyncMessage(message, isError = false) { setFormMessage(elements.syncMessage, message, isError); }
function updateSyncUi() {
  const dot = elements.accountButton.querySelector(".status-dot");
  dot.classList.remove("pending", "offline");
  if (!cloudConfigured) {
    elements.syncStatusLabel.textContent = "Cloud sync setup";
    dot.classList.add("offline");
    elements.syncTitle.textContent = "Connect your ledger across every phone.";
    elements.syncDescription.textContent = "This site is ready for free cloud sync. Add the Supabase project values in supabase-config.js, then deploy it once.";
    elements.signInForm.classList.add("hidden");
    elements.signedInActions.classList.add("hidden");
  } else if (!currentUser) {
    elements.syncStatusLabel.textContent = "Sign in to sync";
    dot.classList.add("pending");
    elements.syncTitle.textContent = "Sign in to sync every phone.";
    elements.syncDescription.textContent = "Use the same email address on each mobile. We will send a secure, password-free sign-in link.";
    elements.signInForm.classList.remove("hidden");
    elements.signedInActions.classList.add("hidden");
  } else {
    elements.syncStatusLabel.textContent = "Cloud sync active";
    elements.syncTitle.textContent = "Your ledger is syncing securely.";
    elements.syncDescription.textContent = `Signed in as ${currentUser.email || "your account"}. Open this site on another phone and sign in with the same email.`;
    elements.signInForm.classList.add("hidden");
    elements.signedInActions.classList.remove("hidden");
  }
}

function getFilteredOrders() {
  const query = elements.search.value.trim().toLowerCase();
  const filtered = orders.filter((order) => !query || [order.orderDate, order.notes].some((value) => String(value || "").toLowerCase().includes(query)));
  return filtered.sort((a, b) => {
    if (elements.sort.value === "oldest") return a.orderDate.localeCompare(b.orderDate);
    if (elements.sort.value === "profit-high") return calculateOrder(b).net - calculateOrder(a).net;
    if (elements.sort.value === "profit-low") return calculateOrder(a).net - calculateOrder(b).net;
    return b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt);
  });
}
function renderSummary() {
  const orderTotals = orders.reduce((result, order) => {
    const values = calculateOrder(order);
    result.sales += values.sales; result.stock += values.stockCost; result.due += values.manufacturerDue;
    return result;
  }, { sales: 0, stock: 0, due: 0 });
  const petrolTotal = petrolExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const profit = orderTotals.sales - orderTotals.stock - petrolTotal;
  const margin = orderTotals.sales ? (profit / orderTotals.sales) * 100 : 0;
  elements.totalSales.textContent = formatSignedCurrency(orderTotals.sales);
  elements.salesCount.textContent = orders.length === 1 ? "1 order recorded" : `${orders.length} orders recorded`;
  elements.netProfit.textContent = formatSignedCurrency(profit);
  elements.manufacturerDueTotal.textContent = formatSignedCurrency(orderTotals.due);
  elements.profitMargin.textContent = `${margin.toFixed(1)}%`;
  elements.totalPetrol.textContent = formatSignedCurrency(petrolTotal);
  document.querySelector(".profit-card").classList.toggle("negative", profit < 0);
  document.querySelector(".margin-card").classList.toggle("negative", margin < 0);
}
function actionIcon(type) {
  return type === "edit"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.8 7.3 3 3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v5m4-5v5M9 7l1-2h4l1 2m-9 0 1 13h10l1-13"/></svg>';
}
function renderOrders() {
  const visibleOrders = getFilteredOrders();
  elements.ordersBody.innerHTML = visibleOrders.map((order) => {
    const values = calculateOrder(order);
    const note = order.notes ? `<span class="order-note" title="${escapeHtml(order.notes)}">${escapeHtml(order.notes)}</span>` : "";
    const netClass = values.net < 0 ? "net net-negative" : "net";
    return `<tr><td><span class="order-date">${displayDate(order.orderDate)}</span>${note}</td><td class="numeric">${formatNumber.format(values.quantity)}</td><td class="numeric">${formatCurrency.format(values.sales)}</td><td class="numeric">${formatCurrency.format(values.stockCost)}</td><td class="numeric">${formatCurrency.format(values.manufacturerDue)}</td><td class="numeric ${netClass}">${formatSignedCurrency(values.net)}</td><td><span class="row-actions"><button class="icon-button" type="button" data-action="edit" data-id="${order.id}" aria-label="Edit order from ${displayDate(order.orderDate)}">${actionIcon("edit")}</button><button class="icon-button delete" type="button" data-action="delete" data-id="${order.id}" aria-label="Delete order from ${displayDate(order.orderDate)}">${actionIcon("delete")}</button></span></td></tr>`;
  }).join("");
  elements.emptyState.classList.toggle("visible", visibleOrders.length === 0);
  const hasNoMatches = orders.length && !visibleOrders.length;
  elements.emptyState.querySelector("h3").textContent = hasNoMatches ? "No matching orders" : "No orders saved yet";
  elements.emptyState.querySelector("p").textContent = hasNoMatches ? "Try a different search term or clear the search field." : "Your sales history will appear here after you add your first order.";
}
function renderPetrolExpenses() {
  const visibleExpenses = [...petrolExpenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt));
  elements.petrolBody.innerHTML = visibleExpenses.map((expense) => `<tr><td><span class="order-date">${displayDate(expense.expenseDate)}</span></td><td>${expense.notes ? escapeHtml(expense.notes) : '<span class="order-note">No note</span>'}</td><td class="numeric">${formatCurrency.format(toNumber(expense.amount))}</td><td><span class="row-actions"><button class="icon-button" type="button" data-petrol-action="edit" data-id="${expense.id}" aria-label="Edit petrol cost from ${displayDate(expense.expenseDate)}">${actionIcon("edit")}</button><button class="icon-button delete" type="button" data-petrol-action="delete" data-id="${expense.id}" aria-label="Delete petrol cost from ${displayDate(expense.expenseDate)}">${actionIcon("delete")}</button></span></td></tr>`).join("");
  elements.petrolEmptyState.classList.toggle("visible", visibleExpenses.length === 0);
}
function render() { renderSummary(); renderOrders(); renderPetrolExpenses(); }
function renderPreview() {
  const values = calculateOrder({ quantity: elements.quantity.value, buyingPrice: elements.buyingPrice.value, sellingPrice: elements.sellingPrice.value, manufacturerDue: elements.manufacturerDue.value });
  elements.previewSales.textContent = formatSignedCurrency(values.sales);
  elements.previewStockCost.textContent = formatSignedCurrency(values.stockCost);
  elements.previewNet.textContent = formatSignedCurrency(values.net);
  elements.previewNet.classList.toggle("net-negative", values.net < 0);
}

function resetOrderForm() {
  elements.form.reset(); elements.orderId.value = ""; elements.orderDate.value = todayISO(); elements.manufacturerDue.value = "0";
  elements.formTitle.textContent = "Add an order"; elements.saveButton.textContent = "Save order"; elements.cancelEdit.classList.add("hidden");
  setFormMessage(elements.formMessage, ""); renderPreview();
}
function resetPetrolForm() {
  elements.petrolForm.reset(); elements.petrolId.value = ""; elements.petrolDate.value = todayISO();
  elements.petrolFormTitle.textContent = "Add petrol cost"; elements.savePetrolButton.textContent = "Save petrol cost"; elements.cancelPetrolEdit.classList.add("hidden");
  setFormMessage(elements.petrolFormMessage, "");
}
function beginEditingOrder(id) {
  const order = orders.find((item) => item.id === id); if (!order) return;
  elements.orderId.value = order.id; elements.orderDate.value = order.orderDate; elements.quantity.value = order.quantity; elements.buyingPrice.value = order.buyingPrice; elements.sellingPrice.value = order.sellingPrice; elements.manufacturerDue.value = order.manufacturerDue; elements.notes.value = order.notes || "";
  elements.formTitle.textContent = "Edit order"; elements.saveButton.textContent = "Update order"; elements.cancelEdit.classList.remove("hidden"); setFormMessage(elements.formMessage, "Editing this order."); renderPreview();
  document.querySelector(".entry-panel").scrollIntoView({ behavior: "smooth", block: "start" }); elements.orderDate.focus();
}
function beginEditingPetrol(id) {
  const expense = petrolExpenses.find((item) => item.id === id); if (!expense) return;
  elements.petrolId.value = expense.id; elements.petrolDate.value = expense.expenseDate; elements.petrolAmount.value = expense.amount; elements.petrolNotes.value = expense.notes || "";
  elements.petrolFormTitle.textContent = "Edit petrol cost"; elements.savePetrolButton.textContent = "Update petrol cost"; elements.cancelPetrolEdit.classList.remove("hidden"); setFormMessage(elements.petrolFormMessage, "Editing this petrol expense.");
  document.querySelector(".petrol-entry-panel").scrollIntoView({ behavior: "smooth", block: "start" }); elements.petrolDate.focus();
}
function canSaveCloudRecord(messageElement) {
  if (!cloudConfigured || currentUser) return true;
  setFormMessage(messageElement, "Sign in above first so this entry can sync across your phones.", true);
  elements.syncPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}

function orderToRemote(order) { return { id: order.id, user_id: order.userId, order_date: order.orderDate, quantity: order.quantity, buying_price: order.buyingPrice, selling_price: order.sellingPrice, manufacturer_due: order.manufacturerDue, notes: order.notes || null }; }
function petrolToRemote(expense) { return { id: expense.id, user_id: expense.userId, expense_date: expense.expenseDate, amount: expense.amount, notes: expense.notes || null }; }
function remoteToOrder(row) { return { id: row.id, userId: row.user_id, orderDate: row.order_date, quantity: toNumber(row.quantity), buyingPrice: toNumber(row.buying_price), sellingPrice: toNumber(row.selling_price), manufacturerDue: toNumber(row.manufacturer_due), notes: row.notes || "", createdAt: row.created_at || new Date().toISOString(), updatedAt: row.updated_at || new Date().toISOString(), syncState: "synced" }; }
function remoteToPetrol(row) { return { id: row.id, userId: row.user_id, expenseDate: row.expense_date, amount: toNumber(row.amount), notes: row.notes || "", createdAt: row.created_at || new Date().toISOString(), updatedAt: row.updated_at || new Date().toISOString(), syncState: "synced" }; }
async function upsertRemote(kind, record) {
  const table = kind === "order" ? "orders" : "petrol_expenses";
  const payload = kind === "order" ? orderToRemote(record) : petrolToRemote(record);
  const { error } = await supabase.from(table).upsert(payload);
  if (error) throw error;
}
async function saveRecord(kind, record) {
  const store = kind === "order" ? ORDER_STORE : PETROL_STORE;
  const localRecord = { ...record, userId: currentUser?.id || record.userId, syncState: cloudConfigured ? "pending" : "local" };
  await saveLocal(store, localRecord);
  if (!cloudConfigured) return localRecord;
  try {
    await upsertRemote(kind, localRecord);
    const syncedRecord = { ...localRecord, syncState: "synced" };
    await saveLocal(store, syncedRecord);
    return syncedRecord;
  } catch (error) {
    console.error("Cloud save failed", error);
    throw new Error("Saved on this device, but cloud sync could not finish. Use Sync now after reconnecting.");
  }
}
async function deleteRecord(kind, record) {
  const store = kind === "order" ? ORDER_STORE : PETROL_STORE;
  if (cloudConfigured) {
    const { error } = await supabase.from(kind === "order" ? "orders" : "petrol_expenses").delete().eq("id", record.id);
    if (error) throw error;
  }
  await deleteLocal(store, record.id);
}

async function handleOrderSubmit(event) {
  event.preventDefault(); if (!canSaveCloudRecord(elements.formMessage)) return;
  const required = [elements.orderDate, elements.quantity, elements.buyingPrice, elements.sellingPrice];
  const invalid = required.find((field) => !field.value || toNumber(field.value) < 0 || (field === elements.quantity && toNumber(field.value) <= 0));
  if (invalid) { setFormMessage(elements.formMessage, "Please complete the date, quantity, buying price, and selling price.", true); invalid.focus(); return; }
  const existing = orders.find((order) => order.id === elements.orderId.value); const now = new Date().toISOString();
  const order = { id: elements.orderId.value || crypto.randomUUID(), orderDate: elements.orderDate.value, quantity: toNumber(elements.quantity.value), buyingPrice: toNumber(elements.buyingPrice.value), sellingPrice: toNumber(elements.sellingPrice.value), manufacturerDue: toNumber(elements.manufacturerDue.value), notes: elements.notes.value.trim(), createdAt: existing?.createdAt || now, updatedAt: now };
  try { const saved = await saveRecord("order", order); orders = orders.filter((item) => item.id !== saved.id).concat(saved); render(); resetOrderForm(); showToast(existing ? "Order updated." : "Order saved."); }
  catch (error) { setFormMessage(elements.formMessage, error.message || "The order could not be saved.", true); }
}
async function handlePetrolSubmit(event) {
  event.preventDefault(); if (!canSaveCloudRecord(elements.petrolFormMessage)) return;
  if (!elements.petrolDate.value || toNumber(elements.petrolAmount.value) <= 0) { setFormMessage(elements.petrolFormMessage, "Please enter the petrol date and a cost greater than zero.", true); (!elements.petrolDate.value ? elements.petrolDate : elements.petrolAmount).focus(); return; }
  const existing = petrolExpenses.find((expense) => expense.id === elements.petrolId.value); const now = new Date().toISOString();
  const expense = { id: elements.petrolId.value || crypto.randomUUID(), expenseDate: elements.petrolDate.value, amount: toNumber(elements.petrolAmount.value), notes: elements.petrolNotes.value.trim(), createdAt: existing?.createdAt || now, updatedAt: now };
  try { const saved = await saveRecord("petrol", expense); petrolExpenses = petrolExpenses.filter((item) => item.id !== saved.id).concat(saved); render(); resetPetrolForm(); showToast(existing ? "Petrol cost updated." : "Petrol cost saved."); }
  catch (error) { setFormMessage(elements.petrolFormMessage, error.message || "The petrol cost could not be saved.", true); }
}
async function handleOrderAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const { action, id } = button.dataset; if (action === "edit") return beginEditingOrder(id);
  const order = orders.find((item) => item.id === id);
  if (!order || !window.confirm(`Delete the order from ${displayDate(order.orderDate)}? This cannot be undone.`)) return;
  try { await deleteRecord("order", order); orders = orders.filter((item) => item.id !== id); render(); if (elements.orderId.value === id) resetOrderForm(); showToast("Order deleted."); }
  catch { showToast("The order could not be deleted. Please try again."); }
}
async function handlePetrolAction(event) {
  const button = event.target.closest("button[data-petrol-action]"); if (!button) return;
  const { petrolAction: action, id } = button.dataset; if (action === "edit") return beginEditingPetrol(id);
  const expense = petrolExpenses.find((item) => item.id === id);
  if (!expense || !window.confirm(`Delete the petrol cost from ${displayDate(expense.expenseDate)}? This cannot be undone.`)) return;
  try { await deleteRecord("petrol", expense); petrolExpenses = petrolExpenses.filter((item) => item.id !== id); render(); if (elements.petrolId.value === id) resetPetrolForm(); showToast("Petrol cost deleted."); }
  catch { showToast("The petrol cost could not be deleted. Please try again."); }
}
function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("show"); toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3500); }

async function syncFromCloud({ showResult = false } = {}) {
  if (!supabase || !currentUser || isSyncing) return;
  isSyncing = true; elements.syncNowButton.disabled = true; elements.syncStatusLabel.textContent = "Syncing…";
  try {
    const [storedOrders, storedPetrol] = await Promise.all([getAllLocal(ORDER_STORE), getAllLocal(PETROL_STORE)]);
    const localOrdersToSync = storedOrders.filter((item) => !item.userId || (item.userId === currentUser.id && item.syncState !== "synced"));
    const localPetrolToSync = storedPetrol.filter((item) => !item.userId || (item.userId === currentUser.id && item.syncState !== "synced"));
    for (const item of localOrdersToSync) { const owned = { ...item, userId: currentUser.id }; await upsertRemote("order", owned); await saveLocal(ORDER_STORE, { ...owned, syncState: "synced" }); }
    for (const item of localPetrolToSync) { const owned = { ...item, userId: currentUser.id }; await upsertRemote("petrol", owned); await saveLocal(PETROL_STORE, { ...owned, syncState: "synced" }); }
    const [{ data: remoteOrders, error: ordersError }, { data: remotePetrol, error: petrolError }] = await Promise.all([
      supabase.from("orders").select("*").order("order_date", { ascending: false }),
      supabase.from("petrol_expenses").select("*").order("expense_date", { ascending: false }),
    ]);
    if (ordersError || petrolError) throw ordersError || petrolError;
    const normalizedOrders = (remoteOrders || []).map(remoteToOrder); const normalizedPetrol = (remotePetrol || []).map(remoteToPetrol);
    await Promise.all([...normalizedOrders.map((item) => saveLocal(ORDER_STORE, item)), ...normalizedPetrol.map((item) => saveLocal(PETROL_STORE, item))]);
    const remoteOrderIds = new Set(normalizedOrders.map((item) => item.id)); const remotePetrolIds = new Set(normalizedPetrol.map((item) => item.id));
    await Promise.all([...storedOrders.filter((item) => item.userId === currentUser.id && item.syncState === "synced" && !remoteOrderIds.has(item.id)).map((item) => deleteLocal(ORDER_STORE, item.id)), ...storedPetrol.filter((item) => item.userId === currentUser.id && item.syncState === "synced" && !remotePetrolIds.has(item.id)).map((item) => deleteLocal(PETROL_STORE, item.id))]);
    await loadLocalLedger(); setSyncMessage("All changes are saved in the cloud."); if (showResult) showToast("Cloud sync complete.");
  } catch (error) {
    console.error("Cloud sync failed", error); setSyncMessage("Cloud sync needs attention. Check the Supabase setup SQL and URL settings, then try again.", true); if (showResult) showToast("Cloud sync could not finish.");
  } finally { isSyncing = false; elements.syncNowButton.disabled = false; updateSyncUi(); }
}
async function initializeCloudSync() {
  if (!cloudConfigured) { updateSyncUi(); return; }
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
    const { data, error } = await supabase.auth.getSession(); if (error) throw error;
    currentUser = data.session?.user || null; updateSyncUi(); if (currentUser) await syncFromCloud();
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null; updateSyncUi();
      window.setTimeout(async () => { if (currentUser) await syncFromCloud(); else { orders = []; petrolExpenses = []; render(); } }, 0);
    });
  } catch (error) { console.error("Cloud sync setup failed", error); setSyncMessage("The cloud sync library could not start. Check the project URL and publishable key in supabase-config.js.", true); updateSyncUi(); }
}
async function handleSignIn(event) {
  event.preventDefault(); if (!supabase) { setSyncMessage("Cloud sync is not configured yet.", true); return; }
  const email = elements.signInEmail.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) { setSyncMessage("Enter a valid email address to receive your sign-in link.", true); elements.signInEmail.focus(); return; }
  elements.signInButton.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href.split("#")[0] } });
    if (error) throw error;
    setSyncMessage("Sign-in link sent. Open it from your email, then use this same email on your other phone.");
  } catch (error) { setSyncMessage(error.message || "Could not send the sign-in link.", true); }
  finally { elements.signInButton.disabled = false; }
}
async function handleSignOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) { setSyncMessage("Could not sign out. Please try again.", true); return; }
  currentUser = null; orders = []; petrolExpenses = []; render(); updateSyncUi(); setSyncMessage("Signed out. Your cloud data remains safe and available after you sign in again.");
}

function excelDate(isoDate) { const [year, month, day] = isoDate.split("-").map(Number); return new Date(year, month - 1, day); }
function formatSheetCurrency(sheet, columns, firstRow, lastRow) {
  for (let row = firstRow; row <= lastRow; row += 1) for (const column of columns) { const cell = sheet[`${column}${row}`]; if (cell) cell.z = '₹#,##0.00;[Red]-₹#,##0.00'; }
}
function exportExcel() {
  if (!orders.length && !petrolExpenses.length) { showToast("Add an order or petrol cost before exporting an Excel file."); return; }
  const orderRows = [...orders].sort((a, b) => a.orderDate.localeCompare(b.orderDate)).map((order) => {
    const values = calculateOrder(order);
    return { Date: excelDate(order.orderDate), "Quantity Sold": values.quantity, "Buying Price / Unit": values.buyingPrice, "Selling Price / Unit": values.sellingPrice, "Sales Value": values.sales, "Stock Cost": values.stockCost, "Manufacturer Due": values.manufacturerDue, "Net Amount Before Petrol": values.net, Note: order.notes || "" };
  });
  const petrolRows = [...petrolExpenses].sort((a, b) => a.expenseDate.localeCompare(b.expenseDate)).map((expense) => ({ Date: excelDate(expense.expenseDate), "Petrol Cost": toNumber(expense.amount), Note: expense.notes || "" }));
  const totals = orderRows.reduce((result, row) => { result.sales += row["Sales Value"]; result.stock += row["Stock Cost"]; result.due += row["Manufacturer Due"]; return result; }, { sales: 0, stock: 0, due: 0 });
  totals.petrol = petrolRows.reduce((sum, row) => sum + row["Petrol Cost"], 0); totals.net = totals.sales - totals.stock - totals.petrol;
  const summaryRows = [["Tissue Ledger Summary", ""], ["Exported", new Date()], ["Orders recorded", orders.length], ["Petrol expenses recorded", petrolExpenses.length], [], ["Metric", "Amount (INR)"], ["Total sales", totals.sales], ["Total stock cost", totals.stock], ["Total petrol cost", totals.petrol], ["Net profit", totals.net], ["Total due to manufacturer", totals.due], [], ["Note", "Manufacturer due is tracked separately from stock cost to prevent double-counting."]];
  const workbook = XLSX.utils.book_new(); const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows); const ordersSheet = XLSX.utils.json_to_sheet(orderRows); const petrolSheet = XLSX.utils.json_to_sheet(petrolRows);
  summarySheet["!cols"] = [{ wch: 31 }, { wch: 54 }]; ordersSheet["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 23 }, { wch: 32 }]; petrolSheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 42 }];
  for (let row = 2; row <= orderRows.length + 1; row += 1) if (ordersSheet[`A${row}`]) ordersSheet[`A${row}`].z = "dd-mmm-yyyy";
  for (let row = 2; row <= petrolRows.length + 1; row += 1) if (petrolSheet[`A${row}`]) petrolSheet[`A${row}`].z = "dd-mmm-yyyy";
  formatSheetCurrency(ordersSheet, ["C", "D", "E", "F", "G", "H"], 2, orderRows.length + 1); formatSheetCurrency(petrolSheet, ["B"], 2, petrolRows.length + 1); formatSheetCurrency(summarySheet, ["B"], 7, 11);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary"); XLSX.utils.book_append_sheet(workbook, ordersSheet, "Order History"); XLSX.utils.book_append_sheet(workbook, petrolSheet, "Petrol Expenses");
  XLSX.writeFile(workbook, `tissue-ledger-${todayISO()}.xlsx`, { compression: true }); showToast("Excel file downloaded.");
}

async function initialize() {
  resetOrderForm(); resetPetrolForm();
  [elements.quantity, elements.buyingPrice, elements.sellingPrice].forEach((input) => input.addEventListener("input", renderPreview));
  elements.form.addEventListener("submit", handleOrderSubmit); elements.cancelEdit.addEventListener("click", resetOrderForm); elements.ordersBody.addEventListener("click", handleOrderAction); elements.search.addEventListener("input", renderOrders); elements.sort.addEventListener("change", renderOrders);
  elements.petrolForm.addEventListener("submit", handlePetrolSubmit); elements.cancelPetrolEdit.addEventListener("click", resetPetrolForm); elements.petrolBody.addEventListener("click", handlePetrolAction); elements.exportButton.addEventListener("click", exportExcel);
  elements.signInForm.addEventListener("submit", handleSignIn); elements.syncNowButton.addEventListener("click", () => syncFromCloud({ showResult: true })); elements.signOutButton.addEventListener("click", handleSignOut);
  elements.accountButton.addEventListener("click", () => { if (currentUser) syncFromCloud({ showResult: true }); else { elements.syncPanel.scrollIntoView({ behavior: "smooth", block: "center" }); if (cloudConfigured) elements.signInEmail.focus(); } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && currentUser) syncFromCloud(); });
  try { await loadLocalLedger(); } catch (error) { console.error(error); showToast("Local storage is unavailable in this browser."); }
  await initializeCloudSync();
}

initialize();
