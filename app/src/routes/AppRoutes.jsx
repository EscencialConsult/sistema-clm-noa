import { BrowserRouter, Routes, Route } from "react-router-dom"

import LoginPage from "../features/auth/LoginPage"
import CambiarContrasenaPage from "../features/auth/CambiarContrasenaPage"
import DashboardAdminPage from "../features/usuarios/DashboardAdminPage"
import BandejaPage from "../features/carga/BandejaPage"
import CargaPage from "../features/carga/CargaPage"
import AptitudPage from "../features/aptitud/AptitudPage"
import DictamenPage from "../features/aptitud/DictamenPage"
import LegajoPage from "../features/legajo/LegajoPage"
import NuevaOrdenPage from "../features/ordenes/NuevaOrdenPage"
import AjustarEstudiosPage from "../features/ordenes/AjustarEstudiosPage"
import CatalogoPage from "../features/catalogo/CatalogoPage"
import ConceptosPage from "../features/catalogo/ConceptosPage"
import BateriasPage from "../features/baterias/BateriasPage"
import PendientesPage from "../features/carga/PendientesPage"
import AuditoriaPage from "../features/auditoria/AuditoriaPage"
import UsuariosPage from "../features/usuarios/UsuariosPage"
import EmpresasPage from "../features/recepcion/EmpresasPage"
import PendientesDelDiaPage from "../features/recepcion/PendientesDelDiaPage"
import ListadoOrdenesPage from "../features/recepcion/ListadoOrdenesPage"
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
        <Route path="/admin/usuarios" element={<UsuariosPage />} />
        <Route path="/admin/profesionales" element={<Placeholder titulo="Maestro de Profesionales" />} />
        <Route path="/admin/empresas" element={<EmpresasPage />} />
        <Route path="/admin/personas" element={<LegajoPage />} />
        <Route path="/admin/ordenes" element={<ListadoOrdenesPage />} />
        <Route path="/admin/catalogo" element={<CatalogoPage />} />
        <Route path="/admin/baterias" element={<BateriasPage />} />
        <Route path="/admin/conceptos" element={<ConceptosPage />} />
        <Route path="/admin/referencias" element={<Placeholder titulo="Valores de Referencia" />} />
        <Route path="/admin/auditoria" element={<AuditoriaPage />} />

        {/* Profesionales — G5, G6 */}
        <Route path="/bandeja" element={<BandejaPage />} />
        <Route path="/carga/:ordenId" element={<CargaPage />} />

        {/* Médico laboral · CU-11 */}
        <Route path="/aptitud" element={<AptitudPage />} />
        <Route path="/aptitud/:ordenId" element={<DictamenPage />} />
        <Route path="/bandeja/pacientes" element={<Placeholder titulo="Pacientes" />} />
        <Route path="/bandeja/pendientes" element={<PendientesPage />} />
        <Route path="/bandeja/legajos" element={<LegajoPage />} />
        <Route path="/bandeja/terceros" element={<Placeholder titulo="Informes de Terceros" />} />
        <Route path="/bandeja/vigencias" element={<Placeholder titulo="Vigencias Próximas" />} />
        <Route path="/bandeja/historial" element={<Placeholder titulo="Historial Personal" />} />

        {/* Recepción — G2, G4, G7 */}
        <Route path="/recepcion" element={<NuevaOrdenPage />} />
        <Route path="/recepcion/nueva-orden" element={<NuevaOrdenPage />} />
        {/* RF11 (c): sumar o sacar un estudio suelto de una orden */}
        <Route path="/orden/:ordenId/estudios" element={<AjustarEstudiosPage />} />
        <Route path="/recepcion/personas" element={<LegajoPage />} />
        <Route path="/recepcion/empresas" element={<EmpresasPage />} />
        <Route path="/recepcion/pendientes" element={<PendientesDelDiaPage />} />
        <Route path="/recepcion/listado" element={<ListadoOrdenesPage />} />
        {/* RF07: el catálogo lo mantienen el Administrador Y Recepción */}
        <Route path="/recepcion/catalogo" element={<CatalogoPage />} />
        {/* RF09: las baterías también las mantiene Recepción */}
        <Route path="/recepcion/baterias" element={<BateriasPage />} />
      </Routes>
    </BrowserRouter>
  )
}
