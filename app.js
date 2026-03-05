// ── STORAGE ───────────────────────────────────────────────────────
const FAV_KEY = 'fci_favoritos';
function loadFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
  catch { return []; }
}
function saveFavs(arr) { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); }
function isFav(name)   { return loadFavs().includes(name); }
function toggleFav(name) {
  const favs = loadFavs();
  const idx = favs.indexOf(name);
  if (idx === -1) favs.push(name);
  else favs.splice(idx, 1);
  saveFavs(favs);
  document.querySelectorAll('.btn-fav').forEach(btn => {
    if (btn.dataset.name === name) {
      const on = isFav(name);
      btn.classList.toggle('active', on);
      btn.title = on ? 'Quitar de favoritos' : 'Agregar a favoritos';
    }
  });
  buildTabs();
  if (activeTab === 'Favoritos') applyAll();
}

// ── STATE ─────────────────────────────────────────────────────────
let RAW = [];
let TABS = [];
let activeTab = 'Favoritos'; // start on favorites? no, Todos
activeTab = 'Todos';
let page      = 1;
let pageSize  = 50;
let sortKey   = 'fondo';
let sortDir   = 1;
let filtered  = [];

// Filters are per-tab
const tabFilters = {};
function getFilter(key) {
  const f = tabFilters[activeTab] || {};
  return f[key] || '';
}
function setFilter(key, val) {
  if (!tabFilters[activeTab]) tabFilters[activeTab] = {};
  tabFilters[activeTab][key] = val;
}

const REG_MAP = { Arg: 'Argentina', Glo: 'Global', Latam: 'Latam', Bra: 'Brasil', Eur: 'Europa' };
const HOR_MAP = { Cor: 'Corto', Med: 'Mediano', Lar: 'Largo', Flex: 'Flexible', Sasig: 'Sasig' };

// ── DATES ─────────────────────────────────────────────────────────
function fmtDate(d) {
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit' });
}
function dateDates() {
  const today = new Date();
  const yday  = new Date(today); yday.setDate(yday.getDate() - 1);
  const d30   = new Date(today); d30.setDate(d30.getDate() - 30);
  const d12m  = new Date(today); d12m.setFullYear(d12m.getFullYear() - 1);
  const anio  = new Date(today.getFullYear(), 0, 1);
  return {
    diaria: `${fmtDate(yday)} → ${fmtDate(today)}`,
    d30:    `${fmtDate(d30)} → ${fmtDate(today)}`,
    anio:   `01/01/${String(today.getFullYear()).slice(-2)} → ${fmtDate(today)}`,
    d12m:   `${fmtDate(d12m)} → ${fmtDate(today)}`,
  };
}

// ── INIT ──────────────────────────────────────────────────────────
const API_BASE  = 'https://api-cafci.onrender.com';
const API_URL   = API_BASE + '/api/fondos';
const API_FECHAS = API_BASE + '/api/fechas';
let _listenersAdded = false;

// ── DATE PICKER ───────────────────────────────────────────────────
async function loadFechas() {
  try {
    const res   = await fetch(API_FECHAS);
    const fechas = await res.json(); // ["2026-02-27","2026-03-02","2026-03-03"]

    // La última fecha es la actual — la excluimos del selector
    const currentFecha = fechas[fechas.length - 1];
    const históricas   = fechas.slice(0, -1).reverse(); // más reciente primero

    if (!históricas.length) return;

    document.getElementById('date-picker-dropdown').innerHTML = históricas.map((f) => {
      const label = formatFechaLabel(f);
      return `<div class="date-option" onclick="openFecha('${f}')">${label}</div>`;
    }).join('');

    document.getElementById('date-picker-btn').disabled = false;
  } catch (e) {
    console.warn('No se pudieron cargar las fechas históricas:', e);
  }
}

