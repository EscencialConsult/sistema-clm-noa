// Candidatos de fondo para el login — misma lógica que la galería de assets de
// COMRURAL: el origen real de los archivos queda documentado acá, no se
// inventa un nombre sin rastro. Se usan mientras no haya foto real de la
// fachada del CML NOA (ver Login.jsx).
import hospital1 from "../assets/fondos/hospital-1.webp"
import hospital2 from "../assets/fondos/hospital-2.webp"
import lobbyOficina from "../assets/fondos/lobby-oficina.webp"
import recepcion1 from "../assets/fondos/recepcion-1.webp"
import recepcion2 from "../assets/fondos/recepcion-2.webp"

// Origen: C:\Users\PERSONAL\Downloads\px-conversions (8)\
export const FONDOS_LOGIN = [
  { id: "hospital-1", label: "Hospital — pasillo/recepción", src: hospital1 },
  { id: "hospital-2", label: "Hospital — recepción/entrada", src: hospital2 },
  { id: "lobby-oficina", label: "Lobby de oficina — puerta de vidrio", src: lobbyOficina },
  { id: "recepcion-1", label: "Recepción hotel/institucional 1", src: recepcion1 },
  { id: "recepcion-2", label: "Recepción hotel/institucional 2", src: recepcion2 },
]
