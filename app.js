/* ═══════════════════════════════════════════════════════════════════
   کیانا - حسابداری پیمانکاری
   app.js - بخش ۱: هسته، تقویم، امنیت، آمار
═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─────────────────────────────────────────────────────────────
   1) ابزارهای عمومی
───────────────────────────────────────────────────────────── */
const $  = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

const STORAGE = {
  get(k, def) {
    try { const v = localStorage.getItem('kiana_' + k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  },
  set(k, v) { try { localStorage.setItem('kiana_' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('kiana_' + k); } catch (e) {} },
  clearAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('kiana_'))
      .forEach((k) => localStorage.removeItem(k));
  }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad2 = (n) => String(n).padStart(2, '0');

/* تبدیل اعداد به فارسی */
function toFa(str) {
  if (str === null || str === undefined) return '';
  const digits = '۰۱۲۳۴۵۶۷۸۹';
  return String(str).replace(/\d/g, (d) => digits[+d]);
}

/* تبدیل اعداد فارسی/عربی به انگلیسی */
function toEn(str) {
  if (!str) return '';
  return String(str)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

/* عدد با جداکننده هزارگان فارسی */
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '۰';
  const num = Math.round(Number(n));
  return toFa(num.toLocaleString('en-US'));
}

function fmtMoney(n) { return fmtNum(n) + ' تومان'; }

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─────────────────────────────────────────────────────────────
   2) تقویم شمسی (بدون کتابخانه)
───────────────────────────────────────────────────────────── */
const JALALI = (function () {

  function div(a, b) { return Math.floor(a / b); }

  function g2j(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = gy <= 1600 ? 0 : 979;
    gy -= gy <= 1600 ? 621 : 1600;
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days =
      365 * gy +
      div(gy2 + 3, 4) -
      div(gy2 + 99, 100) +
      div(gy2 + 399, 400) -
      80 +
      gd +
      g_d_m[gm - 1];
    jy += 33 * div(days, 12053);
    days %= 12053;
    jy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) {
      jy += div(days - 1, 365);
      days = (days - 1) % 365;
    }
    const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
    const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return [jy, jm, jd];
  }

  function j2g(jy, jm, jd) {
    let gy = jy <= 979 ? 621 : 1600;
    jy -= jy <= 979 ? 0 : 979;
    let days =
      365 * jy +
      div(jy, 33) * 8 +
      div((jy % 33) + 3, 4) +
      78 +
      jd +
      (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    gy += 400 * div(days, 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * div(--days, 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) {
      gy += div(days - 1, 365);
      days = (days - 1) % 365;
    }
    let gd = days + 1;
    const sal_a = [
      0, 31,
      (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    ];
    let gm;
    for (gm = 1; gm <= 12; gm++) {
      if (gd <= sal_a[gm]) break;
      gd -= sal_a[gm];
    }
    return [gy, gm, gd];
  }

  function isLeapJ(jy) {
    return (((jy + 2346) * 683) % 2820) < 683;
  }

  function daysInMonth(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJ(jy) ? 30 : 29;
  }

  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const WEEKDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

  function todayJ() {
    const d = new Date();
    return g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function formatJ(jy, jm, jd) {
    return toFa(jy) + '/' + toFa(pad2(jm)) + '/' + toFa(pad2(jd));
  }

  function dayOfWeek(jy, jm, jd) {
    const [gy, gm, gd] = j2g(jy, jm, jd);
    const d = new Date(gy, gm - 1, gd);
    return (d.getDay() + 1) % 7;
  }

  function parseJ(s) {
    if (!s) return null;
    const en = toEn(s).replace(/[^\d]/g, '');
    if (en.length < 8) return null;
    const jy = parseInt(en.substring(0, 4), 10);
    const jm = parseInt(en.substring(4, 6), 10);
    const jd = parseInt(en.substring(6, 8), 10);
    if (!jy || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    return [jy, jm, jd];
  }

  function todayStr() {
    const [jy, jm, jd] = todayJ();
    return formatJ(jy, jm, jd);
  }

  function daysBetween(j1, j2) {
    const [y1, m1, d1] = j1;
    const [y2, m2, d2] = j2;
    const [gy1, gm1, gd1] = j2g(y1, m1, d1);
    const [gy2, gm2, gd2] = j2g(y2, m2, d2);
    const t1 = new Date(gy1, gm1 - 1, gd1).getTime();
    const t2 = new Date(gy2, gm2 - 1, gd2).getTime();
    return Math.round((t2 - t1) / 86400000);
  }

  function addMonths(jy, jm, delta) {
    const total = (jy * 12 + (jm - 1)) + delta;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return [ny, nm];
  }

  return {
    g2j, j2g, isLeapJ, daysInMonth, todayJ, formatJ, dayOfWeek,
    parseJ, todayStr, daysBetween, addMonths,
    MONTHS, WEEKDAYS
  };
})();

/* ─────────────────────────────────────────────────────────────
   3) Toast
───────────────────────────────────────────────────────────── */
const Toast = {
  show(msg, type = 'info', duration = 2800) {
    const container = $('#toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;

    const icons = {
      success: '<polyline points="20 6 9 17 4 12"/>',
      error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
      info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
      warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
    };

    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + (icons[type] || icons.info) + '</svg><span>' + esc(msg) + '</span>';
    container.appendChild(el);

    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },
  success(m) { this.show(m, 'success'); },
  error(m)   { this.show(m, 'error', 3200); },
  info(m)    { this.show(m, 'info'); },
  warn(m)    { this.show(m, 'warning', 3000); }
};

/* ─────────────────────────────────────────────────────────────
   4) Bottom Sheet
───────────────────────────────────────────────────────────── */
const Sheet = {
  open(title, contentHTML, onMount) {
    $('#sheetTitle').textContent = title;
    $('#sheetContent').innerHTML = contentHTML;
    $('#modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    if (typeof onMount === 'function') {
      setTimeout(() => onMount($('#sheetContent')), 30);
    }
  },
  close() {
    $('#modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { $('#sheetContent').innerHTML = ''; }, 300);
  }
};

/* ─────────────────────────────────────────────────────────────
   5) تقویم تعاملی
───────────────────────────────────────────────────────────── */
const Calendar = {
  view: { jy: 0, jm: 0 },
  selected: null,
  targetInput: null,
  onSelect: null,

  init() {
    const [jy, jm] = JALALI.todayJ();
    this.view = { jy, jm };

    const prev = $('#calPrev');
    const next = $('#calNext');
    const today = $('#calToday');
    const popup = $('#calendarPopup');

    if (prev) prev.addEventListener('click', () => this.nav(-1));
    if (next) next.addEventListener('click', () => this.nav(1));
    if (today) today.addEventListener('click', () => {
      const [ty, tm, td] = JALALI.todayJ();
      this.view = { jy: ty, jm: tm };
      this.select(ty, tm, td);
    });
    if (popup) popup.addEventListener('click', (e) => {
      if (e.target === popup) this.close();
    });
  },

  open(inputEl, onSelect) {
    this.targetInput = inputEl;
    this.onSelect = onSelect || null;
    const parsed = JALALI.parseJ(inputEl.value) || JALALI.todayJ();
    this.view = { jy: parsed[0], jm: parsed[1] };
    this.selected = parsed;
    this.render();
    $('#calendarPopup').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    $('#calendarPopup').classList.remove('active');
    document.body.style.overflow = '';
    this.targetInput = null;
  },

  nav(delta) {
    const [ny, nm] = JALALI.addMonths(this.view.jy, this.view.jm, delta);
    this.view = { jy: ny, jm: nm };
    this.render();
  },

  select(jy, jm, jd) {
    this.selected = [jy, jm, jd];
    const str = JALALI.formatJ(jy, jm, jd);
    if (this.targetInput) this.targetInput.value = str;
    if (typeof this.onSelect === 'function') this.onSelect(str, jy, jm, jd);
    setTimeout(() => this.close(), 120);
  },

  render() {
    const { jy, jm } = this.view;
    const [ty, tm, td] = JALALI.todayJ();
    const isCurrentMonth = (jy === ty && jm === tm);

    $('#calMonthName').textContent = JALALI.MONTHS[jm - 1];
    $('#calYearNum').textContent = toFa(jy);

    const grid = $('#calGrid');
    grid.innerHTML = '';

    const daysInMonth = JALALI.daysInMonth(jy, jm);
    const firstDay = JALALI.dayOfWeek(jy, jm, 1);

    for (let i = 0; i < firstDay; i++) {
      const d = document.createElement('div');
      d.className = 'cal-day empty';
      grid.appendChild(d);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const el = document.createElement('div');
      el.className = 'cal-day';
      el.textContent = toFa(day);

      const isToday = isCurrentMonth && day === td;
      const isSelected = this.selected &&
        this.selected[0] === jy &&
        this.selected[1] === jm &&
        this.selected[2] === day;

      if (isToday) el.classList.add('today');
      if (isSelected) el.classList.add('selected');

      el.addEventListener('click', () => this.select(jy, jm, day));
      grid.appendChild(el);
    }
  }
};

/* اتصال خودکار به همه input های تاریخ */
function attachDatePicker(inputEl) {
  if (!inputEl || inputEl.dataset.dpAttached) return;
  inputEl.dataset.dpAttached = '1';
  inputEl.readOnly = true;
  inputEl.addEventListener('click', (e) => {
    e.preventDefault();
    Calendar.open(inputEl);
  });
  inputEl.addEventListener('focus', (e) => {
    e.preventDefault();
    Calendar.open(inputEl);
  });
}

/* ─────────────────────────────────────────────────────────────
   6) State
───────────────────────────────────────────────────────────── */
const State = {
  incomes:    [],
  purchases:  [],
  daily:      [],
  bank:       [],
  rentals:    [],
  invoices:   [],
  projects:   [],
  crews:      [],
  works:      [],
  payments:   [],
  categories: ['خوراک', 'حمل و نقل', 'اداری', 'شخصی', 'سرگرمی', 'متفرقه'],
  profile:    { name: '', company: '' },
  settings:   { theme: 'light', pin: '', biometric: false, biometricCredId: null }
};

function loadState() {
  State.incomes    = STORAGE.get('incomes', []);
  State.purchases  = STORAGE.get('purchases', []);
  State.daily      = STORAGE.get('daily', []);
  State.bank       = STORAGE.get('bank', []);
  State.rentals    = STORAGE.get('rentals', []);
  State.invoices   = STORAGE.get('invoices', []);
  State.projects   = STORAGE.get('projects', []);
  State.crews      = STORAGE.get('crews', []);
  State.works      = STORAGE.get('works', []);
  State.payments   = STORAGE.get('payments', []);
  State.categories = STORAGE.get('categories', State.categories);
  State.profile    = STORAGE.get('profile', State.profile);
  State.settings   = Object.assign(State.settings, STORAGE.get('settings', {}));
}

function saveState(key) {
  if (!key || key === 'all') {
    STORAGE.set('incomes', State.incomes);
    STORAGE.set('purchases', State.purchases);
    STORAGE.set('daily', State.daily);
    STORAGE.set('bank', State.bank);
    STORAGE.set('rentals', State.rentals);
    STORAGE.set('invoices', State.invoices);
    STORAGE.set('projects', State.projects);
    STORAGE.set('crews', State.crews);
    STORAGE.set('works', State.works);
    STORAGE.set('payments', State.payments);
    STORAGE.set('categories', State.categories);
    STORAGE.set('profile', State.profile);
    STORAGE.set('settings', State.settings);
    return;
  }
  if (key === 'settings')   { STORAGE.set('settings', State.settings); return; }
  if (key === 'profile')    { STORAGE.set('profile', State.profile); return; }
  if (key === 'categories') { STORAGE.set('categories', State.categories); return; }
  if (Array.isArray(State[key])) STORAGE.set(key, State[key]);
}

/* ─────────────────────────────────────────────────────────────
   7) صفحه قفل + PIN + WebAuthn
───────────────────────────────────────────────────────────── */
const Lock = {
  buffer: '',
  mode: 'unlock',
  tempPin: '',
  onSuccess: null,

  init() {
    if (!State.settings.pin) {
      this.mode = 'set';
      $('#lockSubtitle').textContent = 'یک رمز ۴ رقمی برای شروع تنظیم کنید';
    } else {
      this.mode = 'unlock';
      $('#lockSubtitle').textContent = 'رمز ۴ رقمی خود را وارد کنید';
    }

    if (State.settings.biometric && State.settings.biometricCredId && window.PublicKeyCredential) {
      $('#fingerprintBtn').style.display = 'inline-flex';
    }

    $$('#pinPad .pin-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'back') this.back();
        else if (key >= '0' && key <= '9') this.press(key);
      });
    });

    $('#fingerprintBtn').addEventListener('click', () => this.authenticateBiometric());
    $('#forgotPin').addEventListener('click', () => this.forgotPin());
  },

  press(digit) {
    if (this.buffer.length >= 4) return;
    this.buffer += digit;
    this.updateDots();
    if (this.buffer.length === 4) {
      setTimeout(() => this.submit(), 180);
    }
  },

  back() {
    this.buffer = this.buffer.slice(0, -1);
    this.updateDots();
  },

  updateDots() {
    $$('#pinDots .pin-dot').forEach((d, i) => {
      d.classList.toggle('filled', i < this.buffer.length);
    });
  },

  clear() { this.buffer = ''; this.updateDots(); },

  error(msg) {
    const el = $('#pinError');
    el.textContent = msg;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => { el.textContent = ''; }, 2000);
  },

  submit() {
    const pin = this.buffer;
    this.clear();

    if (this.mode === 'set') {
      this.tempPin = pin;
      this.mode = 'confirm';
      $('#lockSubtitle').textContent = 'رمز را دوباره وارد کنید';
      return;
    }

    if (this.mode === 'confirm') {
      if (pin === this.tempPin) {
        State.settings.pin = this.tempPin;
        saveState('settings');
        this.tempPin = '';
        Toast.success('رمز با موفقیت تنظیم شد');
        this.enterApp();
      } else {
        this.error('رمزها یکسان نیستند');
        this.mode = 'set';
        this.tempPin = '';
        $('#lockSubtitle').textContent = 'یک رمز ۴ رقمی برای شروع تنظیم کنید';
      }
      return;
    }

    if (this.mode === 'unlock') {
      if (pin === State.settings.pin) this.enterApp();
      else this.error('رمز اشتباه است');
      return;
    }

    if (this.mode === 'change-old') {
      if (pin === State.settings.pin) {
        this.mode = 'change-new';
        $('#lockSubtitle').textContent = 'رمز جدید را وارد کنید';
      } else this.error('رمز فعلی اشتباه است');
      return;
    }

    if (this.mode === 'change-new') {
      this.tempPin = pin;
      this.mode = 'change-confirm';
      $('#lockSubtitle').textContent = 'رمز جدید را دوباره وارد کنید';
      return;
    }

    if (this.mode === 'change-confirm') {
      if (pin === this.tempPin) {
        State.settings.pin = this.tempPin;
        saveState('settings');
        this.tempPin = '';
        Toast.success('رمز با موفقیت تغییر کرد');
        this.close();
        if (typeof this.onSuccess === 'function') this.onSuccess();
      } else {
        this.error('رمزها یکسان نیستند');
        this.mode = 'change-new';
        this.tempPin = '';
        $('#lockSubtitle').textContent = 'رمز جدید را وارد کنید';
      }
      return;
    }
  },

  startChange(onSuccess) {
    this.mode = 'change-old';
    this.onSuccess = onSuccess || null;
    $('#lockSubtitle').textContent = 'رمز فعلی خود را وارد کنید';
    $('#lockScreen').style.display = 'flex';
    $('#app').classList.remove('active');
    this.clear();
  },

  close() {
    $('#lockScreen').style.display = 'none';
    $('#app').classList.add('active');
  },

  enterApp() {
    $('#lockScreen').style.display = 'none';
    $('#app').classList.add('active');
    App.refreshAll();
  },

  async authenticateBiometric() {
    if (!State.settings.biometricCredId) {
      Toast.error('ابتدا اثر انگشت را در تنظیمات فعال کنید');
      return;
    }
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const credId = base64ToUint8(State.settings.biometricCredId);
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: location.hostname || undefined,
          allowCredentials: [{ type: 'public-key', id: credId, transports: ['internal'] }]
        }
      });
      if (assertion) {
        Toast.success('ورود موفق');
        this.enterApp();
      }
    } catch (e) {
      console.warn(e);
      Toast.error('ورود با اثر انگشت ناموفق بود');
    }
  },

  async registerBiometric() {
    if (!window.PublicKeyCredential) {
      Toast.error('دستگاه شما از WebAuthn پشتیبانی نمی‌کند');
      return false;
    }
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'کیانا - حسابداری پیمانکاری', id: location.hostname || undefined },
          user: {
            id: userId,
            name: 'kiana-user',
            displayName: State.profile.name || 'کاربر کیانا'
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000,
          attestation: 'none'
        }
      });

      if (credential) {
        State.settings.biometric = true;
        State.settings.biometricCredId = uint8ToBase64(new Uint8Array(credential.rawId));
        saveState('settings');
        return true;
      }
      return false;
    } catch (e) {
      console.warn(e);
      Toast.error('فعال‌سازی اثر انگشت ناموفق بود');
      return false;
    }
  },

  forgotPin() {
    Sheet.open('بازیابی رمز', `
      <div style="text-align:center; padding:10px 0 20px;">
        <p style="font-size:13px; color:var(--text-soft); line-height:2; margin-bottom:18px;">
          در صورت فراموش کردن رمز، تنها راه بازیابی، حذف همه داده‌ها است.<br>
          <b style="color:var(--danger);">این عمل قابل بازگشت نیست!</b>
        </p>
        <p style="font-size:12px; color:var(--text-soft); margin-bottom:18px;">
          اگر پشتیبان JSON دارید می‌توانید پس از حذف، آن را بازیابی کنید.
        </p>
        <button class="btn btn-danger" id="confirmWipe" style="margin-bottom:10px;">
          بله، همه داده‌ها را حذف کن
        </button>
        <button class="btn btn-ghost" id="cancelWipe">انصراف</button>
      </div>
    `, (root) => {
      $('#confirmWipe', root).addEventListener('click', () => {
        Sheet.close();
        setTimeout(() => {
          if (confirm('برای اطمینان دوباره تأیید کنید: آیا مطمئن هستید؟')) {
            STORAGE.clearAll();
            location.reload();
          }
        }, 250);
      });
      $('#cancelWipe', root).addEventListener('click', Sheet.close);
    });
  }
};

