/* =============================================
   admin.js — منطق لوحة الأدمن
   ============================================= */
'use strict';

let salesChart    = null;
let sellerChart   = null;
let adminScanner  = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth('admin');
  if (!user) return;

  document.getElementById('adminName').textContent   = user.name;
  document.getElementById('adminAvatar').textContent = user.name.charAt(0).toUpperCase();
  setCurrentDate();

  // Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.section); });
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('sidebarClose').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', logoutUser);

  // Product modal
  document.getElementById('addProductBtn').addEventListener('click', openAddProduct);
  document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
  document.getElementById('cancelProductModal').addEventListener('click', closeProductModal);
  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('productSearch').addEventListener('input', renderProductsTable);

  // Seller modal
  document.getElementById('addSellerBtn').addEventListener('click', openAddSeller);
  document.getElementById('closeSellerModal').addEventListener('click', closeSellerModal);
  document.getElementById('cancelSellerModal').addEventListener('click', closeSellerModal);
  document.getElementById('sellerForm').addEventListener('submit', saveSeller);

  // Barcode scanner
  document.getElementById('scanBarcodeBtn').addEventListener('click', () => openScanModal('product'));
  document.getElementById('closeScanModal').addEventListener('click', closeScanModal);

  // Sales filter
  document.getElementById('sellerFilter').addEventListener('change', renderSalesTable);
  document.getElementById('dateFilter').addEventListener('change', renderSalesTable);
  document.getElementById('dateFilter').value = todayKey();

  // Close on overlay click
  ['productModal','sellerModal','scanModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id === id) { closeScanModal(); closeProductModal(); closeSellerModal(); }
    });
  });

  navigateTo('dashboard');
});

/* ── Navigation ── */
function navigateTo(sec) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const secEl = document.getElementById('section-' + sec);
  if (secEl) secEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-section="${sec}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = { dashboard:'الرئيسية', products:'المنتجات', sellers:'البائعون', sales:'المبيعات' };
  document.getElementById('topbarTitle').textContent = titles[sec] || '';
  if (sec === 'dashboard') renderDashboard();
  if (sec === 'products')  renderProductsTable();
  if (sec === 'sellers')   renderSellersTable();
  if (sec === 'sales')     { populateSellerFilter(); renderSalesTable(); }
}

function setCurrentDate() {
  const el = document.getElementById('currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

/* ── Dashboard ── */
function renderDashboard() {
  const revenue  = getTotalRevenue();
  const sales    = getSales();
  const products = getProducts();
  const sellers  = getSellers();
  document.getElementById('totalRevenue').textContent      = formatMoney(revenue);
  document.getElementById('totalTransactions').textContent = sales.filter(s=>s.status==='completed').length;
  document.getElementById('totalProducts').textContent     = products.length;
  document.getElementById('totalSellers').textContent      = sellers.length;
  renderSalesChart();
  renderSellerChart();
  renderRecentSales();
}

function renderSalesChart() {
  const data   = getDailySalesData(30);
  const labels = Object.keys(data).map(d => { const dt=new Date(d); return (dt.getMonth()+1)+'/'+dt.getDate(); });
  const values = Object.values(data);
  const ctx    = document.getElementById('salesChart');
  if (!ctx) return;
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:'الإيرادات', data:values,
        borderColor:'#7B6FFF',
        backgroundColor:'rgba(123,111,255,0.07)',
        borderWidth:2.5, pointRadius:3,
        pointBackgroundColor:'#7B6FFF',
        pointBorderColor:'rgba(0,229,204,0.6)',
        tension:.45, fill:true,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{
          rtl:true, backgroundColor:'rgba(12,16,35,0.95)',
          borderColor:'rgba(123,111,255,0.3)', borderWidth:1,
          titleFont:{family:'Cairo'}, bodyFont:{family:'Cairo'},
          callbacks:{label:ctx=>formatMoney(ctx.parsed.y)}
        }
      },
      scales:{
        x:{grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#8B96C1',font:{family:'Cairo',size:11}}},
        y:{grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#8B96C1',font:{family:'Cairo',size:11},callback:v=>v+' ج.م'}}
      }
    }
  });
}

