// RNF-17: cada rol ve solo sus funciones y sus estudios — 0 opciones ajenas visibles.
// Un solo componente <Sidebar>, la lista de items sale de acá según el rol de sesión.
// icon: nombre de ícono de lucide-react.
export const navegacionPorRol = {
  administrador: {
    etiqueta: "ADMINISTRADOR",
    home: "/admin",
    items: [
      { label: "Inicio", to: "/admin", icon: "Home" },
      { label: "Usuarios y Roles", to: "/admin/usuarios", icon: "Users" },
      { label: "Profesionales", to: "/admin/profesionales", icon: "UserRound" },
      { label: "Empresas", to: "/admin/empresas", icon: "Building2" },
      { label: "Personas", to: "/admin/personas", icon: "IdCard" },
      { label: "Órdenes de Servicio", to: "/admin/ordenes", icon: "ClipboardList" },
      { label: "Estudios y Categorías", to: "/admin/catalogo", icon: "FlaskConical" },
      { label: "Baterías", to: "/admin/baterias", icon: "Layers" },
      { label: "Conceptos Facturables", to: "/admin/conceptos", icon: "Receipt" },
      { label: "Valores de Referencia", to: "/admin/referencias", icon: "Ruler" },
      { label: "Auditoría", to: "/admin/auditoria", icon: "ShieldCheck" },
    ],
  },
  medico_laboral: {
    etiqueta: "MI ÁREA",
    home: "/bandeja",
    items: [
      { label: "Bandeja del Día", to: "/bandeja", icon: "LayoutGrid" },
      { label: "Pacientes", to: "/bandeja/pacientes", icon: "Users" },
      { label: "Estudios Pendientes", to: "/bandeja/pendientes", icon: "FlaskConical" },
      { label: "Legajos", to: "/bandeja/legajos", icon: "FolderOpen" },
      { label: "Informes de Terceros", to: "/bandeja/terceros", icon: "FileStack" },
      { label: "Vigencias Próximas", to: "/bandeja/vigencias", icon: "CalendarClock" },
      { label: "Historial Personal", to: "/bandeja/historial", icon: "History" },
    ],
  },
  laboratorio: {
    etiqueta: "MI ÁREA",
    home: "/bandeja",
    items: [
      { label: "Bandeja del Día", to: "/bandeja", icon: "LayoutGrid" },
      { label: "Estudios Pendientes", to: "/bandeja/pendientes", icon: "FlaskConical" },
    ],
  },
  medico_clinico: {
    etiqueta: 'MI ÁREA',
    home: '/bandeja',
    items: [
      { label: 'Bandeja del Día', to: '/bandeja', icon: 'LayoutGrid' },
      { label: 'Estudios Pendientes', to: '/bandeja/pendientes', icon: 'Stethoscope' },
    ],
  },
  rayos: {
    etiqueta: 'MI ÁREA',
    home: '/bandeja',
    items: [
      { label: 'Bandeja del Día', to: '/bandeja', icon: 'LayoutGrid' },
      { label: 'Estudios Pendientes', to: '/bandeja/pendientes', icon: 'Scan' },
    ],
  },
  audiometria: {
    etiqueta: 'MI ÁREA',
    home: '/bandeja',
    items: [
      { label: 'Bandeja del Día', to: '/bandeja', icon: 'LayoutGrid' },
      { label: 'Estudios Pendientes', to: '/bandeja/pendientes', icon: 'Ear' },
    ],
  },
  psicologia: {
    etiqueta: 'MI ÁREA',
    home: '/bandeja',
    items: [
      { label: 'Bandeja del Día', to: '/bandeja', icon: 'LayoutGrid' },
      { label: 'Estudios Pendientes', to: '/bandeja/pendientes', icon: 'Brain' },
    ],
  },
  recepcion: {
    etiqueta: "RECEPCIÓN",
    home: "/recepcion",
    items: [
      { label: "Nueva Orden", to: "/recepcion/nueva-orden", icon: "FilePlus2" },
      { label: "Buscar Persona", to: "/recepcion/personas", icon: "Search" },
      { label: "Empresas", to: "/recepcion/empresas", icon: "Building2" },
      { label: "Pendientes del Día", to: "/recepcion/pendientes", icon: "ListChecks" },
      { label: "Listado de Órdenes", to: "/recepcion/listado", icon: "ClipboardList" },
    ],
  },
}