function formatFechaLabel(iso) {
  // "2026-03-02" → "02/03/2026"
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function toggleDatePicker() {
  const dd = document.getElementById('date-picker-dropdown');
  const open = dd.classList.toggle('open');
  // Cerrar al hacer clic afuera
  if (open) {
    setTimeout(() => document.addEventListener('click', closeDatePickerOutside, { once: true }), 0);
  }
}

function closeDatePickerOutside(e) {
  const wrap = document.getElementById('date-picker-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('date-picker-dropdown').classList.remove('open');
  }
}

function openFecha(fechaIso) {
  document.getElementById('date-picker-dropdown').classList.remove('open');
  window.open(`index.html?fecha=${fechaIso}`, '_blank');
}

// Detectar si se cargó con ?fecha= en la URL
function getFechaParam() {
  return new URLSearchParams(window.location.search).get('fecha');
}


function showLoader() {
  // Overlay de carga sobre toda la página
  let overlay = document.getElementById('loader-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loader-overlay';
    overlay.innerHTML = `
      <div class="spinner"></div>
      <span id="loader-msg">Conectando con la API…</span>
      <span id="loader-sub">Esto puede tardar hasta 30 segundos si el servidor está iniciando.</span>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  // KPIs skeleton
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="kpi-bar c"></div><div class="kpi-label">Fondos en filtro</div><div class="kpi-val c skeleton"></div></div>
    <div class="kpi"><div class="kpi-bar c"></div><div class="kpi-label">Var. diaria promedio</div><div class="kpi-val c skeleton"></div></div>
    <div class="kpi"><div class="kpi-bar c"></div><div class="kpi-label">Rend. 12m promedio</div><div class="kpi-val c skeleton"></div></div>
    <div class="kpi"><div class="kpi-bar c"></div><div class="kpi-label">Patrimonio total</div><div class="kpi-val c skeleton"></div></div>`;
  document.getElementById('tbody').innerHTML = '';
}

function hideLoader() {
  const overlay = document.getElementById('loader-overlay');
  if (overlay) overlay.style.display = 'none';
}

function showError(msg, attempt, maxAttempts) {
  hideLoader();
  document.getElementById('kpis').innerHTML = '';
  document.getElementById('tbody').innerHTML =
    `<tr><td colspan="12"><div class="error-wrap">
      <div class="error-icon">⚠</div>
      <p>No se pudieron cargar los datos.<br><small>${msg}</small></p>
      ${attempt < maxAttempts
        ? `<p class="retry-msg">Reintentando automáticamente (${attempt}/${maxAttempts})…</p>`
        : `<button class="btn-retry" onclick="init()">↻ Reintentar</button>`}
    </div></td></tr>`;
}

async function init() {
  const MAX = 3;
  const fechaParam = getFechaParam();
  const url = fechaParam ? `${API_BASE}/api/fondos/${fechaParam}` : API_URL;

  // Si es una página de fecha histórica, mostrar banner
  if (fechaParam) {
    document.title = `Dashboard CAFCI - ${formatFechaLabel(fechaParam)}`;
    const meta = document.getElementById('fecha-dato');
    meta.innerHTML = `<span style="color:var(--yellow);font-weight:600">📅 Histórico: ${formatFechaLabel(fechaParam)}</span>`;
  }

  showLoader();

  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const refs = data.datos.referencias;

      TABS = [{ id: 'Todos', label: 'Todos' }];
      RAW  = [];

      const refFecha1 = refs.variacion_fecha1;
      const refFecha2 = refs.variacion_fecha2;
      const refFecha3 = refs.variacion_fecha3;

      (data.datos.listado_fondos || []).forEach((cat) => {
        const catNombre = cat.categoria_fondo || '';
        TABS.push({ id: catNombre, label: catNombre });
        (cat.fondos || []).forEach((f) => {
          RAW.push([
            f['Codigo CNV']                           || '',   // [0]  cod CNV
            f['Fondo']                               || '',   // [1]  nombre
            f['Moneda Fondo']                        || '',   // [2]  moneda
            f['Clasificación_Región']                || '',   // [3]  región
            f['Clasificación_Horizonte']             || '',   // [4]  horizonte
            f[`Variacion cuotaparte %_${refFecha1}`] ?? null, // [5]  var diaria
            f[`Variacion cuotaparte %_${refFecha2}`] ?? null, // [6]  var año
            f[`Variacion cuotaparte %_${refFecha3}`] ?? null, // [7]  var 12m
            null,                                             // [8]  unused
            f['Patrimonio_Actual']                   ?? null, // [9]  patrimonio
            null,                                             // [10] unused
            f['Sociedad Gerente']                    || '',   // [11] gerente
            catNombre,                                        // [12] categoría
            f['Código CAFCI']                        || '',   // [13] código CAFCI
          ]);
        });
      });

      document.getElementById('fecha-dato').textContent = 'Actualizado: ' + (data.fecha || '');
      document.getElementById('total-meta').textContent = RAW.length.toLocaleString('es-AR') + ' fondos totales';

      const cleanDate = (d) => (d || '').replace(/[:]/g, '').trim();
      document.getElementById('th-vard-date').textContent    = cleanDate(refs.variacion_fecha1);
      document.getElementById('th-varanio-date').textContent = cleanDate(refs.variacion_fecha2);
      document.getElementById('th-var12-date').textContent   = cleanDate(refs.variacion_fecha3);

      buildTabs();
      if (!_listenersAdded) { addListeners(); _listenersAdded = true; }
      hideLoader();
      applyAll();
      if (!fechaParam) loadFechas(); // solo en página principal
      return; // éxito

    } catch (e) {
      console.error(`Intento ${attempt}/${MAX} fallido:`, e);
      if (attempt < MAX) {
        showError(e.message, attempt, MAX);
        await new Promise(r => setTimeout(r, 2500 * attempt)); // espera creciente
      } else {
        showError(e.message, attempt, MAX);
      }
    }
  }
}

