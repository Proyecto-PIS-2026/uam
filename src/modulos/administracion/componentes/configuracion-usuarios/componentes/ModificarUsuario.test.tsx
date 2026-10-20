import { act, fireEvent, render, screen } from "@testing-library/react";
import type { DatosModificarUsuarios, TipoUsuario, UsuarioParaModificar } from "../Tipos";
import type { FiltroRestablecimiento } from "./BuscadorUsuario";
import ModificarUsuario from "./ModificarUsuario";

const mocks = vi.hoisted(() => ({
    bajaOperador: vi.fn(),
    refresh: vi.fn(),
    lista: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/modulos/usuarios/operadores/bajaOperador", () => ({
    bajaOperador: mocks.bajaOperador,
}));

interface BuscadorMockProps {
    busqueda: string;
    tipoUsuario: TipoUsuario | "TODOS";
    onBusquedaChange: (busqueda: string) => void;
    onTipoUsuarioChange: (tipoUsuario: TipoUsuario | "TODOS") => void;
    restablecimiento: FiltroRestablecimiento;
    onRestablecimientoChange: (valor: FiltroRestablecimiento) => void;
}

interface ListaMockProps {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    onSeleccionar: (usuario: UsuarioParaModificar) => void;
    onEliminar: (usuario: UsuarioParaModificar) => Promise<void>;
}

vi.mock("./BuscadorUsuario", () => ({
    default: ({
        busqueda,
        tipoUsuario,
        onBusquedaChange,
        onTipoUsuarioChange,
        restablecimiento,
        onRestablecimientoChange,
    }: BuscadorMockProps) => (
        <div data-testid="buscador">
            <input
                aria-label="Buscar usuarios"
                value={busqueda}
                onChange={(event) => onBusquedaChange(event.target.value)}
            />

            <select
                aria-label="Tipo de usuario"
                value={tipoUsuario}
                onChange={(event) =>
                    onTipoUsuarioChange(
                        event.target.value as TipoUsuario | "TODOS",
                    )
                }
            >
                <option value="TODOS">Todos</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="OPERADOR">Operador</option>
                <option value="PRODUCTOR">Productor</option>
            </select>

            <select
                aria-label="Restablecimiento"
                value={restablecimiento}
                onChange={(event) =>
                    onRestablecimientoChange(
                        event.target.value as FiltroRestablecimiento,
                    )
                }
            >
                <option value="TODOS">Todos</option>
                <option value="SOLICITADO">Solicitado</option>
            </select>
        </div>
    ),
}));

vi.mock("./ListaUsuarios", () => ({
    default: (props: ListaMockProps) => {
        mocks.lista(props);
        const {
        usuarios,
        usuarioSeleccionadoId,
        onSeleccionar,
        } = props;
        return (
        <div data-testid="lista-usuarios">
            {usuarios.map((usuario) => (
                <button
                    key={usuario.id}
                    type="button"
                    onClick={() => onSeleccionar(usuario)}
                >
                    {usuario.username}
                </button>
            ))}
            <span data-testid="usuario-seleccionado">
                {usuarioSeleccionadoId ?? "ninguno"}
            </span>
        </div>
        );
    },
}));

const usuarios: UsuarioParaModificar[] = [
    {
        id: 1,
        username: "ana.admin",
        rol: "ADMINISTRADOR",
        administradorId: 101,
        email: "ana@example.com",
        solicitoRestablecimiento: false,
    },
    {
        id: 2,
        username: "beto.operador",
        rol: "OPERADOR",
        operadorId: 201,
        nombreFantasia: "La Huerta",
        solicitoRestablecimiento: true,
    },
    {
        id: 3,
        username: "carla.productor",
        rol: "PRODUCTOR",
        productorId: 301,
        solicitoRestablecimiento: false,
    },
];
const datos: DatosModificarUsuarios = {
    usuarios,
};

