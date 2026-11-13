import { beforeEach, describe, expect, it, vi } from "vitest";
import ContenedorConfiguracionGenerales from "./ContenedorConfiguracionGenerales";

const mocks = vi.hoisted(() => ({
    obtenerConfiguraciones: vi.fn(),
    obtenerEspecies: vi.fn(),
}));

vi.mock("@/modulos/administracion/acciones/consultas-configuracion", () => ({
    default: mocks.obtenerConfiguraciones,
}));

vi.mock("@/modulos/administracion/acciones/consultas-especies", () => ({
    default: mocks.obtenerEspecies,
}));

vi.mock("../listado-configuracion-general/ListadoConfiguracionesGenerales", () => ({
    default: () => null,
}));

const clavesEsperadas = [
    "url_lista_inteligente",
    "incremento_precio",
    "ordenamiento_habilitado",
    "orden_landing_page_default",
    "orden_mercado_virtual_default",
    "orden_mercado_produccion_default",
    "aging_fotos_habilitado",
    "vigencia_fotos",
    "aviso_vencimiento_fotos_habilitado",
    "anticipacion_aviso_fotos",
    "aging_fotos_productor_habilitado",
    "vigencia_fotos_productor",
    "aviso_vencimiento_fotos_productor_habilitado",
    "anticipacion_aviso_fotos_productor",
    "vigencia_publicaciones_operador_habilitada",
    "vigencia_publicaciones_operador",
    "aviso_vencimiento_publicaciones_operador_habilitado",
    "anticipacion_aviso_publicaciones_operador",
    "vigencia_publicaciones_productor_habilitada",
    "vigencia_publicaciones_productor",
    "aviso_vencimiento_publicaciones_productor_habilitado",
    "anticipacion_aviso_publicaciones_productor",
    "restablecimiento_contrasena_habilitado",
];

beforeEach(() => {
    vi.resetAllMocks();
    mocks.obtenerConfiguraciones.mockResolvedValue([]);
    mocks.obtenerEspecies.mockResolvedValue([]);
});

describe("ContenedorConfiguracionGenerales", () => {
    it("solicita las configuraciones necesarias para el panel", async () => {
        await ContenedorConfiguracionGenerales();

        expect(mocks.obtenerConfiguraciones).toHaveBeenCalledOnce();
        const claves = mocks.obtenerConfiguraciones.mock.calls[0][0] as string[];
        expect([...claves].sort()).toEqual([...clavesEsperadas].sort());
    });

    it("consulta las especies disponibles", async () => {
        await ContenedorConfiguracionGenerales();

        expect(mocks.obtenerEspecies).toHaveBeenCalledExactlyOnceWith();
    });

    it("transforma las filas de configuración en las propiedades del listado", async () => {
        mocks.obtenerConfiguraciones.mockResolvedValue([
            { nombreConfiguracion: "url_lista_inteligente", valorConfiguracion: "https://uam.com.uy/lista.pdf" },
            { nombreConfiguracion: "incremento_precio", valorConfiguracion: "25" },
            { nombreConfiguracion: "restablecimiento_contrasena_habilitado", valorConfiguracion: "true" },
        ]);

        const resultado = await ContenedorConfiguracionGenerales();

        expect(resultado.props.configuracion).toEqual({
            url_lista_inteligente: "https://uam.com.uy/lista.pdf",
            incremento_precio: "25",
            restablecimiento_contrasena_habilitado: "true",
        });
    });

    it("pasa las especies al listado conservando sus fotos", async () => {
        const especies = [
            { id: 1, nombreEspecie: "Acelga", fotoEspecie: "/acelga.webp" },
            { id: 2, nombreEspecie: "Ají", fotoEspecie: null },
        ];
        mocks.obtenerEspecies.mockResolvedValue(especies);

        const resultado = await ContenedorConfiguracionGenerales();

        expect(resultado.props.especies).toEqual(especies);
    });

    it("permite configuraciones vacías y una lista de especies vacía", async () => {
        const resultado = await ContenedorConfiguracionGenerales();

        expect(resultado.props.configuracion).toEqual({});
        expect(resultado.props.especies).toEqual([]);
    });

    it("conserva valores vacíos de configuraciones desactivadas", async () => {
        mocks.obtenerConfiguraciones.mockResolvedValue([
            { nombreConfiguracion: "aging_fotos_habilitado", valorConfiguracion: "false" },
            { nombreConfiguracion: "vigencia_fotos", valorConfiguracion: "" },
            { nombreConfiguracion: "anticipacion_aviso_fotos", valorConfiguracion: "" },
        ]);

        const resultado = await ContenedorConfiguracionGenerales();

        expect(resultado.props.configuracion).toEqual({
            aging_fotos_habilitado: "false",
            vigencia_fotos: "",
            anticipacion_aviso_fotos: "",
        });
    });

    it("inicia ambas consultas sin esperar a que termine la primera", async () => {
        let resolverConfiguraciones!: (filas: []) => void;
        mocks.obtenerConfiguraciones.mockImplementation(() => new Promise<[]>((resolve) => { resolverConfiguraciones = resolve }));

        const pendiente = ContenedorConfiguracionGenerales();

        expect(mocks.obtenerConfiguraciones).toHaveBeenCalledOnce();
        expect(mocks.obtenerEspecies).toHaveBeenCalledOnce();

        resolverConfiguraciones([]);
        await pendiente;
    });

    it("propaga un error al consultar las configuraciones", async () => {
        const error = new Error("Error al consultar configuraciones");
        mocks.obtenerConfiguraciones.mockRejectedValue(error);

        await expect(ContenedorConfiguracionGenerales()).rejects.toBe(error);
    });

    it("propaga un error al consultar las especies", async () => {
        const error = new Error("Error al consultar especies");
        mocks.obtenerEspecies.mockRejectedValue(error);

        await expect(ContenedorConfiguracionGenerales()).rejects.toBe(error);
    });
});
