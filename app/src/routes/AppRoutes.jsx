import { BrowserRouter, Routes, Route } from "react-router-dom"

import LoginPage from "../features/auth/LoginPage"
import CambiarContrasenaPage from "../features/auth/CambiarContrasenaPage"
import DashboardAdminPage from "../features/usuarios/DashboardAdminPage"
import BandejaPage from "../features/carga/BandejaPage"
import CargaPage from "../features/carga/CargaPage"
import AptitudPage from "../features/aptitud/AptitudPage"
import DictamenPage from "../features/aptitud/DictamenPage"
import LegajoPage from "../features/legajo/LegajoPage"
import Placeholder from "../components/Placeholder"

// Regla de la Raíz Literal (DESIGN.md): "/" ES el login, no un redirect.
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/cambiar-contrasena" element={<CambiarContrasenaPage />} />

        {/* Administrador — G1, G3 */}
        <Route path="/admin" element={<DashboardAdminPage />} />
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

        {/* Profesionales — G5, G6 */}
        <Route path="/bandeja" element={<BandejaPage />} />
        <Route path="/carga/:ordenId" element={<CargaPage />} />

        {/* Médico laboral · CU-11 */}
        <Route path="/aptitud" element={<AptitudPage />} />
        <Route path="/aptitud/:ordenId" element={<DictamenPage />} />
        <Route path="/bandeja/pacientes" element={<Placeholder titulo="Pacientes" />} />
        <Route path="/bandeja/pendientes" element={<Placeholder titulo="Estudios Pendientes" />} />
        <Route path="/bandeja/legajos" element={<LegajoPage />} />
        <Route path="/bandeja/terceros" element={<Placeholder titulo="Informes de Terceros" />} />
        <Route path="/bandeja/vigencias" element={<Placeholder titulo="Vigencias Próximas" />} />
        <Route path="/bandeja/historial" element={<Placeholder titulo="Historial Personal" />} />

        {/* Recepción — G2, G4, G7 */}
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
