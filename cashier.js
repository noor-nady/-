/* =============================================
   cashier.js — منطق شاشة الكاشير
   ============================================= */
'use strict';

let cart = [];
let currentProduct = null;
let cashierScanner = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth('seller');
  if (!user) return;

  document.getElementById('cashierName').textContent   = user.name;
  document.getElementById('cashierAvatar').textContent = user.name.charAt(0).toUpperCase();
  updateClock();
  setInterval(updateClock, 1000);

  document.getElementById('logoutBtnCashier').addEventListener('click', logoutUser);

  // Barcode field
  const barcodeInput = document.getElementById('barcodeInput');
  barcodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleBarcodeInput(barcodeInput.value.trim()); }
  });

  // Camera scan toggle
  const camBtn  = document.getElementById('openCamScan');
  const camWrap = document.getElementById('camScannerWrap');

  camBtn.addEventListener('click', () => {
    if (cashierScanner) {
      // Already running — stop
      stopCashierCamera();
    } else {
      // Start
      camWrap.classList.remove('hidden');
      camBtn.classList.add('active');
      cashierScanner = new BarcodeScanner();
      cashierScanner.start(
        'cashierScannerContainer',
        code => {
          stopCashierCamera();
          handleBarcodeInput(code);
          showToast(document.getElementById('toastCashier'),'تم مسح الباركود','success');
        },
        err => {
          showToast(document.getElementById('toastCashier'),'تعذّر فتح الكاميرا','error');
        }
      );
    }
  });

  document.getElementById('stopCamScan').addEventListener('click', stopCashierCamera);

  // Qty
  document.getElementById('increaseQty').addEventListener('click', () => {
    const q = document.getElementById('itemQty');
    q.value = Math.min(999, parseInt(q.value||1)+1);
  });
  document.getElementById('decreaseQty').addEventListener('click', () => {
    const q = document.getElementById('itemQty');
    q.value = Math.max(1, parseInt(q.value||1)-1);
  });

  document.getElementById('addToCartBtn').addEventListener('click', addCurrentToCart);

  document.getElementById('clearCartBtn').addEventListener('click', () => {
    if (!cart.length) return;
    if (confirmAction('هل تريد مسح جميع المنتجات من الفاتورة؟')) {
      cart = []; renderCart(); resetProductCard();
    }
  });

  document.getElementById('discountInput').addEventListener('input', updateTotals);

  // Payment method
  document.querySelectorAll('.pm-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.pm-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      opt.querySelector('input').checked = true;
      const isCash = opt.querySelector('input').value === 'cash';
      document.getElementById('cashReceivedWrap').style.display = isCash ? '' : 'none';
      updateChange();
    });
  });

  document.getElementById('cashReceived').addEventListener('input', updateChange);
  document.getElementById('payBtn').addEventListener('click', processPayment);

  document.getElementById('cancelSaleBtn').addEventListener('click', () => {
    if (!cart.length) return;
    if (confirmAction('هل أنت متأكد من إلغاء الفاتورة؟')) {
      cart = []; renderCart(); resetProductCard();
      document.getElementById('discountInput').value = 0;
      updateTotals();
      showToast(document.getElementById('toastCashier'),'تم إلغاء الفاتورة','info');
    }
  });

  document.getElementById('printReceipt').addEventListener('click', printReceipt);
  document.getElementById('newSaleBtn').addEventListener('click', startNewSale);
  document.getElementById('successModal').addEventListener('click', e => {
    if (e.target === document.getElementById('successModal')) startNewSale();
  });

  renderCart();
  updateTotals();
  barcodeInput.focus();
});