function renderSellerChart() {
  const sellerData = getSalesBySeller();
  const labels = Object.keys(sellerData);
  const vals   = Object.values(sellerData);
  const colors = ['#7B6FFF','#00E5CC','#F97316','#22D3A0','#A855F7','#EC4899','#FBBF24'];
  const ctx    = document.getElementById('sellerChart');
  if (!ctx) return;
  if (sellerChart) sellerChart.destroy();
  if (labels.length === 0) return;
  sellerChart = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels,
      datasets:[{ data:vals, backgroundColor:colors.slice(0,labels.length), borderColor:'rgba(12,16,35,0.8)', borderWidth:3, hoverOffset:10 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom', labels:{color:'#8B96C1',font:{family:'Cairo',size:11},padding:12}},
        tooltip:{
          rtl:true, backgroundColor:'rgba(12,16,35,0.95)',
          borderColor:'rgba(255,255,255,0.1)', borderWidth:1,
          titleFont:{family:'Cairo'}, bodyFont:{family:'Cairo'},
          callbacks:{label:ctx=>' '+formatMoney(ctx.parsed)}
        }
      }
    }
  });
}

function renderRecentSales() {
  const sales = getSales().filter(s=>s.status==='completed').slice(0,10);
  const tbody = document.getElementById('recentSalesBody');
  if (!tbody) return;
  if (!sales.length) { tbody.innerHTML='<tr><td colspan="6" class="empty-row">لا توجد معاملات بعد</td></tr>'; return; }
  tbody.innerHTML = sales.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${formatDate(s.createdAt)}</td>
      <td>${escHtml(s.sellerName)}</td>
      <td>${s.items.length} صنف</td>
      <td style="font-weight:700;background:linear-gradient(90deg,#00E5CC,#7B6FFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${formatMoney(s.total)}</td>
      <td><span class="badge badge-green">مكتملة</span></td>
    </tr>`).join('');
}

/* ── Products ── */
function renderProductsTable() {
  const query    = (document.getElementById('productSearch')?.value||'').toLowerCase();
  let products   = getProducts();
  if (query) products = products.filter(p=>p.name.toLowerCase().includes(query)||p.barcode.includes(query));
  const tbody    = document.getElementById('productsTableBody');
  if (!tbody) return;
  if (!products.length) { tbody.innerHTML='<tr><td colspan="6" class="empty-row">لا توجد منتجات</td></tr>'; return; }
  tbody.innerHTML = products.map((p,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(p.name)}</strong></td>
      <td style="direction:ltr;text-align:right;font-family:monospace;font-size:.82rem;color:var(--text-muted)">${escHtml(p.barcode)}</td>
      <td style="font-weight:700;background:linear-gradient(90deg,#00E5CC,#7B6FFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${formatMoney(p.price)}</td>
      <td>${p.qty??'-'}</td>
      <td>
        <button class="btn-icon btn-edit" onclick="editProduct('${p.id}')" title="تعديل">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-del" onclick="removeProduct('${p.id}')" title="حذف" style="margin-right:.35rem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>`).join('');
}

