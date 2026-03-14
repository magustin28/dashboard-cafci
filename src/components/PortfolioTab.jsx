import { useState } from "react";
import InformeModal from "./InformeModal";
import { useAuth } from "../context/AuthContext";
import { parseFechaAPI, fmtMoney, cnvLink } from "../lib/utils";

function MoneyCell({ v, mon, colored }) {
  if (v === null || isNaN(v)) return <span className="td-mono zero">—</span>;
  const pfx = mon === "ARS" ? "$ " : "U$S ";
  const val = Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cls = colored ? (v > 0 ? "pos" : v < 0 ? "neg" : "zero") : "";
  const sign = colored ? (v > 0 ? "+" : v < 0 ? "-" : "") : "";
  return (
    <span className={`td-mono ${cls}`} style={{ whiteSpace: "nowrap" }}>
      {sign}
      {pfx}
      {val}
    </span>
  );
}

function VActualCell({ v, costo, mon }) {
  if (v === null || isNaN(v)) return <span className="td-mono zero">—</span>;
  const cls = v > costo ? "pos" : v < costo ? "neg" : "zero";
  const pfx = mon === "ARS" ? "$ " : "U$S ";
  const val = v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className={`td-mono ${cls}`} style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
      {pfx}
      {val}
    </span>
  );
}

function PctCell({ v, d = 2 }) {
  if (v === null || isNaN(v)) return <span className="td-mono zero">—</span>;
  const cls = v > 0 ? "pos" : v < 0 ? "neg" : "zero";
  return (
    <span className={`td-mono ${cls}`}>
      {v > 0 ? "+" : ""}
      {v.toFixed(d)}%
    </span>
  );
}

function MonBadge({ m }) {
  const c = { ARS: "ars", USD: "usd", USB: "usb" }[m] || "reg";
  return <span className={`badge badge-${c}`}>{m}</span>;
}

