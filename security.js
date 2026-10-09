/* ============================================================
   🔒 کیانا - لایه امنیتی و ذخیره‌سازی حرفه‌ای
   فایل: security.js
   باید قبل از app.js لود شود

   ویژگی‌ها:
   - IndexedDB به جای localStorage (کاملاً شفاف)
   - پشتیبان‌گیری خودکار روزانه
   - File System Access API
   - بنر هشدار پشتیبان
   - پنل وضعیت ذخیره‌سازی
   - بازیابی دو مرحله‌ای
   
   نحوه کار:
   - app.js با localStorage کار می‌کنه (kiana_* keys)
   - این لایه localStorage رو شفاف پچ می‌کنه به IndexedDB
   - app.js هیچ تغییری نمی‌خواد
   ============================================================ */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════
  // ۱. تنظیمات کلی
  // ═══════════════════════════════════════════════
  const CONFIG = {
    DB_NAME: 'raman_db',
    STORE_NAME: 'kv',
    // کیانا از کلیدهای kiana_* استفاده می‌کنه، پس همه‌شون رو پچ می‌کنیم
    KEY_PREFIX: 'kiana_',
    // کلیدهای پشتیبان‌گیری خودمون
    BACKUP_LATEST: 'raman_backup_latest',
    BACKUP_PREFIX: 'raman_backup_',
    PRE_RESTORE_KEY: 'raman_backup_pre_restore',
    PRE_CLEAR_KEY: 'raman_backup_pre_clear',
    META_KEY: 'raman_security_meta',
    SETTINGS_KEY: 'raman_security_settings',
    DEFAULT_BACKUP_COUNT: 7,
    BACKUP_INTERVAL_MS: 24 * 60 * 60 * 1000
  };

  // ═══════════════════════════════════════════════
  // ۲. تنظیمات پشتیبان‌گیری
  // ═══════════════════════════════════════════════
  let settings = {
    autoBackup: true,
    autoDownload: false,
    backupCount: 7
  };

  function loadSettings() {
    try {
      const s = localStorage.getItem(CONFIG.SETTINGS_KEY);
      if (s) settings = Object.assign({}, settings, JSON.parse(s));
    } catch (e) {}
  }
  function saveSettingsInternal() {
    try { localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  // ═══════════════════════════════════════════════
  // ۳. توابع کمکی
  // ═══════════════════════════════════════════════
  const faDigits = s => String(s == null ? '' : s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);

  function todayStamp() {
    const d = new Date();
    return d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
  }

  const bytesToKB = b => (b / 1024).toFixed(1);

  // نمایش پیام
  function kianaToast(msg, type) {
    // اگه toast خود کیانا موجوده
    if (window.Toast && typeof window.Toast.show === 'function') {
      try {
        const t = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info';
        window.Toast.show(msg, t);
        return;
      } catch (e) {}
    }
    // Fallback
    let el = document.getElementById('kiana-security-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kiana-security-toast';
      el.style.cssText =
        'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);' +
        'background:#0A1F44;color:#fff;padding:12px 20px;border-radius:12px;' +
        'font-family:Vazirmatn,sans-serif;font-size:13px;z-index:99999;' +
        'box-shadow:0 8px 25px rgba(0,0,0,.3);direction:rtl;' +
        'max-width:90vw;text-align:center;transition:opacity .3s';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
  }// ═══════════════════════════════════════════════
// ۴. IndexedDB Wrapper
// ═══════════════════════════════════════════════
const IDB = (function () {
  let _db = null;

  function open() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) {
        return reject(new Error('IndexedDB not supported'));
      }
      if (_db) return resolve(_db);

      const req = indexedDB.open(CONFIG.DB_NAME, 1);

      req.onupgradeneeded = function (e) {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(CONFIG.STORE_NAME)) {
          d.createObjectStore(CONFIG.STORE_NAME);
        }
      };
      req.onsuccess = function (e) {
        _db = e.target.result;
        resolve(_db);
      };
      req.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  function tx(mode, fn) {
    return open().then(function (d) {
      return new Promise(function (resolve, reject) {
        const t = d.transaction(CONFIG.STORE_NAME, mode);
        const store = t.objectStore(CONFIG.STORE_NAME);
        let req;
        try { req = fn(store); }
        catch (e) { return reject(e); }
        t.oncomplete = function () { resolve(req ? req.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  return {
    get:    k => tx('readonly',  s => s.get(k)),
    set:    (k, v) => tx('readwrite', s => s.put(v, k)),
    remove: k => tx('readwrite', s => s.delete(k)),
    keys:   () => tx('readonly',  s => s.getAllKeys()),
    getAll: () => tx('readonly',  s => s.getAll()),
    clear:  () => tx('readwrite', s => s.clear()),
    available: () => new Promise(function (r) {
      try { open().then(() => r(true)).catch(() => r(false)); }
      catch (e) { r(false); }
    })
  };
})();

// ═══════════════════════════════════════════════
// ۵. Monkey Patch localStorage
// هدف: هر دسترسی به kiana_* خودکار بره روی IndexedDB
// ═══════════════════════════════════════════════
let idbReady = false;
const _mirror = {};       // آینه همه مقادیر kiana_*
let _mirrorLoaded = false;

// نگه‌داشتن توابع اصلی
const _origLS = window.localStorage;
const _origGetItem = _origLS.getItem.bind(_origLS);
const _origSetItem = _origLS.setItem.bind(_origLS);
const _origRemoveItem = _origLS.removeItem.bind(_origLS);
const _origClear = _origLS.clear.bind(_origLS);
const _origKey = _origLS.key.bind(_origLS);

// آیا این کلید باید به IndexedDB بره؟
function shouldIntercept(key) {
  if (!idbReady) return false;
  if (!key) return false;
  return String(key).indexOf(CONFIG.KEY_PREFIX) === 0;
}

// بارگذاری آینه از IndexedDB
async function loadMirror() {
  if (_mirrorLoaded) return;
  _mirrorLoaded = true;
  try {
    const keys = await IDB.keys();
    const kianaKeys = keys.filter(function (k) {
      return String(k).indexOf(CONFIG.KEY_PREFIX) === 0;
    });
    for (let i = 0; i < kianaKeys.length; i++) {
      const k = kianaKeys[i];
      _mirror[k] = await IDB.get(k);
    }
    console.log('🔒 Mirror loaded:', kianaKeys.length, 'keys from IndexedDB');
  } catch (e) {
    console.warn('🔒 loadMirror error:', e);
  }
}

// Mock localStorage
const mockedStorage = {
  getItem: function (k) {
    if (shouldIntercept(k)) {
      if (Object.prototype.hasOwnProperty.call(_mirror, k)) {
        const v = _mirror[k];
        if (v === null || v === undefined) return null;
        return typeof v === 'string' ? v : JSON.stringify(v);
      }
      // اگه توی آینه نبود، از localStorage قدیمی بخون
      return _origGetItem(k);
    }
    return _origGetItem(k);
  },

  setItem: function (k, v) {
    if (shouldIntercept(k)) {
      // ذخیره توی آینه
      _mirror[k] = v;

      // ذخیره توی IndexedDB
      IDB.set(k, v).then(function () {
        // ثبت زمان آخرین ذخیره
        IDB.get(CONFIG.META_KEY).then(function (m) {
          let meta = {};
          try { meta = m ? JSON.parse(m) : {}; } catch (e) {}
          meta.lastSave = Date.now();
          IDB.set(CONFIG.META_KEY, JSON.stringify(meta));
        });
      }).catch(function (err) {
        console.warn('🔒 IDB set error:', err);
        if (err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''))) {
          kianaToast('⚠ فضای ذخیره‌سازی پر شد!', 'error');
        }
        // fallback
        try { _origSetItem(k, v); } catch (e) {}
      });

      return;
    }
    _origSetItem(k, v);
  },

  removeItem: function (k) {
    if (shouldIntercept(k)) {
      delete _mirror[k];
      IDB.remove(k).catch(function () {});
      return;
    }
    _origRemoveItem(k);
  },

  clear: function () {
    // پاک کردن همه کلیدهای kiana_* از IndexedDB
    IDB.keys().then(function (keys) {
      keys.forEach(function (k) {
        if (String(k).indexOf(CONFIG.KEY_PREFIX) === 0) {
          IDB.remove(k);
        }
      });
    }).catch(function () {});

    Object.keys(_mirror).forEach(function (k) { delete _mirror[k]; });
    _origClear();
  },

  key: function (i) { return _origKey(i); }
};

Object.defineProperty(mockedStorage, 'length', {
  get: function () { return _origLS.length; }
});

// جایگزینی window.localStorage
try {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: function () { return mockedStorage; }
  });
  console.log('🔒 localStorage patched');
} catch (e) {
  console.warn('🔒 Cannot patch localStorage:', e);
}

// نگه‌داشتن reference اصلی
window.__kianaOriginalLS = _origLS;// ═══════════════════════════════════════════════
// ۶. File System Access API
// ═══════════════════════════════════════════════
const FSA = {
  handle: null,
  supported: ('showSaveFilePicker' in window),

  connect: async function () {
    if (!this.supported) {
      kianaToast('مرورگر شما از اتصال فایل پشتیبانی نمی‌کند', 'error');
      return false;
    }
    try {
      this.handle = await window.showSaveFilePicker({
        suggestedName: 'kiana-data.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const data = await collectAllData();
      await this.write(data);

      try {
        const meta = JSON.parse(await IDB.get(CONFIG.META_KEY) || '{}');
        meta.fileLinkName = this.handle.name;
        await IDB.set(CONFIG.META_KEY, JSON.stringify(meta));
      } catch (e) {}

      kianaToast('✅ اتصال به فایل برقرار شد', 'success');
      renderStoragePanel();
      renderFileStatus();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') {
        kianaToast('خطا در اتصال فایل: ' + e.message, 'error');
      }
      return false;
    }
  },

  write: async function (data) {
    if (!this.handle) return false;
    try {
      const w = await this.handle.createWritable();
      await w.write(JSON.stringify(data, null, 2));
      await w.close();
      return true;
    } catch (e) {
      console.warn('🔒 FSA write error:', e);
      if (e.name === 'NotFoundError') {
        kianaToast('⚠ فایل پشتیبان پیدا نشد', 'error');
        this.handle = null;
      }
      return false;
    }
  },

  disconnect: function () {
    this.handle = null;
    IDB.get(CONFIG.META_KEY).then(function (m) {
      let meta = {};
      try { meta = m ? JSON.parse(m) : {}; } catch (e) {}
      meta.fileLinkName = '';
      IDB.set(CONFIG.META_KEY, JSON.stringify(meta));
    });
    kianaToast('اتصال فایل قطع شد');
    renderStoragePanel();
    renderFileStatus();
  }
};

// ═══════════════════════════════════════════════
// ۷. جمع‌آوری همه داده‌ها
// ═══════════════════════════════════════════════
async function collectAllData() {
  const data = {};
  // همه کلیدهای kiana_*
  Object.keys(_mirror).forEach(function (k) {
    const v = _mirror[k];
    try {
      data[k] = typeof v === 'string' ? JSON.parse(v) : v;
    } catch (e) {
      data[k] = v;
    }
  });
  // اگه آینه خالی بود، از localStorage اصلی بخون
  if (Object.keys(data).length === 0) {
    for (let i = 0; i < _origLS.length; i++) {
      const k = _origKey(i);
      if (k && k.indexOf(CONFIG.KEY_PREFIX) === 0) {
        try { data[k] = JSON.parse(_origGetItem(k)); }
        catch (e) { data[k] = _origGetItem(k); }
      }
    }
  }
  return {
    _meta: {
      version: '3.0.0',
      exported: new Date().toISOString(),
      keys: Object.keys(data).length
    },
    ...data
  };
}

// ═══════════════════════════════════════════════
// ۸. Backup Manager
// ═══════════════════════════════════════════════
const Backup = {
  save: async function (reason) {
    reason = reason || 'auto';
    try {
      const data = await collectAllData();
      const ts = Date.now();
      const stamp = todayStamp();
      data._backupMeta = { at: ts, reason: reason };

      await IDB.set(CONFIG.BACKUP_LATEST, data);
      await IDB.set(CONFIG.BACKUP_PREFIX + stamp, data);

      // هرس
      const keys = await IDB.keys();
      const backups = keys
        .filter(function (k) {
          return String(k).indexOf(CONFIG.BACKUP_PREFIX) === 0 &&
                 k !== CONFIG.BACKUP_LATEST;
        })
        .sort();
      const max = Math.max(3, Math.min(30, Number(settings.backupCount) || CONFIG.DEFAULT_BACKUP_COUNT));
      while (backups.length > max) {
        const old = backups.shift();
        await IDB.remove(old);
      }

      const meta = JSON.parse(await IDB.get(CONFIG.META_KEY) || '{}');
      meta.lastBackup = ts;
      await IDB.set(CONFIG.META_KEY, JSON.stringify(meta));

      console.log('🔒 Backup saved:', reason, stamp);
      return true;
    } catch (e) {
      console.warn('🔒 Backup error:', e);
      return false;
    }
  },

  list: async function () {
    const keys = await IDB.keys();
    const list = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === CONFIG.BACKUP_LATEST) {
        const d = await IDB.get(k);
        if (d) {
          list.push({
            key: k,
            at: (d._backupMeta && d._backupMeta.at) || 0,
            size: JSON.stringify(d).length,
            reason: (d._backupMeta && d._backupMeta.reason) || 'auto',
            label: 'آخرین نسخه'
          });
        }
      } else if (String(k).indexOf(CONFIG.BACKUP_PREFIX) === 0) {
        const d = await IDB.get(k);
        if (d) {
          list.push({
            key: k,
            at: (d._backupMeta && d._backupMeta.at) || 0,
            size: JSON.stringify(d).length,
            reason: (d._backupMeta && d._backupMeta.reason) || 'daily',
            label: k.replace(CONFIG.BACKUP_PREFIX, '')
          });
        }
      }
    }
    return list.sort(function (a, b) { return b.at - a.at; });
  },

  restore: async function (key) {
    try {
      // نسخه ایمنی قبل از بازیابی
      const current = await collectAllData();
      await IDB.set(CONFIG.PRE_RESTORE_KEY, current);

      // بازیابی
      const d = await IDB.get(key);
      if (!d) {
        kianaToast('نسخه پشتیبان یافت نشد', 'error');
        return false;
      }

      // پاک کردن همه کلیدهای kiana_* فعلی
      const allKeys = await IDB.keys();
      for (let i = 0; i < allKeys.length; i++) {
        const k = allKeys[i];
        if (String(k).indexOf(CONFIG.KEY_PREFIX) === 0) {
          await IDB.remove(k);
        }
      }
      // پاک کردن از localStorage قدیمی هم
      const toRemove = [];
      for (let i = 0; i < _origLS.length; i++) {
        const k = _origKey(i);
        if (k && k.indexOf(CONFIG.KEY_PREFIX) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) { _origRemoveItem(k); });

      // بازنویسی داده‌های پشتیبان
      for (const k in d) {
        if (k === '_backupMeta' || k === '_meta') continue;
        if (String(k).indexOf(CONFIG.KEY_PREFIX) === 0) {
          await IDB.set(k, d[k]);
        }
      }

      // پاک کردن آینه تا در رفرش بعدی دوباره بار بشه
      Object.keys(_mirror).forEach(function (k) { delete _mirror[k]; });

      return true;
    } catch (e) {
      console.warn('🔒 Restore error:', e);
      return false;
    }
  },

  download: async function (key) {
    const d = await IDB.get(key);
    if (!d) { kianaToast('نسخه یافت نشد', 'error'); return; }
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = key + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    kianaToast('✅ پشتیبان دانلود شد', 'success');
  }
};

// ═══════════════════════════════════════════════
// ۹. تزریق بنر پشتیبان در داشبورد
// ═══════════════════════════════════════════════
function injectBackupBanner() {
  if (document.getElementById('kianaBackupBanner')) return;

  const dashboard = document.getElementById('page-dashboard');
  if (!dashboard) return;

  const banner = document.createElement('div');
  banner.id = 'kianaBackupBanner';
  // درج بعد از summary-grid
  const summaryGrid = dashboard.querySelector('.summary-grid');
  if (summaryGrid && summaryGrid.parentNode) {
    summaryGrid.parentNode.insertBefore(banner, summaryGrid);
  } else {
    dashboard.insertBefore(banner, dashboard.firstChild);
  }
  renderBackupBanner();
}

// ═══════════════════════════════════════════════
// ۱۰. تزریق پنل‌های امنیتی در تنظیمات
// ═══════════════════════════════════════════════
function injectSettingsPanels() {
  if (document.getElementById('kianaStoragePanel')) return;

  const settingsPage = document.getElementById('page-settings');
  if (!settingsPage) return;

  const container = document.createElement('div');
  container.id = 'kianaStoragePanel';
  container.innerHTML = `
    <div class="section-title" style="margin-top:20px;"><h3>📊 وضعیت ذخیره‌سازی</h3></div>
    <div class="glass-card" style="padding:14px;">
      <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px;">
        <div class="kiana-si"><label>موتور ذخیره‌سازی</label><strong id="siEngine">—</strong></div>
        <div class="kiana-si"><label>حجم داده‌ها</label><strong id="siSize">—</strong></div>
        <div class="kiana-si"><label>آخرین ذخیره خودکار</label><strong id="siLastSave">—</strong></div>
        <div class="kiana-si"><label>آخرین پشتیبان</label><strong id="siLastBackup">—</strong></div>
        <div class="kiana-si"><label>تعداد پشتیبان‌ها</label><strong id="siBackupCount">—</strong></div>
        <div class="kiana-si"><label>تعداد کل رکوردها</label><strong id="siRecords">—</strong></div>
        <div class="kiana-si"><label>وضعیت اتصال فایل</label><strong id="siFileLink">—</strong></div>
        <div class="kiana-si"><label>ذخیره‌سازی دائمی</label><strong id="siPersist">—</strong></div>
      </div>
    </div>

    <div class="section-title"><h3>🔗 اتصال به فایل پشتیبان</h3></div>
    <div class="glass-card" style="padding:14px;">
      <div style="font-size:11.5px; color:var(--text-soft); margin-bottom:12px; line-height:1.8;">
        با اتصال به یک فایل JSON، از این پس تمام تغییرات به‌صورت خودکار در همان فایل نوشته می‌شود.
        در صورت پشتیبانی نشدن مرورگر، از IndexedDB استفاده می‌شود.
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" id="kianaConnectFile" style="flex:1;">📎 اتصال به فایل</button>
        <button class="btn btn-ghost btn-sm" id="kianaDisconnectFile" style="flex:1;">✂ قطع اتصال</button>
      </div>
      <div id="fileStatus" style="margin-top:10px;"></div>
    </div>

    <div class="section-title"><h3>⚙️ تنظیمات پشتیبان‌گیری</h3></div>
    <div class="glass-card" style="padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--divider);">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--text);">پشتیبان‌گیری خودکار</div>
          <div style="font-size:10.5px; color:var(--text-soft); margin-top:2px;">هر ۲۴ ساعت یک نسخه بساز</div>
        </div>
        <label class="switch" id="kianaAutoBackupSwitch">
          <input type="checkbox" id="kianaSettingAutoBackup" style="display:none;">
        </label>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--divider);">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--text);">دانلود خودکار JSON</div>
          <div style="font-size:10.5px; color:var(--text-soft); margin-top:2px;">هر بار پشتیبان، فایل هم دانلود شود</div>
        </div>
        <label class="switch" id="kianaAutoDownloadSwitch">
          <input type="checkbox" id="kianaSettingAutoDownload" style="display:none;">
        </label>
      </div>

      <div style="padding:10px 0;">
        <div style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:6px;">تعداد نسخه‌های نگه‌داری (۳ تا ۳۰)</div>
        <input type="number" id="kianaSettingBackupCount" min="3" max="30" value="7"
          style="width:100%; background:var(--input-bg); border:1.5px solid var(--divider);
          border-radius:10px; padding:10px 12px; color:var(--text); font-family:inherit; font-size:13px;">
      </div>

      <button class="btn btn-gold" id="kianaManualBackup" style="margin-top:10px;">💾 پشتیبان‌گیری دستی</button>
    </div>

    <div class="section-title"><h3>📚 بازیابی از پشتیبان</h3></div>
    <div class="glass-card" style="padding:14px;">
      <div id="backupListCount" style="font-size:11px; color:var(--text-soft); margin-bottom:8px;"></div>
      <div id="backupList"></div>
    </div>
  `;

  // درج در ابتدای بخش "درباره"
  const aboutSection = Array.from(settingsPage.querySelectorAll('.section-title'))
    .find(function (el) {
      return el.textContent.indexOf('درباره') !== -1;
    });

  if (aboutSection) {
    settingsPage.insertBefore(container, aboutSection);
  } else {
    settingsPage.appendChild(container);
  }

  // استایل داخلی
  if (!document.getElementById('kiana-si-style')) {
    const style = document.createElement('style');
    style.id = 'kiana-si-style';
    style.textContent = `
      .kiana-si {
        background: var(--input-bg);
        border: 1.5px solid var(--divider);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 12px;
      }
      .kiana-si label {
        color: var(--text-soft);
        font-size: 10.5px;
        display: block;
        margin-bottom: 3px;
      }
      .kiana-si strong {
        font-weight: 700;
        color: var(--text);
        font-size: 12.5px;
        word-break: break-word;
      }
      .kiana-si.ok strong { color: #10B981; }
      .kiana-si.warn strong { color: #F59E0B; }
      .kiana-si.err strong { color: #EF4444; }
    `;
    document.head.appendChild(style);
  }

  // رویدادها
  const btnConnect = document.getElementById('kianaConnectFile');
  const btnDisconnect = document.getElementById('kianaDisconnectFile');
  const btnBackup = document.getElementById('kianaManualBackup');
  const chkAuto = document.getElementById('kianaSettingAutoBackup');
  const chkAutoDl = document.getElementById('kianaSettingAutoDownload');
  const inpCount = document.getElementById('kianaSettingBackupCount');

  if (btnConnect) btnConnect.addEventListener('click', async function () {
    await FSA.connect();
  });
  if (btnDisconnect) btnDisconnect.addEventListener('click', function () {
    FSA.disconnect();
  });
  if (btnBackup) btnBackup.addEventListener('click', function () {
    manualBackup();
  });

  if (chkAuto) {
    chkAuto.checked = !!settings.autoBackup;
    updateSwitchUI('kianaAutoBackupSwitch', chkAuto.checked);
    chkAuto.addEventListener('change', function () {
      settings.autoBackup = chkAuto.checked;
      saveSettingsInternal();
      updateSwitchUI('kianaAutoBackupSwitch', chkAuto.checked);
    });
  }
  if (chkAutoDl) {
    chkAutoDl.checked = !!settings.autoDownload;
    updateSwitchUI('kianaAutoDownloadSwitch', chkAutoDl.checked);
    chkAutoDl.addEventListener('change', function () {
      settings.autoDownload = chkAutoDl.checked;
      saveSettingsInternal();
      updateSwitchUI('kianaAutoDownloadSwitch', chkAutoDl.checked);
    });
  }
  if (inpCount) {
    inpCount.value = settings.backupCount || 7;
    inpCount.addEventListener('change', function () {
      settings.backupCount = Math.max(3, Math.min(30, Number(inpCount.value) || 7));
      inpCount.value = settings.backupCount;
      saveSettingsInternal();
    });
  }

  // رویداد کلیک روی سوییچ‌ها
  document.querySelectorAll('#kianaAutoBackupSwitch, #kianaAutoDownloadSwitch').forEach(function (sw) {
    sw.addEventListener('click', function () {
      const input = sw.querySelector('input');
      if (input) { input.click(); }
    });
  });

  renderBackupList();
  renderFileStatus();
  renderStoragePanel();
}

function updateSwitchUI(id, on) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('on', !!on);
}

// ═══════════════════════════════════════════════
// ۱۱. رندر پنل‌ها
// ═══════════════════════════════════════════════
async function renderStoragePanel() {
  function setVal(id, val, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    if (el.parentElement) el.parentElement.className = 'kiana-si ' + (cls || '');
  }

  const engine = idbReady ? 'IndexedDB ✅' : 'localStorage (fallback)';
  setVal('siEngine', engine, idbReady ? 'ok' : 'warn');

  try {
    const data = await collectAllData();
    const size = JSON.stringify(data).length;
    setVal('siSize', bytesToKB(size) + ' KB');
  } catch (e) { setVal('siSize', '—'); }

  let meta = {};
  try { meta = JSON.parse(await IDB.get(CONFIG.META_KEY) || '{}'); } catch (e) {}

  setVal('siLastSave', meta.lastSave ? new Date(meta.lastSave).toLocaleString('fa-IR') : '—');
  setVal('siLastBackup', meta.lastBackup ? new Date(meta.lastBackup).toLocaleString('fa-IR') : 'هرگز');

  try {
    const backups = await Backup.list();
    setVal('siBackupCount', faDigits(backups.length) + ' نسخه');
  } catch (e) { setVal('siBackupCount', '—'); }

  try {
    const data = await collectAllData();
    let records = 0;
    Object.keys(data).forEach(function (k) {
      if (Array.isArray(data[k])) records += data[k].length;
    });
    setVal('siRecords', faDigits(records) + ' رکورد');
  } catch (e) { setVal('siRecords', '—'); }

  if (FSA.handle) {
    setVal('siFileLink', 'متصل: ' + FSA.handle.name, 'ok');
  } else {
    setVal('siFileLink', FSA.supported ? 'متصل نیست' : 'پشتیبانی نمی‌شود', 'warn');
  }

  try {
    if (navigator.storage && navigator.storage.persisted) {
      const p = await navigator.storage.persisted();
      setVal('siPersist', p ? 'دائمی ✅' : 'موقت', p ? 'ok' : 'warn');
    } else {
      setVal('siPersist', 'نامشخص', 'warn');
    }
  } catch (e) { setVal('siPersist', 'نامشخص', 'warn'); }
}

async function renderBackupList() {
  const el = document.getElementById('backupList');
  if (!el) return;
  const cnt = document.getElementById('backupListCount');
  const list = await Backup.list();
  if (cnt) cnt.textContent = faDigits(list.length) + ' نسخه';

  if (!list.length) {
    el.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-soft); font-size:12px;">هنوز پشتیبانی ساخته نشده است</div>';
    return;
  }

  const reasonLabels = {
    auto: 'خودکار', daily: 'روزانه',
    pre_restore: 'قبل از بازیابی', manual: 'دستی'
  };

  el.innerHTML = list.map(function (b) {
    const date = b.at ? new Date(b.at).toLocaleString('fa-IR') : '—';
    const size = bytesToKB(b.size) + ' KB';
    const reason = reasonLabels[b.reason] || b.reason;
    return '' +
      '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px;' +
      'padding:11px 12px; background:var(--input-bg); border:1.5px solid var(--divider);' +
      'border-radius:10px; margin-bottom:8px; font-size:12px;">' +
      '<div style="flex:1; min-width:0;">' +
      '<div style="font-weight:700; color:var(--text); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
      '<span>' + b.label + '</span>' +
      '<span style="font-size:9px; background:rgba(212,175,55,0.18); color:#D4AF37;' +
      'padding:2px 6px; border-radius:6px;">' + reason + '</span>' +
      '</div>' +
      '<div style="font-size:10.5px; color:var(--text-soft); margin-top:2px;">' + date + ' · ' + size + '</div>' +
      '</div>' +
      '<div style="display:flex; gap:6px;">' +
      '<button onclick="KianaSecurity.downloadBackup(\'' + b.key + '\')" ' +
      'style="background:rgba(212,175,55,0.15); border:0; color:#D4AF37; width:32px; height:32px;' +
      'border-radius:8px; cursor:pointer; font-size:14px;">⬇</button>' +
      '<button onclick="KianaSecurity.requestRestore(\'' + b.key + '\')" ' +
      'style="background:rgba(16,185,129,0.15); border:0; color:#10B981; width:32px; height:32px;' +
      'border-radius:8px; cursor:pointer; font-size:14px;">↻</button>' +
      '</div></div>';
  }).join('');
}

function renderFileStatus() {
  const el = document.getElementById('fileStatus');
  if (!el) return;
  if (!FSA.supported) {
    el.innerHTML = '<div style="padding:10px; background:rgba(245,158,11,0.1);' +
      'border:1.5px solid rgba(245,158,11,0.3); border-radius:8px; color:#F59E0B;' +
      'font-size:11.5px;">⚠ مرورگر شما پشتیبانی نمی‌کند. از IndexedDB استفاده می‌شود.</div>';
  } else if (FSA.handle) {
    el.innerHTML = '<div style="padding:10px; background:rgba(16,185,129,0.1);' +
      'border:1.5px solid rgba(16,185,129,0.3); border-radius:8px; color:#10B981;' +
      'font-size:11.5px;">✅ متصل به: ' + FSA.handle.name + '</div>';
  } else {
    el.innerHTML = '<div style="padding:10px; background:var(--input-bg);' +
      'border:1.5px solid var(--divider); border-radius:8px; color:var(--text-soft);' +
      'font-size:11.5px;">متصل نیست</div>';
  }
}

async function renderBackupBanner() {
  const area = document.getElementById('kianaBackupBanner');
  if (!area) return;

  let meta = {};
  try { meta = JSON.parse(await IDB.get(CONFIG.META_KEY) || '{}'); } catch (e) {}

  const last = meta.lastBackup || 0;
  const days = last ? Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000)) : 999;

  let cls, icon, title, sub;
  if (!last) {
    cls = 'danger'; icon = '⚠';
    title = 'هنوز پشتیبانی تهیه نکرده‌اید';
    sub = 'برای جلوگیری از از دست رفتن اطلاعات، پشتیبان بگیرید.';
  } else if (days > 7) {
    cls = 'danger'; icon = '⚠';
    title = 'آخرین پشتیبان ' + faDigits(days) + ' روز پیش بوده';
    sub = 'توصیه می‌شود هر ۷ روز یک بار پشتیبان تهیه کنید.';
  } else {
    cls = 'ok'; icon = '✓';
    title = 'پشتیبان‌گیری به‌روز است';
    sub = 'آخرین پشتیبان ' + faDigits(days) + ' روز پیش تهیه شده است.';
  }

  const styles = {
    ok: 'background:rgba(16,185,129,0.12); border:1.5px solid rgba(16,185,129,0.3); color:#10B981;',
    danger: 'background:rgba(239,68,68,0.12); border:1.5px solid rgba(239,68,68,0.3); color:#EF4444;',
    warn: 'background:rgba(245,158,11,0.12); border:1.5px solid rgba(245,158,11,0.3); color:#F59E0B;'
  };

  area.innerHTML =
    '<div style="' + styles[cls] + 'padding:14px 16px; border-radius:16px;' +
    'margin-bottom:16px; display:flex; align-items:center; gap:12px;' +
    'font-family:Vazirmatn,sans-serif; direction:rtl; flex-wrap:wrap;">' +
    '<div style="font-size:22px;">' + icon + '</div>' +
    '<div style="flex:1; min-width:160px;">' +
    '<div style="font-size:13px; font-weight:700;">' + title + '</div>' +
    '<div style="font-size:11px; opacity:.85; margin-top:2px;">' + sub + '</div>' +
    '</div>' +
    '<button onclick="KianaSecurity.manualBackup()" ' +
    'style="background:linear-gradient(135deg, #D4AF37, #F4D03F); color:#0A1F44;' +
    'border:0; padding:10px 16px; border-radius:11px; font-family:Vazirmatn,sans-serif;' +
    'font-weight:700; font-size:12px; cursor:pointer; white-space:nowrap;">' +
    'پشتیبان‌گیری الان</button>' +
    '</div>';
}  // ═══════════════════════════════════════════════
  // ۱۲. Actions (اکشن‌های اصلی)
  // ═══════════════════════════════════════════════
  async function manualBackup() {
    const ok = await Backup.save('manual');
    if (ok) {
      kianaToast('✅ پشتیبان با موفقیت ساخته شد', 'success');
      if (settings.autoDownload) {
        await Backup.download(CONFIG.BACKUP_LATEST);
      }
      await renderBackupBanner();
      await renderStoragePanel();
      await renderBackupList();
    } else {
      kianaToast('خطا در پشتیبان‌گیری', 'error');
    }
  }

  // تأیید بازیابی (دو مرحله‌ای)
  let _pendingRestoreKey = null;

  function requestRestore(key) {
    _pendingRestoreKey = key;
    const input = prompt('برای تأیید بازیابی، کلمه «بازیابی» را تایپ کنید:');
    if (input === 'بازیابی') {
      confirmRestore();
    } else if (input !== null) {
      kianaToast('عبارت تأیید صحیح نیست', 'error');
    }
  }

  async function confirmRestore() {
    const key = _pendingRestoreKey;
    if (!key) return;
    const ok = await Backup.restore(key);
    if (ok) {
      kianaToast('✅ بازیابی انجام شد، صفحه رفرش می‌شود...', 'success');
      setTimeout(function () { location.reload(); }, 1500);
    } else {
      kianaToast('خطا در بازیابی', 'error');
    }
  }

  async function downloadBackup(key) {
    await Backup.download(key);
  }

  // درخواست ذخیره‌سازی دائمی
  async function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const already = await navigator.storage.persisted();
        if (!already) {
          const granted = await navigator.storage.persist();
          console.log('🔒 Persist:', granted ? '✅ granted' : '❌ denied');
        } else {
          console.log('🔒 Persist: already granted');
        }
      }
    } catch (e) { console.warn('🔒 persist error:', e); }
  }

  // اجرای پشتیبان‌گیری خودکار در بازه ۲۴ ساعته
  async function runAutoBackup() {
    if (!settings.autoBackup) return;
    try {
      let meta = {};
      try { meta = JSON.parse(await IDB.get(CONFIG.META_KEY) || '{}'); } catch (e) {}
      const last = meta.lastBackup || 0;
      const elapsed = Date.now() - last;
      if (elapsed > CONFIG.BACKUP_INTERVAL_MS) {
        const ok = await Backup.save('auto');
        if (ok) {
          console.log('🔒 Auto backup created');
          if (settings.autoDownload) {
            await Backup.download(CONFIG.BACKUP_LATEST);
          }
          await renderBackupBanner();
        }
      }
    } catch (e) {
      console.warn('🔒 Auto backup error:', e);
    }
  }

  // ═══════════════════════════════════════════════
  // ۱۳. Init
  // ═══════════════════════════════════════════════
  async function init() {
    console.log('🔒 Kiana Security Layer: راه‌اندازی...');

    loadSettings();

    idbReady = await IDB.available();
    console.log('🔒 IndexedDB available:', idbReady);

    if (idbReady) {
      // مهاجرت خودکار از localStorage
      try {
        let migrated = 0;
        const existingKeys = await IDB.keys();
        const existingKiana = existingKeys.filter(function (k) {
          return String(k).indexOf(CONFIG.KEY_PREFIX) === 0;
        });

        // فقط اگه IndexedDB خالی از kiana_* بود مهاجرت کن
        if (existingKiana.length === 0) {
          // همه کلیدهای kiana_* رو از localStorage قدیمی بگیر
          const toMigrate = [];
          for (let i = 0; i < _origLS.length; i++) {
            const k = _origKey(i);
            if (k && k.indexOf(CONFIG.KEY_PREFIX) === 0) {
              toMigrate.push(k);
            }
          }

          for (let i = 0; i < toMigrate.length; i++) {
            const k = toMigrate[i];
            const v = _origGetItem(k);
            if (v !== null && v !== undefined) {
              await IDB.set(k, v);
              migrated++;
            }
          }

          if (migrated > 0) {
            console.log('✅ Migrated ' + migrated + ' keys from localStorage to IndexedDB');
            setTimeout(function () {
              kianaToast('✅ ' + migrated + ' کلید از localStorage منتقل شد', 'success');
            }, 1500);
          }
        }

        // بارگذاری آینه از IndexedDB
        await loadMirror();
      } catch (e) {
        console.warn('🔒 Migration error:', e);
      }
    } else {
      console.warn('🔒 IndexedDB not available, using localStorage');
    }

    // درخواست ذخیره‌سازی دائمی
    await requestPersist();

    // تزریق بنر و پنل‌ها
    setTimeout(function () {
      injectBackupBanner();
      injectSettingsPanels();
    }, 800);

    // پشتیبان‌گیری خودکار اولیه
    setTimeout(runAutoBackup, 5000);

    // بررسی دوره‌ای
    setInterval(async function () {
      await runAutoBackup();
      await renderBackupBanner();
      if (document.getElementById('kianaStoragePanel')) {
        await renderStoragePanel();
      }
    }, 60000); // هر دقیقه

    console.log('✅ Kiana Security Layer آماده است');
  }

  // ═══════════════════════════════════════════════
  // ۱۴. Public API
  // ═══════════════════════════════════════════════
  window.KianaSecurity = {
    init: init,
    manualBackup: manualBackup,
    requestRestore: requestRestore,
    confirmRestore: confirmRestore,
    downloadBackup: downloadBackup,

    renderStoragePanel: renderStoragePanel,
    renderBackupList: renderBackupList,
    renderFileStatus: renderFileStatus,
    renderBackupBanner: renderBackupBanner,

    connectFile: function () { return FSA.connect(); },
    disconnectFile: function () { return FSA.disconnect(); },

    FSA: FSA,
    Backup: Backup,
    IDB: IDB,

    settings: settings,
    saveSettings: function (patch) {
      settings = Object.assign({}, settings, patch || {});
      saveSettingsInternal();
    },

    // ابزار
    collectAllData: collectAllData,
    toast: kianaToast
  };

  // ═══════════════════════════════════════════════
  // ۱۵. اجرای خودکار
  // ═══════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }

})();
// ═══ پایان فایل security.js ═══
