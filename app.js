/* =============================================
   app.js — المنطق المشترك للنظام
   ============================================= */

'use strict';

// ── Storage Keys ──
const KEYS = {
  users:    'kasheer_users',
  products: 'kasheer_products',
  sales:    'kasheer_sales',
  session:  'kasheer_session',
};

// ── Helpers ──
function getData(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function setData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function getObj(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}
function setObj(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function formatMoney(n) {
  return (parseFloat(n) || 0).toFixed(2) + ' ج.م';
}
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ar-EG') + '  ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── Session ──
function getSession() { return getObj(KEYS.session); }
function setSession(user) { setObj(KEYS.session, user); }
function clearSession() { localStorage.removeItem(KEYS.session); }
function requireAuth(role) {
  const s = getSession();
  if (!s || !s.id) { window.location.href = 'index.html'; return null; }
  if (role && s.role !== role) { window.location.href = s.role === 'admin' ? 'admin.html' : 'cashier.html'; return null; }
  return s;
}

// ── Auth ──
function loginUser(username, password) {
  const users = getData(KEYS.users);
  const user = users.find(u => u.username === username && u.password === password && u.active);
  if (user) {
    setSession({ id: user.id, username: user.username, name: user.name, role: user.role });
    return user;
  }
  return null;
}
function logoutUser() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Products ──
function getProducts() { return getData(KEYS.products); }
function saveProducts(arr) { setData(KEYS.products, arr); }
function findProductByBarcode(barcode) {
  return getProducts().find(p => p.barcode === barcode.trim());
}
function addProduct(product) {
  const products = getProducts();
  const existing = products.findIndex(p => p.barcode === product.barcode);
  if (existing > -1) { products[existing] = product; }
  else { products.push(product); }
  saveProducts(products);
}
function deleteProduct(id) {
  saveProducts(getProducts().filter(p => p.id !== id));
}
function updateProduct(id, updates) {
  const products = getProducts();
  const i = products.findIndex(p => p.id === id);
  if (i > -1) { products[i] = { ...products[i], ...updates }; saveProducts(products); }
}

// ── Users / Sellers ──
function getUsers() { return getData(KEYS.users); }
function saveUsers(arr) { setData(KEYS.users, arr); }
function getSellers() { return getUsers().filter(u => u.role === 'seller'); }
function addSeller(seller) {
  const users = getUsers();
  if (users.find(u => u.username === seller.username)) return false;
  users.push(seller);
  saveUsers(users);
  return true;
}
function deleteSeller(id) {
  saveUsers(getUsers().filter(u => u.id !== id || u.role === 'admin'));
}
function updateSeller(id, updates) {
  const users = getUsers();
  const i = users.findIndex(u => u.id === id);
  if (i > -1) { users[i] = { ...users[i], ...updates }; saveUsers(users); }
}

// ── Sales ──
function getSales() { return getData(KEYS.sales); }
function saveSales(arr) { setData(KEYS.sales, arr); }
function recordSale(sale) {
  const sales = getSales();
  sales.unshift(sale);
  saveSales(sales);
}
function getTotalRevenue() {
  return getSales().filter(s => s.status === 'completed').reduce((sum, s) => sum + s.total, 0);
}
function getDailySalesData(days = 30) {
  const sales = getSales().filter(s => s.status === 'completed');
  const result = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result[key] = 0;
  }
  sales.forEach(s => {
    const key = new Date(s.createdAt).toISOString().slice(0, 10);
    if (key in result) result[key] += s.total;
  });
  return result;
}
function getSalesBySeller() {
  const sales = getSales().filter(s => s.status === 'completed');
  const result = {};
  sales.forEach(s => {
    if (!result[s.sellerName]) result[s.sellerName] = 0;
    result[s.sellerName] += s.total;
  });
  return result;
}

// ── Init: Seed admin & sample data ──
function initApp() {
  const users = getUsers();
  if (!users.find(u => u.username === 'admin')) {
    users.push({
      id: uid(), username: 'admin', password: 'admin123',
      name: 'الأدمن', role: 'admin', active: true, createdAt: Date.now()
    });
    saveUsers(users);
  }

  // Seed some demo products if empty
  if (getProducts().length === 0) {
    const demos = [
      { id: uid(), name: 'زيت نخيل',   barcode: '6001234567890', price: 28.50, qty: 50 },
      { id: uid(), name: 'أرز بسمتي',  barcode: '6001234567891', price: 35.00, qty: 80 },
      { id: uid(), name: 'سكر أبيض',   barcode: '6001234567892', price: 18.75, qty: 120 },
      { id: uid(), name: 'شاي أحمر',   barcode: '6001234567893', price: 22.00, qty: 60 },
      { id: uid(), name: 'عصير مانجو', barcode: '6001234567894', price: 12.50, qty: 200 },
      { id: uid(), name: 'معجون أسنان',barcode: '6001234567895', price: 15.00, qty: 90 },
    ];
    saveProducts(demos);
  }

  // Seed demo sales if empty
  if (getSales().length === 0) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const demos = Array.from({ length: 15 }, (_, i) => ({
      id: uid(),
      sellerName: i % 2 === 0 ? 'محمد علي' : 'سارة أحمد',
      sellerId: 'demo',
      items: [{ name: 'أرز بسمتي', price: 35, qty: 2, subtotal: 70 }],
      subtotal: 70,
      discount: 0,
      total: 70 + Math.floor(Math.random() * 100),
      payMethod: 'cash',
      status: 'completed',
      createdAt: now - (i * day * 2) + Math.random() * day,
    }));
    saveSales(demos);
  }
}

// ── Toast ──
function showToast(el, msg, type = 'info') {
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + type + ' show';
  setTimeout(() => { el.classList.remove('show'); }, 2800);
}

// ── Confirm ──
function confirmAction(msg) {
  return window.confirm(msg);
}