export default function PortfolioTab({ raw, apiFecha, refs, onOpenSuscripcion, onOpenRescate, onOpenHistorial, onFondoClick }) {
  const { user, portfolio, deleteSuscripcion } = useAuth();
  const [subTab, setSubTab] = useState("actual");
  const [q, setQ] = useState("");
  const [showInforme, setShowInforme] = useState(false);
  const [filterMoneda, setFilterMoneda] = useState("");
  const hasFilters = q || filterMoneda;
  const clearFilters = () => {
    setQ("");
    setFilterMoneda("");
  };

  if (!user) {
    return (
      <div className="table-wrap">
        <div className="tbl-scroll">
          <table id="main-table">
            <tbody>
              <tr>
                <td colSpan={14}>
                  <div className="empty-favs">
                    <div className="empty-icon">🔐</div>
                    <p>Iniciá sesión para ver tu portafolio.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const fechaAPI = parseFechaAPI(apiFecha);

  const portfolioFiltered = portfolio.filter((i) => {
    if (filterMoneda && i.moneda !== filterMoneda) return false;
    if (q && !i.fondo_nombre.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const enriched = [...portfolioFiltered]
    .sort((a, b) => a.fondo_nombre.localeCompare(b.fondo_nombre, "es"))
    .map((item) => {
      const match = raw.find((r) => r[1] === item.fondo_nombre);
      // Costo basado en cuotapartes DISPONIBLES (refleja posición actual tras rescates)
      const cpDisponibles = parseFloat(item.cuotapartes_disponibles);
      const costoTotal = cpDisponibles * parseFloat(item.precio_compra);
      const valorMilCp = match ? parseFloat(match[14]) : null;
      const precioActual = valorMilCp !== null && !isNaN(valorMilCp) ? valorMilCp / 1000 : null;
      const vActual = precioActual !== null ? cpDisponibles * precioActual : null;
      const rendPct = vActual !== null && costoTotal > 0 ? ((vActual - costoTotal) / costoTotal) * 100 : null;
      const varDiariaPct = match ? parseFloat(match[15]) : null;
      const rendImporte = vActual !== null ? Math.round((vActual - costoTotal) * 100) / 100 : null;
      let tna = null,
        tem = null,
        tea = null;
      if (vActual !== null && costoTotal > 0 && fechaAPI && item.fecha_compra) {
        const dias = Math.round((fechaAPI - new Date(item.fecha_compra + "T00:00:00")) / (1000 * 60 * 60 * 24));
        if (dias > 0) {
          tna = (rendImporte / costoTotal / dias) * 360 * 100;
          tea = (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100;
          tem = (Math.pow(1 + tea / 100, 1 / 12) - 1) * 100;
        }
      }
      return { ...item, match, costoTotal, precioActual, vActual, rendPct, varDiariaPct, rendImporte, tna, tem, tea };
    });

  // Split actual vs historico
  // Un fondo es histórico si TODAS sus suscripciones tienen cp_disponibles = 0
  // Agrupamos por fondo_nombre para detectarlo
  const fondosEnCartera = {};
  portfolioFiltered.forEach((item) => {
    const fn = item.fondo_nombre;
    if (!fondosEnCartera[fn]) fondosEnCartera[fn] = [];
    fondosEnCartera[fn].push(item);
  });

  const enrichedActual = enriched.filter((i) => parseFloat(i.cuotapartes_disponibles) > 0.000001);
  const fondosHistoricos = Object.keys(fondosEnCartera).filter((fn) =>
    fondosEnCartera[fn].every((i) => parseFloat(i.cuotapartes_disponibles) <= 0.000001),
  );
  // Una sola fila por fondo en histórico (la primera suscripción como representante)
  const enrichedHistorico = fondosHistoricos.map((fn) => enriched.find((i) => i.fondo_nombre === fn)).filter(Boolean);
  const enrichedView = subTab === "actual" ? enrichedActual : enrichedHistorico;

  // KPIs
  const totalARS = enrichedActual.filter((i) => i.moneda === "ARS").reduce((s, i) => s + i.costoTotal, 0);
  const totalUSD = enrichedActual.filter((i) => i.moneda !== "ARS").reduce((s, i) => s + i.costoTotal, 0);
  const vARS = enrichedActual.filter((i) => i.moneda === "ARS" && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
  const vUSD = enrichedActual.filter((i) => i.moneda !== "ARS" && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
  const rendARS = enrichedActual.filter((i) => i.moneda === "ARS" && i.rendImporte !== null).reduce((s, i) => s + i.rendImporte, 0);
  const rendUSD = enrichedActual.filter((i) => i.moneda !== "ARS" && i.rendImporte !== null).reduce((s, i) => s + i.rendImporte, 0);
  const rendARSpct = totalARS > 0 && vARS > 0 ? ((vARS - totalARS) / totalARS) * 100 : null;
  const rendUSDpct = totalUSD > 0 && vUSD > 0 ? ((vUSD - totalUSD) / totalUSD) * 100 : null;
  const clsARS = rendARS > 0 ? "g" : rendARS < 0 ? "r" : "y";
  const clsUSD = rendUSD > 0 ? "g" : rendUSD < 0 ? "r" : "y";

  const confirmDelete = (item) => {
    if (confirm(`¿Eliminar "${item.fondo_nombre}" del portafolio? Esta acción es irreversible.`)) {
      deleteSuscripcion(item.id);
    }
  };

  return (
    <>
      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-bar c"></div>
          <div className="kpi-label">Posiciones</div>
          <div className="kpi-val c">{enrichedActual.length}</div>
          <div className="kpi-sub">fondos en cartera</div>
        </div>
        {totalARS > 0 && (
          <div className="kpi">
            <div className="kpi-bar c"></div>
            <div className="kpi-label">Invertido ARS</div>
            <div className="kpi-val c" style={{ fontSize: 18 }}>
              {fmtMoney(totalARS, "ARS")}
            </div>
            <div className="kpi-sub">costo de compra</div>
          </div>
        )}
        {rendARS !== 0 && vARS > 0 && (
          <div className="kpi">
            <div className={`kpi-bar ${clsARS}`}></div>
            <div className="kpi-label">Rendimiento ARS</div>
            <div className={`kpi-val ${clsARS}`} style={{ fontSize: 18 }}>
              {rendARS > 0 ? "+" : ""}
              {fmtMoney(rendARS, "ARS")}
            </div>
            <div className="kpi-sub">{rendARSpct !== null ? (rendARSpct > 0 ? "+" : "") + rendARSpct.toFixed(2) + "% sobre costo" : ""}</div>
          </div>
        )}
        {totalUSD > 0 && (
          <div className="kpi">
            <div className="kpi-bar c"></div>
            <div className="kpi-label">Invertido USD</div>
            <div className="kpi-val c" style={{ fontSize: 18 }}>
              {fmtMoney(totalUSD, "USD")}
            </div>
            <div className="kpi-sub">costo de compra</div>
          </div>
        )}
        {rendUSD !== 0 && vUSD > 0 && (
          <div className="kpi">
            <div className={`kpi-bar ${clsUSD}`}></div>
            <div className="kpi-label">Rendimiento USD</div>
            <div className={`kpi-val ${clsUSD}`} style={{ fontSize: 18 }}>
              {rendUSD > 0 ? "+" : ""}
              {fmtMoney(rendUSD, "USD")}
            </div>
            <div className="kpi-sub">{rendUSDpct !== null ? (rendUSDpct > 0 ? "+" : "") + rendUSDpct.toFixed(2) + "% sobre costo" : ""}</div>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, margin: "0 0 14px" }}>
        <button
          onClick={() => setSubTab("actual")}
          style={{
            padding: "5px 14px",
            borderRadius: 20,
            border: "1px solid var(--border)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: subTab === "actual" ? "var(--accent)" : "transparent",
            color: subTab === "actual" ? "#fff" : "var(--text2)",
            transition: "all 0.15s",
          }}
        >
          Tenencia Actual {enrichedActual.length > 0 && <span style={{ opacity: 0.8 }}>({enrichedActual.length})</span>}
        </button>
        <button
          onClick={() => setSubTab("historico")}
          style={{
            padding: "5px 14px",
            borderRadius: 20,
            border: "1px solid var(--border)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: subTab === "historico" ? "var(--accent)" : "transparent",
            color: subTab === "historico" ? "#fff" : "var(--text2)",
            transition: "all 0.15s",
          }}
        >
          Tenencia Histórica {enrichedHistorico.length > 0 && <span style={{ opacity: 0.8 }}>({enrichedHistorico.length})</span>}
        </button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input type="search" placeholder="Buscar fondo…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={filterMoneda} onChange={(e) => setFilterMoneda(e.target.value)}>
          <option value="">Todas las monedas</option>
          <option value="ARS">ARS — Pesos</option>
          <option value="USD">USD — Dólar</option>
          <option value="USB">USB — Dólar Billete</option>
        </select>
        <button className="btn-clear" disabled={!hasFilters} onClick={clearFilters}>
          ✕ Limpiar filtros
        </button>
        <button className="btn-informe-print" style={{ marginLeft: "auto" }} onClick={() => setShowInforme(true)} disabled={subTab === "historico"}>
          📄 Exportar PDF
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="tbl-scroll">
          <table id="main-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Acciones</th>
                <th style={{ minWidth: 180, maxWidth: 240 }}>Fondo</th>
                <th style={{ width: 70 }}>Moneda</th>
                <th style={{ width: 100 }}>
                  Cuota-
                  <br />
                  partes
                </th>
                <th style={{ width: 110 }}>
                  P. Suscrip.
                  <br />
                  Pond.
                </th>
                <th style={{ width: 110 }}>
                  Importe
                  <br />
                  Suscrip.
                </th>
                <th style={{ width: 110 }}>
                  Valor Actual
                  {apiFecha && (
                    <div style={{ fontSize: 9, fontWeight: 400, color: "var(--muted2)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                      {(() => {
                        const f = apiFecha;
                        if (f && f.includes("-")) {
                          const [y, m, d] = f.split("-");
                          return `${d}/${m}/${y.slice(2)}`;
                        }
                        return f;
                      })()}
                    </div>
                  )}
                </th>
                <th style={{ width: 80 }}>
                  Rend.
                  <br />%
                </th>
                <th style={{ width: 110 }}>
                  Rendimiento
                  <br />
                  Importe
                </th>
                <th style={{ width: 80 }}>
                  Var. Diaria %
                  {refs?.fechaAnterior && (
                    <div style={{ fontSize: 9, fontWeight: 400, color: "var(--muted2)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                      {refs.fechaAnterior}
                    </div>
                  )}
                </th>
                <th style={{ width: 72 }}>TNA</th>
                <th style={{ width: 72 }}>TEM</th>
                <th style={{ width: 72 }}>TEA</th>
                <th style={{ width: 44 }}>CAFCI</th>
              </tr>
            </thead>
            <tbody className="fade-up">
              {enrichedView.length === 0 ? (
                <tr>
                  <td colSpan={14}>
                    <div className="empty-favs">
                      {subTab === "actual" ? (
                        <>
                          <div className="empty-icon">📊</div>
                          <p>
                            No tenés suscripciones activas.
                            <br />
                            <button className="btn-retry" style={{ marginTop: 14 }} onClick={() => onOpenSuscripcion()}>
                              + Agregar suscripción
                            </button>
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="empty-icon">📋</div>
                          <p>No hay fondos rescatados en tu historial.</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                enrichedView.map((item) => {
                  const r = item.match;
                  const cpDisp = parseFloat(item.cuotapartes_disponibles);
                  const cantFmt = cpDisp.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                  const precFmt = parseFloat(item.precio_compra).toLocaleString("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
                  return (
                    <tr key={item.id}>
                      <td style={{ verticalAlign: "middle" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: 52 }}>
                          {/* Fila 1: ⓘ + 📋 */}
                          <button
                            className="btn-port-action btn-info"
                            onClick={() => {
                              const match = raw.find((r) => r[1] === item.fondo_nombre);
                              if (match) onFondoClick && onFondoClick(match);
                            }}
                            title="Ver detalle del fondo"
                          >
                            ⓘ
                          </button>
                          <button
                            className="btn-port-action btn-hist"
                            onClick={() => onOpenHistorial(item.fondo_nombre, item.moneda)}
                            title="Ver historial"
                          >
                            📋
                          </button>
                          {/* Fila 2: + y − (actual) o + y 🗑 (historico) */}
                          <button
                            className="btn-port-action btn-susc"
                            onClick={() => onOpenSuscripcion(item.fondo_nombre, item.moneda)}
                            title="Nueva suscripción"
                          >
                            +
                          </button>
                          {subTab === "actual" ? (
                            <button
                              className="btn-port-action btn-resc"
                              onClick={() => onOpenRescate(item.fondo_nombre, item.moneda)}
                              title="Registrar rescate"
                            >
                              −
                            </button>
                          ) : (
                            <button className="btn-port-action btn-del" onClick={() => confirmDelete(item)} title="Eliminar posición">
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                      <td
                        className="td-fondo"
                        style={{ minWidth: 160, maxWidth: 220, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}
                      >
                        {item.fondo_nombre}
                        {!r && (
                          <span style={{ fontSize: 10, color: "var(--yellow)" }} title="Sin match">
                            {" "}
                            ⚠
                          </span>
                        )}
                      </td>
                      <td>
                        <MonBadge m={item.moneda} />
                      </td>
                      <td>
                        <span className="td-mono" style={{ fontSize: 11 }}>
                          {cantFmt}
                        </span>
                      </td>
                      <td>
                        <span className="td-mono" style={{ fontSize: 11 }}>
                          {precFmt}
                        </span>
                      </td>
                      <td>
                        <MoneyCell v={item.costoTotal} mon={item.moneda} />
                      </td>
                      <td>
                        <VActualCell v={item.vActual} costo={item.costoTotal} mon={item.moneda} />
                      </td>
                      <td>
                        <PctCell v={item.rendPct} />
                      </td>
                      <td>
                        <MoneyCell v={item.rendImporte} mon={item.moneda} colored />
                      </td>
                      <td>
                        <PctCell v={item.varDiariaPct} />
                      </td>
                      <td>
                        <PctCell v={item.tna} />
                      </td>
                      <td>
                        <PctCell v={item.tem} />
                      </td>
                      <td>
                        <PctCell v={item.tea} />
                      </td>
                      <td>
                        {r ? (
                          <a className="btn-cnv" href={cnvLink(r[13] || "", r[0] || "")} target="_blank" rel="noopener" title="Ver en CAFCI">
                            ↗
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showInforme && <InformeModal enriched={enriched} apiFecha={apiFecha} onClose={() => setShowInforme(false)} />}
    </>
  );
}