init();

// ── TABS AGRUPADOS ────────────────────────────────────────────────
const TAB_GROUPS = [
  { id: 'Todos',           label: 'Todos',           match: () => true },
  { id: 'Mercado Dinero',  label: 'Mercado de Dinero', match: (c) => /mercado de dinero|fondos l[íi]quidos/i.test(c) },
  { id: 'Renta Fija',     label: 'Renta Fija',       match: (c) => /^renta fija/i.test(c) },
  { id: 'Renta Variable', label: 'Renta Variable',   match: (c) => /^renta variable/i.test(c) },
  { id: 'Renta Mixta',    label: 'Renta Mixta',      match: (c) => /^renta mixta/i.test(c) },
  { id: 'Retorno Total',  label: 'Retorno Total',    match: (c) => /^retorno total/i.test(c) },
  { id: 'PyME',           label: 'PyME',             match: (c) => /pyme|pymes/i.test(c) },
  { id: 'Otros',          label: 'Otros',            match: null }, // catch-all
];

function getTabGroup(categoria) {
  for (const g of TAB_GROUPS) {
    if (g.id === 'Todos' || g.match === null) continue;
    if (g.match(categoria)) return g.id;
  }
  return 'Otros';
}

// ── TABS ──────────────────────────────────────────────────────────
function buildTabs() {
  const row = document.getElementById('tabs-row');
  // Preserve btn-clear, remove only tab buttons
  row.querySelectorAll('.tab').forEach(b => b.remove());

  const clearBtn = document.getElementById('btn-clear');

  // ★ Favoritos FIRST
  const favCount = loadFavs().length;
  const favBtn   = document.createElement('button');
  favBtn.className = 'tab tab-fav' + (activeTab === 'Favoritos' ? ' active' : '');
  favBtn.innerHTML = '★ Favoritos' + `<span class="tab-n">${favCount}</span>`;
  favBtn.onclick = () => switchTab('Favoritos');
  row.insertBefore(favBtn, clearBtn);

  // Grouped tabs
  TAB_GROUPS.forEach((g) => {
    const n = g.id === 'Todos'
      ? RAW.length
      : RAW.filter((r) => getTabGroup(r[12]) === g.id).length;
    const btn = document.createElement('button');
    btn.className = 'tab' + (g.id === activeTab ? ' active' : '');
    btn.innerHTML = g.label + `<span class="tab-n">${n.toLocaleString('es-AR')}</span>`;
    btn.onclick = () => switchTab(g.id);
    row.insertBefore(btn, clearBtn);
  });
}

