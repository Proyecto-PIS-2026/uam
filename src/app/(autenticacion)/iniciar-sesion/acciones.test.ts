
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const funcionesSimuladas = vi.hoisted(() => ({
    autenticarUsuario: vi.fn(),
    crearSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    iniciarSegundoFactor: vi.fn(),
    guardarCookieSegundoFactor: vi.fn(),
    existeUsuarioPorNombre: vi.fn(),
    enviarNotificacion: vi.fn(),
    transaction: vi.fn(),
    obtenerRutaPrincipal: vi.fn(),
    redirect: vi.fn(),
    redireccion: new Error("REDIRECCION"),
    modelos: {
        EstadisticaVisita: {
            where: vi.fn(),
            first: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
        Usuario: {
            where: vi.fn(),
            updateAndCount: vi.fn(),
        },
    },
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/autenticarUsuario", () => ({
    autenticarUsuario: funcionesSimuladas.autenticarUsuario,
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    crearSesion: funcionesSimuladas.crearSesion,
    cerrarSesion: funcionesSimuladas.cerrarSesion,
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor", () => ({
    iniciarSegundoFactor: funcionesSimuladas.iniciarSegundoFactor,
    cancelarSegundoFactor: vi.fn(),
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/cookie-segundo-factor", () => ({
    obtenerTokenSegundoFactor: vi.fn(async () => ""),
    borrarCookieSegundoFactor: vi.fn(),
    guardarCookieSegundoFactor: funcionesSimuladas.guardarCookieSegundoFactor,
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/consultasAutenticacion", () => ({
    existeUsuarioPorNombre: funcionesSimuladas.existeUsuarioPorNombre,
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/rutas", () => ({
    obtenerRutaPrincipal: funcionesSimuladas.obtenerRutaPrincipal,
}));

vi.mock("@/modulos/notificaciones/notificaciones", () => ({
    enviarNotificacion: funcionesSimuladas.enviarNotificacion,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: funcionesSimuladas.transaction,
        orm: {
            public: funcionesSimuladas.modelos,
        },
    },
}));

vi.mock("next/navigation", () => ({
    redirect: funcionesSimuladas.redirect,
}));

import { iniciarSesion, solicitarRecuperacion } from "./acciones";

function crearFormulario(
    identificador: string | Blob | null = "huerta_productora",
    contrasena: string | Blob | null = "contrasena-de-prueba",
) {
    const formulario = new FormData();

    if (identificador !== null) formulario.set("identificador", identificador);
    if (contrasena !== null) formulario.set("contrasena", contrasena);

    return formulario;
}

function configurarMocksBase() {
    vi.resetAllMocks();

    funcionesSimuladas.autenticarUsuario.mockResolvedValue(null);
    funcionesSimuladas.crearSesion.mockResolvedValue(undefined);
    funcionesSimuladas.iniciarSegundoFactor.mockResolvedValue({ token: "token-pendiente" });
    funcionesSimuladas.existeUsuarioPorNombre.mockResolvedValue(true);
    funcionesSimuladas.enviarNotificacion.mockResolvedValue({ enviadas: 2 });
    funcionesSimuladas.transaction.mockImplementation(async (operacion) =>
        operacion({ orm: { public: funcionesSimuladas.modelos } }));

    funcionesSimuladas.obtenerRutaPrincipal.mockImplementation((rol: string) => {
        const rutas: Record<string, string> = {
            ADMINISTRADOR: "/inicio",
            OPERADOR: "/mi-mercado",
            PRODUCTOR: "/mi-mercado/productor",
        };

        return rutas[rol];
    });

    funcionesSimuladas.redirect.mockImplementation(() => {
        throw funcionesSimuladas.redireccion;
    });

    funcionesSimuladas.modelos.EstadisticaVisita.where.mockReturnThis();
    funcionesSimuladas.modelos.EstadisticaVisita.first.mockResolvedValue(null);
    funcionesSimuladas.modelos.EstadisticaVisita.update.mockResolvedValue(1);
    funcionesSimuladas.modelos.EstadisticaVisita.create.mockResolvedValue({ id: 1 });

    funcionesSimuladas.modelos.Usuario.where.mockReturnThis();
    funcionesSimuladas.modelos.Usuario.updateAndCount.mockResolvedValue(1);
}

