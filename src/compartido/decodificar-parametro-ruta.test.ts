import { describe, expect, it } from "vitest";
import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex";
import { getDynamicParam } from "next/dist/shared/lib/router/utils/get-dynamic-param";
import { decodificarParametroRuta } from "./decodificar-parametro-ruta";

describe("decodificarParametroRuta", () => {
    it.each([
        "Bacigalupi", "Jorge Ferias", "Frutas & Más", "Frutas 100%", "Frutas %20",
        "%", "%ZZ", "%C3", "Frutas %2520", "Ruta / Montevideo", "Campo + Quinta",
    ])("recupera el nombre original del parámetro que entrega Next instalado: %s", (nombre) => {
        const ruta = `/mi-mercado/${encodeURIComponent(nombre)}`;
        const coincidencia = getRouteMatcher(getRouteRegex("/mi-mercado/[nombre]"))(ruta);
        if (!coincidencia) throw new Error("La ruta de prueba no coincide.");
        const parametro = getDynamicParam(coincidencia, "nombre", "d", null, null).value;
        if (typeof parametro !== "string") throw new Error("Next no entregó un segmento simple.");

        expect(decodificarParametroRuta(parametro)).toBe(nombre);
    });

    it.each(["%", "%ZZ", "%C3", "%E0%A4%A"])("rechaza parámetros mal codificados: %s", (parametro) => {
        expect(decodificarParametroRuta(parametro)).toBeNull();
    });
});
