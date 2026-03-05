// ── AUTH & PORTFOLIO SYSTEM ───────────────────────────────────────
// Uses localStorage for simplicity (no backend required)
// Each user has: { username, passwordHash, portfolio: [] }
// Portfolio item: { id, fondoNombre, fechaCompra, cantidad, precioCompra, moneda }

const AUTH_USERS_KEY  = 'cafci_users';
const AUTH_SESSION_KEY = 'cafci_session';

// Simple hash (not cryptographic, but ok for local demo)
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || '{}'); }
  catch { return {}; }
}
function saveUsers(u) { localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(u)); }

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null'); }
  catch { return null; }
}
function setCurrentUser(u) {
  if (u) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(u));
  else localStorage.removeItem(AUTH_SESSION_KEY);
}

function authRegister(username, password) {
  const users = getUsers();
  const key = username.trim().toLowerCase();
  if (!key || key.length < 3) return { ok: false, msg: 'El usuario debe tener al menos 3 caracteres.' };
  if (!password || password.length < 4) return { ok: false, msg: 'La contraseña debe tener al menos 4 caracteres.' };
  if (users[key]) return { ok: false, msg: 'Ese nombre de usuario ya existe.' };
  users[key] = { username: username.trim(), passwordHash: simpleHash(password), portfolio: [] };
  saveUsers(users);
  setCurrentUser(key);
  return { ok: true };
}

function authLogin(username, password) {
  const users = getUsers();
  const key = username.trim().toLowerCase();
  const user = users[key];
  if (!user) return { ok: false, msg: 'Usuario no encontrado.' };
  if (user.passwordHash !== simpleHash(password)) return { ok: false, msg: 'Contraseña incorrecta.' };
  setCurrentUser(key);
  return { ok: true };
}

function authLogout() {
  setCurrentUser(null);
  renderAuthUI();
  if (typeof buildTabs === 'function') buildTabs();
}

function getUserData() {
  const key = getCurrentUser();
  if (!key) return null;
  const users = getUsers();
  return users[key] || null;
}

function savePortfolio(portfolio) {
  const key = getCurrentUser();
  if (!key) return;
  const users = getUsers();
  if (users[key]) {
    users[key].portfolio = portfolio;
    saveUsers(users);
  }
}

function getPortfolio() {
  const data = getUserData();
  return data ? (data.portfolio || []) : [];
}

// ── PORTFOLIO CRUD ────────────────────────────────────────────────
function addPortfolioItem(item) {
  const portfolio = getPortfolio();
  item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  portfolio.push(item);
  savePortfolio(portfolio);
  return item;
}

function removePortfolioItem(id) {
  const portfolio = getPortfolio().filter(i => i.id !== id);
  savePortfolio(portfolio);
}

function updatePortfolioItem(id, updates) {
  const portfolio = getPortfolio().map(i => i.id === id ? { ...i, ...updates } : i);
  savePortfolio(portfolio);
}

// ── AUTH MODAL ────────────────────────────────────────────────────
function renderAuthUI() {
  const user = getUserData();
  const btn = document.getElementById('auth-btn');
  if (!btn) return;
  if (user) {
    btn.innerHTML = `<span class="auth-avatar">${user.username[0].toUpperCase()}</span> ${user.username} <span class="auth-arrow">▾</span>`;
    btn.classList.add('logged-in');
    btn.onclick = toggleUserMenu;
  } else {
    btn.innerHTML = `<span class="auth-icon">⎆</span> Ingresar`;
    btn.classList.remove('logged-in');
    btn.onclick = openAuthModal;
  }
  // Update portfolio tab
  if (typeof buildTabs === 'function') buildTabs();
}

function openAuthModal(mode = 'login') {
  document.getElementById('auth-modal-overlay').style.display = 'flex';
  switchAuthMode(mode);
}

function closeAuthModal() {
  document.getElementById('auth-modal-overlay').style.display = 'none';
  document.getElementById('auth-error').textContent = '';
}

function switchAuthMode(mode) {
  const isLogin = mode === 'login';
  document.getElementById('auth-modal-title').textContent = isLogin ? 'Iniciar sesión' : 'Crear cuenta';
  document.getElementById('auth-submit-btn').textContent  = isLogin ? 'Entrar' : 'Registrarse';
  document.getElementById('auth-toggle-link').innerHTML   = isLogin
    ? '¿No tenés cuenta? <a href="#" onclick="switchAuthMode(\'register\');return false">Registrate</a>'
    : '¿Ya tenés cuenta? <a href="#" onclick="switchAuthMode(\'login\');return false">Iniciá sesión</a>';
  document.getElementById('auth-modal').dataset.mode = mode;
  document.getElementById('auth-error').textContent = '';
}

