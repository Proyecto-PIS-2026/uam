import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfiguracionUsuarios from "./ConfiguracionUsuarios";
import ModificarUsuario from "./componentes/ModificarUsuario";
import consultarDatosModificarUsuarios from "./acciones/ConsultaUsuarios";

vi.mock("./componentes/ModificarUsuario", () => ({
    default: vi.fn(() => (
        <div data-testid="modificar-usuario">
            ModificarUsuario
        </div>
    )),
}));

vi.mock("./acciones/ConsultaUsuarios", () => ({
    default: vi.fn(),
}));

describe("ConfiguracionUsuarios", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("consulta los datos y renderiza ModificarUsuario con ellos", async () => {
        const datos = {} as Awaited<
            ReturnType<typeof consultarDatosModificarUsuarios>
        >;

        vi.mocked(consultarDatosModificarUsuarios).mockResolvedValue(datos);

        const componente = await ConfiguracionUsuarios();

        render(componente);

        expect(consultarDatosModificarUsuarios).toHaveBeenCalledTimes(1);
        expect(vi.mocked(ModificarUsuario).mock.calls[0][0]).toEqual({ datos });
        expect(screen.getByTestId("modificar-usuario")).toBeInTheDocument();
    });
});