/* Base64 ↔ Uint8 */
function uint8ToBase64(arr) {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
function base64ToUint8(str) {
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/* ─────────────────────────────────────────────────────────────
   8) فشرده‌سازی تصویر
───────────────────────────────────────────────────────────── */
function compressImage(file, maxSize = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────────────────────────────
   9) پارس پیامک بانکی
───────────────────────────────────────────────────────────── */
const SMS_PARSER = {
  banks: {
    'ملی': 'بانک ملی',
    'ملت': 'بانک ملت',
    'صادرات': 'بانک صادرات',
    'تجارت': 'بانک تجارت',
    'سپه': 'بانک سپه',
    'پاسارگاد': 'بانک پاسارگاد',
    'سامان': 'بانک سامان',
    'پرسپولیس': 'بانک پرسپولیس',
    'رفاه': 'بانک رفاه',
    'کشاورزی': 'بانک کشاورزی',
    'مسکن': 'بانک مسکن',
    'آینده': 'بانک آینده'
  },

  parse(text) {
    if (!text) return null;
    const en = toEn(text);
    const lines = en.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';

    let bankName = '';
    for (const b of Object.keys(this.banks)) {
      if (firstLine.includes(b) || en.slice(0, 100).includes(b)) {
        bankName = b;
        break;
      }
    }

    let amount = 0;
    const amountRegexes = [
      /(?:مبلغ|برداشت|واریز|انتقال|به مبلغ|بابت)\s*[:\-]?\s*([\d,٬،]+)/i,
      /([\d,٬،]{4,})\s*(?:ریال|تومان)/i
    ];
    for (const re of amountRegexes) {
      const m = en.match(re);
      if (m) {
        amount = parseInt(m[1].replace(/[,٬،]/g, ''), 10);
        break;
      }
    }

    const currency = /تومان/.test(en) ? 'toman' : 'rial';
    const amountToman = currency === 'rial' ? Math.round(amount / 10) : amount;

    let type = 'deposit';
    if (/برداشت|کسر|پرداخت/.test(en)) type = 'withdraw';
    else if (/انتقال/.test(en)) type = 'transfer';
    else if (/واریز|افزایش/.test(en)) type = 'deposit';

    let cardLast4 = '';
    const cardM = en.match(/\*{2,}\s*(\d{4})/);
    if (cardM) cardLast4 = cardM[1];
    else {
      const cardM2 = en.match(/(?:کارت|حساب)\s*[:\-]?\s*[\d*]*?(\d{4})(?!\d)/);
      if (cardM2) cardLast4 = cardM2[1];
    }

    let date = '';
    const dateM = en.match(/(1[34]\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (dateM) date = JALALI.formatJ(parseInt(dateM[1]), parseInt(dateM[2]), parseInt(dateM[3]));
    else date = JALALI.todayStr();

    let time = '';
    const timeM = en.match(/(\d{1,2}):(\d{2})/);
    if (timeM) time = pad2(timeM[1]) + ':' + pad2(timeM[2]);

    return {
      bank: bankName ? this.banks[bankName] : '',
      card: cardLast4,
      amount: amountToman,
      type,
      date,
      time,
      rawText: text
    };
  }
};

/* ─────────────────────────────────────────────────────────────
   10) آمار
───────────────────────────────────────────────────────────── */
const Stats = {
  totalIncome()   { return State.incomes.reduce((s, x) => s + (+x.amount || 0), 0); },
  totalPurchase() { return State.purchases.reduce((s, x) => s + (+x.amount || 0), 0); },
  totalDaily()    { return State.daily.reduce((s, x) => s + (+x.amount || 0), 0); },
  totalRentals()  { return State.rentals.reduce((s, x) => s + (+x.totalAmount || 0), 0); },
  netProfit()     { return this.totalIncome() - this.totalPurchase() - this.totalDaily() - this.totalRentals(); },
  activeProjects() { return State.projects.filter((p) => p.status !== 'done').length; },
  activeRentals()  { return State.rentals.filter((r) => r.status === 'active').length; },

  projectStats(projectName) {
    if (!projectName) return { income: 0, purchase: 0, profit: 0, contract: 0 };
    const inc = State.incomes.filter((x) => x.project === projectName)
      .reduce((s, x) => s + (+x.amount || 0), 0);
    const pur = State.purchases.filter((x) => x.project === projectName)
      .reduce((s, x) => s + (+x.amount || 0), 0);
    const prj = State.projects.find((p) => p.name === projectName);
    const contract = prj ? +prj.contract || 0 : 0;
    return { income: inc, purchase: pur, profit: inc - pur, contract };
  },

  /* ─── اکیپ ─── */
  activeCrews() { return State.crews.filter((c) => c.status !== 'inactive').length; },

  crewWorkedAmount(crewId) {
    return State.works
      .filter((w) => w.crewId === crewId)
      .reduce((s, w) => s + (+w.amount || 0), 0);
  },

  crewPaidAmount(crewId) {
    return State.payments
      .filter((p) => p.crewId === crewId)
      .reduce((s, p) => s + (+p.amount || 0), 0);
  },

  crewBalance(crewId) {
    return this.crewWorkedAmount(crewId) - this.crewPaidAmount(crewId);
  },

  totalWorksAmount()  { return State.works.reduce((s, w) => s + (+w.amount || 0), 0); },
  totalUnpaidWorks()  { return State.works.filter((w) => !w.paid).reduce((s, w) => s + (+w.amount || 0), 0); },
  totalPaymentsAmount() { return State.payments.reduce((s, p) => s + (+p.amount || 0), 0); },

  totalCrewDebt() {
    return Math.max(0, this.totalWorksAmount() - this.totalPaymentsAmount());
  },

  worksByProject(projectName) {
    return State.works
      .filter((w) => w.project === projectName)
      .reduce((s, w) => s + (+w.amount || 0), 0);
  },

  crewWorkedAmountInProject(crewId, projectName) {
    return State.works
      .filter((w) => w.crewId === crewId && w.project === projectName)
      .reduce((s, w) => s + (+w.amount || 0), 0);
  }
};

/* ابزار کمکی */
function emptyState(title, sub) {
  return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
      <p>${esc(title)}</p>
      <small>${esc(sub)}</small>
    </div>
  `;
}

function openImageViewer(src) {
  $('#imageViewerImg').src = src;
  $('#imageViewer').classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════════
   ادامه در بخش ۲: App + UI ماژول‌ها + راه‌اندازی
═══════════════════════════════════════════════════════════════════ *//* ═══════════════════════════════════════════════════════════════════
   App - هسته رفرش و ناوبری
═══════════════════════════════════════════════════════════════════ */
const App = {

  currentPage: 'dashboard',

  nav(page) {
    this.currentPage = page;
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + page));
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.nav === page));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.refreshPage(page);
  },

  refreshAll() {
    this.refreshDashboard();
    this.refreshIncomes();
    this.refreshPurchases();
    this.refreshDaily();
    this.refreshBank();
    this.refreshRentals();
    this.refreshInvoices();
    this.refreshProjects();
    this.refreshCrews();
    this.refreshWorks();
    this.refreshPayments();
    this.refreshReports();
    this.refreshSettings();
    this.refreshNotifications();
    this.refreshGreeting();
  },

  refreshPage(page) {
    switch (page) {
      case 'dashboard': this.refreshDashboard(); break;
      case 'incomes':   this.refreshIncomes(); break;
      case 'purchases': this.refreshPurchases(); break;
      case 'daily':     this.refreshDaily(); break;
      case 'bank':      this.refreshBank(); break;
      case 'rentals':   this.refreshRentals(); break;
      case 'invoices':  this.refreshInvoices(); break;
      case 'projects':  this.refreshProjects(); break;
      case 'crews':     this.refreshCrews(); break;
      case 'works':     this.refreshWorks(); break;
      case 'payments':  this.refreshPayments(); break;
      case 'reports':   this.refreshReports(); break;
      case 'settings':  this.refreshSettings(); break;
    }
  },

  refreshGreeting() {
    const h = new Date().getHours();
    let greet = 'سلام';
    if (h < 12) greet = 'صبح بخیر';
    else if (h < 17) greet = 'وقت بخیر';
    else if (h < 20) greet = 'عصر بخیر';
    else greet = 'شب بخیر';

    const name = State.profile.name ? '، ' + State.profile.name : '';
    const [jy, jm, jd] = JALALI.todayJ();
    const wd = JALALI.WEEKDAYS[JALALI.dayOfWeek(jy, jm, jd)];
    $('#headerGreeting').innerHTML = '<b>' + esc(greet + name) + '</b> · ' + esc(wd + ' ' + JALALI.formatJ(jy, jm, jd));
  },

  /* ─── داشبورد ─── */
  refreshDashboard() {
    $('#sumIncome').innerHTML   = fmtNum(Stats.totalIncome()) + ' <small>تومان</small>';
    $('#sumPurchase').innerHTML = fmtNum(Stats.totalPurchase()) + ' <small>تومان</small>';
    $('#sumDaily').innerHTML    = fmtNum(Stats.totalDaily()) + ' <small>تومان</small>';

    const profit = Stats.netProfit();
    $('#sumProfit').innerHTML = fmtNum(profit) + ' <small>تومان</small>';
    $('#sumProfit').style.color = profit >= 0 ? '#10B981' : '#EF4444';

    $('#sumProjects').innerHTML = fmtNum(Stats.activeProjects()) + ' <small>پروژه</small>';
    $('#sumCrews').innerHTML    = fmtNum(Stats.totalCrewDebt()) + ' <small>تومان</small>';

    this.renderChart();
    this.renderActivities();
  },

  renderChart() {
    const container = $('#chartBars');
    container.innerHTML = '';

    const today = JALALI.todayJ();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const [y, m] = JALALI.addMonths(today[0], today[1], -i);
      months.push({ jy: y, jm: m, income: 0, expense: 0 });
    }

    function matchMonth(dateStr) {
      const p = JALALI.parseJ(dateStr);
      if (!p) return null;
      return { jy: p[0], jm: p[1] };
    }

    State.incomes.forEach((x) => {
      const mm = matchMonth(x.date);
      if (!mm) return;
      const slot = months.find((m) => m.jy === mm.jy && m.jm === mm.jm);
      if (slot) slot.income += +x.amount || 0;
    });

    State.purchases.forEach((x) => {
      const mm = matchMonth(x.date);
      if (!mm) return;
      const slot = months.find((m) => m.jy === mm.jy && m.jm === mm.jm);
      if (slot) slot.expense += +x.amount || 0;
    });

    State.daily.forEach((x) => {
      const mm = matchMonth(x.date);
      if (!mm) return;
      const slot = months.find((m) => m.jy === mm.jy && m.jm === mm.jm);
      if (slot) slot.expense += +x.amount || 0;
    });

    State.works.forEach((x) => {
      const mm = matchMonth(x.date);
      if (!mm) return;
      const slot = months.find((m) => m.jy === mm.jy && m.jm === mm.jm);
      if (slot) slot.expense += +x.amount || 0;
    });

    const maxVal = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));

    months.forEach((m, idx) => {
      const group = document.createElement('div');
      group.className = 'chart-bar-group';

      const pair = document.createElement('div');
      pair.className = 'chart-bars-pair';

      const barInc = document.createElement('div');
      barInc.className = 'chart-bar income';
      barInc.style.height = (m.income / maxVal) * 100 + '%';
      barInc.style.animationDelay = (idx * 0.05) + 's';
      barInc.title = 'واریزی: ' + fmtMoney(m.income);

      const barExp = document.createElement('div');
      barExp.className = 'chart-bar expense';
      barExp.style.height = (m.expense / maxVal) * 100 + '%';
      barExp.style.animationDelay = (idx * 0.05 + 0.03) + 's';
      barExp.title = 'هزینه: ' + fmtMoney(m.expense);

      pair.appendChild(barInc);
      pair.appendChild(barExp);

      const label = document.createElement('div');
      label.className = 'chart-month';
      label.textContent = JALALI.MONTHS[m.jm - 1].slice(0, 4);

      group.appendChild(pair);
      group.appendChild(label);
      container.appendChild(group);
    });
  },

  renderActivities() {
    const all = [];

    State.incomes.forEach((x) =>
      all.push({ type: 'income', title: x.title, date: x.date, amount: +x.amount || 0, positive: true, meta: x.project || 'درآمد' }));
    State.purchases.forEach((x) =>
      all.push({ type: 'purchase', title: x.title, date: x.date, amount: +x.amount || 0, positive: false, meta: x.category || 'خرید' }));
    State.daily.forEach((x) =>
      all.push({ type: 'daily', title: x.title, date: x.date, amount: +x.amount || 0, positive: false, meta: x.category || 'روزانه' }));
    State.bank.forEach((x) =>
      all.push({ type: 'bank', title: x.bank + ' - ' + (x.type === 'deposit' ? 'واریز' : x.type === 'withdraw' ? 'برداشت' : 'انتقال'), date: x.date, amount: +x.amount || 0, positive: x.type === 'deposit', meta: 'بانکی' }));
    State.invoices.forEach((x) =>
      all.push({ type: 'invoice', title: 'فاکتور ' + x.title, date: x.date, amount: +x.amount || 0, positive: true, meta: x.customer || 'فاکتور' }));
    State.works.forEach((x) => {
      const c = State.crews.find((cc) => cc.id === x.crewId);
      const name = c ? c.name : '(حذف‌شده)';
      all.push({ type: 'work', title: 'کارکرد ' + name, date: x.date, amount: +x.amount || 0, positive: false, meta: x.project || 'اکیپ' });
    });
    State.payments.forEach((x) => {
      const c = State.crews.find((cc) => cc.id === x.crewId);
      const name = c ? c.name : '(حذف‌شده)';
      all.push({ type: 'payment', title: 'پرداخت به ' + name, date: x.date, amount: +x.amount || 0, positive: false, meta: 'دستمزد' });
    });

    all.sort((a, b) => {
      const pa = JALALI.parseJ(a.date);
      const pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    const list = all.slice(0, 6);
    const container = $('#activityList');

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:24px 10px;"><p>هنوز فعالیتی ثبت نشده</p><small>از دکمه + شروع کنید</small></div>';
      return;
    }

    const icons = {
      income:   '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      purchase: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
      daily:    '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h4l2 5h-6"/>',
      bank:     '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
      invoice:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      work:     '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M9 16l2 2 4-4"/>',
      payment:  '<rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="15" r="2"/>'
    };

    container.innerHTML = list.map((a) => `
      <div class="activity-item">
        <div class="activity-icon ${a.type}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            ${icons[a.type] || icons.income}
          </svg>
        </div>
        <div class="activity-body">
          <div class="activity-title">${esc(a.title)}</div>
          <div class="activity-meta">
            <span>${esc(a.date)}</span>
            <span>·</span>
            <span>${esc(a.meta)}</span>
          </div>
        </div>
        <div class="activity-amount ${a.positive ? 'positive' : 'negative'}">
          ${a.positive ? '+' : '−'} ${fmtNum(a.amount)}
        </div>
      </div>
    `).join('');
  },

  /* ─── واریزی ─── */
  refreshIncomes() {
    const q = ($('#searchIncomes').value || '').toLowerCase();
    let list = State.incomes.slice();
    if (q) {
      list = list.filter((x) =>
        (x.title || '').toLowerCase().includes(q) ||
        (x.project || '').toLowerCase().includes(q) ||
        (x.customer || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const pa = JALALI.parseJ(a.date), pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    $('#countIncomes').textContent = toFa(list.length);
    const container = $('#listIncomes');

    if (list.length === 0) {
      container.innerHTML = emptyState('واریزی‌ای ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = list.map((x) => `
      <div class="item-card" data-id="${x.id}">
        <div class="item-header">
          <div class="item-title">${esc(x.title)}</div>
          <div class="item-amount income">+ ${fmtNum(x.amount)}</div>
        </div>
        <div class="item-meta">
          <div class="item-meta-item">📅 ${esc(x.date)}</div>
          ${x.project ? `<div class="item-meta-item">📁 ${esc(x.project)}</div>` : ''}
          ${x.customer ? `<div class="item-meta-item">👤 ${esc(x.customer)}</div>` : ''}
          <span class="status-badge ${x.status === 'paid' ? 'status-paid' : 'status-pending'}">
            ${x.status === 'paid' ? 'پرداخت‌شده' : 'در انتظار'}
          </span>
        </div>
      </div>
    `).join('');

    $$('#listIncomes .item-card').forEach((card) => {
      card.addEventListener('click', () => IncomeUI.edit(card.dataset.id));
    });
  },

  /* ─── خرید ─── */
  refreshPurchases() {
    const q = ($('#searchPurchases').value || '').toLowerCase();
    const filter = ($('#chipsPurchases .chip.active') || {}).dataset?.filter || 'all';
    let list = State.purchases.slice();

    if (filter !== 'all') list = list.filter((x) => x.category === filter);
    if (q) {
      list = list.filter((x) =>
        (x.title || '').toLowerCase().includes(q) ||
        (x.project || '').toLowerCase().includes(q) ||
        (x.vendor || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const pa = JALALI.parseJ(a.date), pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    $('#countPurchases').textContent = toFa(list.length);
    const container = $('#listPurchases');

    if (list.length === 0) {
      container.innerHTML = emptyState('خریدی ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = list.map((x) => `
      <div class="item-card" data-id="${x.id}">
        <div class="item-header">
          <div class="item-title">${esc(x.title)}</div>
          <div class="item-amount expense">− ${fmtNum(x.amount)}</div>
        </div>
        <div class="item-meta">
          <div class="item-meta-item">📅 ${esc(x.date)}</div>
          ${x.category ? `<span class="status-badge status-active">${esc(x.category)}</span>` : ''}
          ${x.project ? `<div class="item-meta-item">📁 ${esc(x.project)}</div>` : ''}
          ${x.vendor ? `<div class="item-meta-item">👤 ${esc(x.vendor)}</div>` : ''}
        </div>
        ${(x.images && x.images.length) ? `
          <div class="thumb-list">
            ${x.images.map((img, i) => `<img class="thumb-img" data-img="${i}" src="${img}" alt="فاکتور" />`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    $$('#listPurchases .item-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('thumb-img')) return;
        PurchaseUI.edit(card.dataset.id);
      });
    });

    $$('#listPurchases .thumb-img').forEach((img) => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = img.closest('.item-card');
        const item = State.purchases.find((x) => x.id === card.dataset.id);
        if (item && item.images) openImageViewer(item.images[+img.dataset.img]);
      });
    });
  },

  /* ─── خرج روزانه ─── */
  refreshDaily() {
    const q = ($('#searchDaily').value || '').toLowerCase();
    const filter = ($('#chipsDaily .chip.active') || {}).dataset?.filter || 'all';
    let list = State.daily.slice();

    if (filter !== 'all') list = list.filter((x) => x.category === filter);
    if (q) list = list.filter((x) => (x.title || '').toLowerCase().includes(q));

    list.sort((a, b) => {
      const pa = JALALI.parseJ(a.date), pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    $('#countDaily').textContent = toFa(list.length);
    const container = $('#listDaily');

    if (list.length === 0) {
      container.innerHTML = emptyState('خرج روزانه‌ای ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = list.map((x) => `
      <div class="item-card" data-id="${x.id}">
        <div class="item-header">
          <div class="item-title">${esc(x.title)}</div>
          <div class="item-amount expense">− ${fmtNum(x.amount)}</div>
        </div>
        <div class="item-meta">
          <div class="item-meta-item">📅 ${esc(x.date)}</div>
          ${x.category ? `<span class="status-badge status-pending">${esc(x.category)}</span>` : ''}
        </div>
      </div>
    `).join('');

    $$('#listDaily .item-card').forEach((card) => {
      card.addEventListener('click', () => DailyUI.edit(card.dataset.id));
    });
  },

  /* ─── بانکی ─── */
  refreshBank() {
    const q = ($('#searchBank').value || '').toLowerCase();
    const filter = ($('#chipsBank .chip.active') || {}).dataset?.filter || 'all';
    let list = State.bank.slice();

    if (filter !== 'all') list = list.filter((x) => x.type === filter);
    if (q) {
      list = list.filter((x) =>
        (x.bank || '').toLowerCase().includes(q) ||
        (x.card || '').includes(q) ||
        (x.sms || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const pa = JALALI.parseJ(a.date), pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    $('#countBank').textContent = toFa(list.length);
    const container = $('#listBank');

    if (list.length === 0) {
      container.innerHTML = emptyState('تراکنشی ثبت نشده', 'از Paste هوشمند استفاده کنید');
      return;
    }

    container.innerHTML = list.map((x) => {
      const isPos = x.type === 'deposit';
      const typeLabel = x.type === 'deposit' ? 'واریز' : x.type === 'withdraw' ? 'برداشت' : 'انتقال';
      return `
      <div class="item-card" data-id="${x.id}">
        <div class="item-header">
          <div class="item-title">${esc(x.bank || 'بانک')} <span style="font-size:10.5px;color:var(--text-soft);font-weight:400;">${typeLabel} ${x.card ? '· ' + toFa(x.card) : ''}</span></div>
          <div class="item-amount ${isPos ? 'income' : 'expense'}">${isPos ? '+' : '−'} ${fmtNum(x.amount)}</div>
        </div>
        <div class="item-meta">
          <div class="item-meta-item">📅 ${esc(x.date)} ${x.time ? '- ' + toFa(x.time) : ''}</div>
          ${x.project ? `<div class="item-meta-item">📁 ${esc(x.project)}</div>` : ''}
          <span class="status-badge ${x.status === 'confirmed' ? 'status-paid' : 'status-pending'}">
            ${x.status === 'confirmed' ? 'تأییدشده' : 'در انتظار'}
          </span>
        </div>
      </div>
      `;
    }).join('');

    $$('#listBank .item-card').forEach((card) => {
      card.addEventListener('click', () => BankUI.edit(card.dataset.id));
    });
  },

  /* ─── اجاره ─── */
  refreshRentals() {
    const filter = ($('#chipsRentals .chip.active') || {}).dataset?.filter || 'all';
    let list = State.rentals.slice();
    if (filter !== 'all') list = list.filter((x) => x.status === filter);

    const today = JALALI.todayJ();
    const todayKey = today[0] * 10000 + today[1] * 100 + today[2];

    list.sort((a, b) => (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0));

    $('#countRentals').textContent = toFa(list.length);
    const container = $('#listRentals');

    if (list.length === 0) {
      container.innerHTML = emptyState('اجاره‌ای ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = list.map((x) => {
      const endP = JALALI.parseJ(x.endDate);
      const isOverdue = x.status === 'active' && endP && (endP[0] * 10000 + endP[1] * 100 + endP[2]) < todayKey;
      return `
      <div class="item-card" data-id="${x.id}">
        ${isOverdue ? `<div class="rental-alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          تاریخ خروج این دستگاه گذشته!
        </div>` : ''}
        <div class="item-header">
          <div class="item-title">${esc(x.title)}</div>
          <div class="item-amount gold">${fmtNum(x.totalAmount)}</div>
        </div>
        <div class="item-meta">
          <div class="item-meta-item">📅 ${esc(x.startDate)} → ${esc(x.endDate || '...')}</div>
          <div class="item-meta-item">⏱ ${toFa(x.days)} روز</div>
          ${x.owner ? `<div class="item-meta-item">👤 ${esc(x.owner)}</div>` : ''}
          ${x.project ? `<div class="item-meta-item">📁 ${esc(x.project)}</div>` : ''}
          <span class="status-badge ${x.status === 'active' ? 'status-active' : 'status-done'}">
            ${x.status === 'active' ? 'فعال' : 'تمام‌شده'}
          </span>
        </div>
      </div>
      `;
    }).join('');

    $$('#listRentals .item-card').forEach((card) => {
      card.addEventListener('click', () => RentalUI.edit(card.dataset.id));
    });
  },

  /* ─── فاکتور ─── */
  refreshInvoices() {
    const q = ($('#searchInvoices').value || '').toLowerCase();
    const filter = ($('#chipsInvoices .chip.active') || {}).dataset?.filter || 'all';
    let list = State.invoices.slice();

    if (filter !== 'all') list = list.filter((x) => x.status === filter);
    if (q) {
      list = list.filter((x) =>
        (x.title || '').toLowerCase().includes(q) ||
        (x.customer || '').toLowerCase().includes(q) ||
        (x.number || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const pa = JALALI.parseJ(a.date), pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    $('#countInvoices').textContent = toFa(list.length);
    const container = $('#listInvoices');

    if (list.length === 0) {
      container.innerHTML = emptyState('فاکتوری ثبت نشده', 'روی + بزنید');
      return;
    }

    const statusMap = {
      paid:    { cls: 'status-paid',    label: 'پرداخت‌شده' },
      pending: { cls: 'status-pending', label: 'در انتظار' },
      overdue: { cls: 'status-overdue', label: 'معوق' }
    };

    container.innerHTML = list.map((x) => {
      const st = statusMap[x.status] || statusMap.pending;
      return `
      <div class="item-card" data-id="${x.id}">
        <div class="item-header">
          <div class="item-title">${esc(x.title)}</div>
          <div class="item-amount">${fmtNum(x.amount)}</div>
        </div>
        <div class="item-meta">
          <div class="item-meta-item">🧾 ${toFa(x.number || '')}</div>
          <div class="item-meta-item">📅 ${esc(x.date)}</div>
          ${x.customer ? `<div class="item-meta-item">👤 ${esc(x.customer)}</div>` : ''}
          <span class="status-badge ${st.cls}">${st.label}</span>
        </div>
        ${(x.images && x.images.length) ? `
          <div class="thumb-list">
            ${x.images.map((img, i) => `<img class="thumb-img" data-img="${i}" src="${img}" alt="فاکتور" />`).join('')}
          </div>
        ` : ''}
      </div>
      `;
    }).join('');

    $$('#listInvoices .item-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('thumb-img')) return;
        InvoiceUI.edit(card.dataset.id);
      });
    });

    $$('#listInvoices .thumb-img').forEach((img) => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = img.closest('.item-card');
        const item = State.invoices.find((x) => x.id === card.dataset.id);
        if (item && item.images) openImageViewer(item.images[+img.dataset.img]);
      });
    });
  },

  /* ─── پروژه ─── */
  refreshProjects() {
    $('#countProjects').textContent = toFa(State.projects.length);
    const container = $('#listProjects');

    if (State.projects.length === 0) {
      container.innerHTML = emptyState('پروژه‌ای ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = State.projects.map((p) => {
      const st = Stats.projectStats(p.name);
      const progress = st.contract > 0 ? Math.min(100, Math.round((st.income / st.contract) * 100)) : 0;
      const workCost = Stats.worksByProject(p.name);

      return `
      <div class="item-card" data-id="${p.id}">
        <div class="item-header">
          <div class="item-title">${esc(p.name)}</div>
          <div class="item-amount">${fmtNum(p.contract)}</div>
        </div>
        <div class="item-meta">
          ${p.client ? `<div class="item-meta-item">👤 ${esc(p.client)}</div>` : ''}
          <div class="item-meta-item">📅 ${esc(p.startDate)} ${p.endDate ? '→ ' + esc(p.endDate) : ''}</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="item-meta" style="justify-content:space-between; margin-top:4px;">
          <span>دریافت: <b style="color:#10B981;">${fmtNum(st.income)}</b></span>
          <span>هزینه: <b style="color:#EF4444;">${fmtNum(st.purchase + workCost)}</b></span>
          <span>${toFa(progress)}٪</span>
        </div>
      </div>
      `;
    }).join('');

    $$('#listProjects .item-card').forEach((card) => {
      card.addEventListener('click', () => ProjectUI.edit(card.dataset.id));
    });
  },

  /* ─── اکیپ ─── */
  refreshCrews() {
    const q = ($('#searchCrews').value || '').toLowerCase();
    const filter = ($('#chipsCrews .chip.active') || {}).dataset?.filter || 'all';
    let list = State.crews.slice();

    if (filter === 'master')  list = list.filter((c) => c.type === 'master');
    if (filter === 'worker')  list = list.filter((c) => c.type === 'worker');
    if (filter === 'debt')    list = list.filter((c) => Stats.crewBalance(c.id) > 0);
    if (filter === 'settled') list = list.filter((c) => Stats.crewBalance(c.id) <= 0);

    if (q) {
      list = list.filter((c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.skill || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const ba = Stats.crewBalance(a.id);
      const bb = Stats.crewBalance(b.id);
      if (ba !== bb) return bb - ba;
      return (a.name || '').localeCompare(b.name || '', 'fa');
    });

    $('#countCrews').textContent = toFa(list.length);
    const container = $('#listCrews');

    if (list.length === 0) {
      container.innerHTML = emptyState('اکیپی ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = list.map((c) => {
      const worked = Stats.crewWorkedAmount(c.id);
      const paid = Stats.crewPaidAmount(c.id);
      const balance = worked - paid;
      const typeLabel = c.type === 'master' ? 'استادکار' : 'کارگر';
      const rateLabel = c.calcType === 'daily' ? '/ روز' :
                        c.calcType === 'sqm'   ? '/ متر' :
                        c.calcType === 'hourly' ? '/ ساعت' : 'قراردادی';

      return `
        <div class="item-card" data-id="${c.id}">
          <div class="item-header">
            <div class="item-title">
              ${esc(c.name)}
              <span style="font-size:10.5px; color:var(--text-soft); font-weight:400;"> · ${typeLabel}</span>
            </div>
            ${c.rate > 0 ? `<div class="item-amount gold">${fmtNum(c.rate)} <span style="font-size:9.5px; color:var(--text-soft); font-weight:400;">${rateLabel}</span></div>` : ''}
          </div>
          <div class="item-meta">
            ${c.skill ? `<div class="item-meta-item">🎯 ${esc(c.skill)}</div>` : ''}
            ${c.phone ? `<div class="item-meta-item">📞 ${toFa(c.phone)}</div>` : ''}
            <span class="status-badge ${c.status === 'inactive' ? 'status-done' : 'status-active'}">
              ${c.status === 'inactive' ? 'غیرفعال' : 'فعال'}
            </span>
          </div>
          <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--divider); display:flex; justify-content:space-between; font-size:11.5px;">
            <span>کارکرد: <b style="color:var(--gold);">${fmtNum(worked)}</b></span>
            <span>پرداخت: <b style="color:#10B981;">${fmtNum(paid)}</b></span>
            <span>مانده:
              <b style="color:${balance > 0 ? '#EF4444' : balance < 0 ? '#F59E0B' : 'var(--text-soft)'};">
                ${fmtNum(Math.abs(balance))} ${balance > 0 ? 'بدهی' : balance < 0 ? 'طلب' : 'تسویه'}
              </b>
            </span>
          </div>
        </div>
      `;
    }).join('');

    $$('#listCrews .item-card').forEach((card) => {
      card.addEventListener('click', () => CrewUI.edit(card.dataset.id));
    });
  },

  /* ─── کارکرد ─── */
  refreshWorks() {
    const q = ($('#searchWorks').value || '').toLowerCase();
    const filter = ($('#chipsWorks .chip.active') || {}).dataset?.filter || 'all';
    let list = State.works.slice();

    if (filter === 'unpaid') list = list.filter((w) => !w.paid);
    if (filter === 'paid')   list = list.filter((w) => w.paid);

    if (q) {
      list = list.filter((w) => {
        const c = State.crews.find((cc) => cc.id === w.crewId);
        const name = c ? c.name.toLowerCase() : '';
        return name.includes(q) ||
               (w.project || '').toLowerCase().includes(q) ||
               (w.description || '').toLowerCase().includes(q);
      });
    }

    list.sort((a, b) => {
      const pa = JALALI.parseJ(a.date), pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    $('#countWorks').textContent = toFa(list.length);
    $('#worksTotalAmount').textContent = fmtMoney(Stats.totalWorksAmount());
    $('#worksUnpaidAmount').textContent = fmtMoney(Stats.totalUnpaidWorks());

    const container = $('#listWorks');

    if (list.length === 0) {
      container.innerHTML = emptyState('کارکردی ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = list.map((w) => {
      const c = State.crews.find((cc) => cc.id === w.crewId);
      const name = c ? c.name : '(حذف‌شده)';
      const typeLabel = w.calcType === 'daily' ? 'روزمزد' :
                        w.calcType === 'sqm'   ? 'متری' :
                        w.calcType === 'hourly' ? 'ساعتی' : 'قراردادی';
      const unitLabel = w.calcType === 'daily' ? 'روز' :
                        w.calcType === 'sqm'   ? 'متر' :
                        w.calcType === 'hourly' ? 'ساعت' : '';

      return `
        <div class="item-card" data-id="${w.id}">
          <div class="item-header">
            <div class="item-title">${esc(name)}</div>
            <div class="item-amount gold">${fmtNum(w.amount)}</div>
          </div>
          <div class="item-meta">
            <div class="item-meta-item">📅 ${esc(w.date)}</div>
            <span class="status-badge status-active">${typeLabel}</span>
            ${w.qty > 0 ? `<div class="item-meta-item">⏱ ${toFa(w.qty)} ${unitLabel}</div>` : ''}
            ${w.project ? `<div class="item-meta-item">📁 ${esc(w.project)}</div>` : ''}
            <span class="status-badge ${w.paid ? 'status-paid' : 'status-pending'}">
              ${w.paid ? 'تسویه‌شده' : 'تسویه‌نشده'}
            </span>
          </div>
          ${w.description ? `<div style="font-size:11px; color:var(--text-soft); margin-top:6px;">📝 ${esc(w.description)}</div>` : ''}
        </div>
      `;
    }).join('');

    $$('#listWorks .item-card').forEach((card) => {
      card.addEventListener('click', () => WorkUI.edit(card.dataset.id));
    });
  },

  /* ─── پرداخت ─── */
  refreshPayments() {
    const q = ($('#searchPayments').value || '').toLowerCase();
    let list = State.payments.slice();

    if (q) {
      list = list.filter((p) => {
        const c = State.crews.find((cc) => cc.id === p.crewId);
        const name = c ? c.name.toLowerCase() : '';
        return name.includes(q) || (p.note || '').toLowerCase().includes(q);
      });
    }

    list.sort((a, b) => {
      const pa = JALALI.parseJ(a.date), pb = JALALI.parseJ(b.date);
      if (!pa || !pb) return 0;
      return (pb[0] * 10000 + pb[1] * 100 + pb[2]) - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });

    $('#countPayments').textContent = toFa(list.length);
    $('#paymentsTotalAmount').textContent = fmtMoney(Stats.totalPaymentsAmount());

    const container = $('#listPayments');

    if (list.length === 0) {
      container.innerHTML = emptyState('پرداختی ثبت نشده', 'روی + بزنید');
      return;
    }

    container.innerHTML = list.map((p) => {
      const c = State.crews.find((cc) => cc.id === p.crewId);
      const name = c ? c.name : '(حذف‌شده)';
      const methodLabel = p.method === 'cash' ? 'نقدی' :
                          p.method === 'card' ? 'کارت به کارت' :
                          p.method === 'transfer' ? 'واریز' : 'سایر';

      return `
        <div class="item-card" data-id="${p.id}">
          <div class="item-header">
            <div class="item-title">${esc(name)}</div>
            <div class="item-amount income">${fmtNum(p.amount)}</div>
          </div>
          <div class="item-meta">
            <div class="item-meta-item">📅 ${esc(p.date)}</div>
            <div class="item-meta-item">💳 ${methodLabel}</div>
            ${p.project ? `<div class="item-meta-item">📁 ${esc(p.project)}</div>` : ''}
          </div>
          ${p.note ? `<div style="font-size:11px; color:var(--text-soft); margin-top:6px;">📝 ${esc(p.note)}</div>` : ''}
        </div>
      `;
    }).join('');

    $$('#listPayments .item-card').forEach((card) => {
      card.addEventListener('click', () => PaymentUI.edit(card.dataset.id));
    });
  },

  /* ─── گزارش ─── */
  refreshReports() {
    const container = $('#reportsContent');
    const today = JALALI.todayJ();
    const currentYM = today[0] * 100 + today[1];

    function inCurrentMonth(dateStr) {
      const p = JALALI.parseJ(dateStr);
      if (!p) return false;
      return p[0] * 100 + p[1] === currentYM;
    }

    const monthIncome = State.incomes.filter((x) => inCurrentMonth(x.date)).reduce((s, x) => s + (+x.amount || 0), 0);
    const monthPurchase = State.purchases.filter((x) => inCurrentMonth(x.date)).reduce((s, x) => s + (+x.amount || 0), 0);
    const monthDaily = State.daily.filter((x) => inCurrentMonth(x.date)).reduce((s, x) => s + (+x.amount || 0), 0);
    const monthWorks = State.works.filter((x) => inCurrentMonth(x.date)).reduce((s, x) => s + (+x.amount || 0), 0);

    const purchaseByCategory = {};
    State.purchases.forEach((x) => {
      const c = x.category || 'متفرقه';
      purchaseByCategory[c] = (purchaseByCategory[c] || 0) + (+x.amount || 0);
    });

    const dailyByCategory = {};
    State.daily.forEach((x) => {
      const c = x.category || 'متفرقه';
      dailyByCategory[c] = (dailyByCategory[c] || 0) + (+x.amount || 0);
    });

    const bankDeposit = State.bank.filter((x) => x.type === 'deposit').reduce((s, x) => s + (+x.amount || 0), 0);
    const bankWithdraw = State.bank.filter((x) => x.type === 'withdraw').reduce((s, x) => s + (+x.amount || 0), 0);

    let html = '';

    html += `
      <div class="report-card">
        <h4>📅 گزارش ماه ${esc(JALALI.MONTHS[today[1] - 1])} ${toFa(today[0])}</h4>
        <div class="report-row"><span class="label">واریزی ماه</span><span class="value green">${fmtMoney(monthIncome)}</span></div>
        <div class="report-row"><span class="label">خرید ماه</span><span class="value red">${fmtMoney(monthPurchase)}</span></div>
        <div class="report-row"><span class="label">خرج روزانه ماه</span><span class="value red">${fmtMoney(monthDaily)}</span></div>
        <div class="report-row"><span class="label">دستمزد اکیپ ماه</span><span class="value red">${fmtMoney(monthWorks)}</span></div>
        <div class="report-row"><span class="label">سود ماه</span><span class="value ${monthIncome - monthPurchase - monthDaily - monthWorks >= 0 ? 'green' : 'red'}">${fmtMoney(monthIncome - monthPurchase - monthDaily - monthWorks)}</span></div>
      </div>
    `;

    html += `
      <div class="report-card">
        <h4>💰 خلاصه کل</h4>
        <div class="report-row"><span class="label">واریزی کل</span><span class="value green">${fmtMoney(Stats.totalIncome())}</span></div>
        <div class="report-row"><span class="label">خرید کل</span><span class="value red">${fmtMoney(Stats.totalPurchase())}</span></div>
        <div class="report-row"><span class="label">خرج روزانه کل</span><span class="value red">${fmtMoney(Stats.totalDaily())}</span></div>
        <div class="report-row"><span class="label">دستمزد اکیپ کل</span><span class="value red">${fmtMoney(Stats.totalWorksAmount())}</span></div>
        <div class="report-row"><span class="label">اجاره کل</span><span class="value red">${fmtMoney(Stats.totalRentals())}</span></div>
        <div class="report-row"><span class="label"><b>سود خالص</b></span><span class="value gold"><b>${fmtMoney(Stats.netProfit() - Stats.totalWorksAmount())}</b></span></div>
      </div>
    `;

    if (Object.keys(purchaseByCategory).length > 0) {
      html += `<div class="report-card"><h4>🛒 خرید به تفکیک دسته</h4>`;
      Object.keys(purchaseByCategory).sort((a, b) => purchaseByCategory[b] - purchaseByCategory[a]).forEach((c) => {
        html += `<div class="report-row"><span class="label">${esc(c)}</span><span class="value">${fmtMoney(purchaseByCategory[c])}</span></div>`;
      });
      html += `</div>`;
    }

    if (Object.keys(dailyByCategory).length > 0) {
      html += `<div class="report-card"><h4>💸 خرج روزانه به تفکیک دسته</h4>`;
      Object.keys(dailyByCategory).sort((a, b) => dailyByCategory[b] - dailyByCategory[a]).forEach((c) => {
        html += `<div class="report-row"><span class="label">${esc(c)}</span><span class="value">${fmtMoney(dailyByCategory[c])}</span></div>`;
      });
      html += `</div>`;
    }

    html += `
      <div class="report-card">
        <h4>🏦 تراکنش‌های بانکی</h4>
        <div class="report-row"><span class="label">مجموع واریز</span><span class="value green">${fmtMoney(bankDeposit)}</span></div>
        <div class="report-row"><span class="label">مجموع برداشت</span><span class="value red">${fmtMoney(bankWithdraw)}</span></div>
        <div class="report-row"><span class="label">خالص</span><span class="value ${bankDeposit - bankWithdraw >= 0 ? 'green' : 'red'}">${fmtMoney(bankDeposit - bankWithdraw)}</span></div>
      </div>
    `;

    // گزارش اکیپ
    if (State.crews.length > 0) {
      html += `<div class="report-card"><h4>👷 گزارش اکیپ‌ها و دستمزد</h4>`;
      html += `<div class="report-row"><span class="label">مجموع کارکرد</span><span class="value gold">${fmtMoney(Stats.totalWorksAmount())}</span></div>`;
      html += `<div class="report-row"><span class="label">تسویه‌نشده</span><span class="value red">${fmtMoney(Stats.totalUnpaidWorks())}</span></div>`;
      html += `<div class="report-row"><span class="label">مجموع پرداخت‌شده</span><span class="value green">${fmtMoney(Stats.totalPaymentsAmount())}</span></div>`;
      html += `<div class="report-row"><span class="label"><b>مانده کل بدهی</b></span><span class="value gold"><b>${fmtMoney(Stats.totalCrewDebt())}</b></span></div>`;
      html += `<div style="margin-top:12px; font-size:11.5px; color:var(--text-soft); margin-bottom:6px;">جزئیات هر نفر:</div>`;

      const sorted = State.crews.slice().sort((a, b) => Stats.crewBalance(b.id) - Stats.crewBalance(a.id));
      sorted.forEach((c) => {
        const worked = Stats.crewWorkedAmount(c.id);
        const paid = Stats.crewPaidAmount(c.id);
        const bal = worked - paid;
        const color = bal > 0 ? '#EF4444' : bal < 0 ? '#F59E0B' : '#10B981';
        const label = bal > 0 ? 'بدهی' : bal < 0 ? 'طلب' : 'تسویه';

        html += `
          <div style="padding:10px 0; border-bottom:1px dashed var(--divider);">
            <div style="display:flex; justify-content:space-between; font-weight:700; font-size:12.5px; margin-bottom:4px;">
              <span>${esc(c.name)}${c.skill ? ' <span style="font-weight:400; color:var(--text-soft); font-size:10.5px;">(' + esc(c.skill) + ')</span>' : ''}</span>
              <span style="color:${color};">${fmtNum(Math.abs(bal))} ${label}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-soft);">
              <span>کارکرد: <b style="color:var(--gold);">${fmtNum(worked)}</b></span>
              <span>پرداخت: <b style="color:#10B981;">${fmtNum(paid)}</b></span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // هزینه دستمزد به تفکیک پروژه
    const workProjects = [...new Set(State.works.map((w) => w.project).filter(Boolean))];
    if (workProjects.length > 0) {
      html += `<div class="report-card"><h4>🏗 هزینه دستمزد به تفکیک پروژه</h4>`;
      workProjects.forEach((p) => {
        const amt = Stats.worksByProject(p);
        html += `<div class="report-row"><span class="label">${esc(p)}</span><span class="value gold">${fmtMoney(amt)}</span></div>`;
      });
      html += `</div>`;
    }

    if (State.projects.length > 0) {
      html += `<div class="report-card"><h4>📁 پروژه‌ها</h4>`;
      State.projects.forEach((p) => {
        const st = Stats.projectStats(p.name);
        const workCost = Stats.worksByProject(p.name);
        html += `
          <div style="padding:10px 0; border-bottom:1px dashed var(--divider);">
            <div style="font-weight:700; font-size:12.5px; margin-bottom:6px;">${esc(p.name)}</div>
            <div class="report-row" style="padding:2px 0; border:none; font-size:11.5px;"><span class="label">قرارداد</span><span class="value">${fmtMoney(st.contract)}</span></div>
            <div class="report-row" style="padding:2px 0; border:none; font-size:11.5px;"><span class="label">دریافت</span><span class="value green">${fmtMoney(st.income)}</span></div>
            <div class="report-row" style="padding:2px 0; border:none; font-size:11.5px;"><span class="label">خرید</span><span class="value red">${fmtMoney(st.purchase)}</span></div>
            <div class="report-row" style="padding:2px 0; border:none; font-size:11.5px;"><span class="label">دستمزد اکیپ</span><span class="value red">${fmtMoney(workCost)}</span></div>
            <div class="report-row" style="padding:2px 0; border:none; font-size:11.5px;"><span class="label">سود</span><span class="value ${st.profit - workCost >= 0 ? 'green' : 'red'}">${fmtMoney(st.profit - workCost)}</span></div>
          </div>
        `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;
  },

  /* ─── تنظیمات ─── */
  refreshSettings() {
    $('#profileDesc').textContent = State.profile.name
      ? State.profile.name + (State.profile.company ? ' / ' + State.profile.company : '')
      : 'تنظیم نشده';

    $('#bioDesc').textContent = State.settings.biometric
      ? 'فعال - برای ورود سریع'
      : 'غیرفعال - در صورت پشتیبانی دستگاه';

    $('#bioSwitch').classList.toggle('on', !!State.settings.biometric);

    const catList = $('#categoriesList');
    if (State.categories.length === 0) {
      catList.innerHTML = '<div class="empty-state" style="padding:20px;"><p>دسته‌ای وجود ندارد</p></div>';
    } else {
      catList.innerHTML = State.categories.map((c, i) => `
        <div class="category-item">
          <span>${esc(c)}</span>
          <button class="category-del" data-idx="${i}" title="حذف">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('');

      $$('#categoriesList .category-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.idx;
          if (confirm('دسته «' + State.categories[i] + '» حذف شود؟')) {
            State.categories.splice(i, 1);
            saveState('categories');
            this.refreshSettings();
            this.refreshDailyChips();
            Toast.success('دسته حذف شد');
          }
        });
      });
    }

    this.refreshDailyChips();
  },

  refreshDailyChips() {
    const chips = $('#chipsDaily');
    if (!chips) return;
    const activeFilter = (chips.querySelector('.chip.active') || {}).dataset?.filter || 'all';
    chips.innerHTML = '<div class="chip' + (activeFilter === 'all' ? ' active' : '') + '" data-filter="all">همه</div>' +
      State.categories.map((c) => `<div class="chip${activeFilter === c ? ' active' : ''}" data-filter="${esc(c)}">${esc(c)}</div>`).join('');

    chips.querySelectorAll('.chip').forEach((ch) => {
      ch.addEventListener('click', () => {
        chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
        ch.classList.add('active');
        this.refreshDaily();
      });
    });
  },

  refreshNotifications() {
    const today = JALALI.todayJ();
    const todayKey = today[0] * 10000 + today[1] * 100 + today[2];
    let count = 0;

    count += State.invoices.filter((x) => x.status === 'overdue').length;

    count += State.rentals.filter((r) => {
      if (r.status !== 'active') return false;
      const p = JALALI.parseJ(r.endDate);
      return p && (p[0] * 10000 + p[1] * 100 + p[2]) < todayKey;
    }).length;

    State.incomes.forEach((x) => {
      if (x.status === 'pending') {
        const p = JALALI.parseJ(x.date);
        if (p && JALALI.daysBetween(p, today) > 30) count++;
      }
    });

    // بدهی به اکیپ‌ها
    const crewDebt = State.crews.filter((c) => Stats.crewBalance(c.id) > 0).length;
    count += crewDebt;

    const badge = $('#notifBadge');
    badge.textContent = toFa(count);
    badge.classList.toggle('show', count > 0);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   UI ماژول‌ها
═══════════════════════════════════════════════════════════════════ */

/* ─── واریزی ─── */
const IncomeUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    const projects = State.projects.map((p) => `<option value="${esc(p.name)}" ${item.project === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

    Sheet.open(isNew ? 'واریزی جدید' : 'ویرایش واریزی', `
      <div class="form-group">
        <label class="form-label">عنوان <span class="req">*</span></label>
        <input class="form-input" id="incTitle" value="${esc(item.title || '')}" placeholder="مثال: دریافت وجه قرارداد" />
      </div>
      <div class="form-group">
        <label class="form-label">مبلغ (تومان) <span class="req">*</span></label>
        <input class="form-input" id="incAmount" type="tel" inputmode="numeric" value="${item.amount || ''}" placeholder="۰" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="incDate" data-datepicker value="${esc(item.date || JALALI.todayStr())}" placeholder="۱۴۰۳/۰۱/۰۱" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">وضعیت</label>
          <select class="form-select" id="incStatus">
            <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>پرداخت‌شده</option>
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>در انتظار</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">پروژه</label>
        <select class="form-select" id="incProject">
          <option value="">— بدون پروژه —</option>
          ${projects}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">طرف‌حساب</label>
        <input class="form-input" id="incCustomer" value="${esc(item.customer || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <textarea class="form-textarea" id="incNotes">${esc(item.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary" id="incSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="incDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#incDate', root));

      $('#incSave', root).addEventListener('click', () => {
        const title = $('#incTitle', root).value.trim();
        const amount = parseFloat(toEn($('#incAmount', root).value).replace(/[^\d.]/g, '')) || 0;
        const date = $('#incDate', root).value.trim();
        const status = $('#incStatus', root).value;
        const project = $('#incProject', root).value;
        const customer = $('#incCustomer', root).value.trim();
        const notes = $('#incNotes', root).value.trim();

        if (!title) { Toast.error('عنوان را وارد کنید'); return; }
        if (amount <= 0) { Toast.error('مبلغ معتبر وارد کنید'); return; }
        if (!JALALI.parseJ(date)) { Toast.error('تاریخ معتبر نیست'); return; }

        if (isNew) {
          State.incomes.push({ id: uid(), title, amount, date, status, project, customer, notes, createdAt: Date.now() });
        } else {
          const idx = State.incomes.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.incomes[idx], { title, amount, date, status, project, customer, notes });
        }

        saveState('incomes');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#incDelete', root).addEventListener('click', () => {
          if (confirm('این واریزی حذف شود؟')) {
            State.incomes = State.incomes.filter((x) => x.id !== item.id);
            saveState('incomes');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.incomes.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── خرید ─── */
const PurchaseUI = {
  tempImages: [],
  form(item) {
    const isNew = !item;
    item = item || {};
    this.tempImages = (item.images || []).slice();

    const projects = State.projects.map((p) => `<option value="${esc(p.name)}" ${item.project === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const cats = ['مصالح', 'دستمزد', 'حمل و نقل', 'تجهیزات', 'قرارداد', 'متفرقه'];

    Sheet.open(isNew ? 'خرید جدید' : 'ویرایش خرید', `
      <div class="form-group">
        <label class="form-label">عنوان <span class="req">*</span></label>
        <input class="form-input" id="purTitle" value="${esc(item.title || '')}" placeholder="مثال: خرید سیمان" />
      </div>
      <div class="form-group">
        <label class="form-label">مبلغ (تومان) <span class="req">*</span></label>
        <input class="form-input" id="purAmount" type="tel" inputmode="numeric" value="${item.amount || ''}" placeholder="۰" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="purDate" data-datepicker value="${esc(item.date || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">دسته‌بندی</label>
          <select class="form-select" id="purCategory">
            ${cats.map((c) => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">وضعیت</label>
          <select class="form-select" id="purStatus">
            <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>پرداخت‌شده</option>
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>در انتظار</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">طرف‌حساب</label>
          <input class="form-input" id="purVendor" value="${esc(item.vendor || '')}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">پروژه</label>
        <select class="form-select" id="purProject">
          <option value="">— بدون پروژه —</option>
          ${projects}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <textarea class="form-textarea" id="purNotes">${esc(item.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">تصاویر فاکتور</label>
        <div class="upload-area" id="purUpload">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p>برای انتخاب عکس کلیک کنید</p>
        </div>
        <input type="file" id="purFiles" accept="image/*" multiple style="display:none;" />
        <div class="uploaded-thumbs" id="purThumbs"></div>
      </div>
      <button class="btn btn-primary" id="purSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="purDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#purDate', root));

      const renderThumbs = () => {
        const c = $('#purThumbs', root);
        c.innerHTML = this.tempImages.map((img, i) => `
          <div class="upload-thumb">
            <img src="${img}" />
            <button class="upload-thumb-del" data-idx="${i}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join('');
        c.querySelectorAll('.upload-thumb-del').forEach((b) => {
          b.addEventListener('click', () => {
            this.tempImages.splice(+b.dataset.idx, 1);
            renderThumbs();
          });
        });
      };
      renderThumbs();

      $('#purUpload', root).addEventListener('click', () => $('#purFiles', root).click());

      $('#purFiles', root).addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        for (const f of files) {
          try {
            const compressed = await compressImage(f);
            this.tempImages.push(compressed);
          } catch (err) { console.warn(err); }
        }
        renderThumbs();
        e.target.value = '';
      });

      $('#purSave', root).addEventListener('click', () => {
        const title = $('#purTitle', root).value.trim();
        const amount = parseFloat(toEn($('#purAmount', root).value).replace(/[^\d.]/g, '')) || 0;
        const date = $('#purDate', root).value.trim();
        const category = $('#purCategory', root).value;
        const status = $('#purStatus', root).value;
        const vendor = $('#purVendor', root).value.trim();
        const project = $('#purProject', root).value;
        const notes = $('#purNotes', root).value.trim();

        if (!title) { Toast.error('عنوان را وارد کنید'); return; }
        if (amount <= 0) { Toast.error('مبلغ معتبر وارد کنید'); return; }
        if (!JALALI.parseJ(date)) { Toast.error('تاریخ معتبر نیست'); return; }

        if (isNew) {
          State.purchases.push({ id: uid(), title, amount, date, category, status, vendor, project, notes, images: this.tempImages.slice(), createdAt: Date.now() });
        } else {
          const idx = State.purchases.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.purchases[idx], { title, amount, date, category, status, vendor, project, notes, images: this.tempImages.slice() });
        }

        saveState('purchases');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#purDelete', root).addEventListener('click', () => {
          if (confirm('این خرید حذف شود؟')) {
            State.purchases = State.purchases.filter((x) => x.id !== item.id);
            saveState('purchases');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.purchases.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── خرج روزانه ─── */
const DailyUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    Sheet.open(isNew ? 'خرج روزانه جدید' : 'ویرایش خرج روزانه', `
      <div class="form-group">
        <label class="form-label">عنوان <span class="req">*</span></label>
        <input class="form-input" id="dlyTitle" value="${esc(item.title || '')}" placeholder="مثال: ناهار" />
      </div>
      <div class="form-group">
        <label class="form-label">مبلغ (تومان) <span class="req">*</span></label>
        <input class="form-input" id="dlyAmount" type="tel" inputmode="numeric" value="${item.amount || ''}" placeholder="۰" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="dlyDate" data-datepicker value="${esc(item.date || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">دسته <span class="req">*</span></label>
          <select class="form-select" id="dlyCategory">
            ${State.categories.map((c) => `<option value="${esc(c)}" ${item.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary" id="dlySave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="dlyDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#dlyDate', root));

      $('#dlySave', root).addEventListener('click', () => {
        const title = $('#dlyTitle', root).value.trim();
        const amount = parseFloat(toEn($('#dlyAmount', root).value).replace(/[^\d.]/g, '')) || 0;
        const date = $('#dlyDate', root).value.trim();
        const category = $('#dlyCategory', root).value;

        if (!title) { Toast.error('عنوان را وارد کنید'); return; }
        if (amount <= 0) { Toast.error('مبلغ معتبر وارد کنید'); return; }
        if (!JALALI.parseJ(date)) { Toast.error('تاریخ معتبر نیست'); return; }

        if (isNew) {
          State.daily.push({ id: uid(), title, amount, date, category, createdAt: Date.now() });
        } else {
          const idx = State.daily.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.daily[idx], { title, amount, date, category });
        }

        saveState('daily');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#dlyDelete', root).addEventListener('click', () => {
          if (confirm('این خرج حذف شود؟')) {
            State.daily = State.daily.filter((x) => x.id !== item.id);
            saveState('daily');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.daily.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── بانکی ─── */
const BankUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    const projects = State.projects.map((p) => `<option value="${esc(p.name)}" ${item.project === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

    Sheet.open(isNew ? 'تراکنش بانکی جدید' : 'ویرایش تراکنش', `
      <div class="paste-zone" id="bankPaste">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
        <p><b>Paste هوشمند پیامک بانکی</b></p>
        <p style="font-size:10.5px; opacity:.75;">پیامک را کپی کنید و اینجا بزنید</p>
      </div>
      <div class="form-group">
        <label class="form-label">متن پیامک</label>
        <textarea class="form-textarea" id="bnkSms" placeholder="پیامک بانکی...">${esc(item.sms || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نام بانک <span class="req">*</span></label>
          <input class="form-input" id="bnkName" value="${esc(item.bank || '')}" placeholder="بانک ملت" />
        </div>
        <div class="form-group">
          <label class="form-label">۴ رقم آخر کارت</label>
          <input class="form-input" id="bnkCard" type="tel" inputmode="numeric" maxlength="4" value="${esc(item.card || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">مبلغ (تومان) <span class="req">*</span></label>
          <input class="form-input" id="bnkAmount" type="tel" inputmode="numeric" value="${item.amount || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">نوع</label>
          <select class="form-select" id="bnkType">
            <option value="deposit" ${item.type === 'deposit' ? 'selected' : ''}>واریز</option>
            <option value="withdraw" ${item.type === 'withdraw' ? 'selected' : ''}>برداشت</option>
            <option value="transfer" ${item.type === 'transfer' ? 'selected' : ''}>انتقال</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="bnkDate" data-datepicker value="${esc(item.date || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">ساعت</label>
          <input class="form-input" id="bnkTime" value="${esc(item.time || '')}" placeholder="۱۴:۳۰" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">پروژه مرتبط</label>
        <select class="form-select" id="bnkProject">
          <option value="">— بدون پروژه —</option>
          ${projects}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">وضعیت</label>
        <select class="form-select" id="bnkStatus">
          <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>تأییدشده</option>
          <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>در انتظار</option>
        </select>
      </div>
      <button class="btn btn-primary" id="bnkSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="bnkDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#bnkDate', root));

      $('#bankPaste', root).addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (!text) { Toast.error('کلیپ‌بورد خالی است'); return; }
          $('#bnkSms', root).value = text;
          const parsed = SMS_PARSER.parse(text);
          if (parsed) {
            if (parsed.bank)   $('#bnkName', root).value = parsed.bank;
            if (parsed.card)   $('#bnkCard', root).value = parsed.card;
            if (parsed.amount) $('#bnkAmount', root).value = parsed.amount;
            if (parsed.type)   $('#bnkType', root).value = parsed.type;
            if (parsed.date)   $('#bnkDate', root).value = parsed.date;
            if (parsed.time)   $('#bnkTime', root).value = parsed.time;
            Toast.success('پیامک پارس شد');
          } else {
            Toast.warn('پارس ناموفق - دستی وارد کنید');
          }
        } catch (e) {
          const text = prompt('متن پیامک را اینجا paste کنید:');
          if (text) {
            $('#bnkSms', root).value = text;
            const parsed = SMS_PARSER.parse(text);
            if (parsed) {
              if (parsed.bank)   $('#bnkName', root).value = parsed.bank;
              if (parsed.card)   $('#bnkCard', root).value = parsed.card;
              if (parsed.amount) $('#bnkAmount', root).value = parsed.amount;
              if (parsed.type)   $('#bnkType', root).value = parsed.type;
              if (parsed.date)   $('#bnkDate', root).value = parsed.date;
              if (parsed.time)   $('#bnkTime', root).value = parsed.time;
              Toast.success('پیامک پارس شد');
            }
          }
        }
      });

      $('#bnkSave', root).addEventListener('click', () => {
        const bank = $('#bnkName', root).value.trim();
        const card = toEn($('#bnkCard', root).value).replace(/\D/g, '').slice(-4);
        const amount = parseFloat(toEn($('#bnkAmount', root).value).replace(/[^\d.]/g, '')) || 0;
        const type = $('#bnkType', root).value;
        const date = $('#bnkDate', root).value.trim();
        const time = toEn($('#bnkTime', root).value.trim());
        const project = $('#bnkProject', root).value;
        const status = $('#bnkStatus', root).value;
        const sms = $('#bnkSms', root).value.trim();

        if (!bank) { Toast.error('نام بانک را وارد کنید'); return; }
        if (amount <= 0) { Toast.error('مبلغ معتبر وارد کنید'); return; }
        if (!JALALI.parseJ(date)) { Toast.error('تاریخ معتبر نیست'); return; }

        if (isNew) {
          State.bank.push({ id: uid(), bank, card, amount, type, date, time, project, status, sms, createdAt: Date.now() });
        } else {
          const idx = State.bank.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.bank[idx], { bank, card, amount, type, date, time, project, status, sms });
        }

        saveState('bank');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#bnkDelete', root).addEventListener('click', () => {
          if (confirm('این تراکنش حذف شود؟')) {
            State.bank = State.bank.filter((x) => x.id !== item.id);
            saveState('bank');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.bank.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── اجاره ─── */
const RentalUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    const projects = State.projects.map((p) => `<option value="${esc(p.name)}" ${item.project === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

    Sheet.open(isNew ? 'اجاره جدید' : 'ویرایش اجاره', `
      <div class="form-group">
        <label class="form-label">عنوان دستگاه <span class="req">*</span></label>
        <input class="form-input" id="rntTitle" value="${esc(item.title || '')}" placeholder="مثال: جرثقیل ۱۰ تن" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نام موجر</label>
          <input class="form-input" id="rntOwner" value="${esc(item.owner || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">تماس موجر</label>
          <input class="form-input" id="rntPhone" type="tel" inputmode="tel" value="${esc(item.phone || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نوع محاسبه</label>
          <select class="form-select" id="rntCalcType">
            <option value="daily" ${item.calcType === 'daily' ? 'selected' : ''}>روزانه</option>
            <option value="fixed" ${item.calcType === 'fixed' ? 'selected' : ''}>ثابت</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" id="rntAmountLabel">مبلغ روزانه</label>
          <input class="form-input" id="rntRate" type="tel" inputmode="numeric" value="${item.rate || ''}" placeholder="۰" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ ورود <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="rntStart" data-datepicker value="${esc(item.startDate || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">تاریخ خروج</label>
          <div class="date-field">
            <input class="form-input" id="rntEnd" data-datepicker value="${esc(item.endDate || '')}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
      </div>
      <div class="glass-card" style="margin-bottom:14px; padding:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12px;">
          <span style="color:var(--text-soft);">تعداد روز:</span>
          <b id="rntDays">۰</b>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:6px;">
          <span style="color:var(--text-soft);">مبلغ کل:</span>
          <b id="rntTotal" style="color:var(--gold);">۰ تومان</b>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">پروژه مرتبط</label>
        <select class="form-select" id="rntProject">
          <option value="">— بدون پروژه —</option>
          ${projects}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">وضعیت</label>
        <select class="form-select" id="rntStatus">
          <option value="active" ${item.status === 'active' ? 'selected' : ''}>فعال</option>
          <option value="done" ${item.status === 'done' ? 'selected' : ''}>تمام‌شده</option>
        </select>
      </div>
      <button class="btn btn-primary" id="rntSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="rntDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#rntStart', root));
      attachDatePicker($('#rntEnd', root));

      const updateCalc = () => {
        const calcType = $('#rntCalcType', root).value;
        const rate = parseFloat(toEn($('#rntRate', root).value).replace(/[^\d.]/g, '')) || 0;
        const startStr = $('#rntStart', root).value;
        const endStr = $('#rntEnd', root).value;

        $('#rntAmountLabel', root).textContent = calcType === 'daily' ? 'مبلغ روزانه' : 'مبلغ کل';

        const sp = JALALI.parseJ(startStr);
        const ep = JALALI.parseJ(endStr);
        let days = 0;
        if (sp && ep) days = Math.max(0, JALALI.daysBetween(sp, ep)) + 1;
        if (sp && !ep) days = 1;

        const total = calcType === 'daily' ? days * rate : rate;

        $('#rntDays', root).textContent = toFa(days) + ' روز';
        $('#rntTotal', root).textContent = fmtMoney(total);
      };

      ['#rntCalcType', '#rntRate', '#rntStart', '#rntEnd'].forEach((s) => {
        const el = $(s, root);
        el.addEventListener('input', updateCalc);
        el.addEventListener('change', updateCalc);
      });
      updateCalc();

      $('#rntSave', root).addEventListener('click', () => {
        const title = $('#rntTitle', root).value.trim();
        const owner = $('#rntOwner', root).value.trim();
        const phone = toEn($('#rntPhone', root).value).replace(/\D/g, '');
        const calcType = $('#rntCalcType', root).value;
        const rate = parseFloat(toEn($('#rntRate', root).value).replace(/[^\d.]/g, '')) || 0;
        const startDate = $('#rntStart', root).value.trim();
        const endDate = $('#rntEnd', root).value.trim();
        const project = $('#rntProject', root).value;
        const status = $('#rntStatus', root).value;

        if (!title) { Toast.error('عنوان را وارد کنید'); return; }
        if (rate <= 0) { Toast.error('مبلغ معتبر وارد کنید'); return; }
        if (!JALALI.parseJ(startDate)) { Toast.error('تاریخ ورود معتبر نیست'); return; }

        const sp = JALALI.parseJ(startDate);
        const ep = JALALI.parseJ(endDate);
        let days = 0;
        if (sp && ep) days = Math.max(0, JALALI.daysBetween(sp, ep)) + 1;
        if (sp && !ep) days = 1;

        const totalAmount = calcType === 'daily' ? days * rate : rate;
        const data = { title, owner, phone, calcType, rate, startDate, endDate, days, totalAmount, project, status };

        if (isNew) {
          State.rentals.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
        } else {
          const idx = State.rentals.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.rentals[idx], data);
        }

        saveState('rentals');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#rntDelete', root).addEventListener('click', () => {
          if (confirm('این اجاره حذف شود؟')) {
            State.rentals = State.rentals.filter((x) => x.id !== item.id);
            saveState('rentals');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.rentals.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── فاکتور ─── */
const InvoiceUI = {
  tempImages: [],
  nextNumber() {
    const year = JALALI.todayJ()[0];
    const yearInvoices = State.invoices.filter((x) => {
      const p = JALALI.parseJ(x.date);
      return p && p[0] === year;
    });
    return 'INV-' + year + '-' + pad2(yearInvoices.length + 1);
  },
  form(item) {
    const isNew = !item;
    item = item || {};
    this.tempImages = (item.images || []).slice();

    const projects = State.projects.map((p) => `<option value="${esc(p.name)}" ${item.project === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

    Sheet.open(isNew ? 'فاکتور جدید' : 'ویرایش فاکتور', `
      <div class="form-group">
        <label class="form-label">شماره فاکتور</label>
        <input class="form-input" id="invNumber" value="${esc(item.number || this.nextNumber())}" />
      </div>
      <div class="form-group">
        <label class="form-label">عنوان <span class="req">*</span></label>
        <input class="form-input" id="invTitle" value="${esc(item.title || '')}" placeholder="مثال: صورت‌وضعیت مرحله اول" />
      </div>
      <div class="form-group">
        <label class="form-label">مبلغ (تومان) <span class="req">*</span></label>
        <input class="form-input" id="invAmount" type="tel" inputmode="numeric" value="${item.amount || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="invDate" data-datepicker value="${esc(item.date || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">وضعیت</label>
          <select class="form-select" id="invStatus">
            <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>پرداخت‌شده</option>
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>در انتظار</option>
            <option value="overdue" ${item.status === 'overdue' ? 'selected' : ''}>معوق</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">طرف‌حساب</label>
        <input class="form-input" id="invCustomer" value="${esc(item.customer || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">پروژه</label>
        <select class="form-select" id="invProject">
          <option value="">— بدون پروژه —</option>
          ${projects}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <textarea class="form-textarea" id="invNotes">${esc(item.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">تصاویر فاکتور</label>
        <div class="upload-area" id="invUpload">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p>برای انتخاب عکس کلیک کنید</p>
        </div>
        <input type="file" id="invFiles" accept="image/*" multiple style="display:none;" />
        <div class="uploaded-thumbs" id="invThumbs"></div>
      </div>
      <button class="btn btn-primary" id="invSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="invDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#invDate', root));

      const renderThumbs = () => {
        const c = $('#invThumbs', root);
        c.innerHTML = this.tempImages.map((img, i) => `
          <div class="upload-thumb">
            <img src="${img}" />
            <button class="upload-thumb-del" data-idx="${i}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join('');
        c.querySelectorAll('.upload-thumb-del').forEach((b) => {
          b.addEventListener('click', () => {
            this.tempImages.splice(+b.dataset.idx, 1);
            renderThumbs();
          });
        });
      };
      renderThumbs();

      $('#invUpload', root).addEventListener('click', () => $('#invFiles', root).click());

      $('#invFiles', root).addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        for (const f of files) {
          try {
            const compressed = await compressImage(f);
            this.tempImages.push(compressed);
          } catch (err) { console.warn(err); }
        }
        renderThumbs();
        e.target.value = '';
      });

      $('#invSave', root).addEventListener('click', () => {
        const number = $('#invNumber', root).value.trim();
        const title = $('#invTitle', root).value.trim();
        const amount = parseFloat(toEn($('#invAmount', root).value).replace(/[^\d.]/g, '')) || 0;
        const date = $('#invDate', root).value.trim();
        const status = $('#invStatus', root).value;
        const customer = $('#invCustomer', root).value.trim();
        const project = $('#invProject', root).value;
        const notes = $('#invNotes', root).value.trim();

        if (!title) { Toast.error('عنوان را وارد کنید'); return; }
        if (amount <= 0) { Toast.error('مبلغ معتبر وارد کنید'); return; }
        if (!JALALI.parseJ(date)) { Toast.error('تاریخ معتبر نیست'); return; }

        if (isNew) {
          State.invoices.push({ id: uid(), number, title, amount, date, status, customer, project, notes, images: this.tempImages.slice(), createdAt: Date.now() });
        } else {
          const idx = State.invoices.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.invoices[idx], { number, title, amount, date, status, customer, project, notes, images: this.tempImages.slice() });
        }

        saveState('invoices');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#invDelete', root).addEventListener('click', () => {
          if (confirm('این فاکتور حذف شود؟')) {
            State.invoices = State.invoices.filter((x) => x.id !== item.id);
            saveState('invoices');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.invoices.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── پروژه ─── */
const ProjectUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    Sheet.open(isNew ? 'پروژه جدید' : 'ویرایش پروژه', `
      <div class="form-group">
        <label class="form-label">نام پروژه <span class="req">*</span></label>
        <input class="form-input" id="prjName" value="${esc(item.name || '')}" placeholder="مثال: برج نیلوفر" />
      </div>
      <div class="form-group">
        <label class="form-label">کارفرما</label>
        <input class="form-input" id="prjClient" value="${esc(item.client || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">مبلغ قرارداد (تومان)</label>
        <input class="form-input" id="prjContract" type="tel" inputmode="numeric" value="${item.contract || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ شروع</label>
          <div class="date-field">
            <input class="form-input" id="prjStart" data-datepicker value="${esc(item.startDate || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">تاریخ پایان</label>
          <div class="date-field">
            <input class="form-input" id="prjEnd" data-datepicker value="${esc(item.endDate || '')}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">وضعیت</label>
        <select class="form-select" id="prjStatus">
          <option value="active" ${item.status !== 'done' ? 'selected' : ''}>فعال</option>
          <option value="done" ${item.status === 'done' ? 'selected' : ''}>تمام‌شده</option>
        </select>
      </div>
      <button class="btn btn-primary" id="prjSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="prjDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#prjStart', root));
      attachDatePicker($('#prjEnd', root));

      $('#prjSave', root).addEventListener('click', () => {
        const name = $('#prjName', root).value.trim();
        const client = $('#prjClient', root).value.trim();
        const contract = parseFloat(toEn($('#prjContract', root).value).replace(/[^\d.]/g, '')) || 0;
        const startDate = $('#prjStart', root).value.trim();
        const endDate = $('#prjEnd', root).value.trim();
        const status = $('#prjStatus', root).value;

        if (!name) { Toast.error('نام پروژه را وارد کنید'); return; }

        if (isNew) {
          State.projects.push({ id: uid(), name, client, contract, startDate, endDate, status, createdAt: Date.now() });
        } else {
          const idx = State.projects.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.projects[idx], { name, client, contract, startDate, endDate, status });
        }

        saveState('projects');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#prjDelete', root).addEventListener('click', () => {
          if (confirm('این پروژه حذف شود؟')) {
            State.projects = State.projects.filter((x) => x.id !== item.id);
            saveState('projects');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.projects.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── اکیپ ─── */
const CrewUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    Sheet.open(isNew ? 'اکیپ جدید' : 'ویرایش اکیپ', `
      <div class="form-group">
        <label class="form-label">نام و نام خانوادگی <span class="req">*</span></label>
        <input class="form-input" id="crwName" value="${esc(item.name || '')}" placeholder="مثال: استاد رضایی" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نوع</label>
          <select class="form-select" id="crwType">
            <option value="master" ${item.type === 'master' ? 'selected' : ''}>استادکار / سرکارگر</option>
            <option value="worker" ${item.type === 'worker' ? 'selected' : ''}>کارگر</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">مهارت</label>
          <input class="form-input" id="crwSkill" value="${esc(item.skill || '')}" placeholder="بنا، جوشکار..." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تلفن</label>
          <input class="form-input" id="crwPhone" type="tel" inputmode="tel" value="${esc(item.phone || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">کد ملی</label>
          <input class="form-input" id="crwNid" type="tel" inputmode="numeric" maxlength="10" value="${esc(item.nationalId || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نوع محاسبه پیش‌فرض</label>
          <select class="form-select" id="crwCalcType">
            <option value="daily"  ${item.calcType === 'daily'  ? 'selected' : ''}>روزمزد</option>
            <option value="sqm"    ${item.calcType === 'sqm'    ? 'selected' : ''}>متری</option>
            <option value="hourly" ${item.calcType === 'hourly' ? 'selected' : ''}>ساعتی</option>
            <option value="fixed"  ${item.calcType === 'fixed'  ? 'selected' : ''}>قراردادی</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">نرخ پیش‌فرض (تومان)</label>
          <input class="form-input" id="crwRate" type="tel" inputmode="numeric" value="${item.rate || ''}" placeholder="۰" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">وضعیت</label>
        <select class="form-select" id="crwStatus">
          <option value="active"   ${item.status !== 'inactive' ? 'selected' : ''}>فعال</option>
          <option value="inactive" ${item.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <textarea class="form-textarea" id="crwNotes">${esc(item.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary" id="crwSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="crwDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      $('#crwSave', root).addEventListener('click', () => {
        const name = $('#crwName', root).value.trim();
        const type = $('#crwType', root).value;
        const skill = $('#crwSkill', root).value.trim();
        const phone = toEn($('#crwPhone', root).value).replace(/\D/g, '');
        const nationalId = toEn($('#crwNid', root).value).replace(/\D/g, '');
        const calcType = $('#crwCalcType', root).value;
        const rate = parseFloat(toEn($('#crwRate', root).value).replace(/[^\d.]/g, '')) || 0;
        const status = $('#crwStatus', root).value;
        const notes = $('#crwNotes', root).value.trim();

        if (!name) { Toast.error('نام را وارد کنید'); return; }

        const data = { name, type, skill, phone, nationalId, calcType, rate, status, notes };

        if (isNew) {
          State.crews.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
        } else {
          const idx = State.crews.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.crews[idx], data);
        }

        saveState('crews');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#crwDelete', root).addEventListener('click', () => {
          const hasData = State.works.some((w) => w.crewId === item.id) || State.payments.some((p) => p.crewId === item.id);
          const msg = hasData
            ? 'این اکیپ سابقه کارکرد/پرداخت دارد. با حذف، سوابق مالی حفظ می‌شود ولی نام اکیپ در گزارش‌ها نمایش داده نمی‌شود. ادامه؟'
            : 'این اکیپ حذف شود؟';
          if (confirm(msg)) {
            State.crews = State.crews.filter((x) => x.id !== item.id);
            saveState('crews');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.crews.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── کارکرد ─── */
const WorkUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    const activeCrews = State.crews.filter((c) => c.status !== 'inactive');
    if (activeCrews.length === 0) {
      Toast.error('ابتدا یک اکیپ ثبت کنید');
      setTimeout(() => { Sheet.close(); CrewUI.form(); }, 400);
      return;
    }

    const crewsOpts = activeCrews.map((c) => `
      <option value="${c.id}" ${item.crewId === c.id ? 'selected' : ''} data-rate="${c.rate || 0}" data-type="${c.calcType || 'daily'}">
        ${esc(c.name)} ${c.skill ? ' - ' + esc(c.skill) : ''}
      </option>
    `).join('');

    const projectsOpts = State.projects.map((p) => `
      <option value="${esc(p.name)}" ${item.project === p.name ? 'selected' : ''}>${esc(p.name)}</option>
    `).join('');

    Sheet.open(isNew ? 'ثبت کارکرد' : 'ویرایش کارکرد', `
      <div class="form-group">
        <label class="form-label">اکیپ <span class="req">*</span></label>
        <select class="form-select" id="wrkCrew">${crewsOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">نوع محاسبه <span class="req">*</span></label>
        <div class="chips" id="wrkCalcChips" style="padding-bottom:4px;">
          <div class="chip" data-calc="daily">روزمزد</div>
          <div class="chip" data-calc="sqm">متری</div>
          <div class="chip" data-calc="hourly">ساعتی</div>
          <div class="chip" data-calc="fixed">قراردادی</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" id="wrkQtyLabel">تعداد روز</label>
          <input class="form-input" id="wrkQty" type="tel" inputmode="decimal" value="${item.qty || ''}" placeholder="۰" />
        </div>
        <div class="form-group">
          <label class="form-label" id="wrkRateLabel">نرخ (تومان)</label>
          <input class="form-input" id="wrkRate" type="tel" inputmode="numeric" value="${item.rate || ''}" placeholder="۰" />
        </div>
      </div>
      <div class="glass-card" style="margin-bottom:14px; padding:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12.5px;">
          <span style="color:var(--text-soft);">مبلغ محاسبه‌شده:</span>
          <b id="wrkTotal" style="color:var(--gold);">۰ تومان</b>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="wrkDate" data-datepicker value="${esc(item.date || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">پروژه</label>
          <select class="form-select" id="wrkProject">
            <option value="">— بدون پروژه —</option>
            ${projectsOpts}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات / شرح کار</label>
        <textarea class="form-textarea" id="wrkDesc">${esc(item.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">وضعیت تسویه</label>
        <select class="form-select" id="wrkPaid">
          <option value="false" ${!item.paid ? 'selected' : ''}>تسویه‌نشده</option>
          <option value="true"  ${item.paid  ? 'selected' : ''}>تسویه‌شده</option>
        </select>
      </div>
      <button class="btn btn-primary" id="wrkSave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="wrkDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#wrkDate', root));

      let calcType = item.calcType || 'daily';

      const setChips = () => {
        $$('#wrkCalcChips .chip', root).forEach((ch) => {
          ch.classList.toggle('active', ch.dataset.calc === calcType);
        });
        const labels = {
          daily:  { qty: 'تعداد روز',   rate: 'نرخ روزانه (تومان)' },
          sqm:    { qty: 'متراژ (متر)', rate: 'نرخ هر متر (تومان)' },
          hourly: { qty: 'تعداد ساعت',  rate: 'نرخ ساعتی (تومان)' },
          fixed:  { qty: '—',           rate: 'مبلغ کل (تومان)' }
        };
        const l = labels[calcType];
        $('#wrkQtyLabel', root).textContent = l.qty;
        $('#wrkRateLabel', root).textContent = l.rate;
        $('#wrkQty', root).parentElement.style.display = calcType === 'fixed' ? 'none' : '';
        updateTotal();
      };

      const updateTotal = () => {
        const qty = parseFloat(toEn($('#wrkQty', root).value).replace(/[^\d.]/g, '')) || 0;
        const rate = parseFloat(toEn($('#wrkRate', root).value).replace(/[^\d.]/g, '')) || 0;
        const total = calcType === 'fixed' ? rate : qty * rate;
        $('#wrkTotal', root).textContent = fmtMoney(total);
      };

      $$('#wrkCalcChips .chip', root).forEach((ch) => {
        ch.addEventListener('click', () => {
          calcType = ch.dataset.calc;
          setChips();
        });
      });

      $('#wrkQty', root).addEventListener('input', updateTotal);
      $('#wrkRate', root).addEventListener('input', updateTotal);

      $('#wrkCrew', root).addEventListener('change', () => {
        const sel = $('#wrkCrew', root);
        const opt = sel.options[sel.selectedIndex];
        const rate = parseFloat(opt.dataset.rate) || 0;
        const type = opt.dataset.type || 'daily';
        if (rate > 0 && !$('#wrkRate', root).value) {
          $('#wrkRate', root).value = rate;
        }
        if (isNew) {
          calcType = type;
          setChips();
        }
      });

      setChips();
      updateTotal();

      $('#wrkSave', root).addEventListener('click', () => {
        const crewId = $('#wrkCrew', root).value;
        const qty = parseFloat(toEn($('#wrkQty', root).value).replace(/[^\d.]/g, '')) || 0;
        const rate = parseFloat(toEn($('#wrkRate', root).value).replace(/[^\d.]/g, '')) || 0;
        const date = $('#wrkDate', root).value.trim();
        const project = $('#wrkProject', root).value;
        const description = $('#wrkDesc', root).value.trim();
        const paid = $('#wrkPaid', root).value === 'true';

        if (!crewId) { Toast.error('اکیپ را انتخاب کنید'); return; }
        if (!JALALI.parseJ(date)) { Toast.error('تاریخ معتبر نیست'); return; }

        const amount = calcType === 'fixed' ? rate : qty * rate;
        if (amount <= 0) { Toast.error('مبلغ محاسبه‌شده صفر است'); return; }

        const data = { crewId, calcType, qty, rate, amount, date, project, description, paid };

        if (isNew) {
          State.works.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
        } else {
          const idx = State.works.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.works[idx], data);
        }

        saveState('works');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#wrkDelete', root).addEventListener('click', () => {
          if (confirm('این کارکرد حذف شود؟')) {
            State.works = State.works.filter((x) => x.id !== item.id);
            saveState('works');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.works.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ─── پرداخت ─── */
const PaymentUI = {
  form(item) {
    const isNew = !item;
    item = item || {};

    const activeCrews = State.crews.filter((c) => c.status !== 'inactive');
    if (activeCrews.length === 0) {
      Toast.error('ابتدا یک اکیپ ثبت کنید');
      setTimeout(() => { Sheet.close(); CrewUI.form(); }, 400);
      return;
    }

    const crewsOpts = activeCrews.map((c) => {
      const bal = Stats.crewBalance(c.id);
      const balLabel = bal > 0 ? ` (بدهی ${fmtNum(bal)})` : bal < 0 ? ` (طلب ${fmtNum(Math.abs(bal))})` : ' (تسویه)';
      return `<option value="${c.id}" ${item.crewId === c.id ? 'selected' : ''}>${esc(c.name)}${balLabel}</option>`;
    }).join('');

    const projectsOpts = State.projects.map((p) => `
      <option value="${esc(p.name)}" ${item.project === p.name ? 'selected' : ''}>${esc(p.name)}</option>
    `).join('');

    Sheet.open(isNew ? 'پرداخت جدید' : 'ویرایش پرداخت', `
      <div class="form-group">
        <label class="form-label">اکیپ <span class="req">*</span></label>
        <select class="form-select" id="payCrew">${crewsOpts}</select>
      </div>
      <div class="glass-card" style="margin-bottom:14px; padding:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12.5px;">
          <span style="color:var(--text-soft);">مانده فعلی:</span>
          <b id="payBalance" style="color:var(--gold);">۰</b>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">مبلغ (تومان) <span class="req">*</span></label>
        <input class="form-input" id="payAmount" type="tel" inputmode="numeric" value="${item.amount || ''}" placeholder="۰" />
      </div>
      <div class="form-group">
        <label class="form-label">روش پرداخت</label>
        <select class="form-select" id="payMethod">
          <option value="cash"     ${item.method === 'cash'     ? 'selected' : ''}>نقدی</option>
          <option value="card"     ${item.method === 'card'     ? 'selected' : ''}>کارت به کارت</option>
          <option value="transfer" ${item.method === 'transfer' ? 'selected' : ''}>واریز بانکی</option>
          <option value="other"    ${item.method === 'other'    ? 'selected' : ''}>سایر</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">تاریخ <span class="req">*</span></label>
          <div class="date-field">
            <input class="form-input" id="payDate" data-datepicker value="${esc(item.date || JALALI.todayStr())}" />
            <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">پروژه</label>
          <select class="form-select" id="payProject">
            <option value="">— بدون پروژه —</option>
            ${projectsOpts}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <textarea class="form-textarea" id="payNote" placeholder="مثال: بابت کارکرد برج نیلوفر">${esc(item.note || '')}</textarea>
      </div>
      <button class="btn btn-primary" id="paySave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره
      </button>
      ${!isNew ? `<button class="btn btn-danger" id="payDelete" style="margin-top:10px;">حذف</button>` : ''}
    `, (root) => {
      attachDatePicker($('#payDate', root));

      const updateBalance = () => {
        const crewId = $('#payCrew', root).value;
        if (!crewId) { $('#payBalance', root).textContent = '۰'; return; }
        const bal = Stats.crewBalance(crewId);
        const color = bal > 0 ? '#EF4444' : bal < 0 ? '#F59E0B' : 'var(--text-soft)';
        const label = bal > 0 ? 'بدهی' : bal < 0 ? 'طلب' : 'تسویه';
        $('#payBalance', root).innerHTML = `<span style="color:${color};">${fmtNum(Math.abs(bal))} ${label}</span>`;
      };

      $('#payCrew', root).addEventListener('change', updateBalance);
      updateBalance();

      $('#paySave', root).addEventListener('click', () => {
        const crewId = $('#payCrew', root).value;
        const amount = parseFloat(toEn($('#payAmount', root).value).replace(/[^\d.]/g, '')) || 0;
        const method = $('#payMethod', root).value;
        const date = $('#payDate', root).value.trim();
        const project = $('#payProject', root).value;
        const note = $('#payNote', root).value.trim();

        if (!crewId) { Toast.error('اکیپ را انتخاب کنید'); return; }
        if (amount <= 0) { Toast.error('مبلغ معتبر وارد کنید'); return; }
        if (!JALALI.parseJ(date)) { Toast.error('تاریخ معتبر نیست'); return; }

        const data = { crewId, amount, method, date, project, note };

        if (isNew) {
          State.payments.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
        } else {
          const idx = State.payments.findIndex((x) => x.id === item.id);
          if (idx >= 0) Object.assign(State.payments[idx], data);
        }

        saveState('payments');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshAll();
      });

      if (!isNew) {
        $('#payDelete', root).addEventListener('click', () => {
          if (confirm('این پرداخت حذف شود؟')) {
            State.payments = State.payments.filter((x) => x.id !== item.id);
            saveState('payments');
            Sheet.close();
            Toast.success('حذف شد');
            App.refreshAll();
          }
        });
      }
    });
  },
  edit(id) {
    const item = State.payments.find((x) => x.id === id);
    if (item) this.form(item);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   FAB
═══════════════════════════════════════════════════════════════════ */
function menuItem(action, label, path) {
  return `
    <button data-action="${action}" style="padding:18px 12px; border-radius:16px; background:var(--card-bg); border:1px solid var(--card-border); cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--navy-2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;">
        <path d="${path}"/>
      </svg>
      <span style="font-size:12px; font-weight:600; color:var(--text);">${label}</span>
    </button>
  `;
}

function openAddMenu() {
  const page = App.currentPage;

  const quickMap = {
    dashboard: 'menu',
    incomes: 'income', purchases: 'purchase', daily: 'daily',
    bank: 'bank', rentals: 'rental', invoices: 'invoice',
    projects: 'project', crews: 'crew', works: 'work',
    payments: 'payment', reports: 'menu', settings: 'menu'
  };

  const target = quickMap[page] || 'menu';

  if (target === 'income')   { IncomeUI.form(); return; }
  if (target === 'purchase') { PurchaseUI.form(); return; }
  if (target === 'daily')    { DailyUI.form(); return; }
  if (target === 'bank')     { BankUI.form(); return; }
  if (target === 'rental')   { RentalUI.form(); return; }
  if (target === 'invoice')  { InvoiceUI.form(); return; }
  if (target === 'project')  { ProjectUI.form(); return; }
  if (target === 'crew')     { CrewUI.form(); return; }
  if (target === 'work')     { WorkUI.form(); return; }
  if (target === 'payment')  { PaymentUI.form(); return; }

  Sheet.open('افزودن جدید', `
    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
      ${menuItem('income',  'واریزی',      'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6')}
      ${menuItem('purchase','خرید',        'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6')}
      ${menuItem('daily',   'خرج روزانه',  'M15 6h4l2 5h-6M5 17.5V7a1 1 0 0 1 1-1h7l3 5')}
      ${menuItem('bank',    'تراکنش بانکی','M2 7l10-5 10 5M2 21h20M5 21V11M9 21V11M15 21V11M19 21V11')}
      ${menuItem('rental',  'اجاره',       'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z')}
      ${menuItem('invoice', 'فاکتور',      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z')}
      ${menuItem('project', 'پروژه',       'M3 21h18M5 21V7l7-4 7 4v14M9 21V12h6v9')}
      ${menuItem('crew',    'اکیپ/استادکار','M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 1 0 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75')}
      ${menuItem('work',    'ثبت کارکرد',  'M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z')}
      ${menuItem('payment', 'پرداخت دستمزد','M2 6h20v14H2zM2 10h20M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z')}
    </div>
  `, (root) => {
    root.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const a = el.dataset.action;
        Sheet.close();
        setTimeout(() => {
          if (a === 'income')   IncomeUI.form();
          if (a === 'purchase') PurchaseUI.form();
          if (a === 'daily')    DailyUI.form();
          if (a === 'bank')     BankUI.form();
          if (a === 'rental')   RentalUI.form();
          if (a === 'invoice')  InvoiceUI.form();
          if (a === 'project')  ProjectUI.form();
          if (a === 'crew')     CrewUI.form();
          if (a === 'work')     WorkUI.form();
          if (a === 'payment')  PaymentUI.form();
        }, 320);
      });
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   CSV + اشتراک‌گذاری
═══════════════════════════════════════════════════════════════════ */
function exportCSV() {
  const rows = [];
  rows.push(['نوع', 'عنوان', 'مبلغ (تومان)', 'تاریخ', 'پروژه', 'طرف‌حساب/دسته', 'وضعیت', 'توضیحات']);

  State.incomes.forEach((x) => rows.push(['واریزی', x.title, x.amount, x.date, x.project || '', x.customer || '', x.status === 'paid' ? 'پرداخت‌شده' : 'در انتظار', x.notes || '']));
  State.purchases.forEach((x) => rows.push(['خرید', x.title, x.amount, x.date, x.project || '', (x.category || '') + '/' + (x.vendor || ''), x.status === 'paid' ? 'پرداخت‌شده' : 'در انتظار', x.notes || '']));
  State.daily.forEach((x) => rows.push(['خرج روزانه', x.title, x.amount, x.date, '', x.category || '', '', '']));
  State.bank.forEach((x) => rows.push(['بانکی', x.bank, x.amount, x.date, x.project || '', (x.type === 'deposit' ? 'واریز' : x.type === 'withdraw' ? 'برداشت' : 'انتقال') + ' ' + (x.card || ''), x.status === 'confirmed' ? 'تأییدشده' : 'در انتظار', x.sms || '']));
  State.rentals.forEach((x) => rows.push(['اجاره', x.title, x.totalAmount, x.startDate + ' → ' + (x.endDate || ''), x.project || '', x.owner || '', x.status === 'active' ? 'فعال' : 'تمام‌شده', (x.days || 0) + ' روز']));
  State.invoices.forEach((x) => rows.push(['فاکتور', x.number + ' - ' + x.title, x.amount, x.date, x.project || '', x.customer || '', x.status === 'paid' ? 'پرداخت‌شده' : x.status === 'pending' ? 'در انتظار' : 'معوق', x.notes || '']));
  State.crews.forEach((c) => rows.push(['اکیپ', c.name, c.rate, '', '', c.skill || '', c.type === 'master' ? 'استادکار' : 'کارگر', 'مانده: ' + Stats.crewBalance(c.id)]));
  State.works.forEach((w) => {
    const c = State.crews.find((cc) => cc.id === w.crewId);
    const name = c ? c.name : '(حذف‌شده)';
    rows.push(['کارکرد', name, w.amount, w.date, w.project || '', w.calcType === 'daily' ? 'روزمزد' : w.calcType === 'sqm' ? 'متری' : w.calcType === 'hourly' ? 'ساعتی' : 'قراردادی', w.paid ? 'تسویه‌شده' : 'تسویه‌نشده', w.description || '']);
  });
  State.payments.forEach((p) => {
    const c = State.crews.find((cc) => cc.id === p.crewId);
    const name = c ? c.name : '(حذف‌شده)';
    rows.push(['پرداخت دستمزد', name, p.amount, p.date, p.project || '', p.method === 'cash' ? 'نقدی' : p.method === 'card' ? 'کارت به کارت' : p.method === 'transfer' ? 'واریز' : 'سایر', '', p.note || '']);
  });

  const csvContent = rows.map((r) =>
    r.map((cell) => {
      const s = String(cell === null || cell === undefined ? '' : cell);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',')
  ).join('\r\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kiana-report-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Toast.success('فایل CSV دانلود شد');
}

async function shareReport() {
  const text =
    `📊 گزارش کیانا - ${JALALI.todayStr()}\n\n` +
    `💰 واریزی کل: ${fmtMoney(Stats.totalIncome())}\n` +
    `🛒 خرید کل: ${fmtMoney(Stats.totalPurchase())}\n` +
    `💸 خرج روزانه: ${fmtMoney(Stats.totalDaily())}\n` +
    `👷 دستمزد اکیپ: ${fmtMoney(Stats.totalWorksAmount())}\n` +
    `🏗 اجاره: ${fmtMoney(Stats.totalRentals())}\n` +
    `📈 سود خالص: ${fmtMoney(Stats.netProfit() - Stats.totalWorksAmount())}\n` +
    `📁 پروژه‌های فعال: ${toFa(Stats.activeProjects())}\n` +
    `💰 بدهی به اکیپ‌ها: ${fmtMoney(Stats.totalCrewDebt())}\n`;

  if (navigator.share) {
    try { await navigator.share({ title: 'گزارش کیانا', text }); } catch (e) {}
  } else {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success('گزارش در کلیپ‌بورد کپی شد');
    } catch (e) {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   بکاپ و بازیابی
═══════════════════════════════════════════════════════════════════ */
function backupData() {
  const data = {
    version: '2.0.0',
    exported: new Date().toISOString(),
    state: {
      incomes: State.incomes,
      purchases: State.purchases,
      daily: State.daily,
      bank: State.bank,
      rentals: State.rentals,
      invoices: State.invoices,
      projects: State.projects,
      crews: State.crews,
      works: State.works,
      payments: State.payments,
      categories: State.categories,
      profile: State.profile
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kiana-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Toast.success('پشتیبان دانلود شد');
}

function restoreData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const s = parsed.state || parsed;

      if (!confirm('داده‌های فعلی با فایل جایگزین می‌شوند. ادامه می‌دهید؟')) return;

      State.incomes    = s.incomes    || [];
      State.purchases  = s.purchases  || [];
      State.daily      = s.daily      || [];
      State.bank       = s.bank       || [];
      State.rentals    = s.rentals    || [];
      State.invoices   = s.invoices   || [];
      State.projects   = s.projects   || [];
      State.crews      = s.crews      || [];
      State.works      = s.works      || [];
      State.payments   = s.payments   || [];
      State.categories = s.categories || State.categories;
      State.profile    = s.profile    || State.profile;

      saveState('all');
      Toast.success('بازیابی موفق');
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      Toast.error('فایل معتبر نیست');
      console.warn(err);
    }
  };
  reader.readAsText(file);
}

/* ═══════════════════════════════════════════════════════════════════
   تم
═══════════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  State.settings.theme = theme;
  saveState('settings');

  const icon = $('#themeIcon');
  if (icon) {
    if (theme === 'dark') {
      icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    } else {
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   رویدادهای عمومی
═══════════════════════════════════════════════════════════════════ */
function bindEvents() {
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => App.nav(item.dataset.nav));
  });

  $$('[data-nav]').forEach((el) => {
    if (el.classList.contains('nav-item')) return;
    el.addEventListener('click', () => App.nav(el.dataset.nav));
  });

  $('#fabBtn').addEventListener('click', openAddMenu);

  // جستجوها
  ['incomes', 'purchases', 'daily', 'bank', 'invoices', 'crews', 'works', 'payments'].forEach((k) => {
    const el = $('#search' + k.charAt(0).toUpperCase() + k.slice(1));
    if (el) el.addEventListener('input', () => App.refreshPage(k));
  });

  // چیپ‌ها (به جز daily که داینامیک است)
  ['purchases', 'bank', 'rentals', 'invoices', 'crews', 'works'].forEach((k) => {
    const container = $('#chips' + k.charAt(0).toUpperCase() + k.slice(1));
    if (!container) return;
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        App.refreshPage(k);
      });
    });
  });

  // تم
  $('#themeToggle').addEventListener('click', () => {
    applyTheme(State.settings.theme === 'dark' ? 'light' : 'dark');
  });

  // قفل
  $('#lockBtn').addEventListener('click', () => {
    if (!State.settings.pin) { Toast.error('ابتدا رمز تنظیم کنید'); return; }
    Lock.mode = 'unlock';
    Lock.clear();
    $('#lockSubtitle').textContent = 'رمز ۴ رقمی خود را وارد کنید';
    $('#lockScreen').style.display = 'flex';
    $('#app').classList.remove('active');
  });

  // زنگ یادآوری
  $('#notifBtn').addEventListener('click', () => {
    const today = JALALI.todayJ();
    const todayKey = today[0] * 10000 + today[1] * 100 + today[2];
    const items = [];

    State.invoices.filter((x) => x.status === 'overdue').forEach((x) =>
      items.push({ icon: '🧾', text: 'فاکتور معوق: ' + x.title + ' - ' + fmtMoney(x.amount) }));

    State.rentals.forEach((r) => {
      if (r.status !== 'active') return;
      const p = JALALI.parseJ(r.endDate);
      if (p && (p[0] * 10000 + p[1] * 100 + p[2]) < todayKey) {
        items.push({ icon: '🏗', text: 'اجاره منقضی: ' + r.title + ' - ' + fmtMoney(r.totalAmount) });
      }
    });

    State.incomes.forEach((x) => {
      if (x.status === 'pending') {
        const p = JALALI.parseJ(x.date);
        if (p && JALALI.daysBetween(p, today) > 30) {
          items.push({ icon: '💰', text: 'واریزی معوق: ' + x.title + ' - ' + fmtMoney(x.amount) });
        }
      }
    });

    State.crews.forEach((c) => {
      const bal = Stats.crewBalance(c.id);
      if (bal > 0) {
        items.push({ icon: '👷', text: 'بدهی به ' + c.name + ': ' + fmtMoney(bal) });
      }
    });

    if (items.length === 0) { Toast.info('یادآوری فعالی وجود ندارد'); return; }

    Sheet.open('یادآوری‌ها', `
      <div class="items-list">
        ${items.map((i) => `
          <div class="glass-card" style="padding:12px 14px; display:flex; align-items:center; gap:10px;">
            <div style="font-size:20px;">${i.icon}</div>
            <div style="flex:1; font-size:12.5px;">${esc(i.text)}</div>
          </div>
        `).join('')}
      </div>
    `);
  });

  // تنظیمات
  $('#setPin').addEventListener('click', () => {
    Sheet.close();
    setTimeout(() => Lock.startChange(() => Toast.success('انجام شد')), 250);
  });

  $('#setBiometric').addEventListener('click', async () => {
    if (State.settings.biometric) {
      State.settings.biometric = false;
      State.settings.biometricCredId = null;
      saveState('settings');
      App.refreshSettings();
      Toast.success('اثر انگشت غیرفعال شد');
    } else {
      Toast.info('در حال فعال‌سازی...');
      const ok = await Lock.registerBiometric();
      if (ok) {
        Toast.success('اثر انگشت فعال شد');
        App.refreshSettings();
      }
    }
  });

  $('#setProfile').addEventListener('click', () => {
    Sheet.open('اطلاعات کاربر', `
      <div class="form-group">
        <label class="form-label">نام پیمانکار</label>
        <input class="form-input" id="profName" value="${esc(State.profile.name || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">نام شرکت</label>
        <input class="form-input" id="profCompany" value="${esc(State.profile.company || '')}" />
      </div>
      <button class="btn btn-primary" id="profSave">ذخیره</button>
    `, (root) => {
      $('#profSave', root).addEventListener('click', () => {
        State.profile.name = $('#profName', root).value.trim();
        State.profile.company = $('#profCompany', root).value.trim();
        saveState('profile');
        Sheet.close();
        Toast.success('ذخیره شد');
        App.refreshGreeting();
        App.refreshSettings();
      });
    });
  });

  $('#addCategoryBtn').addEventListener('click', () => {
    Sheet.open('افزودن دسته جدید', `
      <div class="form-group">
        <label class="form-label">نام دسته</label>
        <input class="form-input" id="newCatName" placeholder="مثال: تعمیرات" />
      </div>
      <button class="btn btn-primary" id="newCatSave">افزودن</button>
    `, (root) => {
      $('#newCatSave', root).addEventListener('click', () => {
        const name = $('#newCatName', root).value.trim();
        if (!name) { Toast.error('نام را وارد کنید'); return; }
        if (State.categories.includes(name)) { Toast.error('این دسته وجود دارد'); return; }
        State.categories.push(name);
        saveState('categories');
        Sheet.close();
        Toast.success('دسته اضافه شد');
        App.refreshSettings();
      });
    });
  });

  $('#backupBtn').addEventListener('click', backupData);
  $('#restoreBtn').addEventListener('click', () => $('#restoreFileInput').click());
  $('#restoreFileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) restoreData(f);
    e.target.value = '';
  });

  $('#deleteAllBtn').addEventListener('click', () => {
    if (!confirm('⚠️ همه داده‌ها حذف می‌شوند. آیا مطمئن هستید؟')) return;
    setTimeout(() => {
      if (confirm('تأیید نهایی: تمام داده‌ها پاک شوند؟')) {
        STORAGE.clearAll();
        Toast.success('حذف شد');
        setTimeout(() => location.reload(), 800);
      }
    }, 200);
  });

  $('#exportCsvAll').addEventListener('click', exportCSV);
  $('#shareReport').addEventListener('click', shareReport);

  $('#imageViewerClose').addEventListener('click', () => {
    $('#imageViewer').classList.remove('active');
    $('#imageViewerImg').src = '';
  });
  $('#imageViewer').addEventListener('click', (e) => {
    if (e.target === $('#imageViewer')) {
      $('#imageViewer').classList.remove('active');
      $('#imageViewerImg').src = '';
    }
  });

  $('#sheetClose').addEventListener('click', Sheet.close);
  $('#modalOverlay').addEventListener('click', (e) => {
    if (e.target === $('#modalOverlay')) Sheet.close();
  });
}

/* ═══════════════════════════════════════════════════════════════════
   راه‌اندازی
═══════════════════════════════════════════════════════════════════ */
function init() {
  applyTheme(State.settings.theme || 'light');
  Calendar.init();
  Lock.init();
  bindEvents();

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((e) => {
        console.warn('SW register failed:', e);
      });
    });
  }

  // نمایش lock screen
  $('#lockScreen').style.display = 'flex';
  $('#app').classList.remove('active');
}

loadState();

if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}

document.addEventListener('gesturestart', (e) => e.preventDefault());

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && State.settings.pin && $('#app').classList.contains('active')) {
    App.refreshAll();
  }
});

})();
