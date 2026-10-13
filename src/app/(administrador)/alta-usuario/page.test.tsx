import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import FormularioAltaUsuario from "@/modulos/usuarios/administradores/componentes/alta-usuario/FormularioAltaUsuario";

const mockObtenerNaves = vi.hoisted(() => vi.fn());
const mockRequerirAdministrador = vi.hoisted(() => vi.fn());

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
	requerirAdministrador: mockRequerirAdministrador,
}));

vi.mock(
	"@/modulos/usuarios/operadores/consultas-naves",
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
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequerirAdministrador.mockResolvedValue(undefined);
	});

	it("no consulta naves si el acceso administrativo fue rechazado", async () => {
		mockRequerirAdministrador.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

		await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
		expect(mockObtenerNaves).not.toHaveBeenCalled();
	});

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