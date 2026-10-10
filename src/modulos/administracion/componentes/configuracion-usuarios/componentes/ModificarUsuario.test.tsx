import { fireEvent, render, screen } from "@testing-library/react";
import type { DatosModificarUsuarios, TipoUsuario, UsuarioParaModificar } from "../Tipos";
import ModificarUsuario from "./ModificarUsuario";

interface BuscadorMockProps {
    busqueda: string;
    tipoUsuario: TipoUsuario | "TODOS";
    onBusquedaChange: (busqueda: string) => void;
    onTipoUsuarioChange: (tipo: TipoUsuario | "TODOS") => void;
}

interface ListaMockProps {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    onSeleccionar: (usuario: UsuarioParaModificar) => void;
}

vi.mock("./BuscadorUsuario", () => ({
    default: ({
        busqueda,
        tipoUsuario,
        onBusquedaChange,
        onTipoUsuarioChange,
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
                    onTipoUsuarioChange(event.target.value as TipoUsuario | "TODOS")
                }
            >
                <option value="TODOS">Todos</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="OPERADOR">Operador</option>
                <option value="PRODUCTOR">Productor</option>
            </select>
        </div>
    ),
}));

vi.mock("./ListaUsuarios", () => ({
    default: ({
        usuarios,
        usuarioSeleccionadoId,
        onSeleccionar,
    }: ListaMockProps) => (
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
    ),
}));

const usuarios: UsuarioParaModificar[] = [
    {
        id: 1,
        username: "ana.admin",
        rol: "ADMINISTRADOR",
        administradorId: 101,
        email: "ana@example.com",
    },
    {
        id: 2,
        username: "beto.operador",
        rol: "OPERADOR",
        operadorId: 201,
        nombreFantasia: "La Huerta",
    },
    {
        id: 3,
        username: "carla.productor",
        rol: "PRODUCTOR",
        productorId: 301,
    },
];

const datos: DatosModificarUsuarios = {
    usuarios,
};

describe("ModificarUsuario", () => {
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
            "/alta-usuario?rol=operador",
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
        expect(enlaceAlta).toHaveAttribute("href", "/alta-usuario?rol=operador");
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
});