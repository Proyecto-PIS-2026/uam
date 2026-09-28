import { notFound } from "next/navigation";
import VistaMiMercado from "../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const operadorId = Number(id);
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(operadorId)) notFound();

    return <VistaMiMercado operadorId={operadorId} />;
}