function switchTab(id) {
  activeTab = id;
  page = 1;
  // Restore filters for this tab
  document.getElementById('q').value         = getFilter('q');
  document.getElementById('f-moneda').value  = getFilter('moneda');
  document.getElementById('f-region').value  = getFilter('region');
  document.getElementById('f-horizonte').value = getFilter('horizonte');
  document.getElementById('f-sort').value    = getFilter('sort');
  sortKey = null; sortDir = -1;
  const sv = getFilter('sort');
  if (sv) {
    const map = {
      var_d_desc:['var_d',-1], var_d_asc:['var_d',1], var_anio_desc:['var_anio',-1], var_anio_asc:['var_anio',1],
      var_12_desc:['var_12',-1], var_12_asc:['var_12',1],
      pat_desc:['pat',-1], pat_asc:['pat',1],
    };
    if (map[sv]) { sortKey = map[sv][0]; sortDir = map[sv][1]; }
  }
  buildTabs();
  applyAll();
}

// ── LISTENERS ─────────────────────────────────────────────────────
function addListeners() {
  document.getElementById('q').addEventListener('input', () => { page = 1; updateClearBtn(); applyAll(); });
  ['f-moneda', 'f-region', 'f-horizonte'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => { page = 1; updateClearBtn(); applyAll(); });
  });
  document.getElementById('f-sort').addEventListener('change', (e) => {
    const v = e.target.value;
    setFilter('sort', v);
    const map = {
      var_d_desc:['var_d',-1], var_d_asc:['var_d',1], var_anio_desc:['var_anio',-1], var_anio_asc:['var_anio',1],
      var_12_desc:['var_12',-1], var_12_asc:['var_12',1],
      pat_desc:['pat',-1], pat_asc:['pat',1],
    };
    if (map[v]) { sortKey = map[v][0]; sortDir = map[v][1]; } else { sortKey = 'fondo'; sortDir = 1; }
    page = 1; updateClearBtn(); applyAll();
  });
}

function clearFilters() {
  document.getElementById('q').value          = '';
  document.getElementById('f-moneda').value   = '';
  document.getElementById('f-region').value   = '';
  document.getElementById('f-horizonte').value = '';
  document.getElementById('f-sort').value     = '';
  sortKey = 'fondo'; sortDir = 1;
  page = 1;
  updateClearBtn();
  applyAll();
}

function updateClearBtn() {
  const active =
    document.getElementById('q').value ||
    document.getElementById('f-moneda').value ||
    document.getElementById('f-region').value ||
    document.getElementById('f-horizonte').value ||
    document.getElementById('f-sort').value;
  document.getElementById('btn-clear').disabled = !active;
}

function thSort(key) {
  if (sortKey === key) sortDir *= -1;
  else { sortKey = key; sortDir = -1; }
  page = 1; applyAll();
  const sel = document.getElementById('f-sort');
  const opt = key + (sortDir === -1 ? '_desc' : '_asc');
  if ([...sel.options].some((o) => o.value === opt)) {
    sel.value = opt;
    setFilter('sort', opt);
  }
}

