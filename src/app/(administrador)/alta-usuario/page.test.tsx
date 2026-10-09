import { describe, expect, it, vi } from "vitest";
import Page from "./page";
import FormularioAltaUsuario from "@/modulos/usuarios/administradores/componentes/alta-usuario/FormularioAltaUsuario";

const mockObtenerNaves = vi.hoisted(() => vi.fn());

vi.mock(
	"@/modulos/usuarios/administradores/componentes/alta-usuario/obtenerNaves",
	() => ({
		obtenerNaves: mockObtenerNaves,
	}),
);

vi.mock(
	"@/modulos/usuarios/administradores/componentes/alta-usuario/FormularioAltaUsuario",
	() => ({
		default: vi.fn(() => null),
	}),
);

describe("Page (alta de usuario)", () => {
	it("obtiene las naves y se las pasa al componente FormularioAltaUsuario", async () => {
		const navesMock = [
			{ id: 1, nombre: "Central" },
			{ id: 2, nombre: "Norte" },
		];

		mockObtenerNaves.mockResolvedValue(navesMock);

		const elemento = await Page();

		expect(mockObtenerNaves).toHaveBeenCalled();
		expect(elemento.type).toBe("main");

		const formulario = elemento.props.children.props.children;

		expect(formulario.type).toBe(FormularioAltaUsuario);
		expect(formulario.props).toEqual({
			naves: navesMock,
		});
	});

});

