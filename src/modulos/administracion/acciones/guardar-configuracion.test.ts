import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardarConfiguraciones } from "./guardar-configuracion";

const mocks = vi.hoisted(() => ({
    exigirAdministrador: vi.fn(),
    transaction: vi.fn(),
    where: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    rawSql: vi.fn(),
    execute: vi.fn(),
}));

type PlanSql = { texto: string; valores: unknown[] };

vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({ controlarSesionEnAccion: (control: () => Promise<unknown>) => control() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    exigirAdministrador: mocks.exigirAdministrador,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { transaction: mocks.transaction, raw: { sql: mocks.rawSql } },
}));

const gruposVigencia = [
    {
        nombre: "fotos de operadores",
        habilitado: "aging_fotos_habilitado",
        vigencia: "vigencia_fotos",
        avisos: "aviso_vencimiento_fotos_habilitado",
        anticipacion: "anticipacion_aviso_fotos",
    },
    {
        nombre: "fotos de productores",
        habilitado: "aging_fotos_productor_habilitado",
        vigencia: "vigencia_fotos_productor",
        avisos: "aviso_vencimiento_fotos_productor_habilitado",
        anticipacion: "anticipacion_aviso_fotos_productor",
    },
    {
        nombre: "publicaciones de operadores",
        habilitado: "vigencia_publicaciones_operador_habilitada",
        vigencia: "vigencia_publicaciones_operador",
        avisos: "aviso_vencimiento_publicaciones_operador_habilitado",
        anticipacion: "anticipacion_aviso_publicaciones_operador",
    },
    {
        nombre: "publicaciones de productores",
        habilitado: "vigencia_publicaciones_productor_habilitada",
        vigencia: "vigencia_publicaciones_productor",
        avisos: "aviso_vencimiento_publicaciones_productor_habilitado",
        anticipacion: "anticipacion_aviso_publicaciones_productor",
    },
] as const;

function ordenamiento(cambios: Record<string, string> = {}): Record<string, string> {
    return {
        ordenamiento_habilitado: "true",
        orden_landing_page_default: "nombre_asc",
        orden_mercado_virtual_default: "menor_precio",
        orden_mercado_produccion_default: "mayor_precio",
        ...cambios,
    };
}

