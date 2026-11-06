import { useState } from "react";
import InformeModal from "./InformeModal";
import { useAuth } from "../context/useAuth";
import { fmtMoney, cnvLink } from "../lib/utils";
import { fechaCorta } from "../lib/format";
import { filtrarCartera, enriquecerCartera, dividirTenencias, resumenCartera } from "../lib/portfolio";
import { PctCell, MonBadge, MoneyCell, VActualCell } from "./TableCells";
import ConfirmDialog from "./ConfirmDialog";
import Select from "./Select";
import {
  IconX, IconSearch, IconFileText, IconChartColumn,
  IconInfo, IconTrash2, IconAlertTriangle,
} from "./Icons";

export default function PortfolioTab({ raw, apiFecha, refs, onOpenSuscripcion, onOpenRescate, onOpenHistorial, onFondoClick }) {
  const { portfolio, deleteSuscripcion } = useAuth();
  const [subTab, setSubTab] = useState("actual");
  const [q, setQ] = useState("");
  const [showInforme, setShowInforme] = useState(false);
  const [filterMoneda, setFilterMoneda] = useState("");
  // Confirmación de borrado: { mensaje, onConfirm } | null. El diálogo es ConfirmDialog, el mismo
  // que usa HistorialModal.
  const [confirm, setConfirm] = useState(null);
  const hasFilters = q || filterMoneda;
  const clearFilters = () => {
    setQ("");
    setFilterMoneda("");
  };

  // Filtros, agrupación y cálculos: lib/portfolio.js (funciones puras, probadas aparte).
  const portfolioFiltered = filtrarCartera(portfolio, { q, moneda: filterMoneda });
  const enriched = enriquecerCartera(portfolioFiltered, raw, apiFecha);

  // Split actual vs histórico (un item por fondo) y totales para las tarjetas KPI.
  const { actual: enrichedActual, historico: enrichedHistorico } = dividirTenencias(enriched);
  const enrichedView = subTab === "actual" ? enrichedActual : enrichedHistorico;

  const { totalARS, totalUSD, vARS, vUSD, rendARS, rendUSD, rendARSpct, rendUSDpct, clsARS, clsUSD } =
    resumenCartera(enrichedActual);

  const confirmDelete = (item) => {
    const n = item._suscripciones?.length || 1;
    const msg =
      n > 1
        ? `¿Eliminar "${item.fondo_nombre}" del portafolio? Se eliminarán ${n} suscripciones. Esta acción es irreversible.`
        : `¿Eliminar "${item.fondo_nombre}" del portafolio? Esta acción es irreversible.`;
    setConfirm({
      mensaje: msg,
      onConfirm: () => {
        const ids = item._suscripciones?.map((s) => s.id) || [item.id];
        ids.forEach((id) => deleteSuscripcion(id));
      },
    });
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

      {/* Sub-pestañas (estilos en styles/portfolio.css: .subtabs / .subtab) */}
      <div className="subtabs">
        <button className={`subtab${subTab === "actual" ? " on" : ""}`} onClick={() => setSubTab("actual")}>
          Tenencia Actual {enrichedActual.length > 0 && <span className="subtab-n">({enrichedActual.length})</span>}
        </button>
        <button className={`subtab${subTab === "historico" ? " on" : ""}`} onClick={() => setSubTab("historico")}>
          Tenencia Histórica {enrichedHistorico.length > 0 && <span className="subtab-n">({enrichedHistorico.length})</span>}
        </button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-wrap">
          <span className="search-icon"><IconSearch size={14} /></span>
          <input type="search" placeholder="Buscar fondo…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {/* Mismo Select que la barra de filtros principal (components/Select.jsx): flecha de Lucide
            en lugar de la nativa del navegador. */}
        <Select value={filterMoneda} onChange={(e) => setFilterMoneda(e.target.value)} ariaLabel="Moneda">
          <option value="">Todas las monedas</option>
          <option value="ARS">ARS — Pesos</option>
          <option value="USD">USD — Dólar</option>
          <option value="USB">USB — Dólar Billete</option>
        </Select>
        <button className="btn-clear" disabled={!hasFilters} onClick={clearFilters}>
          <IconX size={12} /> Limpiar filtros
        </button>
        <button className="btn-informe-print" style={{ marginLeft: "auto" }} onClick={() => setShowInforme(true)} disabled={subTab === "historico"}>
          <IconFileText size={13} /> Exportar PDF
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
                      {fechaCorta(apiFecha)}
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
                          <div className="empty-icon"><IconChartColumn size={32} strokeWidth={1.5} /></div>
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
                          <div className="empty-icon"><IconFileText size={32} strokeWidth={1.5} /></div>
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
                  const precFmt = parseFloat(item.precio_suscripcion ?? item.precio_compra).toLocaleString("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
                  return (
                    <tr key={`${item.fondo_nombre}__${item.moneda}`}>
                      <td style={{ verticalAlign: "middle" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: 52 }}>
                          {/* Fila 1: info + historial */}
                          <button
                            className="btn-port-action btn-info"
                            onClick={() => {
                              const match = raw.find((r) => r.fondo === item.fondo_nombre);
                              if (match) onFondoClick && onFondoClick(match);
                            }}
                            title="Ver detalle del fondo"
                          >
                            <IconInfo size={13} />
                          </button>
                          <button
                            className="btn-port-action btn-hist"
                            onClick={() => onOpenHistorial(item.fondo_nombre, item.moneda)}
                            title="Ver historial"
                          >
                            <IconFileText size={13} />
                          </button>
                          {/* Fila 2: + y − (actual) o + y borrar (historico) */}
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
                              <IconTrash2 size={13} />
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
                          <span style={{ color: "var(--yellow)" }} title="Sin match">
                            {" "}
                            <IconAlertTriangle size={11} />
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
                          <a className="btn-cnv" href={cnvLink(r.cafci || "", r.cnv || "")} target="_blank" rel="noopener" title="Ver en CAFCI">
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
      {confirm && (
        <ConfirmDialog
          mensaje={confirm.mensaje}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
      {showInforme && <InformeModal enriched={enriched} apiFecha={apiFecha} onClose={() => setShowInforme(false)} />}
    </>
  );
}