describe("iniciarSesion", () => {
    beforeEach(() => {
        configurarMocksBase();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 20, 12));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it.each([
        { identificador: null, contrasena: "clave" },
        { identificador: "", contrasena: "clave" },
        { identificador: "   ", contrasena: "clave" },
        { identificador: "usuario", contrasena: null },
        { identificador: "usuario", contrasena: "" },
        { identificador: new Blob(["usuario"]), contrasena: "clave" },
        { identificador: "usuario", contrasena: new Blob(["clave"]) },
    ])("rechaza credenciales incompletas o de tipo incorrecto: %#", async (datos) => {
        const formulario = crearFormulario(datos.identificador, datos.contrasena);

        expect(await iniciarSesion({}, formulario)).toEqual({
            error: "Ingresá tus credenciales para continuar.",
        });

        expect(funcionesSimuladas.autenticarUsuario).not.toHaveBeenCalled();
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
    });

    it("devuelve un error genérico si las credenciales no son válidas", async () => {
        expect(await iniciarSesion({}, crearFormulario())).toEqual({
            error: "Las credenciales ingresadas no son correctas.",
        });

        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
    });

    it("devuelve un error cuando el usuario no tiene un contrato vigente", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({
            error: "CONTRATO_NO_VIGENTE",
        });

        expect(await iniciarSesion({}, crearFormulario())).toEqual({
            error: "No tenés ningún contrato vigente para iniciar sesión. Comunicate con los administradores de la UAM.",
        });

        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.EstadisticaVisita.create).not.toHaveBeenCalled();
    });

    it.each([
        ["OPERADOR", "/mi-mercado"],
        ["PRODUCTOR", "/mi-mercado/productor"],
    ] as const)(
        "inicia la sesión de %s usando el rol de la base",
        async (rol, destino) => {
            funcionesSimuladas.autenticarUsuario.mockResolvedValue({
                usuarioId: 4,
                rol,
            });

            const formulario = crearFormulario(
                "  identificador  ",
                " clave con espacios ",
            );

            formulario.set("rol", "ADMINISTRADOR");

            await expect(iniciarSesion({}, formulario))
                .rejects.toBe(funcionesSimuladas.redireccion);

            expect(funcionesSimuladas.autenticarUsuario).toHaveBeenCalledExactlyOnceWith({
                identificador: "identificador",
                contrasena: " clave con espacios ",
            });

            expect(funcionesSimuladas.crearSesion).toHaveBeenCalledExactlyOnceWith(
                4,
                rol,
            );

            expect(funcionesSimuladas.obtenerRutaPrincipal).toHaveBeenCalledExactlyOnceWith(
                rol,
            );

            expect(funcionesSimuladas.redirect).toHaveBeenCalledExactlyOnceWith(
                destino,
            );
        },
    );

    it("solicita el segundo factor sin crear una sesión administrativa", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({ usuarioId: 4, rol: "ADMINISTRADOR" });
        funcionesSimuladas.iniciarSegundoFactor.mockResolvedValue({ token: "token-pendiente" });
        await expect(iniciarSesion({}, crearFormulario())).rejects.toBe(funcionesSimuladas.redireccion);
        expect(funcionesSimuladas.cerrarSesion).toHaveBeenCalled();
        expect(funcionesSimuladas.iniciarSegundoFactor).toHaveBeenCalledWith(4);
        expect(funcionesSimuladas.guardarCookieSegundoFactor).toHaveBeenCalledWith("token-pendiente");
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).toHaveBeenCalledWith("/iniciar-sesion/segundo-factor");
    });

    it("no permite reiniciar la verificación de una cuenta bloqueada", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({ usuarioId: 4, rol: "ADMINISTRADOR" });
        funcionesSimuladas.iniciarSegundoFactor.mockResolvedValue({ error: "Cuenta bloqueada" });
        expect(await iniciarSesion({}, crearFormulario())).toEqual({ error: "Cuenta bloqueada" });
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.guardarCookieSegundoFactor).not.toHaveBeenCalled();
    });

    it.each(["OPERADOR", "PRODUCTOR"] as const)(
        "registra una nueva estadística de visita para %s",
        async (rol) => {
            funcionesSimuladas.autenticarUsuario.mockResolvedValue({
                usuarioId: 4,
                rol,
            });

            await expect(iniciarSesion({}, crearFormulario()))
                .rejects.toBe(funcionesSimuladas.redireccion);

            expect(funcionesSimuladas.modelos.EstadisticaVisita.where)
                .toHaveBeenCalledExactlyOnceWith(
                    expect.objectContaining({
                        tipoVisitante: rol,
                    }),
                );

            const filtro = funcionesSimuladas.modelos.EstadisticaVisita.where.mock.calls[0][0];

            expect(filtro.fecha.toString()).toBe("2026-10-20T00:00:00Z");

            expect(funcionesSimuladas.modelos.EstadisticaVisita.create)
                .toHaveBeenCalledExactlyOnceWith({
                    fecha: expect.objectContaining({
                        toString: expect.any(Function),
                    }),
                    tipoVisitante: rol,
                    cantidad: 1,
                });

            expect(funcionesSimuladas.modelos.EstadisticaVisita.update).not.toHaveBeenCalled();

            expect(funcionesSimuladas.crearSesion).toHaveBeenCalledExactlyOnceWith(
                4,
                rol,
            );

            expect(funcionesSimuladas.redirect).toHaveBeenCalledOnce();
        },
    );

    it.each(["OPERADOR", "PRODUCTOR"] as const)(
        "incrementa la estadística existente al iniciar sesión como %s",
        async (rol) => {
            funcionesSimuladas.autenticarUsuario.mockResolvedValue({
                usuarioId: 4,
                rol,
            });

            funcionesSimuladas.modelos.EstadisticaVisita.first.mockResolvedValue({
                id: 25,
                cantidad: 6,
            });

            await expect(iniciarSesion({}, crearFormulario()))
                .rejects.toBe(funcionesSimuladas.redireccion);

            expect(funcionesSimuladas.modelos.EstadisticaVisita.where).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    tipoVisitante: rol,
                }),
            );

            expect(funcionesSimuladas.modelos.EstadisticaVisita.where).toHaveBeenNthCalledWith(
                2,
                { id: 25 },
            );

            expect(funcionesSimuladas.modelos.EstadisticaVisita.update)
                .toHaveBeenCalledExactlyOnceWith({
                    cantidad: 7,
                });

            expect(funcionesSimuladas.modelos.EstadisticaVisita.create).not.toHaveBeenCalled();
            expect(funcionesSimuladas.crearSesion).toHaveBeenCalledOnce();
            expect(funcionesSimuladas.redirect).toHaveBeenCalledOnce();
        },
    );

    it("no registra visitas para el rol Administrador", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({
            usuarioId: 4,
            rol: "ADMINISTRADOR",
        });

        await expect(iniciarSesion({}, crearFormulario()))
            .rejects.toBe(funcionesSimuladas.redireccion);

        expect(funcionesSimuladas.modelos.EstadisticaVisita.where).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.EstadisticaVisita.create).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.EstadisticaVisita.update).not.toHaveBeenCalled();

        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.iniciarSegundoFactor).toHaveBeenCalledWith(4);
        expect(funcionesSimuladas.redirect).toHaveBeenCalledWith("/iniciar-sesion/segundo-factor");
    });

    it("no impide iniciar sesión si falla el registro de la estadística", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({
            usuarioId: 4,
            rol: "PRODUCTOR",
        });

        funcionesSimuladas.modelos.EstadisticaVisita.first.mockRejectedValue(
            new Error("Base no disponible"),
        );

        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(iniciarSesion({}, crearFormulario()))
            .rejects.toBe(funcionesSimuladas.redireccion);

        expect(registrarError).toHaveBeenCalledWith(
            "Error al registrar estadística de visita:",
            expect.any(Error),
        );

        expect(funcionesSimuladas.crearSesion).toHaveBeenCalledExactlyOnceWith(
            4,
            "PRODUCTOR",
        );

        expect(funcionesSimuladas.redirect).toHaveBeenCalledWith(
            "/mi-mercado/productor",
        );
    });

    it("no impide iniciar sesión si falla la creación de una estadística", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({
            usuarioId: 4,
            rol: "OPERADOR",
        });

        funcionesSimuladas.modelos.EstadisticaVisita.create.mockRejectedValue(
            new Error("No se pudo crear la estadística"),
        );

        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(iniciarSesion({}, crearFormulario()))
            .rejects.toBe(funcionesSimuladas.redireccion);

        expect(registrarError).toHaveBeenCalledOnce();
        expect(funcionesSimuladas.crearSesion).toHaveBeenCalledOnce();
        expect(funcionesSimuladas.redirect).toHaveBeenCalledWith("/mi-mercado");
    });

    it("no crea una sesión si falla la consulta de autenticación", async () => {
        funcionesSimuladas.autenticarUsuario.mockRejectedValue(
            new Error("Base no disponible"),
        );

        await expect(iniciarSesion({}, crearFormulario()))
            .rejects.toThrow("Base no disponible");

        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
    });

    it("no redirige si falla la creación de la sesión", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({
            usuarioId: 4,
            rol: "PRODUCTOR",
        });

        funcionesSimuladas.crearSesion.mockRejectedValue(
            new Error("Falta el secreto"),
        );

        await expect(iniciarSesion({}, crearFormulario()))
            .rejects.toThrow("Falta el secreto");

        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
    });
});

