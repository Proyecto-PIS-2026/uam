import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextoTareaDiaria } from "@/infraestructura/tareas-programadas/tipos";
import { procesarVencimientosFotos } from "./procesar-vencimientos-fotos";

const mocks = vi.hoisted(() => ({
    query: vi.fn(), execute: vi.fn(), enviarNotificacion: vi.fn(), notificarCambioCatalogoOperador: vi.fn(),
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        raw: {
            sql: (fragmentos: TemplateStringsArray, ...valores: unknown[]) => ({
                returnsRow: () => ({ build: () => ({ sql: fragmentos.join("?"), valores }) }),
                affectedCount: () => ({ build: () => ({ sql: fragmentos.join("?"), valores }) }),
            }),
        },
    },
}));
vi.mock("../notificaciones/notificaciones", () => ({ enviarNotificacion: mocks.enviarNotificacion }));
vi.mock("../../infraestructura/tiempo-real/publicaciones", () => ({ notificarCambioCatalogoOperador: mocks.notificarCambioCatalogoOperador }));

const tx = { query: mocks.query, execute: mocks.execute } as unknown as ContextoTareaDiaria["tx"];
const contexto: ContextoTareaDiaria = { tx, fecha: "2026-11-04", limite: "2026-11-04T15:00:00Z" };
const sinAvisos = { habilitado: true, diasVigencia: 30, avisosHabilitados: false, diasAnticipacionAviso: 0 } as const;
const publicacion = {
    id: 41,
    foto: "/api/publicaciones/imagenes/41/697849b8-c9ca-47b2-9f13-092fb3c6c591.webp",
    clave: "publicaciones/41/697849b8-c9ca-47b2-9f13-092fb3c6c591.webp",
    cargadaEn: "2026-10-05T15:00:00Z",
    usuarioId: 73,
    nombreEspecie: "Papa",
    vencida: true,
};

function prepararVencida(espacio: number) {
    mocks.query.mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ espacio, propietarioId: 12 }])
        .mockResolvedValueOnce([publicacion])
        .mockResolvedValueOnce([{ id: publicacion.id }]);
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.execute.mockResolvedValue(undefined);
    mocks.enviarNotificacion.mockResolvedValue({ enviadas: 1 });
    mocks.notificarCambioCatalogoOperador.mockResolvedValue(undefined);
});

describe("procesamiento de fotos con avisos configurables", () => {
    it("no accede a la base ni envía avisos si el aging está deshabilitado", async () => {
        expect(await procesarVencimientosFotos(contexto, { habilitado: false })).toBe(0);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
    });

    it("rechaza una configuración inválida antes de modificar fotos o enviar avisos", async () => {
        await expect(procesarVencimientosFotos(contexto, {
            ...sinAvisos, avisosHabilitados: true, diasAnticipacionAviso: 30,
        })).rejects.toThrow("anticipación");
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
    });

    it.each([
        ["OPERADOR", 1719, "/mi-mercado"],
        ["PRODUCTOR", 1720, "/mi-mercado/productor"],
    ] as const)("mantiene el aviso de eliminación al dueño %s aunque los avisos previos estén apagados", async (_, espacio, ruta) => {
        prepararVencida(espacio);

        expect(await procesarVencimientosFotos(contexto, sinAvisos)).toBe(1);

        expect(mocks.enviarNotificacion).toHaveBeenCalledExactlyOnceWith({
            texto: "La foto de tu publicación de Papa venció y fue eliminada. Podés cargar una nueva foto.",
            url: `${ruta}?publicacion=41`,
            usuarios: [73],
        }, tx);
        if (espacio === 1719) {
            expect(mocks.notificarCambioCatalogoOperador).toHaveBeenCalledExactlyOnceWith(tx, 12);
        } else {
            expect(mocks.notificarCambioCatalogoOperador).not.toHaveBeenCalled();
        }
    });

    it("propaga el fallo si la eliminación no puede notificarse para que la transacción se revierta", async () => {
        prepararVencida(1719);
        mocks.enviarNotificacion.mockResolvedValue({ enviadas: 0 });

        await expect(procesarVencimientosFotos(contexto, sinAvisos)).rejects.toThrow("No se pudo guardar el aviso");
        expect(mocks.notificarCambioCatalogoOperador).not.toHaveBeenCalled();
    });
});
