import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NaturePeopleOutlinedIcon from "@mui/icons-material/NaturePeopleOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import type { DatosSesion } from "../../modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "../../modulos/identidad-acceso/autorizacion/permisos";

export type OpcionMenu = {
    nombre: string;
    ruta: string;
    icono: typeof StorefrontOutlinedIcon;
    permitido?: (sesion: DatosSesion | null) => boolean;
    soloSinSesion?: boolean;
    ocultarParaOperador?: boolean;
};

const opcionesMenu: OpcionMenu[] = [
    {
        nombre: "Inicio",
        ruta: "/inicio",
        icono: HomeOutlinedIcon,
        ocultarParaOperador: true,
    },

    {
        nombre: "Mercado Virtual",
        ruta: "/publicaciones",
        icono: StorefrontOutlinedIcon,
        permitido: () => autorizado("operador.publicacion.consultar"),
        ocultarParaOperador: true,
    },
    // Listado de publicaciones de productores
    {
        nombre: "Mercado Producción",
        ruta: "/publicaciones-productor",
        icono: AgricultureOutlinedIcon,
        permitido: (sesion) => autorizado("productor.publicacion.consultar", sesion),
    },

    {
        nombre: "Operadores",
        ruta: "/operadores",
        icono: GroupsOutlinedIcon,
        permitido: () => autorizado("operador.catalogo.consultar"),
        ocultarParaOperador: true,
    },

    {
        nombre: "Productores",
        ruta: "/productores",
        icono: NaturePeopleOutlinedIcon,
        permitido: (sesion) => autorizado("productor.publicacion.consultar", sesion),
    },

    {
        nombre: "Precios de referencia",
        ruta: "/precios-referencia",
        icono: PaymentsOutlinedIcon,
        permitido: () => autorizado("preciosReferencia.consultar"),
    },

    {
        nombre: "Histórico de precios",
        ruta: "/precios-historicos",
        icono: ShowChartOutlinedIcon,
        permitido: () => autorizado("preciosReferencia.consultar"),
    },

    {
        nombre: "Mi mercado",
        ruta: "/mi-mercado",
        icono: Inventory2OutlinedIcon,
        permitido: (sesion) => autorizado("operador.mercado.acceder", sesion),
    },

    {
        nombre: "Iniciar sesión",
        ruta: "/iniciar-sesion",
        icono: LoginOutlinedIcon,
        soloSinSesion: true,
    },

    {
        nombre: "Administración",
        ruta: "/administracion",
        icono: AdminPanelSettingsOutlinedIcon,
        permitido: (sesion) => autorizado("usuarios.cuentas.gestionar", sesion),
    }
];

const opcionesMenuProductor: OpcionMenu[] = [
    {
        nombre: "Mi mercado",
        ruta: "/mi-mercado/productor",
        icono: Inventory2OutlinedIcon,
        permitido: (sesion) => autorizado("productor.mercado.acceder", sesion),
    },
    {
        nombre: "Precios de referencia",
        ruta: "/precios-referencia",
        icono: PaymentsOutlinedIcon,
        permitido: () => autorizado("preciosReferencia.consultar"),
    },
    {
        nombre: "Histórico de precios",
        ruta: "/precios-historicos",
        icono: ShowChartOutlinedIcon,
        permitido: () => autorizado("preciosReferencia.consultar"),
    },
];

export function obtenerOpcionesNavegacion(sesion: DatosSesion | null): OpcionMenu[] {
    const rolUsuario = sesion?.rol ?? null;
    return (rolUsuario === "PRODUCTOR" ? opcionesMenuProductor : opcionesMenu).filter(
        (opcion) =>
            (!opcion.permitido || opcion.permitido(sesion)) &&
            (!opcion.soloSinSesion || rolUsuario === null) &&
            (!opcion.ocultarParaOperador || rolUsuario !== "OPERADOR"),
    );
}

export function agruparOpcionesAdministrador(opciones: OpcionMenu[]) {
    const rutasMercados = ["/publicaciones", "/publicaciones-productor"];
    const rutasUsuarios = ["/operadores", "/productores"];
    const rutasPrecios = ["/precios-referencia", "/precios-historicos"];
    return {
        inicio: opciones.filter((opcion) => opcion.ruta === "/inicio"),
        mercados: opciones.filter((opcion) => rutasMercados.includes(opcion.ruta)).map((opcion) => ({
            ...opcion,
            nombre: opcion.ruta === "/publicaciones" ? "Operadores" : "Productores",
        })),
        usuarios: opciones.filter((opcion) => rutasUsuarios.includes(opcion.ruta)),
        restantes: opciones.filter((opcion) =>
            !rutasMercados.includes(opcion.ruta)
            && !rutasUsuarios.includes(opcion.ruta)
            && !rutasPrecios.includes(opcion.ruta)
            && opcion.ruta !== "/inicio"
            && opcion.ruta !== "/administracion",
        ),
        precios: opciones.filter((opcion) => rutasPrecios.includes(opcion.ruta)),
        administracion: opciones.filter((opcion) => opcion.ruta === "/administracion"),
    };
}

export function esRutaNavegacionActiva(rutaActual: string, ruta: string): boolean {
    if (ruta === "/mi-mercado") {
        return rutaActual === ruta || rutaActual.startsWith(ruta + "/") || rutaActual.startsWith("/publicaciones/nueva");
    }
    if (ruta === "/publicaciones" && rutaActual.startsWith("/publicaciones/nueva")) return false;
    return rutaActual === ruta || rutaActual.startsWith(ruta + "/");
}