beforeEach(() => {
    vi.resetAllMocks();

    const consulta = { where: mocks.where, select: mocks.select, update: mocks.update };
    mocks.where.mockReturnValue(consulta);
    mocks.select.mockReturnValue(consulta);
    mocks.update.mockResolvedValue({ nombreConfiguracion: "configuracion" });
    mocks.exigirAdministrador.mockResolvedValue(undefined);

    mocks.rawSql.mockImplementation((partes: TemplateStringsArray, ...valores: unknown[]) => {
        const plan: PlanSql = { texto: partes.join("?").replace(/\s+/g, " ").trim(), valores };
        const constructor = {
            returnsRow: () => constructor,
            affectedCount: () => constructor,
            build: () => plan,
        };
        return constructor;
    });
    mocks.execute.mockResolvedValue(0);

    const tx = { orm: { public: { Configuracion: consulta } }, execute: mocks.execute };
    mocks.transaction.mockImplementation(async (operacion: (cliente: typeof tx) => Promise<void>) => {
        await operacion(tx);
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("guardarConfiguraciones", () => {
    it("rechaza el guardado si falla la autorización", async () => {
        mocks.exigirAdministrador.mockRejectedValue(new Error("No autorizado"));
        await expect(guardarConfiguraciones({ incremento_precio: "10" })).rejects.toThrow("No autorizado");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each([null, undefined, [], "texto", 10])("rechaza un cuerpo inválido: %j", async (entrada) => {
        await expect(guardarConfiguraciones(entrada as unknown as Record<string, string>)).rejects.toThrow("Las configuraciones no son válidas.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza un objeto vacío", async () => {
        await expect(guardarConfiguraciones({})).rejects.toThrow("No hay configuraciones para guardar.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza claves desconocidas", async () => {
        await expect(guardarConfiguraciones({ desconocida: "true" })).rejects.toThrow("La configuración indicada no es válida.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza valores que no sean texto", async () => {
        await expect(guardarConfiguraciones({ incremento_precio: 10 } as unknown as Record<string, string>)).rejects.toThrow("La configuración indicada no es válida.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
        "https://uam.com.uy/lista.pdf",
        "http://uam.com.uy/lista.pdf",
        "https://uam.com.uy/lista.PDF",
        "https://uam.com.uy/lista.pdf?v=2",
        "https://uam.com.uy/lista.pdf#pagina=1",
    ])("permite guardar la URL %j", async (valor) => {
        await guardarConfiguraciones({ url_lista_inteligente: valor });
        expect(mocks.exigirAdministrador).toHaveBeenCalledOnce();
        expect(mocks.where).toHaveBeenCalledWith({ nombreConfiguracion: "url_lista_inteligente" });
        expect(mocks.update).toHaveBeenCalledWith({ valorConfiguracion: valor });
    });

    it.each(["", "   ", "\t\r\n"])("rechaza una URL vacía %j sin reemplazar la configuración guardada", async (valor) => {
        await expect(guardarConfiguraciones({ url_lista_inteligente: valor })).rejects.toThrow("La URL de la Lista Inteligente no puede estar vacía.");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each([
        "no-es-una-url",
        "ftp://uam.com.uy/lista.pdf",
        "javascript:alert(1)",
        " https://uam.com.uy/lista.pdf",
        "https://uam.com.uy/lista.pdf ",
    ])("rechaza la URL inválida %j", async (valor) => {
        await expect(guardarConfiguraciones({ url_lista_inteligente: valor })).rejects.toThrow();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each([
        "https://www.youtube.com/watch?v=ejemplo",
        "https://uam.com.uy/lista.html",
        "https://uam.com.uy/lista.pdf/otra",
        "https://uam.com.uy/documento?archivo=lista.pdf",
        "https://uam.com.uy/documento#lista.pdf",
    ])("rechaza una URL que no corresponde a un PDF: %j", async (valor) => {
        await expect(guardarConfiguraciones({ url_lista_inteligente: valor })).rejects.toThrow("La URL de la Lista Inteligente debe corresponder a un archivo PDF.");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each(["1", "25", "1000"])("permite el importe %s", async (valor) => {
        await guardarConfiguraciones({ incremento_precio: valor });
        expect(mocks.update).toHaveBeenCalledWith({ valorConfiguracion: valor });
    });

    it.each(["", "0", "-1", "1.5", "abc", " 2"])("rechaza el importe %j", async (valor) => {
        await expect(guardarConfiguraciones({ incremento_precio: valor })).rejects.toThrow("El importe debe ser un número entero mayor que cero.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza un importe demasiado grande con un mensaje específico", async () => {
        await expect(guardarConfiguraciones({ incremento_precio: "9007199254740992" })).rejects.toThrow("El importe ingresado es demasiado grande.");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    describe("restablecimiento de contraseñas", () => {
        it.each(["true", "false"])("guarda el estado %s", async (valor) => {
            await guardarConfiguraciones({ restablecimiento_contrasena_habilitado: valor });
            expect(mocks.where).toHaveBeenCalledWith({ nombreConfiguracion: "restablecimiento_contrasena_habilitado" });
            expect(mocks.update).toHaveBeenCalledWith({ valorConfiguracion: valor });
        });

        it.each(["", "TRUE", "1", "si"])("rechaza el estado %j", async (valor) => {
            await expect(guardarConfiguraciones({ restablecimiento_contrasena_habilitado: valor })).rejects.toThrow("El estado de la configuración no es válido.");
            expect(mocks.transaction).not.toHaveBeenCalled();
        });
    });
});

describe("ordenamiento", () => {
    it("guarda las cuatro opciones en una sola transacción", async () => {
        const cambios = ordenamiento();
        await guardarConfiguraciones(cambios);
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledTimes(4);
        Object.entries(cambios).forEach(([nombre, valor], indice) => {
            expect(mocks.where).toHaveBeenNthCalledWith(indice + 1, { nombreConfiguracion: nombre });
            expect(mocks.update).toHaveBeenNthCalledWith(indice + 1, { valorConfiguracion: valor });
        });
    });

    it.each(["ordenamiento_habilitado", "orden_landing_page_default", "orden_mercado_virtual_default", "orden_mercado_produccion_default"])("rechaza el grupo si falta %s", async (clave) => {
        const cambios = ordenamiento();
        delete cambios[clave];
        await expect(guardarConfiguraciones(cambios)).rejects.toThrow("Las cuatro opciones de ordenamiento deben guardarse juntas.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["nombre_asc", "nombre_desc", "mas_vendidas"])("acepta %s para Inicio", async (orden) => {
        await expect(guardarConfiguraciones(ordenamiento({ orden_landing_page_default: orden }))).resolves.toBeUndefined();
    });

    it.each(["menor_precio", "mayor_precio", "mas_actualizadas", "desconocido", ""])("rechaza %j para Inicio", async (orden) => {
        await expect(guardarConfiguraciones(ordenamiento({ orden_landing_page_default: orden }))).rejects.toThrow();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    describe.each([
        { nombre: "Mercado Virtual", clave: "orden_mercado_virtual_default" },
        { nombre: "Mercado Producción", clave: "orden_mercado_produccion_default" },
    ])("$nombre", ({ clave }) => {
        it.each(["nombre_asc", "nombre_desc", "mas_vendidas", "menor_precio", "mayor_precio", "mas_actualizadas"])("acepta el orden %s", async (orden) => {
            await expect(guardarConfiguraciones(ordenamiento({ [clave]: orden }))).resolves.toBeUndefined();
        });

        it.each(["desconocido", ""])("rechaza el orden inválido %j", async (orden) => {
            await expect(guardarConfiguraciones(ordenamiento({ [clave]: orden }))).rejects.toThrow("El orden seleccionado para el mercado no es válido.");
            expect(mocks.transaction).not.toHaveBeenCalled();
        });
    });

    it("permite guardar órdenes diferentes con el switch apagado", async () => {
        const cambios = ordenamiento({ ordenamiento_habilitado: "false" });
        await guardarConfiguraciones(cambios);
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledTimes(4);
        Object.entries(cambios).forEach(([nombre, valor], indice) => {
            expect(mocks.where).toHaveBeenNthCalledWith(indice + 1, { nombreConfiguracion: nombre });
            expect(mocks.update).toHaveBeenNthCalledWith(indice + 1, { valorConfiguracion: valor });
        });
    });

    it("permite guardar Más actualizadas para ambos mercados con el switch apagado", async () => {
        const cambios = ordenamiento({
            ordenamiento_habilitado: "false",
            orden_mercado_virtual_default: "mas_actualizadas",
            orden_mercado_produccion_default: "mas_actualizadas",
        });
        await guardarConfiguraciones(cambios);
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledTimes(4);
        Object.entries(cambios).forEach(([nombre, valor], indice) => {
            expect(mocks.where).toHaveBeenNthCalledWith(indice + 1, { nombreConfiguracion: nombre });
            expect(mocks.update).toHaveBeenNthCalledWith(indice + 1, { valorConfiguracion: valor });
        });
    });

    it("rechaza la clave anterior de los mercados", async () => {
        await expect(guardarConfiguraciones({ orden_mercados_default: "nombre_asc" })).rejects.toThrow("La configuración indicada no es válida.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza un estado de habilitación inválido", async () => {
        await expect(guardarConfiguraciones(ordenamiento({ ordenamiento_habilitado: "si" }))).rejects.toThrow("El estado de la configuración no es válido.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});

describe.each(gruposVigencia)("vigencia de $nombre", (grupo) => {
    function configuracionVigencia(cambios: Record<string, string> = {}): Record<string, string> {
        return {
            [grupo.habilitado]: "true",
            [grupo.vigencia]: "30",
            [grupo.avisos]: "true",
            [grupo.anticipacion]: "7",
            ...cambios,
        };
    }

    it("guarda las cuatro opciones juntas", async () => {
        await guardarConfiguraciones(configuracionVigencia());
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledTimes(4);
        expect(mocks.where.mock.calls.map(([filtro]) => filtro.nombreConfiguracion)).toEqual([
            grupo.habilitado, grupo.vigencia, grupo.avisos, grupo.anticipacion,
        ]);
        if (grupo.nombre.startsWith("fotos")) expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("rechaza un grupo incompleto", async () => {
        await expect(guardarConfiguraciones({ [grupo.habilitado]: "true" })).rejects.toThrow("Las cuatro opciones de vigencia deben guardarse juntas.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["", "0", "-1", "1.5", "abc"])("rechaza vigencia activa con días %j", async (valor) => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.vigencia]: valor }))).rejects.toThrow("La vigencia debe ser un número entero mayor que cero.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza una vigencia demasiado grande con un mensaje específico", async () => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.vigencia]: "9007199254740992" }))).rejects.toThrow("La vigencia ingresada es demasiado grande.");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each(["", "0", "-1", "1.5", "abc"])("rechaza avisos activos con anticipación %j", async (valor) => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.anticipacion]: valor }))).rejects.toThrow("La anticipación debe ser un número entero mayor que cero.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza una anticipación demasiado grande con un mensaje específico", async () => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.anticipacion]: "9007199254740992" }))).rejects.toThrow("La anticipación ingresada es demasiado grande.");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each(["30", "31"])("rechaza anticipación %s con vigencia de 30 días", async (valor) => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.anticipacion]: valor }))).rejects.toThrow("La anticipación debe ser menor que la vigencia.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("permite un día de vigencia con avisos apagados", async () => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.vigencia]: "1", [grupo.avisos]: "false", [grupo.anticipacion]: "" }))).resolves.toBeUndefined();
    });

    it("permite una vigencia de 36500 días", async () => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.vigencia]: "36500" }))).resolves.toBeUndefined();
        expect(mocks.update).toHaveBeenCalledWith({ valorConfiguracion: "36500" });
    });

    if (grupo.nombre.startsWith("fotos")) {
        it("rechaza una vigencia de fotos mayor a 36500 días antes de guardar", async () => {
            await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.vigencia]: "36501" }))).rejects.toThrow("La vigencia de las fotos no puede superar los 36500 días.");
            expect(mocks.transaction).not.toHaveBeenCalled();
            expect(mocks.update).not.toHaveBeenCalled();
        });
    } else {
        it("conserva la validación de publicaciones sin el límite exclusivo de las fotos", async () => {
            await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.vigencia]: "36501" }))).resolves.toBeUndefined();
            expect(mocks.update).toHaveBeenCalledWith({ valorConfiguracion: "36501" });
        });
    }

    it("permite guardar todo desactivado con campos vacíos", async () => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [grupo.habilitado]: "false", [grupo.vigencia]: "", [grupo.avisos]: "false", [grupo.anticipacion]: "" }))).resolves.toBeUndefined();
    });

    it.each([grupo.habilitado, grupo.avisos])("rechaza un booleano inválido en %s", async (clave) => {
        await expect(guardarConfiguraciones(configuracionVigencia({ [clave]: "si" }))).rejects.toThrow("El estado de la configuración no es válido.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});

describe("independencia de la vigencia de fotos por propietario", () => {
    const fotosOperadores = {
        aging_fotos_habilitado: "true",
        vigencia_fotos: "30",
        aviso_vencimiento_fotos_habilitado: "true",
        anticipacion_aviso_fotos: "7",
    };
    const fotosProductores = {
        aging_fotos_productor_habilitado: "true",
        vigencia_fotos_productor: "10",
        aviso_vencimiento_fotos_productor_habilitado: "true",
        anticipacion_aviso_fotos_productor: "2",
    };

    it("permite guardar plazos y anticipaciones diferentes sin cruzar los grupos", async () => {
        await guardarConfiguraciones({ ...fotosOperadores, ...fotosProductores });

        expect(mocks.update.mock.calls.map(([cambio]) => cambio.valorConfiguracion)).toEqual([
            "true", "30", "true", "7", "true", "10", "true", "2",
        ]);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("valida la anticipación del productor contra su propia vigencia", async () => {
        await expect(guardarConfiguraciones({ ...fotosOperadores, ...fotosProductores, anticipacion_aviso_fotos_productor: "15" }))
            .rejects.toThrow("La anticipación debe ser menor que la vigencia.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("un grupo completo no permite guardar el otro de forma parcial", async () => {
        await expect(guardarConfiguraciones({ ...fotosOperadores, vigencia_fotos_productor: "10" }))
            .rejects.toThrow("Las cuatro opciones de vigencia deben guardarse juntas.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});

describe.each([
    { tipo: "OPERADOR", sufijo: "operador" },
    { tipo: "PRODUCTOR", sufijo: "productor" },
] as const)("aplicación del límite a publicaciones existentes de $tipo", ({ tipo, sufijo }) => {
    function configuracionPublicaciones(dias = "3", habilitada = true): Record<string, string> {
        return {
            [`vigencia_publicaciones_${sufijo}_habilitada`]: String(habilitada),
            [`vigencia_publicaciones_${sufijo}`]: habilitada ? dias : "",
            [`aviso_vencimiento_publicaciones_${sufijo}_habilitado`]: "false",
            [`anticipacion_aviso_publicaciones_${sufijo}`]: "",
        };
    }

    function planesEjecutados(): PlanSql[] {
        return mocks.execute.mock.calls.map(([plan]) => plan as PlanSql);
    }

    beforeEach(() => {
        vi.useFakeTimers();
        // Todavía es el 6 de noviembre en Montevideo, aunque en UTC ya es el 7.
        vi.setSystemTime(new Date("2026-11-07T02:00:00Z"));
    });

    it("guarda las opciones y aplica el tope al final del día local dentro de la misma transacción", async () => {
        await guardarConfiguraciones(configuracionPublicaciones());

        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledTimes(4);
        const [bloqueo, recorte] = planesEjecutados();
        expect(planesEjecutados()).toHaveLength(2);
        expect(bloqueo.texto).toContain("pg_advisory_xact_lock(");
        expect(bloqueo.texto).not.toContain("pg_advisory_xact_lock_shared");
        expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
        expect(mocks.update.mock.invocationCallOrder[3]).toBeLessThan(mocks.execute.mock.invocationCallOrder[1]);
        expect(recorte.valores.map(String)).toEqual(["2026-11-10T02:59:59Z", tipo, "2026-11-10T02:59:59Z"]);
    });

    it("limita únicamente fechas vacías o posteriores del rol configurado, sin cambiar otros campos", async () => {
        await guardarConfiguraciones(configuracionPublicaciones());

        const recorte = planesEjecutados()[1];
        expect(recorte.texto).toMatch(/^UPDATE publicacion SET "fechaVigencia" = \?::timestamptz WHERE /);
        expect(recorte.texto).toMatch(/"tipoPublicacion"::text = \?/);
        expect(recorte.valores[1]).toBe(tipo);
        expect(recorte.texto).toMatch(/AND \("fechaVigencia" IS NULL OR "fechaVigencia" > \?::timestamptz\)$/);
        expect(recorte.texto).not.toMatch(/publicacionDisponible|publicacionActiva|\bversion\b|"fecha"/);
    });

    it("al ampliar el plazo conserva la condición que impide extender fechas ya anteriores al nuevo tope", async () => {
        await guardarConfiguraciones(configuracionPublicaciones("3"));
        await guardarConfiguraciones(configuracionPublicaciones("10"));

        const recorte = planesEjecutados()[3];
        expect(recorte.valores.map(String)).toEqual(["2026-11-17T02:59:59Z", tipo, "2026-11-17T02:59:59Z"]);
        expect(recorte.texto).toMatch(/"fechaVigencia" IS NULL OR "fechaVigencia" > \?::timestamptz/);
    });

    it("desactiva la configuración sin actualizar ninguna fecha existente", async () => {
        await guardarConfiguraciones(configuracionPublicaciones("", false));

        expect(mocks.update).toHaveBeenCalledTimes(4);
        expect(mocks.update).toHaveBeenCalledWith({ valorConfiguracion: "false" });
        expect(planesEjecutados()).toHaveLength(1);
        expect(planesEjecutados()[0].texto).toContain("pg_advisory_xact_lock(");
        expect(planesEjecutados().some((plan) => /^UPDATE /i.test(plan.texto))).toBe(false);
    });

    it("no modifica publicaciones al guardar otra configuración", async () => {
        await guardarConfiguraciones({
            aging_fotos_habilitado: "true",
            vigencia_fotos: "30",
            aviso_vencimiento_fotos_habilitado: "false",
            anticipacion_aviso_fotos: "",
        });

        expect(mocks.update).toHaveBeenCalledTimes(4);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("no escribe configuraciones si no puede obtener el bloqueo", async () => {
        mocks.execute.mockRejectedValueOnce(new Error("No se pudo bloquear la configuración"));

        await expect(guardarConfiguraciones(configuracionPublicaciones())).rejects.toThrow("No se pudo bloquear la configuración");
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it("no recorta fechas si falla el guardado de las opciones", async () => {
        mocks.update.mockResolvedValueOnce({ nombreConfiguracion: "primera" }).mockRejectedValueOnce(new Error("No se pudo guardar"));

        await expect(guardarConfiguraciones(configuracionPublicaciones())).rejects.toThrow("No se pudo guardar");
        expect(mocks.update).toHaveBeenCalledTimes(2);
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it("propaga el fallo del recorte para impedir confirmar el guardado de la configuración", async () => {
        const ejecutarTransaccion = mocks.transaction.getMockImplementation()!;
        let confirmada = false;
        mocks.transaction.mockImplementation(async (...argumentos) => {
            await ejecutarTransaccion(...argumentos);
            confirmada = true;
        });
        mocks.execute.mockResolvedValueOnce(0).mockRejectedValueOnce(new Error("No se pudieron actualizar las fechas"));

        await expect(guardarConfiguraciones(configuracionPublicaciones())).rejects.toThrow("No se pudieron actualizar las fechas");
        expect(mocks.update).toHaveBeenCalledTimes(4);
        expect(confirmada).toBe(false);
    });

    it("propaga el error de un plazo que desborda el rango de fechas sin ejecutar el recorte", async () => {
        await expect(guardarConfiguraciones(configuracionPublicaciones("9007199254740991"))).rejects.toThrow();

        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledTimes(4);
        expect(mocks.execute).toHaveBeenCalledOnce();
    });
});

describe("independencia de la vigencia de publicaciones por rol", () => {
    const operador = {
        vigencia_publicaciones_operador_habilitada: "true",
        vigencia_publicaciones_operador: "30",
        aviso_vencimiento_publicaciones_operador_habilitado: "true",
        anticipacion_aviso_publicaciones_operador: "7",
    };
    const productor = {
        vigencia_publicaciones_productor_habilitada: "true",
        vigencia_publicaciones_productor: "10",
        aviso_vencimiento_publicaciones_productor_habilitado: "true",
        anticipacion_aviso_publicaciones_productor: "2",
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-07T02:00:00Z"));
    });

    it("guarda ambos plazos con un único bloqueo y recorta cada rol con su fecha", async () => {
        await guardarConfiguraciones({ ...operador, ...productor });

        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledTimes(8);
        const planes = mocks.execute.mock.calls.map(([plan]) => plan as PlanSql);
        expect(planes.filter((plan) => plan.texto.includes("pg_advisory_xact_lock("))).toHaveLength(1);
        const recortes = planes.filter((plan) => plan.texto.startsWith("UPDATE publicacion"));
        expect(recortes).toHaveLength(2);
        expect(recortes.find((plan) => plan.valores[1] === "OPERADOR")?.valores.map(String))
            .toEqual(["2026-12-07T02:59:59Z", "OPERADOR", "2026-12-07T02:59:59Z"]);
        expect(recortes.find((plan) => plan.valores[1] === "PRODUCTOR")?.valores.map(String))
            .toEqual(["2026-11-17T02:59:59Z", "PRODUCTOR", "2026-11-17T02:59:59Z"]);
    });

    it("valida el aviso contra el plazo de su propio rol", async () => {
        await expect(guardarConfiguraciones({ ...operador, ...productor, anticipacion_aviso_publicaciones_productor: "15" }))
            .rejects.toThrow("La anticipación debe ser menor que la vigencia.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza un grupo parcial aunque el otro esté completo", async () => {
        await expect(guardarConfiguraciones({ ...productor, vigencia_publicaciones_operador: "30" }))
            .rejects.toThrow("Las cuatro opciones de vigencia deben guardarse juntas.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("desactivar operadores no impide aplicar el plazo de productores", async () => {
        await guardarConfiguraciones({ ...operador, ...productor, vigencia_publicaciones_operador_habilitada: "false" });

        const recortes = mocks.execute.mock.calls.map(([plan]) => plan as PlanSql)
            .filter((plan) => plan.texto.startsWith("UPDATE publicacion"));
        expect(recortes).toHaveLength(1);
        expect(recortes[0].valores[1]).toBe("PRODUCTOR");
    });
});

describe("persistencia de configuraciones", () => {
    it("valida todos los cambios antes de comenzar a escribir", async () => {
        await expect(guardarConfiguraciones({ incremento_precio: "10", restablecimiento_contrasena_habilitado: "incorrecto" })).rejects.toThrow();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("informa si una configuración no existe en la base", async () => {
        mocks.update.mockResolvedValue(null);
        await expect(guardarConfiguraciones({ incremento_precio: "10" })).rejects.toThrow("No existe la configuración incremento_precio.");
    });

    it("propaga el error si falla una actualización", async () => {
        mocks.update.mockRejectedValue(new Error("Error de base de datos"));
        await expect(guardarConfiguraciones({ incremento_precio: "10" })).rejects.toThrow("Error de base de datos");
    });

    it("detiene las actualizaciones si una operación falla", async () => {
        mocks.update.mockResolvedValueOnce({ nombreConfiguracion: "primera" }).mockRejectedValueOnce(new Error("Error al actualizar"));
        await expect(guardarConfiguraciones(ordenamiento())).rejects.toThrow("Error al actualizar");
        expect(mocks.update).toHaveBeenCalledTimes(2);
    });
});
