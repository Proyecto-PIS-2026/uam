"use server";

import varsTemporales from "./vars-temporales";
import { actualizarPrecioPublicacion } from "@/modulos/publicaciones/mi-mercado/consultas-mi-mercado";

export async function actualizarPrecio(publicacionId: number, nuevoPrecio: number) {
    await actualizarPrecioPublicacion(varsTemporales.operadorId, publicacionId, nuevoPrecio);
}