function openAddProduct() {
  document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد';
  document.getElementById('productId').value = '';
  document.getElementById('productForm').reset();
  document.getElementById('productQty').value = 100;
  document.getElementById('productModal').classList.remove('hidden');
}
function editProduct(id) {
  const p = getProducts().find(x=>x.id===id);
  if (!p) return;
  document.getElementById('productModalTitle').textContent = 'تعديل المنتج';
  document.getElementById('productId').value    = p.id;
  document.getElementById('productName').value  = p.name;
  document.getElementById('productPrice').value = p.price;
  document.getElementById('productBarcode').value = p.barcode;
  document.getElementById('productQty').value   = p.qty??0;
  document.getElementById('productModal').classList.remove('hidden');
}
function closeProductModal() { document.getElementById('productModal').classList.add('hidden'); }
function saveProduct(e) {
  e.preventDefault();
  const id      = document.getElementById('productId').value;
  const name    = document.getElementById('productName').value.trim();
  const price   = parseFloat(document.getElementById('productPrice').value);
  const barcode = document.getElementById('productBarcode').value.trim();
  const qty     = parseInt(document.getElementById('productQty').value)||0;
  if (!name||isNaN(price)||!barcode) { showToast(document.getElementById('toast'),'يرجى ملء جميع الحقول','error'); return; }
  addProduct({id:id||uid(),name,price,barcode,qty});
  closeProductModal();
  renderProductsTable();
  showToast(document.getElementById('toast'),id?'تم تحديث المنتج':'تمت إضافة المنتج','success');
}
function removeProduct(id) {
  if (!confirmAction('هل أنت متأكد من حذف هذا المنتج؟')) return;
  deleteProduct(id);
  renderProductsTable();
  showToast(document.getElementById('toast'),'تم حذف المنتج','info');
}

