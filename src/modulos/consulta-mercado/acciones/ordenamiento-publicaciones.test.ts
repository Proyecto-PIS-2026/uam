import { describe, expect, it } from "vitest";
import { convertirOrdenMercados } from "./ordenamiento-publicaciones";
import type { OrdenMercados } from "./configuracion-ordenamiento";
import type { OrdenConsulta } from "./filtros-consulta";

describe("convertirOrdenMercados", () => {
    it.each<{ configurado: OrdenMercados; esperado: OrdenConsulta }>([
        { configurado: "menor_precio", esperado: "precioAsc" },
        { configurado: "mayor_precio", esperado: "precioDesc" },
        { configurado: "nombre_asc", esperado: "alfabeticoAsc" },
        { configurado: "nombre_desc", esperado: "alfabeticoDesc" },
        { configurado: "mas_vendidas", esperado: "prioridad" },
        { configurado: "mas_actualizadas", esperado: "fechaDesc" },
    ])("convierte $configurado en $esperado", ({ configurado, esperado }) => {
        expect(convertirOrdenMercados(configurado)).toBe(esperado);
    });
});