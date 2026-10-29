import { useState } from "react";
import { IconSearch, IconX, IconSlidersHorizontal, IconChevronDown } from "./Icons";

/**
 * Barra de filtros de la tabla principal: buscador + moneda + región + horizonte + limpiar.
 *
 * En escritorio se ve siempre, igual que antes. En el celular ocupa tres filas (buscador, dos
 * selects y limpiar), así que queda plegada detrás de un botón "Filtros" de una sola fila de 44px.
 *
 * El plegado es puro CSS (`.filtros-toggle` y `.filter-bar.abierto` en styles/utils.css): no se
 * consulta window.innerWidth ni se escucha el resize. Así, al rotar el teléfono o al achicar la
 * ventana en el escritorio, la barra se ve bien sin volver a renderizar por JS. En escritorio el
 * botón tiene display:none y `.filter-bar` se muestra como siempre, sin importar `abierto`.
 *
 * El contador del botón indica cuántos filtros están activos: si hay alguno con la barra plegada,
 * es la única pista de por qué la tabla muestra menos fondos.
 *
 * El estado de los filtros sigue viviendo en App: el buscador de Favoritos y el de la tabla
 * principal comparten los mismos valores (como antes de extraer este componente).
 *
 * Props:
 *   q, setQ                     texto del buscador
 *   moneda, setMoneda           filtro de moneda
 *   region, setRegion           filtro de región
 *   horizonte, setHorizonte     filtro de horizonte
 *   hasFilters                  true si hay algún filtro activo (deshabilita "Limpiar filtros")
 *   clearFilters                limpia los cuatro filtros
 */
export default function FilterBar({
  q, setQ,
  moneda, setMoneda,
  region, setRegion,
  horizonte, setHorizonte,
  hasFilters, clearFilters,
}) {
  // Arranca plegada: en el celular es el punto de partida que ahorra las tres filas. El estado
  // vive acá porque no lo necesita nadie más (App sólo guarda los valores de los filtros).
  const [abierto, setAbierto] = useState(false);

  const activos = [q, moneda, region, horizonte].filter(Boolean).length;

  return (
    <div className="filtros">
      {/* Botón del celular: en escritorio no existe (display:none en layout.css). aria-expanded
          comunica si el panel está abierto y aria-controls apunta a él. */}
      <button
        className={`filtros-toggle${abierto ? " abierto" : ""}`}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="filtros-panel"
      >
        <IconSlidersHorizontal size={14} /> Filtros
        {activos > 0 && <span className="filtros-n">{activos}</span>}
        <span className="filtros-chev"><IconChevronDown size={12} /></span>
      </button>

      <div id="filtros-panel" className={`filter-bar${abierto ? " abierto" : ""}`}>
        <div className="search-wrap">
          <span className="search-icon"><IconSearch size={14} /></span>
          <input type="search" placeholder="Buscar fondo o sociedad gerente…" autoComplete="off"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} aria-label="Moneda">
          <option value="">Todas las monedas</option>
          <option value="ARS">ARS — Pesos</option>
          <option value="USD">USD — Dólar</option>
          <option value="USB">USB — Dólar Billete</option>
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Región">
          <option value="">Todas las regiones</option>
          <option value="Arg">Argentina</option>
          <option value="Glo">Global</option>
          <option value="Latam">Latinoamérica</option>
          <option value="Bra">Brasil</option>
          <option value="Eur">Europa</option>
        </select>
        <select value={horizonte} onChange={(e) => setHorizonte(e.target.value)} aria-label="Horizonte">
          <option value="">Todos los horizontes</option>
          <option value="Cor">Corto plazo</option>
          <option value="Med">Mediano plazo</option>
          <option value="Lar">Largo plazo</option>
          <option value="Flex">Flexible</option>
          <option value="Sasig">Sasig</option>
        </select>
        <button className="btn-clear" disabled={!hasFilters} onClick={clearFilters}>
          <IconX size={12} /> Limpiar filtros
        </button>
      </div>
    </div>
  );
}
