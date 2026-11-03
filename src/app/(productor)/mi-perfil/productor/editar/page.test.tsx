import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Pagina from "./page";

const mocks = vi.hoisted(() => ({ requerirProductor: vi.fn(), consultar: vi.fn(), notFound: vi.fn(), propsFormulario: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ requerirProductor: mocks.requerirProductor }));
vi.mock("@/modulos/usuarios/productores/perfil-propio/consultas-mi-perfil-productor", () => ({ obtenerMiPerfilProductor: mocks.consultar }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor", () => ({
    default: (props: unknown) => { mocks.propsFormulario(props); return <div>Formulario propio</div> },
}));
const productor = { id: 5, nombre: "Granja Norte", codigoPais: "+598", telefono: "99123456", fotoPerfil: null };

describe("edición de mi perfil como Productor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.consultar.mockResolvedValue(productor);
        mocks.notFound.mockImplementation(() => { throw new Error("NO_ENCONTRADO") });
    });
    afterEach(cleanup);

    it("reutiliza el formulario con los datos actuales y modo de perfil propio", async () => {
        render(await Pagina());
        expect(mocks.propsFormulario).toHaveBeenCalledWith({ productor, perfilPropio: true });
    });

    it("impide consultar el perfil si se rechaza el acceso", async () => {
        mocks.requerirProductor.mockRejectedValue(new Error("NEXT_REDIRECT"));
        await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.consultar).not.toHaveBeenCalled();
    });

    it("devuelve no encontrado si ya no existe el perfil", async () => {
        mocks.consultar.mockResolvedValue(null);
        await expect(Pagina()).rejects.toThrow("NO_ENCONTRADO");
    });
});
