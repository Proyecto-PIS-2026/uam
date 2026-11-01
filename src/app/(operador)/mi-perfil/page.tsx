import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerPerfilPropioOperador } from "@/modulos/usuarios/operadores/consultasPerfilPropio";
import PerfilPropioOperador from "@/modulos/usuarios/operadores/componentes/perfil-propio-operador/PerfilPropioOperador";

export const dynamic = "force-dynamic";

export default async function Page() {
    await requerirOperador();
    const perfil = await obtenerPerfilPropioOperador();
    return <PerfilPropioOperador perfil={perfil} />;
}