/* ── Sellers ── */
function renderSellersTable() {
  const sellers = getSellers();
  const tbody   = document.getElementById('sellersTableBody');
  if (!tbody) return;
  if (!sellers.length) { tbody.innerHTML='<tr><td colspan="7" class="empty-row">لا يوجد بائعون بعد</td></tr>'; return; }
  const sales = getSales().filter(s=>s.status==='completed');
  const today = todayKey();
  tbody.innerHTML = sellers.map((s,i)=>{
    const ss   = sales.filter(x=>x.sellerId===s.id);
    const tod  = ss.filter(x=>new Date(x.createdAt).toISOString().slice(0,10)===today).reduce((a,x)=>a+x.total,0);
    const all  = ss.reduce((a,x)=>a+x.total,0);
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td style="color:var(--text-muted)">${escHtml(s.username)}</td>
      <td>${formatMoney(tod)}</td>
      <td style="font-weight:700;background:linear-gradient(90deg,#00E5CC,#7B6FFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${formatMoney(all)}</td>
      <td><span class="badge ${s.active?'badge-green':'badge-red'}">${s.active?'نشط':'موقوف'}</span></td>
      <td>
        <button class="btn-icon btn-edit" onclick="editSeller('${s.id}')" title="تعديل">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon ${s.active?'btn-del':'btn-edit'}" onclick="toggleSeller('${s.id}')" title="${s.active?'إيقاف':'تفعيل'}" style="margin-right:.35rem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/>${s.active?'<line x1="8" y1="12" x2="16" y2="12"/>':'<line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'}</svg>
        </button>
        <button class="btn-icon btn-del" onclick="removeSeller('${s.id}')" title="حذف" style="margin-right:.35rem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}
function openAddSeller() {
  document.getElementById('sellerModalTitle').textContent = 'إضافة بائع جديد';
  document.getElementById('sellerId').value = '';
  document.getElementById('sellerForm').reset();
  document.getElementById('sellerPassword').required = true;
  document.getElementById('sellerModal').classList.remove('hidden');
}
function editSeller(id) {
  const s = getSellers().find(x=>x.id===id);
  if (!s) return;
  document.getElementById('sellerModalTitle').textContent = 'تعديل البائع';
  document.getElementById('sellerId').value       = s.id;
  document.getElementById('sellerFullName').value = s.name;
  document.getElementById('sellerUsername').value = s.username;
  document.getElementById('sellerPassword').value = '';
  document.getElementById('sellerPassword').required = false;
  document.getElementById('sellerModal').classList.remove('hidden');
}
function closeSellerModal() { document.getElementById('sellerModal').classList.add('hidden'); }
function saveSeller(e) {
  e.preventDefault();
  const id       = document.getElementById('sellerId').value;
  const name     = document.getElementById('sellerFullName').value.trim();
  const username = document.getElementById('sellerUsername').value.trim();
  const password = document.getElementById('sellerPassword').value;
  if (!name||!username) { showToast(document.getElementById('toast'),'يرجى ملء جميع الحقول','error'); return; }
  if (id) {
    const upd = {name,username};
    if (password) upd.password = password;
    updateSeller(id,upd);
    closeSellerModal(); renderSellersTable();
    showToast(document.getElementById('toast'),'تم تحديث بيانات البائع','success');
  } else {
    if (!password) { showToast(document.getElementById('toast'),'كلمة المرور مطلوبة','error'); return; }
    const ok = addSeller({id:uid(),name,username,password,role:'seller',active:true,createdAt:Date.now()});
    if (!ok) { showToast(document.getElementById('toast'),'اسم المستخدم مستخدم مسبقًا','error'); return; }
    closeSellerModal(); renderSellersTable();
    showToast(document.getElementById('toast'),'تمت إضافة البائع بنجاح','success');
  }
}
function toggleSeller(id) {
  const s = getUsers().find(u=>u.id===id);
  if (!s) return;
  updateSeller(id,{active:!s.active});
  renderSellersTable();
  showToast(document.getElementById('toast'),s.active?'تم إيقاف الحساب':'تم تفعيل الحساب','info');
}
function removeSeller(id) {
  if (!confirmAction('هل أنت متأكد من حذف هذا البائع؟')) return;
  deleteSeller(id); renderSellersTable();
  showToast(document.getElementById('toast'),'تم حذف البائع','info');
}

/* ── Sales ── */
function populateSellerFilter() {
  const sel = document.getElementById('sellerFilter');
  const curr = sel.value;
  sel.innerHTML = '<option value="">جميع البائعين</option>' +
    getSellers().map(s=>`<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  sel.value = curr;
}
function renderSalesTable() {
  const sf = document.getElementById('sellerFilter')?.value||'';
  const df = document.getElementById('dateFilter')?.value||'';
  let sales = getSales().filter(s=>s.status==='completed');
  if (sf) sales = sales.filter(s=>s.sellerId===sf);
  if (df) sales = sales.filter(s=>new Date(s.createdAt).toISOString().slice(0,10)===df);
  const tbody = document.getElementById('salesTableBody');
  if (!tbody) return;
  if (!sales.length) { tbody.innerHTML='<tr><td colspan="6" class="empty-row">لا توجد مبيعات لهذا الفلتر</td></tr>'; return; }
  tbody.innerHTML = sales.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${formatDate(s.createdAt)}</td>
      <td>${escHtml(s.sellerName)}</td>
      <td style="font-size:.8rem;color:var(--text-muted)">${s.items.map(x=>escHtml(x.name)+' × '+x.qty).join('، ')}</td>
      <td style="font-weight:700;background:linear-gradient(90deg,#00E5CC,#7B6FFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${formatMoney(s.total)}</td>
      <td><span class="badge badge-green">مكتملة</span></td>
    </tr>`).join('');
}

/* ── Scanner ── */
function openScanModal(target) {
  document.getElementById('scanModal').classList.remove('hidden');
  adminScanner = new BarcodeScanner();
  adminScanner.start(
    'scannerContainer',
    code => {
      if (target==='product') document.getElementById('productBarcode').value = code;
      closeScanModal();
      showToast(document.getElementById('toast'),'تم قراءة الباركود: '+code,'success');
    },
    err => showToast(document.getElementById('toast'),'خطأ في الكاميرا','error')
  );
}
function closeScanModal() {
  if (adminScanner) { adminScanner.stop(); adminScanner = null; }
  document.getElementById('scanModal').classList.add('hidden');
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str||''));
  return d.innerHTML;
}
