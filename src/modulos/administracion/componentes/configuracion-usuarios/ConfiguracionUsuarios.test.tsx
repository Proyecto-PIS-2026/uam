import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConfiguracionUsuarios from "./ConfiguracionUsuarios";
import ModificarUsuario from "./componentes/ModificarUsuario";
import type consultarDatosModificarUsuarios from "./acciones/ConsultaUsuarios";

vi.mock("./componentes/ModificarUsuario", () => ({
    default: vi.fn(() => (
        <div data-testid="modificar-usuario">
            ModificarUsuario
        </div>
    )),
}));

describe("ConfiguracionUsuarios", () => {
    beforeEach(() => {vi.clearAllMocks()});

    it("renderiza ModificarUsuario con los datos recibidos", () => {
        const datos = {} as Awaited<ReturnType<typeof consultarDatosModificarUsuarios>>;
        render(<ConfiguracionUsuarios datos={datos} />);
        expect(vi.mocked(ModificarUsuario)).toHaveBeenCalled();
        expect(vi.mocked(ModificarUsuario).mock.calls[0][0]).toEqual({datos});
        expect(screen.getByTestId("modificar-usuario")).toBeInTheDocument();
    });
});