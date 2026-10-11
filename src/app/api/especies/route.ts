import { obtenerEspeciesConPublicacionesActivas } from "@/modulos/consulta-mercado/inicio/consultas-inicio";
import { NextResponse } from "next/server";
import { ErrorAutorizacion, exigirConsultaMercadoPublico } from "@/modulos/identidad-acceso/autorizacion/controles";

export async function GET() {
  try {
    await exigirConsultaMercadoPublico();
    const especies = await obtenerEspeciesConPublicacionesActivas();
    return NextResponse.json(especies);

  } catch (error) {
    if (error instanceof ErrorAutorizacion) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("ERROR REAL:", error);
    return NextResponse.json(
        { error: "Ocurrió un error al procesar la solicitud." },
        { status: 500 }
    );
}
}