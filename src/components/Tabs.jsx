import { useAuth } from "../context/useAuth";
import { TAB_GROUPS, getTabGroup } from "../lib/utils";
import { IconChartColumn, IconChevronDown, IconStar, IconTrophy } from "./Icons";

// esFechaHistorica llega por prop y ya no se lee de window.location.search: la fecha pasó a ser
// estado de App, así que el parámetro puede cambiar sin recargar y este componente tiene que
// reaccionar a eso como cualquier otro.
export default function Tabs({ raw, activeTab, onSwitch, esFechaHistorica = false }) {
  const { user, portfolio, favs } = useAuth();

  // Fondos con cuotapartes en cartera: lo usan el tab y el selector del celular.
  const nPort = new Set(portfolio.filter((s) => parseFloat(s.cuotapartes_disponibles) > 0).map((s) => s.fondo_nombre)).size;

  // Una sola lista para los tabs de escritorio y para el selector del celular, así no se pueden
  // desincronizar. En el celular 11 tabs no entran en una fila y el scroll horizontal se descartó,
  // así que .tabs-row se oculta y se usa un <select>: una fila de 44px y el picker del sistema.
  const opciones = [
    ...(user && !esFechaHistorica ? [{ id: "Mi Portfolio", label: "Mi Portfolio", n: nPort }] : []),
    { id: "Favoritos", label: "Favoritos", n: favs.length },
    { id: "Top 10", label: "Top 10", n: null },
    ...TAB_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      n: g.id === "Todos" ? raw.length : raw.filter((r) => getTabGroup(r) === g.id).length,
    })),
  ];
  // Si la pestaña activa no está en la lista (por ejemplo "Mi Portfolio" sin sesión), el select
  // mostraría la primera opción: se apunta el value a una opción que exista.
  const valor = opciones.some((o) => o.id === activeTab) ? activeTab : opciones[0].id;

  return (
    <>
    {/* El <select> va dentro de un envoltorio: la flecha del navegador no se puede estilizar (cada
        navegador dibuja la suya y ninguna se parecía a la de "Filtros"), así que el select la esconde
        con appearance: none y la flecha de Lucide se dibuja acá. Ver utils.css. */}
    <div className="tabs-select-wrap">
      <select className="tabs-select" value={valor} onChange={(e) => onSwitch(e.target.value)} aria-label="Sección">
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}{o.n !== null ? ` · ${o.n.toLocaleString("es-AR")}` : ""}
          </option>
        ))}
      </select>
      <span className="tabs-select-chev"><IconChevronDown size={12} /></span>
    </div>

    <div className="tabs-row">
      {user && !esFechaHistorica && (
        <button className={`tab tab-port${activeTab === "Mi Portfolio" ? " active" : ""}`} onClick={() => onSwitch("Mi Portfolio")}>
          <IconChartColumn size={13} /> Mi Portfolio<span className="tab-n">{nPort}</span>
        </button>
      )}
      <button className={`tab tab-fav${activeTab === "Favoritos" ? " active" : ""}`} onClick={() => onSwitch("Favoritos")}>
        <IconStar size={13} /> Favoritos<span className="tab-n">{favs.length}</span>
      </button>
      <button className={`tab tab-top${activeTab === "Top 10" ? " active" : ""}`} onClick={() => onSwitch("Top 10")}>
        <IconTrophy size={13} /> Top 10
      </button>
      {TAB_GROUPS.map((g) => {
        const n = g.id === "Todos" ? raw.length : raw.filter((r) => getTabGroup(r) === g.id).length;
        return (
          <button key={g.id} className={`tab${activeTab === g.id ? " active" : ""}`} onClick={() => onSwitch(g.id)}>
            {g.label}
            <span className="tab-n">{n.toLocaleString("es-AR")}</span>
          </button>
        );
      })}
    </div>
    </>
  );
}