// ── FILTER + SORT ─────────────────────────────────────────────────
function applyAll() {
  const q   = document.getElementById('q').value.toLowerCase();
  const mon = document.getElementById('f-moneda').value;
  const reg = document.getElementById('f-region').value;
  const hor = document.getElementById('f-horizonte').value;
  const favs = loadFavs();

  filtered = RAW.filter((r) => {
    // Tab filter
    if (activeTab === 'Favoritos') {
      if (!favs.includes(r[1])) return false;
    } else if (activeTab !== 'Todos' && getTabGroup(r[12]) !== activeTab) return false;

    // UI filters — apply within the current tab scope
    if (mon && r[2] !== mon) return false;
    if (reg && r[3] !== reg) return false;
    if (hor && r[4] !== hor) return false;
    if (q) {
      const hay = (r[1] || '').toLowerCase() + ' ' + (r[11] || '').toLowerCase() + ' ' + String(r[0] || '').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sortKey) {
    const idx = { fondo:1, var_d:5, var_anio:6, var_12:7, pat:9 }[sortKey];
    filtered.sort((a, b) => {
      if (sortKey === 'fondo') {
        return (a[1] || '').localeCompare(b[1] || '', 'es') * sortDir;
      }
      const av = parseFloat(a[idx]) || -Infinity;
      const bv = parseFloat(b[idx]) || -Infinity;
      return (av - bv) * sortDir;
    });
  }

  document.getElementById('filter-count').textContent =
    filtered.length.toLocaleString('es-AR') + ' fondos';
  renderKPIs();
  renderTable();
}

// ── KPIs ──────────────────────────────────────────────────────────
function renderKPIs() {
  const n   = filtered.length;
  const vd  = filtered.map((r) => parseFloat(r[5])).filter((v) => !isNaN(v));
  const v12 = filtered.map((r) => parseFloat(r[7])).filter((v) => !isNaN(v));
  const pat = filtered.map((r) => parseFloat(r[9])).filter((v) => !isNaN(v) && v > 0);

  const avgVd  = vd.length  ? vd.reduce((a,b)  => a+b, 0) / vd.length  : null;
  const avgV12 = v12.length ? v12.reduce((a,b) => a+b, 0) / v12.length : null;
  const sumPat = pat.length ? pat.reduce((a,b) => a+b, 0) : null;
  const posVd  = vd.filter((v) => v > 0).length;

  const pct = (v, d=2) => v === null ? '—' : (v > 0 ? '+' : '') + v.toFixed(d) + '%';
  const fmtPat = (v) => {
    if (v === null) return '—';
    if (v >= 1e12) return '$' + (v/1e12).toFixed(2) + 'B';
    if (v >= 1e9)  return '$' + (v/1e9).toFixed(2)  + 'MM';
    if (v >= 1e6)  return '$' + (v/1e6).toFixed(2)  + 'M';
    return '$' + v.toLocaleString('es-AR');
  };
  const cls = (v) => v === null ? 'c' : v > 0 ? 'g' : v < 0 ? 'r' : 'y';

  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="kpi-bar c"></div>
      <div class="kpi-label">Fondos en filtro</div>
      <div class="kpi-val c">${n.toLocaleString('es-AR')}</div>
      <div class="kpi-sub">de ${RAW.length.toLocaleString('es-AR')} totales</div>
    </div>
    <div class="kpi"><div class="kpi-bar ${cls(avgVd)}"></div>
      <div class="kpi-label">Var. diaria promedio</div>
      <div class="kpi-val ${cls(avgVd)}">${pct(avgVd)}</div>
      <div class="kpi-sub">${posVd} fondos positivos</div>
    </div>
    <div class="kpi"><div class="kpi-bar ${cls(avgV12)}"></div>
      <div class="kpi-label">Rend. 12m promedio</div>
      <div class="kpi-val ${cls(avgV12)}">${pct(avgV12, 1)}</div>
      <div class="kpi-sub">últ. 12 meses</div>
    </div>
    <div class="kpi"><div class="kpi-bar c"></div>
      <div class="kpi-label">Patrimonio total</div>
      <div class="kpi-val c">${fmtPat(sumPat)}</div>
      <div class="kpi-sub">ARS en el filtro</div>
    </div>`;
}

// ── TABLE ─────────────────────────────────────────────────────────
function pctCell(v) {
  if (v === null || v === '' || v === undefined) return '<span class="td-mono zero">—</span>';
  const n = parseFloat(v);
  if (isNaN(n)) return '<span class="td-mono zero">—</span>';
  const cls = n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero';
  return `<span class="td-mono ${cls}">${n > 0 ? '+' : ''}${n.toFixed(2)}%</span>`;
}
function patCell(v) {
  if (!v) return '<span class="td-mono zero">—</span>';
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return '<span class="td-mono zero">—</span>';
  let s;
  if (n >= 1e12) s = '$' + (n/1e12).toFixed(2) + 'B';
  else if (n >= 1e9)  s = '$' + (n/1e9).toFixed(2)  + 'MM';
  else if (n >= 1e6)  s = '$' + (n/1e6).toFixed(2)  + 'M';
  else s = '$' + n.toLocaleString('es-AR');
  return `<span class="td-mono">${s}</span>`;
}
function monBadge(m) {
  const c = { ARS:'ars', USD:'usd', USB:'usb' }[m] || 'reg';
  return `<span class="badge badge-${c}">${m}</span>`;
}
function favBtnHtml(name) {
  const on  = isFav(name);
  const esc = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<button class="btn-fav${on?' active':''}" data-name="${name.replace(/"/g,'&quot;')}" onclick="toggleFav('${esc}')" title="${on?'Quitar de favoritos':'Agregar a favoritos'}">★</button>`;
}
function cnvLink(cnvCode, cafciCode) {
  const q = encodeURIComponent(cnvCode) + ';' + encodeURIComponent(cafciCode);
  return `<a class="btn-cnv" href="https://www.cafci.org.ar/ficha-fondo.html?q=${q}" target="_blank" rel="noopener" title="Ver en CAFCI">↗</a>`;
}

function renderTable() {
  const tbody = document.getElementById('tbody');

  if (activeTab === 'Favoritos' && loadFavs().length === 0) {
    tbody.innerHTML = `<tr><td colspan="12">
      <div class="empty-favs">
        <div class="empty-icon">★</div>
        <p>No tenés favoritos guardados todavía.<br>Hacé clic en la estrella de cualquier fondo para agregarlo.</p>
      </div>
    </td></tr>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="12" class="empty">No se encontraron fondos con los filtros seleccionados.</td></tr>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  tbody.className = 'fade-up';
  tbody.innerHTML = slice.map((r) => `<tr>
    <td>${favBtnHtml(r[1] || '')}</td>
    <td class="td-fondo">${r[1] || '—'}</td>
    <td>${monBadge(r[2])}</td>
    <td><span class="badge badge-reg">${REG_MAP[r[3]] || r[3] || '—'}</span></td>
    <td><span class="badge badge-hor">${HOR_MAP[r[4]] || r[4] || '—'}</span></td>
    <td>${pctCell(r[5])}</td>
    <td>${pctCell(r[6])}</td>
    <td>${pctCell(r[7])}</td>
    <td>${patCell(r[9])}</td>
    <td class="td-gerente">${r[11] || '—'}</td>
    <td>${cnvLink(r[13] || '', r[0] || '')}</td>
  </tr>`).join('');

  renderPagination();
}

// ── PAGINATION ────────────────────────────────────────────────────
function renderPagination() {
  const total = Math.ceil(filtered.length / pageSize);
  const pg = document.getElementById('pagination');
  if (total <= 1) { pg.innerHTML = ''; return; }

  let btns = `<button class="pg" onclick="goPage(${page-1})" ${page<=1?'disabled':''}>‹</button>`;
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i===1 || i===total || Math.abs(i-page)<=2) pages.push(i);
    else if (pages[pages.length-1] !== '…') pages.push('…');
  }
  pages.forEach((p) => {
    if (p==='…') btns += `<span class="pg-info" style="padding:0 4px">…</span>`;
    else btns += `<button class="pg ${p===page?'on':''}" onclick="goPage(${p})">${p}</button>`;
  });
  btns += `<button class="pg" onclick="goPage(${page+1})" ${page>=total?'disabled':''}>›</button>`;

  const info = `<span class="pg-info">${((page-1)*pageSize+1).toLocaleString('es-AR')}–${Math.min(page*pageSize,filtered.length).toLocaleString('es-AR')} de ${filtered.length.toLocaleString('es-AR')}</span>`;
  const sizeSelect = `<select class="pg-size" onchange="pageSize=+this.value;page=1;renderTable()"><option value="25">25</option><option value="50" selected>50</option><option value="100">100</option></select>`;
  pg.innerHTML = `<div class="page-btns">${btns}</div>${info}${sizeSelect}`;
}

function goPage(p) {
  const total = Math.ceil(filtered.length / pageSize);
  if (p<1 || p>total) return;
  page = p;
  renderTable();
  document.querySelector('.table-wrap').scrollIntoView({ behavior:'smooth', block:'start' });
}

async function reloadData() {
  RAW = []; TABS = [];
  document.getElementById('tbody').innerHTML =
    '<tr><td colspan="12" class="empty">Actualizando datos…</td></tr>';
  await init();
}
