import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { REG_MAP, HOR_MAP, cnvLink } from "../lib/utils";

// Parse "DD/MM/YY" or "DD/MM/YYYY" → Date
function parseApiDate(s) {
  if (!s) return null;
  const p = s.split("/");
  if (p.length !== 3) return null;
  const yr = p[2].length === 2 ? 2000 + parseInt(p[2], 10) : parseInt(p[2], 10);
  return new Date(yr, parseInt(p[1], 10) - 1, parseInt(p[0], 10));
}

function PctCell({ v }) {
  if (v === null || v === undefined || v === "") return <span className="td-mono zero">—</span>;
  const n = parseFloat(v);
  if (isNaN(n)) return <span className="td-mono zero">—</span>;
  const cls = n > 0 ? "pos" : n < 0 ? "neg" : "zero";
  return (
    <span className={`td-mono ${cls}`}>
      {n > 0 ? "+" : ""}
      {n.toFixed(3)}%
    </span>
  );
}

function PatCell({ v }) {
  if (!v) return <span className="td-mono zero">—</span>;
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return <span className="td-mono zero">—</span>;
  let s;
  if (n >= 1e12) s = "$" + (n / 1e12).toFixed(2) + "B";
  else if (n >= 1e9) s = "$" + (n / 1e9).toFixed(2) + "MM";
  else if (n >= 1e6) s = "$" + (n / 1e6).toFixed(2) + "M";
  else s = "$" + n.toLocaleString("es-AR");
  return <span className="td-mono">{s}</span>;
}

function MonBadge({ m }) {
  const c = { ARS: "ars", USD: "usd", USB: "usb" }[m] || "reg";
  return <span className={`badge badge-${c}`}>{m}</span>;
}

