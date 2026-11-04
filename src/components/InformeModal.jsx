import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { sb } from "../lib/supabase";
import { toast } from "../lib/utils";
import {
  fechaCompleta, cuotapartes, precioCuotaparte, moneda, porcentaje, hoyCompleta,
} from "../lib/format";
import { abrirInformePDF } from "../lib/informePdf";
import { useModalClose } from "../hooks/useModalClose";
import { IconX, IconFileText } from "./Icons";

export default function InformeModal({ enriched, apiFecha, onClose }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Cierre animado (hooks/useModalClose.js): el informe usa .informe-modal, que tiene su propia
  // animación de salida en styles/portfolio.css.
  const { closing, requestClose } = useModalClose(onClose);

  // Cerrar con ESC
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [requestClose]);

  useEffect(() => {
    if (!user || !enriched?.length) return;
    (async () => {
      const fondos = enriched.map((i) => i.fondo_nombre);
      const [rS, rR] = await Promise.all([
        sb.from("suscripciones").select("*").eq("user_id", user.id).in("fondo_nombre", fondos).order("fecha_compra", { ascending: true }),
        sb
          .from("rescates")
          .select("*, rescate_detalles(*)")
          .eq("user_id", user.id)
          .in("fondo_nombre", fondos)
          .order("fecha_rescate", { ascending: true }),
      ]);
      if (rS.error || rR.error) {
        const e = rS.error || rR.error;
        console.error("[cafci] no se pudieron leer los datos del informe:", e);
        toast(`No se pudieron leer los datos del informe: ${e.message}`);
      }
      setData({ suscs: rS.data || [], rescates: rR.data || [] });
      setLoading(false);
    })();
  }, [user, enriched]);

  // Formateadores: lib/format.js. Los alias conservan los nombres que ya usaba el JSX.
  const fmtDate = fechaCompleta;
  const fmtCp = cuotapartes;
  const fmtPrecio = precioCuotaparte;
  const fmtMon = moneda;
  const fmtPct = porcentaje;
  const fmtMonSigned = (v, mon) => moneda(v, mon, { signo: true });
  const today = hoyCompleta();
  const fechaData = fechaCompleta(apiFecha || today);

  // La ventana de impresión vive en lib/informePdf.js: acá sólo se dispara.
  const handleOpenPDF = () => abrirInformePDF("informe-content");

  const Logo = () => (
    <svg width="26" height="26" viewBox="0 0 32 32" style={{ verticalAlign: "middle", marginRight: 6 }}>
      <rect width="32" height="32" rx="6" fill="#16a34a" />
      <line x1="8" y1="7" x2="8" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="5.5" y="10" width="5" height="7" rx="1" fill="white" opacity="0.6" />
      <line x1="8" y1="17" x2="8" y2="21" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="8" x2="16" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="13.5" y="12" width="5" height="9" rx="1" fill="white" />
      <line x1="16" y1="21" x2="16" y2="25" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="5" x2="24" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="21.5" y="9" width="5" height="12" rx="1" fill="white" />
      <line x1="24" y1="21" x2="24" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const renderInforme = () => {
    if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Cargando datos…</div>;
    const { suscs, rescates } = data;

    // Solo fondos con tenencia actual
    const enrichedActivo = enriched.filter((i) => parseFloat(i.cuotapartes_disponibles) > 0);

    // KPIs
    const totalARS = enrichedActivo.filter((i) => i.moneda === "ARS").reduce((s, i) => s + i.costoTotal, 0);
    const totalUSD = enrichedActivo.filter((i) => i.moneda !== "ARS").reduce((s, i) => s + i.costoTotal, 0);
    const vARS = enrichedActivo.filter((i) => i.moneda === "ARS" && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
    const vUSD = enrichedActivo.filter((i) => i.moneda !== "ARS" && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
    const rendARS = vARS - totalARS;
    const rendUSD = vUSD - totalUSD;

    return (
      <div id="informe-content">
        {/* ── Header: título izquierda, logo+nombre derecha ── */}
        <div className="inf-header">
          <div className="inf-meta">
            <div className="inf-title">Informe de Portfolio</div>
            <div className="inf-subtitle">
              Datos al {fechaData} · Generado el {today} · {user.email}
            </div>
          </div>
          <div className="inf-logo">
            <Logo /> Dashboard CAFCI
          </div>
        </div>

        {/* ── KPIs: ARS fila 1, USD fila 2, Posiciones al final ── */}
        <div className="inf-section-title">Resumen — {enrichedActivo.length} fondos</div>
        <div className="inf-kpis-grid">
          {/* Fila ARS */}
          {totalARS > 0 && (
            <div className="inf-kpis-row">
              <div className="inf-kpi">
                <div className="inf-kpi-label">Invertido ARS</div>
                <div className="inf-kpi-val">{fmtMon(totalARS, "ARS")}</div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Valor Actual ARS</div>
                <div className="inf-kpi-val" style={{ color: vARS >= totalARS ? "#16a34a" : "#dc2626" }}>
                  {fmtMon(vARS, "ARS")}
                </div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Rendimiento ARS</div>
                <div className="inf-kpi-val" style={{ color: rendARS >= 0 ? "#16a34a" : "#dc2626" }}>
                  {fmtMonSigned(rendARS, "ARS")} ({fmtPct(totalARS > 0 ? (rendARS / totalARS) * 100 : null)})
                </div>
              </div>
            </div>
          )}
          {/* Fila USD */}
          {totalUSD > 0 && (
            <div className="inf-kpis-row">
              <div className="inf-kpi">
                <div className="inf-kpi-label">Invertido USD</div>
                <div className="inf-kpi-val">{fmtMon(totalUSD, "USD")}</div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Valor Actual USD</div>
                <div className="inf-kpi-val" style={{ color: vUSD >= totalUSD ? "#16a34a" : "#dc2626" }}>
                  {fmtMon(vUSD, "USD")}
                </div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Rendimiento USD</div>
                <div className="inf-kpi-val" style={{ color: rendUSD >= 0 ? "#16a34a" : "#dc2626" }}>
                  {fmtMonSigned(rendUSD, "USD")} ({fmtPct(totalUSD > 0 ? (rendUSD / totalUSD) * 100 : null)})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Posiciones actuales ── */}
        <div className="inf-section-title">Posiciones Actuales</div>
        <table className="inf-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Fondo</th>
              <th>Mon.</th>
              <th>CP Disponibles</th>
              <th>P. Suscrip.</th>
              <th>Importe Suscrip.</th>
              <th>Valor Actual</th>
              <th>Rend. %</th>
              <th>TNA</th>
              <th>TEA</th>
            </tr>
          </thead>
          <tbody>
            {enrichedActivo.map((item) => (
              <tr key={item.id}>
                <td style={{ textAlign: "left" }}>{item.fondo_nombre}</td>
                <td style={{ textAlign: "center" }}>{item.moneda}</td>
                <td>{fmtCp(item.cuotapartes_disponibles)}</td>
                <td>{fmtPrecio(item.precio_compra)}</td>
                <td>{item.costoTotal != null ? fmtMon(item.costoTotal, item.moneda) : "—"}</td>
                <td style={{ color: item.vActual >= item.costoTotal ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                  {item.vActual != null ? fmtMon(item.vActual, item.moneda) : "—"}
                </td>
                <td style={{ color: item.rendPct >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPct(item.rendPct)}</td>
                <td style={{ color: item.tna >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPct(item.tna)}</td>
                <td style={{ color: item.tea >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPct(item.tea)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Historial por fondo: suscrip + rescates juntos ── */}
        <div className="inf-section-title">Historial por Fondo</div>
        {enrichedActivo.map((item) => {
          const fondoSuscs = suscs.filter((s) => s.fondo_nombre === item.fondo_nombre && s.moneda === item.moneda);
          const fondoRescates = rescates.filter((r) => r.fondo_nombre === item.fondo_nombre && r.moneda === item.moneda);

          return (
            <div key={`${item.fondo_nombre}__${item.moneda}`} className="inf-fondo-block">
              <div className="inf-fondo-name">
                {item.fondo_nombre}
                <span className="inf-mon-badge">{item.moneda}</span>
              </div>

              {/* Suscripciones */}
              <div className="inf-sub-title">Suscripciones</div>
              {fondoSuscs.length === 0 ? (
                <div className="inf-empty">Sin suscripciones registradas</div>
              ) : (
                <table className="inf-table inf-table-susc">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Fecha</th>
                      <th>Cuotapartes</th>
                      <th>P. Suscrip.</th>
                      <th>Importe</th>
                      <th>CP Disponibles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fondoSuscs.map((s) => (
                      <tr key={s.id}>
                        <td style={{ textAlign: "left" }}>{fmtDate(s.fecha_compra)}</td>
                        <td>{fmtCp(s.cantidad)}</td>
                        <td>{fmtPrecio(s.precio_compra)}</td>
                        <td>{fmtMon(parseFloat(s.cantidad) * parseFloat(s.precio_compra), item.moneda)}</td>
                        <td style={{ color: parseFloat(s.cuotapartes_disponibles) > 0 ? "#16a34a" : "#6b7280" }}>
                          {fmtCp(s.cuotapartes_disponibles)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Rescates — solo si hay */}
              {fondoRescates.length > 0 && (
                <>
                  <div className="inf-sub-title" style={{ marginTop: 10 }}>
                    Rescates
                  </div>
                  <table className="inf-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Fecha</th>
                        <th>CP Rescatadas</th>
                        <th>P. Suscrip. Pond.</th>
                        <th>P. Rescate</th>
                        <th>Importe Rescate</th>
                        <th>Importe Suscrip.</th>
                        <th>Gan./Pérd.</th>
                        <th>Rend%</th>
                        <th>Días</th>
                        <th>TNA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fondoRescates.map((r) => {
                        const detalles = r.rescate_detalles || [];
                        const totalCp = detalles.reduce((s, d) => s + parseFloat(d.cuotapartes_consumidas), 0);
                        const precPond =
                          totalCp > 0
                            ? detalles.reduce((s, d) => s + parseFloat(d.cuotapartes_consumidas) * parseFloat(d.precio_compra), 0) / totalCp
                            : 0;
                        const rendPos = parseFloat(r.rendimiento) >= 0;
                        const rendPct = parseFloat(r.costo_total) > 0 ? (parseFloat(r.rendimiento) / parseFloat(r.costo_total)) * 100 : null;
                        const dias = detalles.length === 1 ? detalles[0].dias : null;
                        const tna = dias > 0 ? (parseFloat(r.rendimiento) / parseFloat(r.costo_total) / dias) * 360 * 100 : null;
                        return (
                          <tr key={r.id}>
                            <td style={{ textAlign: "left" }}>{fmtDate(r.fecha_rescate)}</td>
                            <td>{fmtCp(r.cuotapartes_rescatadas)}</td>
                            <td>{fmtPrecio(precPond)}</td>
                            <td>{fmtPrecio(r.precio_rescate)}</td>
                            <td>{fmtMon(r.importe_venta, item.moneda)}</td>
                            <td>{fmtMon(r.costo_total, item.moneda)}</td>
                            <td style={{ color: rendPos ? "#16a34a" : "#dc2626" }}>
                              {rendPos ? "+" : ""}
                              {fmtMon(r.rendimiento, item.moneda)}
                            </td>
                            <td style={{ color: rendPos ? "#16a34a" : "#dc2626" }}>{fmtPct(rendPct)}</td>
                            <td style={{ textAlign: "center" }}>{dias ?? "—"}</td>
                            <td style={{ color: tna >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPct(tna)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          );
        })}

        <div className="inf-footer">
          Informe generado automáticamente por Dashboard CAFCI · {today} · Los datos corresponden a información provista por CAFCI.
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className={`modal-overlay informe-overlay${closing ? " closing" : ""}`}
        style={{ display: "flex", alignItems: "flex-start", overflowY: "auto", padding: "20px" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
      >
        <div className="informe-modal" style={{ maxWidth: 1200 }}>
          <div className="informe-actions no-print">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Previsualización del informe</span>
              {loading && <span style={{ fontSize: 12, color: "var(--text2)" }}>Cargando datos…</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-informe-print" onClick={handleOpenPDF} disabled={loading}>
                <IconFileText size={13} /> Ver / Guardar PDF
              </button>
              <button className="modal-close" style={{ position: "static", fontSize: 16 }} onClick={requestClose} aria-label="Cerrar">
                <IconX size={16} />
              </button>
            </div>
          </div>
          <div className="informe-paper">{renderInforme()}</div>
        </div>
      </div>
    </>
  );
}
