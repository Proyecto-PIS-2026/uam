import { obtenerEspecies } from "@/infraestructura/persistencia/prisma/productos";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const especies = await obtenerEspecies();

    const especiesActivas = especies
      .filter((e) => e.especieActiva === true)
      .map((e) => e.nombreEspecie);

    return NextResponse.json(especiesActivas);
  } catch (error) {
    console.error("ERROR REAL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}