function submitAuth() {
  const mode = document.getElementById('auth-modal').dataset.mode;
  const user = document.getElementById('auth-username').value.trim();
  const pass = document.getElementById('auth-password').value;
  const result = mode === 'login' ? authLogin(user, pass) : authRegister(user, pass);
  if (result.ok) {
    closeAuthModal();
    renderAuthUI();
    // Switch to portfolio tab (also shows FAB)
    if (typeof switchTab === 'function') switchTab('Mi Portafolio');
  } else {
    document.getElementById('auth-error').textContent = result.msg;
  }
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  const open = menu.classList.toggle('open');
  if (open) setTimeout(() => document.addEventListener('click', closeUserMenuOutside, { once: true }), 0);
}

function closeUserMenuOutside(e) {
  const wrap = document.getElementById('auth-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('user-menu')?.classList.remove('open');
  }
}

// ── PORTFOLIO MODAL ───────────────────────────────────────────────
let portfolioEditId = null;

function openPortfolioModal(fondoNombre = '', moneda = '') {
  portfolioEditId = null;
  document.getElementById('port-modal-title').textContent = 'Agregar posición';
  document.getElementById('port-fondo').value       = fondoNombre;
  document.getElementById('port-moneda').value      = moneda || 'ARS';
  document.getElementById('port-fecha').value       = new Date().toISOString().slice(0, 10);
  document.getElementById('port-cantidad').value    = '';
  document.getElementById('port-precio').value      = '';
  document.getElementById('port-error').textContent = '';
  document.getElementById('port-modal-overlay').style.display = 'flex';
  document.getElementById('port-fondo').focus();
}

function openPortfolioEditModal(id) {
  const item = getPortfolio().find(i => i.id === id);
  if (!item) return;
  portfolioEditId = id;
  document.getElementById('port-modal-title').textContent = 'Editar posición';
  document.getElementById('port-fondo').value    = item.fondoNombre;
  document.getElementById('port-moneda').value   = item.moneda || 'ARS';
  document.getElementById('port-fecha').value    = item.fechaCompra;
  document.getElementById('port-cantidad').value = item.cantidad;
  document.getElementById('port-precio').value   = item.precioCompra;
  document.getElementById('port-error').textContent = '';
  document.getElementById('port-modal-overlay').style.display = 'flex';
}

function closePortfolioModal() {
  document.getElementById('port-modal-overlay').style.display = 'none';
  portfolioEditId = null;
}

function submitPortfolioModal() {
  const fondo    = document.getElementById('port-fondo').value.trim();
  const moneda   = document.getElementById('port-moneda').value;
  const fecha    = document.getElementById('port-fecha').value;
  const cantidad = parseFloat(document.getElementById('port-cantidad').value);
  const precio   = parseFloat(document.getElementById('port-precio').value);

  if (!fondo)          return showPortError('Ingresá el nombre del fondo.');
  if (!fecha)          return showPortError('Ingresá la fecha de compra.');
  if (isNaN(cantidad) || cantidad <= 0) return showPortError('Ingresá una cantidad válida (mayor a 0).');
  if (isNaN(precio)   || precio   <= 0) return showPortError('Ingresá un precio válido (mayor a 0).');

  if (portfolioEditId) {
    updatePortfolioItem(portfolioEditId, { fondoNombre: fondo, moneda, fechaCompra: fecha, cantidad, precioCompra: precio });
  } else {
    addPortfolioItem({ fondoNombre: fondo, moneda, fechaCompra: fecha, cantidad, precioCompra: precio });
  }

  closePortfolioModal();
  if (typeof switchTab === 'function') switchTab('Mi Portafolio');
  else renderPortfolioTab();
}

function showPortError(msg) {
  document.getElementById('port-error').textContent = msg;
}

