import { Fragment, useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { REG_MAP, HOR_MAP, cnvLink, parseFechaAPI, agruparFondos, nombreClase } from "../lib/utils";
import { capaSuperior } from "../lib/historial";
import { PctCell, PatCell, MonBadge } from "./TableCells";
import { IconStar, IconInfo, IconPlus, IconChevronDown, IconChevronUp } from "./Icons";

// ── Agrupación por clase ──────────────────────────────────────────────────────
// CAFCI publica una fila por CLASE (código CNV propio: comisiones y rendimiento distintos), así
// que un mismo fondo ocupa 3-4 filas y tapa al resto de la tabla. Acá se agrupa por nombre base +
// moneda (ver lib/utils.js: agruparFondos) y se muestra UNA fila por fondo con su mejor clase.
//
// DECISIONES (acordadas con el usuario):
//   · "Mejor" = mayor Var. Diaria % (la TEA sólo existe en Mi Portfolio, no en esta planilla).
//   · Sólo se agrupa cuando hay MÁS DE UNA clase. Con una sola clase no hay nada que comparar y
//     la fila se dibuja normal, sin desplegable.
//   · Los botones de acción (favorito, info, agregar) van en CADA fila de clase, no en el
//     resumen: lo que se agrega o se consulta es el fondo concreto (una clase), no el grupo.
//     El resumen sólo lleva el botón de abrir/cerrar las clases.
//   · Favoritos y Mi Portfolio NO se agrupan (esas pestañas tienen su propia lógica y el usuario
//     puede tener una clase puntual, que desaparecería si se mostrara la "mejor").
// activeTab llega desde App.jsx y sólo se usa para decidir si se agrupa: en "Favoritos" no se
// agrupa (el favorito es una clase puntual y agrupar le mostraría otra).
export default function FondosTable({ filtered, refs, activeTab, onOpenSuscripcion, onFondoClick }) {
  const { user, favs, toggleFav } = useAuth();
  const [page, setPage] = useState(1);
  // 25 por hoja por defecto: con 50 la tabla quedaba en ~2.000px de scroll. El selector 25/50/100
  // de la paginación sigue estando para quien quiera ver más de una vez.
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState("fondo");
  const [sortDir, setSortDir] = useState(1);
  // Clave del grupo con las clases desplegadas. Uno solo por vez (abrir un acordeón cierra el
  // anterior, como pidió el usuario). null = ninguno abierto. Antes era un Set y permitía varios.
  const [abierto, setAbierto] = useState(null);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d * -1);
    else {
      setSortKey(key);
      setSortDir(-1);
    }
    setPage(1);
  };

  const toggleAbierto = (key) => setAbierto((prev) => (prev === key ? null : key));

  // Mientras hay un acordeón abierto: ESC lo cierra y un clic FUERA de sus filas también. Los dos
  // se ignoran si hay un modal arriba (capaSuperior() no es null): ahí la interacción es del modal.
  // Así el cierre va POR FASES, igual que con ESC: primero se cierra el modal y recién el segundo
  // gesto cierra el acordeón. Es la práctica recomendada en UI por capas (cada gesto descarta sólo
  // la capa de arriba); cerrar todo de una vez deja al usuario sin el contexto que estaba mirando.
  // Para el clic se mira el <tr> del target (closest) y no un ref, porque el grupo son VARIAS filas
  // (el resumen y las clases desplegadas) y no comparten un contenedor.
  //
  // El listener va en FASE DE CAPTURA (tercer argumento = true) y no en bubbling: en bubbling corre
  // DESPUÉS del onClick sintético de React del overlay del modal, y para entonces el modal ya sacó
  // su capa con sacarCapa() (useModalClose la saca al instante y recién desmonta a los 240 ms). Por
  // eso capaSuperior() ya daba null y el clic fuera del modal cerraba TAMBIÉN el acordeón. En
  // captura corre ANTES de React y la capa del modal todavía está en la pila: se detecta y se ignora.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !capaSuperior()) setAbierto(null);
    };
    const onDocClick = (e) => {
      if (capaSuperior()) return;
      const tr = e.target.closest?.("tr");
      if (tr && (tr.classList.contains("tr-grupo") || tr.classList.contains("tr-clase"))) return;
      setAbierto(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick, true);
    };
  }, [abierto]);

  // Un grupo por nombre base + moneda. Cada grupo trae su "mejor" clase (mayor var. diaria) y la
  // lista completa de clases para el desplegable.
  //
  // EXCEPCIÓN: Favoritos no se agrupa. El usuario guardó clases puntuales (el favorito es el nombre
  // de la clase, no del fondo base); agrupar le mostraría otra clase —la "mejor"— y le ocultaría
  // justo la que eligió. Cada favorito se dibuja como fila suelta con sus botones de acción.
  const grupos = activeTab === "Favoritos"
    ? filtered.map((r) => ({ key: `${r.fondo}|${r.moneda}`, nombre: r.fondo, moneda: r.moneda, clases: [r], mejor: r, n: 1 }))
    : agruparFondos(filtered);

  // El orden se resuelve por el MEJOR de cada grupo: si el usuario ordena por Var. Diaria, un fondo
  // se ubica por su clase más rendidora. Ordenar por "fondo" usa el nombre base (sin la clase).
  const sorted = [...grupos].sort((a, b) => {
    const campo = { fondo: "fondo", var_d: "valorVarPct", var_anio: "varAnio", var_12: "varAnual", pat: "patrimonio" }[sortKey];
    if (sortKey === "fondo") return (a.nombre || "").localeCompare(b.nombre || "", "es") * sortDir;
    const av = parseFloat(a.mejor[campo]) || -Infinity;
    const bv = parseFloat(b.mejor[campo]) || -Infinity;
    return (av - bv) * sortDir;
  });

  // Si la lista cambió (filtros, cambio de pestaña o refresco), `page` puede quedar fuera de
  // rango y mostrar una página vacía. Se recorta durante el render (derivando la página válida)
  // en lugar de resetear con un useEffect: el effect dispara un render en cascada y el lint de
  // react-hooks lo marca como error.
  // La paginación cuenta FONDOS (grupos), no clases: "de 2.041" es la cantidad de fondos reales.
  const total = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pagina = Math.min(page, total);

  const slice = sorted.slice((pagina - 1) * pageSize, pagina * pageSize);

  const arrow = (key) => (sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : " ↕");

  // Props que comparten las filas de clase: la fila normal de un grupo de una sola clase y las
  // filas de detalle de un grupo abierto. Se arma una vez por render en lugar de repetir ocho
  // props en cada llamada a <FilaClase>.
  const filaProps = { refs, favs, user, toggleFav, onOpenSuscripcion, onFondoClick };

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
              slice.map((g) => {
                // Una sola clase: no hay nada que agrupar. Fila normal con todos sus botones.
                if (g.n === 1) return <FilaClase key={g.key} r={g.mejor} {...filaProps} />;

                const estaAbierto = abierto === g.key;
                const clase = nombreClase(g.mejor.fondo);
                return (
                  <Fragment key={g.key}>
                    {/* Resumen del fondo: nombre base, la clase que se muestra y el botón de
                        abrir/cerrar. Sin botones de acción: lo que se agrega o se consulta es
                        el fondo concreto (una clase), y eso vive en las filas de abajo.
                        Toda la fila abre/cierra el acordeón; el botón y el link a CAFCI frenan la
                        propagación para no dispararlo dos veces o sin querer. */}
                    <tr
                      className={`tr-grupo${estaAbierto ? " abierto" : ""}`}
                      onClick={() => toggleAbierto(g.key)}
                    >
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <button
                          className={`btn-expand${estaAbierto ? " on" : ""}`}
                          onClick={(e) => { e.stopPropagation(); toggleAbierto(g.key); }}
                          title={estaAbierto ? "Ocultar las demás clases" : `Ver las ${g.n} clases`}
                          aria-expanded={estaAbierto}
                        >
                          {estaAbierto ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
                        </button>
                      </td>
                      <td className="td-fondo">
                        <span className="grupo-nombre">{g.nombre || "—"}</span>
                        <span className="badge badge-clase" title={`Se muestra la mejor clase por Var. Diaria: ${clase}`}>
                          {clase || "Clase —"} · {g.n}
                        </span>
                      </td>
                      <td><MonBadge m={g.mejor.moneda} /></td>
                      <td><span className="badge badge-reg">{REG_MAP[g.mejor.region] || g.mejor.region || "—"}</span></td>
                      <td><span className="badge badge-hor">{HOR_MAP[g.mejor.horizonte] || g.mejor.horizonte || "—"}</span></td>
                      <td style={{ textAlign: "center" }}>
                        <PctCell v={g.mejor.valorVarPct} decimals={3} />
                        {g.mejor.valorVarPct != null && (
                          <div style={{ fontSize: 9, color: "var(--text2)", marginTop: 1 }}>~ {(parseFloat(g.mejor.valorVarPct) * 360).toFixed(2)}% TNA ~</div>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}><VarAnioCell r={g.mejor} refs={refs} /></td>
                      <td><PctCell v={g.mejor.varAnual} decimals={3} /></td>
                      <td><PatCell v={g.mejor.patrimonio} /></td>
                      <td className="td-gerente">{g.mejor.socGerente || "—"}</td>
                      {/* Sin botón de CAFCI en la fila de resumen: la fila representa varias
                          clases y el botón llevaría a una sola (la "mejor"), lo que confunde.
                          Cada clase tiene el suyo en las filas de detalle. */}
                      <td />
                    </tr>
                    {/* Clases restantes: cada una es un fondo con su código CNV propio y sus
                        botones de acción. Sólo se dibujan con el grupo abierto. */}
                    {estaAbierto && g.clases.map((r) => (
                      <FilaClase key={`${g.key}|${r.cnv || r.fondo}`} r={r} {...filaProps} indentada />
                    ))}
                  </Fragment>
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
            <button className="pg" onClick={() => setPage(pagina - 1)} disabled={pagina <= 1}>
              ‹
            </button>
            {(() => {
              const pages = [];
              for (let i = 1; i <= total; i++) {
                if (i === 1 || i === total || Math.abs(i - pagina) <= 2) pages.push(i);
                else if (pages[pages.length - 1] !== "…") pages.push("…");
              }
              return pages.map((p, i) =>
                p === "…" ? (
                  <span key={i} className="pg-dots">…</span>
                ) : (
                  <button key={i} className={`pg${p === pagina ? " on" : ""}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                ),
              );
            })()}
            <button className="pg" onClick={() => setPage(pagina + 1)} disabled={pagina >= total}>
              ›
            </button>
          </div>
          <span className="pg-info">
            {((pagina - 1) * pageSize + 1).toLocaleString("es-AR")}–{Math.min(pagina * pageSize, sorted.length).toLocaleString("es-AR")} de{" "}
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

// Celda de "Var. Inicio Año %" convertida a TNA anualizada. Estaba inline en la fila con una IIFE
// y se repetía en el resumen del grupo y en las filas de detalle: acá queda en un solo lugar.
// La TNA se deriva del % acumulado del año dividido por los días transcurridos, proyectado a 360.
function VarAnioCell({ r, refs }) {
  const pct = parseFloat(r && r.varAnio);
  if (isNaN(pct)) return <span className="td-mono zero">—</span>;
  const apiFechaDate = parseFechaAPI(refs?.apiFecha);
  const baseAnio = parseFechaAPI(refs?.fecha2);
  const dias = apiFechaDate && baseAnio ? Math.max(1, Math.round((apiFechaDate - baseAnio) / 86400000)) : 365;
  const tna = (pct / dias) * 360;
  const cls = tna > 0 ? "pos" : tna < 0 ? "neg" : "zero";
  return (
    <span className={"td-mono " + cls}>
      {tna > 0 ? "+" : ""}
      {tna.toFixed(2)}%
    </span>
  );
}

// Fila de una clase concreta: es el "fondo" en el sentido de CAFCI (una fila = un código CNV, con
// su comisión y su rendimiento). La usan tanto los fondos de una sola clase como las filas de
// detalle de un grupo abierto.
//   conAcciones = false → sólo la fila de resumen del grupo, que lleva el botón de abrir/cerrar.
//   indentada   = true  → fila de detalle: se sangra el nombre para que se lea como "sub-ítem" del
//                         grupo y se muestra sólo la clase (el nombre base ya está arriba).
function FilaClase({ r, refs, favs, user, toggleFav, onOpenSuscripcion, onFondoClick, conAcciones = true, indentada = false }) {
  const isFaved = favs.includes(r.fondo);
  const clase = nombreClase(r.fondo);
  return (
    <tr className={indentada ? "tr-clase" : undefined}>
      <td style={{ verticalAlign: "middle" }}>
        {conAcciones && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: 52, margin: "0 auto" }}>
            <button
              className={`btn-fav${isFaved ? " active" : ""}`}
              onClick={() => toggleFav(r.fondo)}
              title={isFaved ? "Quitar de favoritos" : "Agregar a favoritos"}
              style={{ fontSize: 13 }}
            ><IconStar size={13} /></button>
            <button
              className="btn-port-action btn-info"
              onClick={() => onFondoClick && onFondoClick(r)}
              title="Ver detalle del fondo"
            ><IconInfo size={13} /></button>
            {user ? (
              <button
                className="btn-port-action btn-susc"
                onClick={() => onOpenSuscripcion(r.fondo, r.moneda)}
                title="Agregar a mi portfolio"
                style={{ gridColumn: "span 2" }}
              ><IconPlus size={13} /></button>
            ) : <span />}
          </div>
        )}
      </td>
      <td className={indentada ? "td-fondo td-fondo-clase" : "td-fondo"} title={indentada ? r.fondo : undefined}>
        {indentada ? (
          <span className="clase-etiqueta">{clase || "Clase —"}</span>
        ) : (
          r.fondo || "—"
        )}
      </td>
      <td>
        <MonBadge m={r.moneda} />
      </td>
      <td>
        <span className="badge badge-reg">{REG_MAP[r.region] || r.region || "—"}</span>
      </td>
      <td>
        <span className="badge badge-hor">{HOR_MAP[r.horizonte] || r.horizonte || "—"}</span>
      </td>
      <td style={{ textAlign: "center" }}>
        <PctCell v={r.valorVarPct} decimals={3} />
        {r.valorVarPct != null && (
          <div style={{ fontSize: 9, color: "var(--text2)", marginTop: 1 }}>~ {(parseFloat(r.valorVarPct) * 360).toFixed(2)}% TNA ~</div>
        )}
      </td>
      <td style={{ textAlign: "center" }}>
        <VarAnioCell r={r} refs={refs} />
      </td>
      <td>
        <PctCell v={r.varAnual} decimals={3} />
      </td>
      <td>
        <PatCell v={r.patrimonio} />
      </td>
      <td className="td-gerente">{r.socGerente || "—"}</td>
      <td>
        <a className="btn-cnv" href={cnvLink(r.cafci || "", r.cnv || "")} target="_blank" rel="noopener" title="Ver en CAFCI">
          ↗
        </a>
      </td>
    </tr>
  );
}
