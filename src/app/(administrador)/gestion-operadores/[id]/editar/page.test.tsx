import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const mocks = vi.hoisted(() => ({
    obtenerOperadorParaModificar: vi.fn(),
    obtenerNaves: vi.fn(),
    notFound: vi.fn(),
}));

vi.mock(
    "@/modulos/usuarios/operadores/componentes/modificar-operador-por-admin/obtenerOperadorParaModificar",
    () => ({
        obtenerOperadorParaModificar: mocks.obtenerOperadorParaModificar,
    }),
);

vi.mock(
    "@/modulos/usuarios/operadores/componentes/modificar-operador-por-admin/obtenerNaves",
    () => ({
        obtenerNaves: mocks.obtenerNaves,
    }),
);

// Formulario falso: solo muestra lo que recibió, para comprobar que la página se lo pasa bien.
// El formulario real tiene sus propias pruebas.
vi.mock(
    "@/modulos/usuarios/operadores/componentes/modificar-operador-por-admin/FormularioModificarOperador",
    () => ({
        default: ({
            operador,
            naves,
        }: {
            operador: { nombre: string };
            naves: { nombre: string }[];
        }) => (
            <div data-testid="formulario">
                <span>{operador.nombre}</span>
                <span>{naves.map((nave) => nave.nombre).join(", ")}</span>
            </div>
        ),
    }),
);

vi.mock("next/navigation", () => ({
    notFound: mocks.notFound,
}));

const operador = {
    id: 13,
    nombre: "Frutas del Norte",
    codigoPais: "+598",
    telefono: "99100001",
    locales: [{ nombre: "18", naveId: 2, contrato: "" }],
};

const naves = [
    { id: 1, nombre: "A" },
    { id: 2, nombre: "B" },
];

// Arma los parámetros de la URL como los entrega Next
function parametros(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("página de modificación de un operador", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerOperadorParaModificar.mockResolvedValue(operador);
        mocks.obtenerNaves.mockResolvedValue(naves);

        mocks.notFound.mockImplementation(() => {
            throw new Error("NO_ENCONTRADO");
        });
    });

    // El id llega como texto en la URL y la página lo convierte a número para consultar
    it("consulta el operador indicado en la URL", async () => {
        await Page(parametros("13"));

        expect(mocks.obtenerOperadorParaModificar).toHaveBeenCalledWith(13);
        expect(mocks.obtenerNaves).toHaveBeenCalledOnce();
    });

    it("muestra el formulario con los datos del operador y las naves", async () => {
        render(await Page(parametros("13")));

        const formulario = screen.getByTestId("formulario");
        expect(formulario.textContent).toContain("Frutas del Norte");
        expect(formulario.textContent).toContain("A, B");
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    // Si no hay un operador con ese id, la página responde "no encontrado"
    it("responde no encontrado si el operador no existe", async () => {
        mocks.obtenerOperadorParaModificar.mockResolvedValue(null);

        await expect(Page(parametros("13"))).rejects.toThrow("NO_ENCONTRADO");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });
});