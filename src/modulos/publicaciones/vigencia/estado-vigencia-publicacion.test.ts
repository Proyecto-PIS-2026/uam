import { describe, expect, it } from "vitest";
import { Temporal } from "temporal-polyfill";
import { obtenerEstadoVigenciaPublicacion } from "./estado-vigencia-publicacion";

const configuracion = { avisosHabilitados: true, diasAnticipacion: 7 };
const ahora = Temporal.Instant.from("2026-11-04T15:00:00Z");

describe("estado visual de vigencia de publicaciones", () => {
    it.each([null, undefined, "", "no es una fecha", "2026-02-30"])("no inventa un vencimiento para %s", (fecha) => {
        expect(obtenerEstadoVigenciaPublicacion(fecha, configuracion, ahora)).toBeNull();
    });

    it("usa el final del día de Uruguay para fechas ingresadas por el usuario", () => {
        expect(obtenerEstadoVigenciaPublicacion("2026-11-04", configuracion, Temporal.Instant.from("2026-11-05T02:30:00Z")))
            .toBe("por-vencer");
        expect(obtenerEstadoVigenciaPublicacion("2026-11-04", configuracion, Temporal.Instant.from("2026-11-05T03:00:00Z")))
            .toBe("vencida");
    });

    it("mantiene la vigencia en el instante límite y marca el vencimiento inmediatamente después", () => {
        const finDelDia = Temporal.Instant.from("2026-11-05T02:59:59Z");

        expect(obtenerEstadoVigenciaPublicacion("2026-11-04", configuracion, finDelDia)).toBe("por-vencer");
        expect(obtenerEstadoVigenciaPublicacion("2026-11-04", configuracion, finDelDia.add({ nanoseconds: 1 }))).toBe("vencida");
    });

    it("activa el aviso desde las 00 de Uruguay aunque la vigencia termine al final del último día", () => {
        const medianoche = Temporal.Instant.from("2026-11-04T03:00:00Z");

        expect(obtenerEstadoVigenciaPublicacion("2026-11-11", configuracion, medianoche.subtract({ nanoseconds: 1 }))).toBeNull();
        expect(obtenerEstadoVigenciaPublicacion("2026-11-11", configuracion, medianoche)).toBe("por-vencer");
        expect(obtenerEstadoVigenciaPublicacion("2026-11-12", configuracion, medianoche)).toBeNull();
    });

    it("respeta un plazo distinto sin marcar publicaciones lejanas", () => {
        const fecha = ahora.add({ hours: 3 * 24 });

        expect(obtenerEstadoVigenciaPublicacion(fecha, { ...configuracion, diasAnticipacion: 2 }, ahora)).toBeNull();
        expect(obtenerEstadoVigenciaPublicacion(fecha, { ...configuracion, diasAnticipacion: 3 }, ahora)).toBe("por-vencer");
    });

    it("desactivar los avisos oculta el aviso previo y conserva el estado de vencida", () => {
        const sinAvisos = { ...configuracion, avisosHabilitados: false };

        expect(obtenerEstadoVigenciaPublicacion(ahora.add({ hours: 24 }), sinAvisos, ahora)).toBeNull();
        expect(obtenerEstadoVigenciaPublicacion(ahora.subtract({ nanoseconds: 1 }), sinAvisos, ahora)).toBe("vencida");
    });
});
