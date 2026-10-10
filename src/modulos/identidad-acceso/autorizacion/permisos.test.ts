import { describe, expect, expectTypeOf, it } from "vitest";
import type { DatosSesion, RolUsuario } from "../autenticacion/sesiones";
import { autorizado, type RecursoConPropietario } from "./permisos";

const roles: (RolUsuario | null)[] = [null, "OPERADOR", "PRODUCTOR", "ADMINISTRADOR"];
const sesionDe = (rol: RolUsuario | null): DatosSesion | null =>
    rol ? { usuarioId: 7, rol, expiraEn: 2000000000 } : null;

describe("matriz de autorización BP-04.4", () => {
    it.each([
        "operador.publicacion.consultar",
        "operador.catalogo.consultar",
        "preciosReferencia.consultar",
        "listaInteligente.consultar",
    ] as const)("permite acceso público a %s", (permiso) => {
        expect(autorizado(permiso)).toBe(true);
    });

    it.each(roles)("limita el acceso a mercados y catálogo de Productores para %s", (rol) => {
        const sesion = sesionDe(rol);
        expect(autorizado("operador.mercado.acceder", sesion)).toBe(rol === "OPERADOR");
        expect(autorizado("productor.mercado.acceder", sesion)).toBe(rol === "PRODUCTOR");
        expect(autorizado("productor.publicacion.consultar", sesion)).toBe(rol === "OPERADOR");
    });

    it.each([
        "operador.publicacion.consultarPropias",
        "operador.publicacion.crear",
        "operador.publicacion.modificar",
        "operador.publicacion.eliminar",
        "operador.licencias.gestionar",
        "operador.contacto.modificar",
    ] as const)("%s exige rol Operador y propiedad real", (permiso) => {
        for (const rol of roles) {
            const sesion = sesionDe(rol);
            expect(autorizado(permiso, sesion, { id: 42, usuarioId: 7 })).toBe(rol === "OPERADOR");
            expect(autorizado(permiso, sesion, { id: 42, usuarioId: 9 })).toBe(false);
        }
    });

    it.each([
        "productor.publicacion.crear",
        "productor.publicacion.modificar",
        "productor.publicacion.eliminar",
        "productor.contacto.modificar",
        "productor.departamento.modificar",
    ] as const)("%s exige rol Productor y propiedad real", (permiso) => {
        for (const rol of roles) {
            const sesion = sesionDe(rol);
            expect(autorizado(permiso, sesion, { id: 42, usuarioId: 7 })).toBe(rol === "PRODUCTOR");
            expect(autorizado(permiso, sesion, { id: 42, usuarioId: 9 })).toBe(false);
        }
    });

    it.each([
        "usuarios.cuentas.gestionar",
        "usuarios.restablecimientos.gestionar",
        "administracion.configuracion.gestionar",
    ] as const)("%s es exclusivo de Administradores", (permiso) => {
        for (const rol of roles) {
            expect(autorizado(permiso, sesionDe(rol))).toBe(rol === "ADMINISTRADOR");
        }
    });

    it("la sesión no satisface el tipo del recurso", () => {
        expectTypeOf<DatosSesion>().not.toExtend<RecursoConPropietario>();
    });

    it("rechaza una sesión usada como recurso incluso si se fuerza el tipo", () => {
        const sesion = sesionDe("OPERADOR")!;
        expect(autorizado("operador.publicacion.eliminar", sesion, sesion as unknown as RecursoConPropietario)).toBe(false);
    });

    it.each([0, -1, NaN, 1.5])("rechaza identificadores inválidos de recurso: %s", (id) => {
        expect(autorizado("operador.publicacion.eliminar", sesionDe("OPERADOR"), { id, usuarioId: 7 })).toBe(false);
    });

    it.each(["permiso.inexistente", "constructor", "toString"])("deniega el permiso desconocido %s", (permiso) => {
        // @ts-expect-error Un permiso desconocido también se rechaza en compilación.
        expect(autorizado(permiso)).toBe(false);
    });
});