/* ── Clock ── */
function updateClock() {
  const el = document.getElementById('cashierTime');
  if (el) el.textContent = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

/* ── Camera ── */
function stopCashierCamera() {
  if (cashierScanner) { cashierScanner.stop(); cashierScanner = null; }
  document.getElementById('camScannerWrap').classList.add('hidden');
  document.getElementById('openCamScan').classList.remove('active');
  document.getElementById('cashierScannerContainer').innerHTML = '';
  document.getElementById('barcodeInput').focus();
}

/* ── Barcode ── */
function handleBarcodeInput(barcode) {
  if (!barcode) return;
  document.getElementById('barcodeInput').value = '';

  const product = findProductByBarcode(barcode);
  const card    = document.getElementById('productFoundCard');

  card.classList.remove('hidden');

  if (product) {
    currentProduct = product;
    document.getElementById('foundProductName').textContent    = product.name;
    document.getElementById('foundProductBarcode').textContent = product.barcode;
    document.getElementById('foundProductPrice').textContent   = formatMoney(product.price);
    document.getElementById('notFoundMsg').classList.add('hidden');
    document.getElementById('addToCartBtn').style.display = '';
    document.getElementById('itemQty').value = 1;
    document.getElementById('itemQty').focus();
  } else {
    currentProduct = null;
    document.getElementById('foundProductName').textContent    = 'منتج غير معروف';
    document.getElementById('foundProductBarcode').textContent = barcode;
    document.getElementById('foundProductPrice').textContent   = '—';
    document.getElementById('notFoundMsg').classList.remove('hidden');
    document.getElementById('addToCartBtn').style.display = 'none';
    showToast(document.getElementById('toastCashier'),'الباركود غير موجود في النظام','error');
  }
}

/* ── Cart ── */
function addCurrentToCart() {
  if (!currentProduct) return;
  const qty       = Math.max(1, parseInt(document.getElementById('itemQty').value)||1);
  const existing  = cart.findIndex(i => i.id === currentProduct.id);
  if (existing > -1) {
    cart[existing].qty      += qty;
    cart[existing].subtotal  = cart[existing].qty * cart[existing].price;
  } else {
    cart.push({ id:currentProduct.id, name:currentProduct.name, price:currentProduct.price, qty, subtotal:currentProduct.price*qty });
  }
  renderCart();
  updateTotals();
  const name = currentProduct.name;
  resetProductCard();
  showToast(document.getElementById('toastCashier'),`تمت إضافة "${name}"`, 'success');
  document.getElementById('barcodeInput').focus();
}

function removeFromCart(idx) { cart.splice(idx,1); renderCart(); updateTotals(); }

function renderCart() {
  const container = document.getElementById('cartItems');
  const emptyEl   = document.getElementById('cartEmpty');
  if (!cart.length) {
    container.innerHTML = '';
    if (emptyEl) { emptyEl.style.display='flex'; container.appendChild(emptyEl); }
    document.getElementById('payBtn').disabled = true;
    return;
  }
  document.getElementById('payBtn').disabled = false;
  if (emptyEl) emptyEl.style.display = 'none';
  container.innerHTML = cart.map((item,idx)=>`
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-meta">${formatMoney(item.price)} × ${item.qty}</div>
      </div>
      <div class="cart-item-price">${formatMoney(item.subtotal)}</div>
      <button class="cart-item-remove" onclick="removeFromCart(${idx})" title="إزالة">&#10005;</button>
    </div>`).join('');
}

/* ── Totals ── */
function updateTotals() {
  const subtotal    = cart.reduce((s,i) => s+i.subtotal,0);
  const discount    = Math.min(100, Math.max(0, parseFloat(document.getElementById('discountInput').value)||0));
  const discountAmt = subtotal*(discount/100);
  const grandTotal  = subtotal-discountAmt;
  document.getElementById('totalItems').textContent     = cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('subTotal').textContent       = formatMoney(subtotal);
  document.getElementById('discountAmount').textContent = formatMoney(discountAmt);
  document.getElementById('grandTotal').textContent     = formatMoney(grandTotal);
  updateChange();
}
function updateChange() {
  const gt       = parseFloat(document.getElementById('grandTotal').textContent)||0;
  const received = parseFloat(document.getElementById('cashReceived').value)||0;
  const change   = received - gt;
  const el       = document.getElementById('changeAmount');
  el.textContent = formatMoney(Math.max(0,change));
  el.style.color = change >= 0 ? 'var(--green)' : 'var(--red)';
}

/* ── Payment ── */
function processPayment() {
  if (!cart.length) return;
  const subtotal    = cart.reduce((s,i)=>s+i.subtotal,0);
  const discount    = Math.min(100,Math.max(0,parseFloat(document.getElementById('discountInput').value)||0));
  const discountAmt = subtotal*(discount/100);
  const grandTotal  = subtotal - discountAmt;
  const payMethod   = document.querySelector('input[name="payMethod"]:checked')?.value||'cash';
  const received    = parseFloat(document.getElementById('cashReceived').value)||0;

  if (payMethod==='cash' && received < grandTotal) {
    showToast(document.getElementById('toastCashier'),'المبلغ المستلم أقل من الإجمالي','error');
    return;
  }

  const session = getSession();
  const sale = {
    id:uid(), sellerId:session.id, sellerName:session.name,
    items:cart.map(i=>({name:i.name,price:i.price,qty:i.qty,subtotal:i.subtotal})),
    subtotal, discount, discountAmt, total:grandTotal,
    payMethod,
    cashReceived: payMethod==='cash' ? received : grandTotal,
    change: payMethod==='cash' ? received-grandTotal : 0,
    status:'completed', createdAt:Date.now(),
  };
  recordSale(sale);
  window._lastSale = sale;
  document.getElementById('receiptPreview').innerHTML = buildReceiptHtml(sale);
  document.getElementById('successModal').classList.remove('hidden');
}

function buildReceiptHtml(sale) {
  const items = sale.items.map(i=>`
    <div style="display:flex;justify-content:space-between;padding:.2rem 0;border-bottom:1px dashed rgba(255,255,255,0.1)">
      <span>${escHtml(i.name)} × ${i.qty}</span><span>${formatMoney(i.subtotal)}</span>
    </div>`).join('');
  return `
    <div style="text-align:center;margin-bottom:.75rem">
      <strong style="font-size:1rem;background:linear-gradient(90deg,#7B6FFF,#00E5CC);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">KASHEER</strong><br/>
      <small style="color:var(--text-muted)">نظام كاشير سوبر ماركت</small>
    </div>
    <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.5rem">
      التاريخ: ${formatDate(sale.createdAt)}<br/>البائع: ${escHtml(sale.sellerName)}
    </div>
    <div style="border-top:1px dashed rgba(255,255,255,0.1);padding-top:.5rem;margin-bottom:.5rem">${items}</div>
    <div style="display:flex;justify-content:space-between"><span>الإجمالي</span><span>${formatMoney(sale.subtotal)}</span></div>
    ${sale.discount>0?`<div style="display:flex;justify-content:space-between;color:var(--green)"><span>خصم (${sale.discount}%)</span><span>- ${formatMoney(sale.discountAmt)}</span></div>`:''}
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1rem;border-top:1px solid rgba(255,255,255,0.1);margin-top:.5rem;padding-top:.5rem">
      <span>الصافي</span>
      <span style="background:linear-gradient(90deg,#00E5CC,#7B6FFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${formatMoney(sale.total)}</span>
    </div>
    ${sale.payMethod==='cash'?`
    <div style="display:flex;justify-content:space-between;margin-top:.3rem"><span>مستلم</span><span>${formatMoney(sale.cashReceived)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>الباقي</span><span style="color:var(--green)">${formatMoney(sale.change)}</span></div>
    `:'<div style="text-align:center;margin-top:.5rem;color:var(--accent)">دفع بالبطاقة</div>'}
    <div style="text-align:center;margin-top:.75rem;font-size:.75rem;color:var(--text-muted)">شكرًا لتسوقكم معنا</div>`;
}

function printReceipt() {
  if (!window._lastSale) return;
  const el = document.getElementById('printArea');
  el.innerHTML = buildReceiptHtml(window._lastSale).replace(/var\(--[^)]+\)/g,'#000');
  el.classList.remove('hidden');
  window.print();
  el.classList.add('hidden');
}

function startNewSale() {
  cart = []; renderCart(); resetProductCard();
  document.getElementById('discountInput').value  = 0;
  document.getElementById('cashReceived').value   = '';
  updateTotals();
  document.getElementById('successModal').classList.add('hidden');
  document.getElementById('barcodeInput').focus();
}

function resetProductCard() {
  currentProduct = null;
  document.getElementById('productFoundCard').classList.add('hidden');
  document.getElementById('notFoundMsg').classList.add('hidden');
  document.getElementById('itemQty').value = 1;
  document.getElementById('barcodeInput').value = '';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str||''));
  return d.innerHTML;
}