describe("ModificarUsuario", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.bajaOperador.mockResolvedValue({ esValido: true, mensaje: "Operador eliminado correctamente." });
    });

    it("conecta la baja real con el id del operador y recarga los datos después del éxito", async () => {
        render(<ModificarUsuario datos={datos} />);
        const props = mocks.lista.mock.lastCall?.[0] as ListaMockProps;

        await act(() => props.onEliminar(usuarios[1]));

        expect(mocks.bajaOperador).toHaveBeenCalledWith({ operadorId: 201 });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("propaga los errores de baja y conserva los datos para mostrar el error", async () => {
        mocks.bajaOperador.mockResolvedValue({ esValido: false, errores: ["El operador seleccionado ya no existe."] });
        render(<ModificarUsuario datos={datos} />);
        const props = mocks.lista.mock.lastCall?.[0] as ListaMockProps;

        await expect(props.onEliminar(usuarios[1])).rejects.toThrow("El operador seleccionado ya no existe.");
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("muestra todos los usuarios inicialmente y configura el enlace de alta", () => {
        render(<ModificarUsuario datos={datos} />);

        expect(screen.getByText("Gestión de Usuarios")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ana.admin" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "beto.operador" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "carla.productor" })).toBeInTheDocument();

        expect(screen.getByRole("textbox", { name: "Buscar usuarios" })).toHaveValue("");
        expect(screen.getByRole("combobox", { name: "Tipo de usuario" })).toHaveValue("TODOS");

        expect(screen.getByRole("link", { name: /Nuevo Usuario/ })).toHaveAttribute(
            "href",
            "/alta-usuario",
        );

        expect(screen.getByTestId("usuario-seleccionado")).toHaveTextContent("ninguno");
    });

    it("filtra por username, email, nombre de fantasía y descarta las coincidencias inexistentes", () => {
        render(<ModificarUsuario datos={datos} />);

        const buscador = screen.getByRole("textbox", { name: "Buscar usuarios" });

        fireEvent.change(buscador, {
            target: { value: "  CARLA.PRODUCTOR  " },
        });

        expect(screen.getByRole("button", { name: "carla.productor" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ana.admin" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "beto.operador" })).not.toBeInTheDocument();

        fireEvent.change(buscador, {
            target: { value: "ANA@EXAMPLE.COM" },
        });

        expect(screen.getByRole("button", { name: "ana.admin" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "beto.operador" })).not.toBeInTheDocument();

        fireEvent.change(buscador, {
            target: { value: "  LA HUERTA  " },
        });

        expect(screen.getByRole("button", { name: "beto.operador" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ana.admin" })).not.toBeInTheDocument();

        fireEvent.change(buscador, {
            target: { value: "BETO.OPERADOR" },
        });

        expect(screen.getByRole("button", { name: "beto.operador" })).toBeInTheDocument();

        fireEvent.change(buscador, {
            target: { value: "usuario-inexistente" },
        });

        expect(screen.queryByRole("button", { name: "ana.admin" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "beto.operador" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "carla.productor" })).not.toBeInTheDocument();
    });

    it("filtra por rol y actualiza el enlace de alta para cada selección", () => {
        render(<ModificarUsuario datos={datos} />);

        const selector = screen.getByRole("combobox", { name: "Tipo de usuario" });
        const enlaceAlta = screen.getByRole("link", { name: /Nuevo Usuario/ });

        fireEvent.change(selector, {
            target: { value: "ADMINISTRADOR" },
        });

        expect(screen.getByRole("button", { name: "ana.admin" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "beto.operador" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "carla.productor" })).not.toBeInTheDocument();
        expect(enlaceAlta).toHaveAttribute("href", "/alta-usuario?rol=administrador");

        fireEvent.change(selector, {
            target: { value: "OPERADOR" },
        });

        expect(screen.getByRole("button", { name: "beto.operador" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ana.admin" })).not.toBeInTheDocument();
        expect(enlaceAlta).toHaveAttribute("href", "/alta-usuario?rol=operador");

        fireEvent.change(selector, {
            target: { value: "PRODUCTOR" },
        });

        expect(screen.getByRole("button", { name: "carla.productor" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ana.admin" })).not.toBeInTheDocument();
        expect(enlaceAlta).toHaveAttribute("href", "/alta-usuario?rol=productor");

        fireEvent.change(selector, {
            target: { value: "TODOS" },
        });

        expect(screen.getByRole("button", { name: "ana.admin" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "beto.operador" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "carla.productor" })).toBeInTheDocument();
        expect(enlaceAlta).toHaveAttribute("href", "/alta-usuario");
    });

    it("limpia la búsqueda y la selección al cambiar el rol", () => {
        render(<ModificarUsuario datos={datos} />);

        const buscador = screen.getByRole("textbox", { name: "Buscar usuarios" });
        const selector = screen.getByRole("combobox", { name: "Tipo de usuario" });

        fireEvent.click(screen.getByRole("button", { name: "beto.operador" }));

        expect(screen.getByTestId("usuario-seleccionado")).toHaveTextContent("2");

        fireEvent.change(buscador, {
            target: { value: "beto" },
        });

        expect(screen.getByTestId("usuario-seleccionado")).toHaveTextContent("ninguno");
        expect(buscador).toHaveValue("beto");

        fireEvent.change(selector, {
            target: { value: "ADMINISTRADOR" },
        });

        expect(buscador).toHaveValue("");
        expect(screen.getByTestId("usuario-seleccionado")).toHaveTextContent("ninguno");

        fireEvent.change(selector, {
            target: { value: "OPERADOR" },
        });

        fireEvent.click(screen.getByRole("button", { name: "beto.operador" }));

        expect(screen.getByTestId("usuario-seleccionado")).toHaveTextContent("2");

        fireEvent.change(selector, {
            target: { value: "PRODUCTOR" },
        });

        expect(screen.getByTestId("usuario-seleccionado")).toHaveTextContent("ninguno");
        expect(buscador).toHaveValue("");
        expect(screen.getByRole("button", { name: "carla.productor" })).toBeInTheDocument();
    });

    
    it("filtra los usuarios que solicitaron restablecimiento y permite volver a mostrar todos", () => {
        render(<ModificarUsuario datos={datos} />);

        const selector = screen.getByRole("combobox", {
            name: "Restablecimiento",
        });

        fireEvent.change(selector, {
            target: { value: "SOLICITADO" },
        });

        expect(
            screen.getByRole("button", { name: "beto.operador" }),
        ).toBeInTheDocument();

        expect(
            screen.queryByRole("button", { name: "ana.admin" }),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole("button", { name: "carla.productor" }),
        ).not.toBeInTheDocument();

        fireEvent.change(selector, {
            target: { value: "TODOS" },
        });

        expect(
            screen.getByRole("button", { name: "ana.admin" }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "beto.operador" }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "carla.productor" }),
        ).toBeInTheDocument();
    });

    it("combina el filtro de restablecimiento con el filtro por rol", () => {
        render(<ModificarUsuario datos={datos} />);

        fireEvent.change(
            screen.getByRole("combobox", { name: "Restablecimiento" }),
            { target: { value: "SOLICITADO" } },
        );

        fireEvent.change(
            screen.getByRole("combobox", { name: "Tipo de usuario" }),
            { target: { value: "OPERADOR" } },
        );

        expect(
            screen.getByRole("button", { name: "beto.operador" }),
        ).toBeInTheDocument();

        expect(
            screen.queryByRole("button", { name: "ana.admin" }),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole("button", { name: "carla.productor" }),
        ).not.toBeInTheDocument();
    });

    it("limpia la selección al cambiar el filtro de restablecimiento", () => {
        render(<ModificarUsuario datos={datos} />);

        fireEvent.click(
            screen.getByRole("button", { name: "beto.operador" }),
        );

        expect(
            screen.getByTestId("usuario-seleccionado"),
        ).toHaveTextContent("2");

        fireEvent.change(
            screen.getByRole("combobox", { name: "Restablecimiento" }),
            { target: { value: "SOLICITADO" } },
        );

        expect(
            screen.getByTestId("usuario-seleccionado"),
        ).toHaveTextContent("ninguno");
    });

});