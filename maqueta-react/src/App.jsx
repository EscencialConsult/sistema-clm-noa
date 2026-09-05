import { BrowserRouter, Routes, Route } from "react-router-dom"
import Login from "./pages/Login"
import CambiarContrasena from "./pages/CambiarContrasena"
import DashboardAdmin from "./pages/admin/DashboardAdmin"
import BandejaProfesional from "./pages/profesional/BandejaProfesional"
import Placeholder from "./pages/Placeholder"

// Regla de la Raíz Literal (DESIGN.md): "/" ES el login, no un redirect.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />

        {/* Administrador */}
        <Route path="/admin" element={<DashboardAdmin />} />
        <Route path="/admin/usuarios" element={<Placeholder titulo="Usuarios y Roles" />} />
        <Route path="/admin/profesionales" element={<Placeholder titulo="Maestro de Profesionales" />} />
        <Route path="/admin/empresas" element={<Placeholder titulo="Empresas" />} />
        <Route path="/admin/personas" element={<Placeholder titulo="Personas" />} />
        <Route path="/admin/ordenes" element={<Placeholder titulo="Órdenes de Servicio" />} />
        <Route path="/admin/catalogo" element={<Placeholder titulo="Estudios y Categorías" />} />
        <Route path="/admin/baterias" element={<Placeholder titulo="Baterías" />} />
        <Route path="/admin/conceptos" element={<Placeholder titulo="Conceptos Facturables" />} />
        <Route path="/admin/referencias" element={<Placeholder titulo="Valores de Referencia" />} />
        <Route path="/admin/auditoria" element={<Placeholder titulo="Auditoría" />} />

        {/* Profesionales (Médico laboral, Laboratorio, Rayos, Audiometría, Psicología) */}
        <Route path="/bandeja" element={<BandejaProfesional />} />
        <Route path="/bandeja/pacientes" element={<Placeholder titulo="Pacientes" />} />
        <Route path="/bandeja/pendientes" element={<Placeholder titulo="Estudios Pendientes" />} />
        <Route path="/bandeja/legajos" element={<Placeholder titulo="Legajos" />} />
        <Route path="/bandeja/terceros" element={<Placeholder titulo="Informes de Terceros" />} />
        <Route path="/bandeja/vigencias" element={<Placeholder titulo="Vigencias Próximas" />} />
        <Route path="/bandeja/historial" element={<Placeholder titulo="Historial Personal" />} />

        {/* Recepción */}
        <Route path="/recepcion" element={<Placeholder titulo="Nueva Orden" />} />
        <Route path="/recepcion/nueva-orden" element={<Placeholder titulo="Nueva Orden" />} />
        <Route path="/recepcion/personas" element={<Placeholder titulo="Buscar Persona" />} />
        <Route path="/recepcion/empresas" element={<Placeholder titulo="Empresas" />} />
        <Route path="/recepcion/pendientes" element={<Placeholder titulo="Pendientes del Día" />} />
        <Route path="/recepcion/listado" element={<Placeholder titulo="Listado de Órdenes" />} />
      </Routes>
    </BrowserRouter>
  )
}
