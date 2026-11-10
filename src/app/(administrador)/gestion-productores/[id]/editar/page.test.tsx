import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const mocks = vi.hoisted(() => ({
    requerirAdministrador: vi.fn(),
    obtenerProductorParaModificar: vi.fn(),
    notFound: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirAdministrador: mocks.requerirAdministrador,
}));

vi.mock(
    "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/obtenerProductorParaModificar",
    () => ({
        obtenerProductorParaModificar: mocks.obtenerProductorParaModificar,
    }),
);

// Formulario falso: solo muestra lo que recibió, para comprobar que la página se lo pasa bien.
// El formulario real tiene sus propias pruebas.
vi.mock(
    "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor",
    () => ({
        default: ({ productor }: { productor: { nombre: string } }) => (
            <div data-testid="formulario">
                <span>{productor.nombre}</span>
            </div>
        ),
    }),
);

vi.mock("next/navigation", () => ({
    notFound: mocks.notFound,
}));

const productor = {
    id: 2,
    nombre: "Granja Los Álamos",
    codigoPais: "+598",
    telefono: "99200002",
};

// Arma los parámetros de la URL como los entrega Next
function parametros(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("página de modificación de un productor", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requerirAdministrador.mockResolvedValue(undefined);
        mocks.obtenerProductorParaModificar.mockResolvedValue(productor);

        mocks.notFound.mockImplementation(() => {
            throw new Error("NO_ENCONTRADO");
        });
    });

    it("no consulta al productor sin autorización administrativa", async () => {
        mocks.requerirAdministrador.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

        await expect(Page(parametros("2"))).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.obtenerProductorParaModificar).not.toHaveBeenCalled();
    });

    // El id llega como texto en la URL y la página lo convierte a número para consultar
    it("consulta el productor indicado en la URL", async () => {
        await Page(parametros("2"));

        expect(mocks.obtenerProductorParaModificar).toHaveBeenCalledWith(2);
    });

    it("muestra el formulario con los datos del productor", async () => {
        render(await Page(parametros("2")));

        const formulario = screen.getByTestId("formulario");
        expect(formulario.textContent).toContain("Granja Los Álamos");
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    // Si no hay un productor con ese id, la página responde "no encontrado"
    it("responde no encontrado si el productor no existe", async () => {
        mocks.obtenerProductorParaModificar.mockResolvedValue(null);

        await expect(Page(parametros("2"))).rejects.toThrow("NO_ENCONTRADO");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });
});