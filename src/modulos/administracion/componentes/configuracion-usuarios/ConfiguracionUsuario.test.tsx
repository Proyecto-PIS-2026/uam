import { render, screen } from "@testing-library/react";
import type { DatosModificarUsuarios } from "./Tipos";
import ConfiguracionUsuarios from "./ConfiguracionUsuarios";
import ModificarUsuario from "./componentes/ModificarUsuario";
import consultarDatosModificarUsuarios from "./acciones/ConsultaUsuarios";

vi.mock("./ModificarUsuario", () => ({
    default: vi.fn(() => (
        <div data-testid="modificar-usuario">
            ModificarUsuario
        </div>
    )),
}));

vi.mock("../acciones/ConsultaUsuarios", () => ({
    default: vi.fn(),
}));

describe("ConfiguracionUsuarios", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("consulta los datos y renderiza ModificarUsuario con ellos", async () => {
        const datos = {} as DatosModificarUsuarios;
        vi.mocked(consultarDatosModificarUsuarios).mockResolvedValue(datos);
        const componente = await ConfiguracionUsuarios();
        render(componente);
        expect(consultarDatosModificarUsuarios).toHaveBeenCalledTimes(1);
        expect(ModificarUsuario).toHaveBeenCalledWith({ datos });
        expect(screen.getByTestId("modificar-usuario")).toBeInTheDocument();
    });
});
