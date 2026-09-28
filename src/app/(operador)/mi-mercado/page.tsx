import { redirect } from "next/navigation";
import { obtenerOperadorActual } from "../../../modulos/usuarios/operadores/operador-actual";

export const dynamic = "force-dynamic";

export default async function Page() {
    const operador = await obtenerOperadorActual();
    redirect(`/mi-mercado/${operador.id}`);
}
