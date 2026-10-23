import { useAuth } from "../context/useAuth";
import { TAB_GROUPS, getTabGroup } from "../lib/utils";
import { IconChartColumn, IconStar, IconTrophy } from "./Icons";

export default function Tabs({ raw, activeTab, onSwitch }) {
  const { user, portfolio, favs } = useAuth();
  const esFechaHistorica = !!new URLSearchParams(window.location.search).get("fecha");

  return (
    <div className="tabs-row">
      {user && !esFechaHistorica && (
        <button className={`tab tab-port${activeTab === "Mi Portfolio" ? " active" : ""}`} onClick={() => onSwitch("Mi Portfolio")}>
          <IconChartColumn size={13} /> Mi Portfolio<span className="tab-n">{new Set(portfolio.filter((s) => parseFloat(s.cuotapartes_disponibles) > 0).map((s) => s.fondo_nombre)).size}</span>
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
  );
}
