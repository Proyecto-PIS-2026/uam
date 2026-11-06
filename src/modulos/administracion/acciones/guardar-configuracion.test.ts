import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarConfiguraciones } from "./guardar-configuracion";

const mocks = vi.hoisted(() => ({
    exigirAdministrador: vi.fn(),
    transaction: vi.fn(),
    where: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({ controlarSesionEnAccion: (control: () => Promise<unknown>) => control() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    exigirAdministrador: mocks.exigirAdministrador,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { transaction: mocks.transaction },
}));

const gruposVigencia = [
    {
        nombre: "fotos",
        habilitado: "aging_fotos_habilitado",
        vigencia: "vigencia_fotos",
        avisos: "aviso_vencimiento_fotos_habilitado",
        anticipacion: "anticipacion_aviso_fotos",
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

    const tx = { orm: { public: { Configuracion: consulta } } };
    mocks.transaction.mockImplementation(async (operacion: (cliente: typeof tx) => Promise<void>) => {
        await operacion(tx);
    });
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

    if (grupo.nombre === "fotos") {
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
