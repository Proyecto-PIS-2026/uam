import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../../infraestructura/persistencia/prisma/db";
import type { DatosSesion } from "../autenticacion/sesiones";
import { POST } from "../../../app/api/publicaciones/route";
import { DELETE, PATCH } from "../../../app/api/publicaciones/[id]/route";
import { actualizarPrecio, cargarPublicacionesMiMercado } from "../../publicaciones/mi-mercado/acciones";

const sesionMock = vi.hoisted(() => vi.fn());
vi.mock("../autenticacion/sesiones", () => ({ obtenerSesion: sesionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.sequential("autorización contra datos reales", () => {
    let propio: { id: number; usuarioId: number };
    let ajeno: { id: number; usuarioId: number };
    let publicacionAjena: { id: number; presentacionId: number; categoriaId: number; calibreId: number };
    let sesion: DatosSesion;

    beforeAll(async () => {
        if (!process.env.DATABASE_URL_TEST || process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST) {
            throw new Error("Estas pruebas requieren DATABASE_URL_TEST como base activa.");
        }
        const operadores = await db.orm.public.Operador.select("id", "usuarioId").all();
        const relaciones = await db.orm.public.PublicacionOperador.all();
        const relacion = relaciones.find((item) => {
            const propietario = operadores.find((operador) => operador.id === item.operadorId);
            return propietario && operadores.some((operador) => operador.usuarioId !== propietario.usuarioId);
        });
        if (!relacion) throw new Error("Se requiere una publicación y dos Operadores de usuarios distintos en el seed.");
        const propietario = operadores.find((operador) => operador.id === relacion.operadorId)!;
        ajeno = propietario;
        propio = operadores.find((operador) => operador.usuarioId !== propietario.usuarioId)!;
        const publicacion = await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).first();
        if (!publicacion) throw new Error("No se encontró la publicación de prueba.");
        publicacionAjena = publicacion;
        sesion = { usuarioId: propio.usuarioId, rol: "OPERADOR", expiraEn: 2000000000 };
    });

    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(sesion);
    });

    const leerPublicacion = () => db.orm.public.Publicacion
        .where({ id: publicacionAjena.id })
        .select("id", "precio", "publicacionDisponible", "cantidadUnidades")
        .first();

    it("no crea publicaciones para un Operador ajeno ni acepta su usuarioId enviado por el cliente", async () => {
        const antes = await db.orm.public.PublicacionOperador.where({ operadorId: ajeno.id }).all();
        const respuesta = await POST(new Request("http://localhost/api/publicaciones", {
            method: "POST",
            body: JSON.stringify({ operadorId: ajeno.id, usuarioId: ajeno.usuarioId }),
        }));
        expect(respuesta.status).toBe(403);
        expect(await db.orm.public.PublicacionOperador.where({ operadorId: ajeno.id }).all()).toEqual(antes);
    });

    it.each(["DELETE", "PATCH"] as const)("%s no cambia una publicación ajena, aunque se envíe el Operador propio", async (metodo) => {
        const antes = await leerPublicacion();
        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify({
            presentacionId: publicacionAjena.presentacionId,
            categoriaId: publicacionAjena.categoriaId,
            calibreId: publicacionAjena.calibreId,
            paisId: 1,
            precio: "999",
            disponible: false,
        }));
        const handler = metodo === "DELETE" ? DELETE : PATCH;
        for (const operadorId of [ajeno.id, propio.id]) {
            const respuesta = await handler(new Request(`http://localhost/api/publicaciones/${publicacionAjena.id}?operadorId=${operadorId}`, {
                method: metodo,
                ...(metodo === "PATCH" ? { body: formulario } : {}),
            }), { params: Promise.resolve({ id: String(publicacionAjena.id) }) });
            expect(respuesta.status).toBe(operadorId === ajeno.id ? 403 : 404);
            expect(await leerPublicacion()).toEqual(antes);
        }
    });

    it("la acción de precio rechaza tanto el Operador ajeno como su publicación con Operador propio", async () => {
        const antes = await leerPublicacion();
        await expect(actualizarPrecio(publicacionAjena.id, 999, ajeno.id)).rejects.toThrow("No tiene permisos");
        await expect(actualizarPrecio(publicacionAjena.id, 999, propio.id)).resolves.toEqual({ publicacionEliminada: true });
        expect(await leerPublicacion()).toEqual(antes);
        await expect(cargarPublicacionesMiMercado(ajeno.id)).rejects.toThrow("No tiene permisos");
    });

    it.each([null, "PRODUCTOR", "ADMINISTRADOR"] as const)("no elimina publicaciones con sesión %s", async (rol) => {
        const antes = await leerPublicacion();
        sesionMock.mockResolvedValue(rol ? { ...sesion, rol } : null);
        const respuesta = await DELETE(new Request(`http://localhost/api/publicaciones/${publicacionAjena.id}?operadorId=${ajeno.id}`), {
            params: Promise.resolve({ id: String(publicacionAjena.id) }),
        });
        expect(respuesta.status).toBe(rol ? 403 : 401);
        expect(await leerPublicacion()).toEqual(antes);
    });
});
