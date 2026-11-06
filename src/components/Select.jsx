import { IconChevronDown } from "./Icons";

/**
 * <select> con la flecha de Lucide en lugar de la nativa del navegador.
 *
 * La flecha nativa no se puede estilizar (cada navegador dibuja la suya y ninguna se parece a la
 * de la app) y en el selector de secciones del celular ya se había resuelto así: el <select> la
 * esconde con appearance: none y la flecha de Lucide se dibuja en HTML (components/Tabs.jsx con
 * .tabs-select / .tabs-select-chev en utils.css). Este componente lleva ese mismo patrón a la
 * barra de filtros, así todos los desplegables se ven iguales en escritorio y en el celular.
 *
 * El envoltorio (.sel-wrap) es el que se lleva el ancho/flex de la barra; el <select> lo llena.
 * Ver styles/layout.css (base) y styles/utils.css (ajustes del celular).
 *
 * Props:
 *   value, onChange          estado controlado, igual que un <select> nativo
 *   ariaLabel                nombre para lectores de pantalla (estos selects no llevan <label>)
 *   children                 las <option>
 */
export default function Select({ value, onChange, ariaLabel, children }) {
  return (
    <span className="sel-wrap">
      <select value={value} onChange={onChange} aria-label={ariaLabel}>
        {children}
      </select>
      <span className="sel-chev"><IconChevronDown size={12} /></span>
    </span>
  );
}
