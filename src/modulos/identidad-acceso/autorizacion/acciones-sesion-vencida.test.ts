// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { altaAdministrador } from "@/modulos/usuarios/administradores/altaAdministrador";
import { modificarMiPerfilAdministrador } from "@/modulos/usuarios/administradores/modificar-mi-perfil";
import { restablecerSegundoFactorAdministrador } from "@/modulos/usuarios/administradores/restablecerSegundoFactorAdministrador";
import { modificarPerfilPropio } from "@/modulos/usuarios/operadores/acciones/modificarPerfilPropio";
import { cambiarContrasena } from "@/modulos/usuarios/operadores/acciones/cambiarContrasena";
import { guardarConfiguraciones } from "@/modulos/administracion/acciones/guardar-configuracion";
import { guardarFotoEspecie, eliminarFotoEspecie } from "@/modulos/administracion/acciones/foto-especie";

const mocks = vi.hoisted(() => ({ sesion: vi.fn(), cerrar: vi.fn(), redirigir: vi.fn(), transaction: vi.fn() }));
vi.mock("../autenticacion/sesiones", () => ({ obtenerSesion: mocks.sesion, cerrarSesion: mocks.cerrar }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirigir }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { transaction: mocks.transaction } }));

const acciones = [
    { nombre: "alta de administrador", rol: "ADMINISTRADOR", ejecutar: () => altaAdministrador({}) },
    { nombre: "perfil propio de administrador", rol: "ADMINISTRADOR", ejecutar: () => modificarMiPerfilAdministrador({}) },
    { nombre: "restablecimiento de segundo factor", rol: "ADMINISTRADOR", ejecutar: () => restablecerSegundoFactorAdministrador(2) },
    { nombre: "perfil propio de operador", rol: "OPERADOR", ejecutar: () => modificarPerfilPropio({}) },
    { nombre: "cambio de contraseña de operador", rol: "OPERADOR", ejecutar: () => cambiarContrasena({}, new FormData()) },
    { nombre: "configuración administrativa", rol: "ADMINISTRADOR", ejecutar: () => guardarConfiguraciones({ incremento_precio: "1" }) },
    { nombre: "guardar foto de especie", rol: "ADMINISTRADOR", ejecutar: () => guardarFotoEspecie(1, new File(["foto"], "foto.png")) },
    { nombre: "quitar foto de especie", rol: "ADMINISTRADOR", ejecutar: () => eliminarFotoEspecie(1) },
];

beforeEach(() => {
    vi.resetAllMocks();
    mocks.sesion.mockResolvedValue(null);
    mocks.cerrar.mockResolvedValue(undefined);
    mocks.redirigir.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
});

describe("acciones protegidas con sesión vencida", () => {
    it.each(acciones)("$nombre redirige al login antes de validar o modificar datos", async ({ ejecutar }) => {
        await expect(ejecutar()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.cerrar).toHaveBeenCalledOnce();
        expect(mocks.redirigir).toHaveBeenCalledWith("/iniciar-sesion");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(acciones)("$nombre mantiene el rechazo de permisos de otro rol", async ({ ejecutar, rol }) => {
        mocks.sesion.mockResolvedValue({ usuarioId: 4, rol: rol === "ADMINISTRADOR" ? "OPERADOR" : "ADMINISTRADOR", expiraEn: 9999999999 });
        await expect(ejecutar()).rejects.toMatchObject({ status: 403 });
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.redirigir).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});
