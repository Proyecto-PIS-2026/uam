import Link from "next/link";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import MenuGrupoNavegacion from "./MenuGrupoNavegacion";
import { agruparOpcionesAdministrador, esRutaNavegacionActiva, type OpcionMenu } from "./opciones-navegacion";
import estilos from "./EncabezadoAplicacion.module.css";

type Propiedades = {
    opciones: OpcionMenu[];
    esAdministrador: boolean;
    rutaActual: string;
    mobile?: boolean;
    alNavegar: () => void;
};

export default function OpcionesNavegacion({ opciones, esAdministrador, rutaActual, mobile = false, alNavegar }: Propiedades) {
    function renderOpcion(opcion: OpcionMenu) {
        const activa = esRutaNavegacionActiva(rutaActual, opcion.ruta);
        return (
            <Link
                key={opcion.ruta}
                href={opcion.ruta}
                aria-current={activa ? "page" : undefined}
                className={`${mobile ? estilos.enlaceMobile : estilos.enlace} ${activa ? estilos.enlaceActivo : ""}`}
                onClick={() => mobile && alNavegar()}
            >
                {mobile && <opcion.icono className={estilos.iconoMenuMobile} fontSize="small" aria-hidden="true" />}
                {opcion.nombre}
            </Link>
        );
    }

    if (!esAdministrador) return <>{opciones.map(renderOpcion)}</>;

    const grupos = agruparOpcionesAdministrador(opciones);
    return (
        <>
            {grupos.inicio.map(renderOpcion)}
            {grupos.mercados.length > 0 && (
                <MenuGrupoNavegacion
                    nombre="Mercados"
                    icono={StorefrontOutlinedIcon}
                    opciones={grupos.mercados}
                    mobile={mobile}
                    rutaActual={rutaActual}
                    onNavigate={alNavegar}
                />
            )}
            {grupos.usuarios.length > 0 && (
                <MenuGrupoNavegacion
                    nombre="Usuarios"
                    icono={GroupsOutlinedIcon}
                    opciones={grupos.usuarios}
                    mobile={mobile}
                    rutaActual={rutaActual}
                    onNavigate={alNavegar}
                />
            )}
            {grupos.restantes.map(renderOpcion)}
            {grupos.precios.map(renderOpcion)}
            {grupos.administracion.map(renderOpcion)}
        </>
    );
}
