import { IconExternalLink } from './Icons';

/**
 * Marca del header: badge CAFCI (link al sitio oficial, abre en pestaña nueva) + título.
 *
 * No recibe props: es marca estática. El badge usa la clase .logo-badge de styles/layout.css,
 * que pinta el fondo/padding para <a> y <span> por igual; el cursor y el hover quedan sólo
 * para el <a> (ver el comentario en el CSS).
 */
export default function Logo() {
  return (
    <div className="logo">
      <a className="logo-badge" href="https://www.cafci.org.ar/" target="_blank" rel="noopener noreferrer"
        title="Ir al sitio de CAFCI (abre en una pestaña nueva)"
        aria-label="Ir al sitio de CAFCI (abre en una pestaña nueva)">
        CAFCI<IconExternalLink size={10} className="icon-inline" />
      </a>
      {/* Dos títulos: en escritorio el completo y en el celular el corto (.logo-titulo-corto), para
          que el badge CAFCI y el título entren en una sola fila. Ver @media de styles/utils.css. */}
      <h1>
        <span className="logo-titulo-largo">Fondos Comunes de Inversión &mdash; Argentina</span>
        {/* Título corto del celular: tiene que entrar junto al badge CAFCI en la fila 1. */}
        <span className="logo-titulo-corto">FCI - Argentina</span>
      </h1>
    </div>
  );
}