describe("solicitarRecuperacion", () => {
    beforeEach(() => {
        configurarMocksBase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("rechaza un nombre de usuario vacío", async () => {
        const resultado = await solicitarRecuperacion("");

        expect(resultado).toEqual({
            error: "Ingresá tu nombre de usuario para solicitar la recuperación.",
        });

        expect(funcionesSimuladas.existeUsuarioPorNombre).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.Usuario.where).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.Usuario.updateAndCount).not.toHaveBeenCalled();
    });

    it("rechaza un nombre de usuario compuesto solamente por espacios", async () => {
        const resultado = await solicitarRecuperacion("     ");

        expect(resultado).toEqual({
            error: "Ingresá tu nombre de usuario para solicitar la recuperación.",
        });

        expect(funcionesSimuladas.existeUsuarioPorNombre).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.Usuario.updateAndCount).not.toHaveBeenCalled();
    });

    it("informa cuando el usuario no existe", async () => {
        funcionesSimuladas.existeUsuarioPorNombre.mockResolvedValue(false);

        const resultado = await solicitarRecuperacion("usuario_inexistente");

        expect(resultado).toEqual({
            error: "No existe ningún usuario con ese nombre.",
        });

        expect(funcionesSimuladas.existeUsuarioPorNombre)
            .toHaveBeenCalledExactlyOnceWith("usuario_inexistente");

        expect(funcionesSimuladas.modelos.Usuario.where).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.Usuario.updateAndCount).not.toHaveBeenCalled();
    });

    it("registra correctamente una solicitud de recuperación", async () => {
        const resultado = await solicitarRecuperacion("usuario_existente");

        expect(resultado).toEqual({
            exito: "La solicitud de recuperación fue realizada correctamente.",
        });

        expect(funcionesSimuladas.existeUsuarioPorNombre)
            .toHaveBeenCalledExactlyOnceWith("usuario_existente");

        expect(funcionesSimuladas.modelos.Usuario.where)
            .toHaveBeenCalledExactlyOnceWith({
                username: "usuario_existente",
                solicitoRestablecimiento: false,
            });

        expect(funcionesSimuladas.modelos.Usuario.updateAndCount)
            .toHaveBeenCalledExactlyOnceWith({
                solicitoRestablecimiento: true,
            });
        expect(funcionesSimuladas.transaction).toHaveBeenCalledOnce();
        expect(funcionesSimuladas.enviarNotificacion).toHaveBeenCalledExactlyOnceWith({
            texto: "El usuario usuario_existente solicitó restablecer su contraseña.",
            url: "/administracion#usuarios",
            roles: ["ADMINISTRADOR"],
        }, { orm: { public: funcionesSimuladas.modelos } });
    });

    it("no repite los avisos de una solicitud que sigue pendiente", async () => {
        funcionesSimuladas.modelos.Usuario.updateAndCount.mockResolvedValue(0);

        expect(await solicitarRecuperacion("usuario_existente")).toEqual({
            exito: "La solicitud de recuperación fue realizada correctamente.",
        });

        expect(funcionesSimuladas.enviarNotificacion).not.toHaveBeenCalled();
    });

    it("sólo avisa por la solicitud que consigue marcar al usuario como pendiente", async () => {
        funcionesSimuladas.modelos.Usuario.updateAndCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

        const resultados = await Promise.all([
            solicitarRecuperacion("usuario_existente"),
            solicitarRecuperacion("usuario_existente"),
        ]);

        expect(resultados.every((resultado) => resultado.exito)).toBe(true);
        expect(funcionesSimuladas.enviarNotificacion).toHaveBeenCalledOnce();
    });

    it("propaga el fallo del aviso a la transacción y permite informar el error", async () => {
        const error = new Error("No se pudo notificar a los administradores");
        funcionesSimuladas.enviarNotificacion.mockRejectedValue(error);

        expect(await solicitarRecuperacion("usuario_existente")).toEqual({
            error: "No se pudo registrar la solicitud. Intentá nuevamente.",
            tipoError: "operacion",
        });

        await expect(funcionesSimuladas.transaction.mock.results[0].value).rejects.toBe(error);
    });

    it("rechaza la transacción si no hay administradores para recibir la solicitud", async () => {
        funcionesSimuladas.enviarNotificacion.mockResolvedValue({ enviadas: 0 });

        expect(await solicitarRecuperacion("usuario_existente")).toEqual({
            error: "No se pudo registrar la solicitud. Intentá nuevamente.",
            tipoError: "operacion",
        });

        await expect(funcionesSimuladas.transaction.mock.results[0].value)
            .rejects.toThrow("No hay administradores para recibir la solicitud de recuperación.");
    });

    it("acota el nombre mostrado en el aviso sin modificar el usuario solicitado", async () => {
        const nombreLargo = "usuario_" + "a".repeat(2000);

        expect(await solicitarRecuperacion(nombreLargo)).toEqual({
            exito: "La solicitud de recuperación fue realizada correctamente.",
        });

        expect(funcionesSimuladas.existeUsuarioPorNombre).toHaveBeenCalledExactlyOnceWith(nombreLargo);
        expect(funcionesSimuladas.modelos.Usuario.where).toHaveBeenCalledExactlyOnceWith({
            username: nombreLargo,
            solicitoRestablecimiento: false,
        });
        const aviso = funcionesSimuladas.enviarNotificacion.mock.calls[0][0];
        expect(aviso.texto).toContain(`${nombreLargo.slice(0, 160)}…`);
        expect(aviso.texto.length).toBeLessThanOrEqual(2000);
        expect(aviso.url).toBe("/administracion#usuarios");
    });

    it("normaliza el nombre de usuario antes de consultar y registrar la solicitud", async () => {
        const resultado = await solicitarRecuperacion("   usuario_existente   ");

        expect(resultado).toEqual({
            exito: "La solicitud de recuperación fue realizada correctamente.",
        });

        expect(funcionesSimuladas.existeUsuarioPorNombre)
            .toHaveBeenCalledExactlyOnceWith("usuario_existente");

        expect(funcionesSimuladas.modelos.Usuario.where)
            .toHaveBeenCalledExactlyOnceWith({
                username: "usuario_existente",
                solicitoRestablecimiento: false,
            });

        expect(funcionesSimuladas.modelos.Usuario.updateAndCount)
            .toHaveBeenCalledExactlyOnceWith({
                solicitoRestablecimiento: true,
            });
    });

    it("devuelve un error operacional si falla la consulta de existencia", async () => {
        funcionesSimuladas.existeUsuarioPorNombre.mockRejectedValue(
            new Error("Base de datos no disponible"),
        );

        const resultado = await solicitarRecuperacion("usuario_existente");

        expect(resultado).toEqual({
            error: "No se pudo registrar la solicitud. Intentá nuevamente.",
            tipoError: "operacion",
        });

        expect(funcionesSimuladas.modelos.Usuario.where).not.toHaveBeenCalled();
        expect(funcionesSimuladas.modelos.Usuario.updateAndCount).not.toHaveBeenCalled();
    });

    it("devuelve un error operacional si falla el registro de la solicitud", async () => {
        funcionesSimuladas.modelos.Usuario.updateAndCount.mockRejectedValue(
            new Error("No se pudo actualizar el usuario"),
        );

        const resultado = await solicitarRecuperacion("usuario_existente");

        expect(resultado).toEqual({
            error: "No se pudo registrar la solicitud. Intentá nuevamente.",
            tipoError: "operacion",
        });

        expect(funcionesSimuladas.existeUsuarioPorNombre)
            .toHaveBeenCalledExactlyOnceWith("usuario_existente");

        expect(funcionesSimuladas.modelos.Usuario.where)
            .toHaveBeenCalledExactlyOnceWith({
                username: "usuario_existente",
                solicitoRestablecimiento: false,
            });

        expect(funcionesSimuladas.modelos.Usuario.updateAndCount)
            .toHaveBeenCalledExactlyOnceWith({
                solicitoRestablecimiento: true,
            });
    });
});