export default function FondosTable({ filtered, refs, onOpenSuscripcion, onFondoClick }) {
  const { user, favs, toggleFav } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState("fondo");
  const [sortDir, setSortDir] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d * -1);
    else {
      setSortKey(key);
      setSortDir(-1);
    }
    setPage(1);
  };

  const sorted = [...filtered].sort((a, b) => {
    const idx = { fondo: 1, var_d: 15, var_anio: 6, var_12: 7, pat: 9 }[sortKey];
    if (sortKey === "fondo") return (a[1] || "").localeCompare(b[1] || "", "es") * sortDir;
    const av = parseFloat(a[idx]) || -Infinity;
    const bv = parseFloat(b[idx]) || -Infinity;
    return (av - bv) * sortDir;
  });

  const total = Math.ceil(sorted.length / pageSize);
  const slice = sorted.slice((page - 1) * pageSize, page * pageSize);

  const arrow = (key) => (sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : " ↕");

  return (
    <div className="table-wrap">
      <div className="tbl-scroll">
        <table id="main-table">
          <thead>
            <tr>
              <th style={{ width: 64, textAlign: "center" }}>Acciones</th>
              <th style={{ minWidth: 240 }} onClick={() => handleSort("fondo")} id="th-fondo">
                Fondo <span className="sort-arrow">{arrow("fondo")}</span>
              </th>
              <th>Moneda</th>
              <th>Región</th>
              <th>Horizonte</th>
              <th onClick={() => handleSort("var_d")} id="th-vard">
                <div className="th-var-inner">
                  <div className="th-var-left">
                    <span className="th-var-title">Var. Diaria %</span>
                    <span className="th-date">{(refs?.fechaAnterior || "").trim()}</span>
                  </div>
                  <span className="sort-arrow">{arrow("var_d")}</span>
                </div>
              </th>
              <th onClick={() => handleSort("var_anio")} id="th-varanio">
                <div className="th-var-inner">
                  <div className="th-var-left">
                    <span className="th-var-title">Var. Inicio Año %</span>
                    <span className="th-date">
                      {(() => {
                        if (refs?.fechaInicioAnio) return refs.fechaInicioAnio;
                        if (refs?.fecha2) {
                          const p = refs.fecha2.split("/");
                          if (p.length === 3) return "01/01/" + String(parseInt(p[2], 10) + 1).padStart(2, "0");
                        }
                        return "01/01/26";
                      })()}
                    </span>
                  </div>
                  <span className="sort-arrow">{arrow("var_anio")}</span>
                </div>
              </th>
              <th onClick={() => handleSort("var_12")} id="th-var12">
                <div className="th-var-inner">
                  <div className="th-var-left">
                    <span className="th-var-title">Var. 12m %</span>
                    <span className="th-date">{(refs?.fecha3 || "").trim()}</span>
                  </div>
                  <span className="sort-arrow">{arrow("var_12")}</span>
                </div>
              </th>
              <th onClick={() => handleSort("pat")} id="th-pat">
                Patrimonio <span className="sort-arrow">{arrow("pat")}</span>
              </th>
              <th style={{ minWidth: 180 }}>Sociedad Gerente</th>
              <th>
                Consultar
                <br />
                CAFCI
              </th>
            </tr>
          </thead>
          <tbody className="fade-up">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty">
                  No se encontraron fondos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              slice.map((r, i) => {
                const isFaved = favs.includes(r[1]);
                return (
                  <tr key={i}>
                    <td style={{ verticalAlign: "middle" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: 52, margin: "0 auto" }}>
                        <button
                          className={`btn-fav${isFaved ? " active" : ""}`}
                          onClick={() => toggleFav(r[1])}
                          title={isFaved ? "Quitar de favoritos" : "Agregar a favoritos"}
                          style={{ fontSize: 13 }}
                        >★</button>
                        <button
                          className="btn-port-action btn-info"
                          onClick={() => onFondoClick && onFondoClick(r)}
                          title="Ver detalle del fondo"
                        >ⓘ</button>
                        {user ? (
                          <button
                            className="btn-port-action btn-susc"
                            onClick={() => onOpenSuscripcion(r[1], r[2])}
                            title="Agregar a mi portfolio"
                            style={{ gridColumn: "span 2" }}
                          >+📊</button>
                        ) : <span />}
                      </div>
                    </td>
                    <td className="td-fondo">{r[1] || "—"}</td>
                    <td>
                      <MonBadge m={r[2]} />
                    </td>
                    <td>
                      <span className="badge badge-reg">{REG_MAP[r[3]] || r[3] || "—"}</span>
                    </td>
                    <td>
                      <span className="badge badge-hor">{HOR_MAP[r[4]] || r[4] || "—"}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <PctCell v={r[15]} />
                      {r[15] != null && (
                        <div style={{ fontSize: 9, color: "var(--text2)", marginTop: 1 }}>~ {(parseFloat(r[15]) * 360).toFixed(2)}% TNA ~</div>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {(() => {
                        const pct = parseFloat(r[6]);
                        if (isNaN(pct)) return <span className="td-mono zero">—</span>;
                        const apiFechaDate = parseApiDate(refs?.apiFecha);
                        const baseAnio = parseApiDate(refs?.fecha2);
                        const dias = apiFechaDate && baseAnio ? Math.max(1, Math.round((apiFechaDate - baseAnio) / 86400000)) : 365;
                        const tna = (pct / dias) * 360;
                        const cls = tna > 0 ? "pos" : tna < 0 ? "neg" : "zero";
                        return (
                          <span className={"td-mono " + cls}>
                            {tna > 0 ? "+" : ""}
                            {tna.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <PctCell v={r[7]} />
                    </td>
                    <td>
                      <PatCell v={r[9]} />
                    </td>
                    <td className="td-gerente">{r[11] || "—"}</td>
                    <td>
                      <a className="btn-cnv" href={cnvLink(r[13] || "", r[0] || "")} target="_blank" rel="noopener" title="Ver en CAFCI">
                        ↗
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 1 && (
        <div className="pagination">
          <div className="page-btns">
            <button className="pg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ‹
            </button>
            {(() => {
              const pages = [];
              for (let i = 1; i <= total; i++) {
                if (i === 1 || i === total || Math.abs(i - page) <= 2) pages.push(i);
                else if (pages[pages.length - 1] !== "…") pages.push("…");
              }
              return pages.map((p, i) =>
                p === "…" ? (
                  <span key={i} className="pg-info" style={{ padding: "0 4px" }}>
                    …
                  </span>
                ) : (
                  <button key={i} className={`pg${p === page ? " on" : ""}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                ),
              );
            })()}
            <button className="pg" onClick={() => setPage((p) => Math.min(total, p + 1))} disabled={page >= total}>
              ›
            </button>
          </div>
          <span className="pg-info">
            {((page - 1) * pageSize + 1).toLocaleString("es-AR")}–{Math.min(page * pageSize, sorted.length).toLocaleString("es-AR")} de{" "}
            {sorted.length.toLocaleString("es-AR")}
          </span>
          <select
            className="pg-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(+e.target.value);
              setPage(1);
            }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      )}
    </div>
  );
}
