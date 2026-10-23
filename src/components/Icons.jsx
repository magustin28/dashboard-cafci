// Iconos vendorizados de Lucide (https://lucide.dev) — licencia ISC.
//
// Por qué están acá y no como dependencia: el proyecto usa sólo 8 iconos, así que copiar los
// paths al repo cuesta ~2 KB y evita sumar un paquete a package.json (menos node_modules,
// menos superficie de mantenimiento). Los trazos son exactamente los de lucide-static v1.61.0.
//
// Todos heredan el color del texto (`stroke="currentColor"`), así que se pintan solos con
// :hover de los botones. El tamaño por defecto es 16px; se cambia con `size`.
// Uso: <IconCalendar size={12} />   ·   <IconRefreshCw className="algo" />

function Icon({ size = 16, strokeWidth = 2, className = '', title, children }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `icon ${className}` : 'icon'}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function IconCalendar(props) {
  return (
    <Icon {...props}>
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
    </Icon>
  );
}

export function IconRefreshCw(props) {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Icon>
  );
}

export function IconChevronDown(props) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function IconLogIn(props) {
  return (
    <Icon {...props}>
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </Icon>
  );
}

export function IconLogOut(props) {
  return (
    <Icon {...props}>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icon>
  );
}

export function IconChartColumn(props) {
  return (
    <Icon {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </Icon>
  );
}

export function IconX(props) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function IconExternalLink(props) {
  return (
    <Icon {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Icon>
  );
}