// ── PORTFOLIO TAB RENDER ──────────────────────────────────────────
function renderPortfolioTab() {
  const user = getUserData();
  const tbody = document.getElementById('tbody');
  const pagination = document.getElementById('pagination');
  const kpisEl = document.getElementById('kpis');
  pagination.innerHTML = '';

  if (!user) {
    tbody.innerHTML = `<tr><td colspan="14">
      <div class="empty-favs">
        <div class="empty-icon">🔐</div>
        <p>Iniciá sesión para ver y gestionar tu portafolio personal.<br>
        <button class="btn-retry" style="margin-top:14px" onclick="openAuthModal('login')">Iniciar sesión</button>
        &nbsp;
        <button class="btn-retry" style="margin-top:14px;background:rgba(5,150,105,.07);border-color:var(--accent2);color:var(--accent2)" onclick="openAuthModal('register')">Crear cuenta</button>
        </p>
      </div>
    </td></tr>`;
    kpisEl.innerHTML = '';
    return;
  }

  const portfolio = getPortfolio();

  // Parse API date stored globally as window.API_FECHA
  // Handles: YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY
  function parseFechaAPI(str) {
    if (!str) return null;
    // ISO: 2026-03-04
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    // DD/MM/YYYY
    const dmy4 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy4) return new Date(`${dmy4[3]}-${dmy4[2]}-${dmy4[1]}T00:00:00`);
    // DD/MM/YY  ← API returns "04/03/26"
    const dmy2 = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (dmy2) return new Date(`20${dmy2[3]}-${dmy2[2]}-${dmy2[1]}T00:00:00`);
    return null;
  }
  const fechaAPI = parseFechaAPI(window.API_FECHA);

  // Enrich each portfolio item with live data
  const enriched = portfolio.map(item => {
    const match = RAW.find(r => r[1] === item.fondoNombre);
    const costoTotal   = item.cantidad * item.precioCompra;
    const valorMilCp   = match ? parseFloat(match[14]) : null;
    const precioActual = (valorMilCp !== null && !isNaN(valorMilCp)) ? valorMilCp / 1000 : null;
    const vActual      = precioActual !== null ? item.cantidad * precioActual : null;
    const rendPct      = (vActual !== null && costoTotal > 0) ? (vActual - costoTotal) / costoTotal * 100 : null;
    // r[15] = Valor (mil cuotapartes)_Variac. % — true daily variation
    const varDiariaPct = match ? parseFloat(match[15]) : null;

    // Rendimiento en importe = V.Actual - Costo Total (rounded, no truncation)
    const rendImporte = vActual !== null ? Math.round((vActual - costoTotal) * 100) / 100 : null;

    // Tasas — TNA, TEA, TEM
    let tna = null, tem = null, tea = null;
    if (vActual !== null && costoTotal > 0 && fechaAPI && item.fechaCompra) {
      const fechaCompra = new Date(item.fechaCompra + 'T00:00:00');
      const dias = Math.round((fechaAPI - fechaCompra) / (1000 * 60 * 60 * 24));
      if (dias > 0) {
        const rend = vActual - costoTotal;
        tna = (rend / costoTotal) / dias * 360 * 100;
        tea = (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100;
        tem = (Math.pow(1 + tea / 100, 1 / 12) - 1) * 100;
      }
    }
    return { ...item, match, costoTotal, precioActual, vActual, rendPct, varDiariaPct, rendImporte, tna, tem, tea };
  });

  // ── Formatters ─────────────────────────────────────────────────
  const fmtMoney = (v, mon) => {
    if (v === null || isNaN(v)) return '—';
    const pfx = mon === 'ARS' ? '$' : 'U$S ';
    const a = Math.abs(v);
    if (a >= 1e9) return pfx + (v/1e9).toFixed(2) + 'MM';
    if (a >= 1e6) return pfx + (v/1e6).toFixed(2) + 'M';
    if (a >= 1e3) return pfx + (v/1e3).toFixed(1) + 'K';
    return pfx + v.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
  };
  const fmtFull = (v, mon) => {
    if (v === null || isNaN(v)) return '—';
    return (mon === 'ARS' ? '$' : 'U$S ') + v.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
  };
  const pctC = (v, d=2) => {
    if (v === null || isNaN(v)) return '<span class="td-mono zero">—</span>';
    const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
    return `<span class="td-mono ${cls}">${v > 0 ? '+' : ''}${v.toFixed(d)}%</span>`;
  };
  const moneyC = (v, mon) => {
    if (v === null || isNaN(v)) return '<span class="td-mono zero">—</span>';
    const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
    return `<span class="td-mono ${cls}">${v > 0 ? '+' : ''}${fmtMoney(v, mon)}</span>`;
  };

  // ── KPIs ────────────────────────────────────────────────────────
  const totalARS       = enriched.filter(i => i.moneda === 'ARS').reduce((s,i) => s+i.costoTotal, 0);
  const totalUSD       = enriched.filter(i => i.moneda !== 'ARS').reduce((s,i) => s+i.costoTotal, 0);
  const vActualARS     = enriched.filter(i => i.moneda === 'ARS' && i.vActual !== null).reduce((s,i) => s+i.vActual, 0);
  const vActualUSD     = enriched.filter(i => i.moneda !== 'ARS' && i.vActual !== null).reduce((s,i) => s+i.vActual, 0);
  const rendTotalARS   = enriched.filter(i => i.moneda === 'ARS' && i.rendImporte !== null).reduce((s,i) => s+i.rendImporte, 0);
  const rendTotalUSD   = enriched.filter(i => i.moneda !== 'ARS' && i.rendImporte !== null).reduce((s,i) => s+i.rendImporte, 0);
  const nPos = enriched.length;
  const rendTotalPct   = totalARS > 0 && vActualARS > 0 ? (vActualARS - totalARS) / totalARS * 100 : null;
  const rendCls        = rendTotalPct === null ? 'c' : rendTotalPct > 0 ? 'g' : rendTotalPct < 0 ? 'r' : 'y';
  const rendImpCls     = rendTotalARS > 0 ? 'g' : rendTotalARS < 0 ? 'r' : 'y';
  const rendUSDCls     = rendTotalUSD > 0 ? 'g' : rendTotalUSD < 0 ? 'r' : 'y';

  kpisEl.innerHTML = `
    <div class="kpi"><div class="kpi-bar c"></div>
      <div class="kpi-label">Posiciones</div>
      <div class="kpi-val c">${nPos}</div>
      <div class="kpi-sub">fondos en cartera</div>
    </div>
    ${totalARS > 0 ? `<div class="kpi"><div class="kpi-bar c"></div>
      <div class="kpi-label">Invertido ARS</div>
      <div class="kpi-val c" style="font-size:18px">${fmtMoney(totalARS, 'ARS')}</div>
      <div class="kpi-sub">costo de compra</div>
    </div>` : ''}
    ${rendTotalARS !== 0 && vActualARS > 0 ? `<div class="kpi"><div class="kpi-bar ${rendImpCls}"></div>
      <div class="kpi-label">Rendimiento ARS</div>
      <div class="kpi-val ${rendImpCls}" style="font-size:18px">${rendTotalARS > 0 ? '+' : ''}${fmtMoney(rendTotalARS, 'ARS')}</div>
      <div class="kpi-sub">${rendTotalPct !== null ? (rendTotalPct > 0 ? '+' : '') + rendTotalPct.toFixed(2) + '% sobre costo' : 'diferencia vs costo'}</div>
    </div>` : ''}
    ${totalUSD > 0 ? `<div class="kpi"><div class="kpi-bar c"></div>
      <div class="kpi-label">Invertido USD</div>
      <div class="kpi-val c" style="font-size:18px">${fmtMoney(totalUSD, 'USD')}</div>
      <div class="kpi-sub">costo de compra</div>
    </div>` : ''}
    ${rendTotalUSD !== 0 && vActualUSD > 0 ? (() => {
      const rendUSDPct = totalUSD > 0 ? (vActualUSD - totalUSD) / totalUSD * 100 : null;
      return `<div class="kpi"><div class="kpi-bar ${rendUSDCls}"></div>
        <div class="kpi-label">Rendimiento USD</div>
        <div class="kpi-val ${rendUSDCls}" style="font-size:18px">${rendTotalUSD > 0 ? '+' : ''}${fmtMoney(rendTotalUSD, 'USD')}</div>
        <div class="kpi-sub">${rendUSDPct !== null ? (rendUSDPct > 0 ? '+' : '') + rendUSDPct.toFixed(2) + '% sobre costo' : 'diferencia vs costo'}</div>
      </div>`;
    })() : ''}`;

  if (!portfolio.length) {
    tbody.innerHTML = `<tr><td colspan="14">
      <div class="empty-favs">
        <div class="empty-icon">📊</div>
        <p>Todavía no cargaste ninguna posición.<br>
        <button class="btn-retry" style="margin-top:14px" onclick="openPortfolioModal()">+ Agregar primer fondo</button>
        </p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.className = 'fade-up';
  tbody.innerHTML = enriched.map(item => {
    const r = item.match;
    const mon = item.moneda;
    const monBadge = `<span class="badge badge-${mon === 'ARS' ? 'ars' : mon === 'USD' ? 'usd' : 'usb'}">${mon}</span>`;
    const cantFmt  = item.cantidad.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:4});
    const precFmt  = item.precioCompra.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:4});
    const noMatch  = !r ? ' <span style="font-size:10px;color:var(--yellow)" title="Sin match en datos actuales">⚠</span>' : '';
    // Money cells: single line, no wrap
    const moneyCell = (v, m, bold = false) => {
      if (v === null || isNaN(v)) return '<span class="td-mono zero">—</span>';
      const pfx = m === 'ARS' ? '$\u00a0' : 'U$S\u00a0';
      const val = Math.abs(v).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      const fw  = bold ? 'font-weight:600;' : '';
      return `<span class="td-mono" style="white-space:nowrap;${fw}">${pfx}${val}</span>`;
    };
    // Valor actual: green if > costo, red if < costo
    const vActualCell = (v, costo, m) => {
      if (v === null || isNaN(v)) return '<span class="td-mono zero">—</span>';
      const cls = v > costo ? 'pos' : v < costo ? 'neg' : 'zero';
      const pfx = m === 'ARS' ? '$\u00a0' : 'U$S\u00a0';
      const val = Math.abs(v).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      return `<span class="td-mono ${cls}" style="white-space:nowrap;font-weight:600">${pfx}${val}</span>`;
    };
    const moneyColorCellFmt = (v, m) => {
      if (v === null || isNaN(v)) return '<span class="td-mono zero">—</span>';
      const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
      const pfx = m === 'ARS' ? '$\u00a0' : 'U$S\u00a0';
      const sign = v > 0 ? '+' : v < 0 ? '-' : '';
      const val = Math.abs(v).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      return `<span class="td-mono ${cls}" style="white-space:nowrap">${sign}${pfx}${val}</span>`;
    };

    return `<tr>
      <td><div style="display:flex;gap:4px;justify-content:center">
        <button class="btn-port-edit" onclick="openPortfolioEditModal('${item.id}')" title="Editar">✏️</button>
        <button class="btn-port-del"  onclick="confirmDeletePortfolio('${item.id}')" title="Eliminar">🗑</button>
      </div></td>
      <td class="td-fondo" style="max-width:200px">${item.fondoNombre}${noMatch}</td>
      <td>${monBadge}</td>
      <td><span class="td-mono" style="font-size:11px">${cantFmt}</span></td>
      <td><span class="td-mono" style="font-size:11px">${precFmt}</span></td>
      <td>${moneyCell(item.costoTotal, mon, false)}</td>
      <td>${vActualCell(item.vActual, item.costoTotal, mon)}</td>
      <td>${pctC(item.rendPct)}</td>
      <td>${moneyColorCellFmt(item.rendImporte, mon)}</td>
      <td>${pctC(item.varDiariaPct)}</td>
      <td>${pctC(item.tna)}</td>
      <td>${pctC(item.tem)}</td>
      <td>${pctC(item.tea)}</td>
      <td>${r ? cnvLink(r[13] || '', r[0] || '') : '—'}</td>
    </tr>`;
  }).join('');
}
function confirmDeletePortfolio(id) {
  const item = getPortfolio().find(i => i.id === id);
  if (!item) return;
  if (confirm(`¿Eliminar "${item.fondoNombre}" de tu portafolio?`)) {
    removePortfolioItem(id);
    renderPortfolioTab();
  }
}

// ── INIT AUTH UI ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderAuthUI();
  // Close modal on overlay click
  document.getElementById('auth-modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeAuthModal();
  });
  document.getElementById('port-modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closePortfolioModal();
  });
  // Enter key on auth form
  ['auth-username','auth-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') submitAuth();
    });
  });
  ['port-fondo','port-moneda','port-fecha','port-cantidad','port-precio'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitPortfolioModal();
    });
  });
  // Live cost calculation
  ['port-cantidad', 'port-precio', 'port-moneda'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePortCalc);
    document.getElementById(id)?.addEventListener('change', updatePortCalc);
  });
});
