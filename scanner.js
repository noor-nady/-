/* =============================================
   scanner.js — محرك الكاميرا والباركود السلس
   يعتمد على مكتبة html5-qrcode مع إعدادات متقدمة للسرعة والوضوح
   ============================================= */
'use strict';

class BarcodeScanner {
  constructor() {
    this.html5QrCode = null;
    this.containerId = null;
    this.active = false;
    this.onSuccess = null;
    this.onError = null;
  }

  /* ─── بدء مسح الباركود ─── */
  async start(containerId, onSuccess, onError) {
    this.containerId = containerId;
    this.onSuccess = onSuccess;
    this.onError = onError;
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    // إنشاء قسم مستقل للكاميرا
    const scannerDiv = document.createElement('div');
    scannerDiv.id = `ks-scanner-box-${containerId}`;
    // إخفاء الـ border الأساسي الذي تضعه المكتبة
    scannerDiv.style.width = '100%';
    scannerDiv.style.border = 'none';
    scannerDiv.style.overflow = 'hidden';
    container.appendChild(scannerDiv);
    
    if (typeof Html5Qrcode === 'undefined') {
      if (this.onError) this.onError(new Error("المكتبة غير متوفرة"));
      this._showPermissionError(new Error("المكتبة غير متوفرة"));
      return;
    }

    try {
      // إجبار المكتبة على دعم أشهر أنواع الباركود المطبوعة
      // رقم 0 هو QR، والأنواع الأخرى للباركود الشريطي (1D)
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE
      ];

      this.html5QrCode = new Html5Qrcode(scannerDiv.id, { formatsToSupport });
      this.active = true;
      
      const config = { 
        fps: 25, // فريمات عالية لسرعة التقاط الصورة
        // تم تعطيل qrbox حتى تتمكن الكاميرا من قراءة الباركود من أي مكان في الشاشة وليس من المربع الأوسط فقط
        aspectRatio: 1.333,
        disableFlip: false
      };

      // إعدادات الكاميرا للحصول على أفضل دقة وتركيز تلقائي
      const videoConstraints = {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        // محاولة تفعيل التركيز التلقائي المستمر (مفيد للهواتف)
        advanced: [{ focusMode: "continuous" }]
      };

      await this.html5QrCode.start(
        videoConstraints,
        config,
        (decodedText, decodedResult) => {
          if (!this.active) return;
          this.stop(); // إيقاف الكاميرا فوراً لقراءة قيمة واحدة
          if (this.onSuccess) this.onSuccess(decodedText.trim());
        },
        (errorMessage) => {
          // يتم تجاهل هذا الخطأ لأنه يحدث عشرات المرات في الثانية عندما لا يجد باركود
        }
      );
      
      // تنسيق الفيديو ليطابق التصميم الزجاجي السلس
      setTimeout(() => {
        const videoEl = document.querySelector(`#${scannerDiv.id} video`);
        if(videoEl) {
          videoEl.style.borderRadius = '14px';
          videoEl.style.objectFit = 'cover';
          videoEl.style.width = '100%';
        }
      }, 500);

    } catch (err) {
      this.active = false;
      this._showPermissionError(err);
      if (this.onError) this.onError(err);
    }
  }

  stop() {
    this.active = false;
    if (this.html5QrCode) {
      try {
        this.html5QrCode.stop().then(() => {
          this.html5QrCode.clear();
          this.html5QrCode = null;
        }).catch(err => console.warn(err));
      } catch (e) {}
    }
  }

  _showPermissionError(err) {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = `
      <div style="padding:1.5rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem;min-height:160px;justify-content:center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="1.5">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
          <line x1="1" y1="1" x2="23" y2="23" stroke="#F43F5E"/>
        </svg>
        <p style="color:#F87171;font-size:.9rem;max-width:280px">تعذر الوصول للكاميرا، يرجى إدخال الباركود يدوياً.</p>
        <div style="width:100%;max-width:300px">
          <input type="text" id="manual-bc-input" placeholder="رقم الباركود..."
            dir="ltr" style="width:100%;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.15);
            border-radius:8px;padding:.7rem 1rem;color:#F0F2FF;font-size:1rem;outline:none;
            text-align:center;font-family:'Cairo',sans-serif"/>
          <button onclick="window._ks_manual()" 
            style="margin-top:.6rem;width:100%;padding:.65rem;
            background:linear-gradient(135deg,#7B6FFF,#00E5CC);
            color:#fff;border:none;border-radius:8px;
            font-family:'Cairo',sans-serif;font-weight:700;font-size:.9rem;cursor:pointer">
            بحث
          </button>
        </div>
      </div>`;
      
    const inp = document.getElementById('manual-bc-input');
    if (inp) { 
      inp.focus(); 
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') window._ks_manual(); }); 
    }
    
    window._ks_manual = () => {
      const v = document.getElementById('manual-bc-input')?.value?.trim();
      if (v && this.onSuccess) {
          this.stop();
          this.onSuccess(v);
      }
    };
  }
}

window.BarcodeScanner = BarcodeScanner;
