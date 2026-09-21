import { obtenerEspeciesConPublicacionesActivas } from "@/infraestructura/persistencia/prisma/especies";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const especies = await obtenerEspeciesConPublicacionesActivas();
    return NextResponse.json(especies);

  } catch (error) {
    console.error("ERROR REAL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}