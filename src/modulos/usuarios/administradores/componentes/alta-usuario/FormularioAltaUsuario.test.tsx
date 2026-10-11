import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormularioAltaUsuario from "./FormularioAltaUsuario";
import { altaOperador } from "@/modulos/usuarios/operadores/altaOperador";

vi.mock("next/navigation", () => ({
    useSearchParams: vi.fn(),
}));

vi.mock("@/modulos/usuarios/operadores/altaOperador", () => ({
    altaOperador: vi.fn(),
}));

vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: ({ titulo, subtitulo }: { titulo: string; subtitulo: string }) => (
        <div>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
        </div>
    ),
}));

import { useSearchParams } from "next/navigation";

const naves = [
    { id: 1, nombre: "Nave Central" },
    { id: 2, nombre: "Nave Norte" },
];

function configurarSearchParams(rol: string | null = null) {
    vi.mocked(useSearchParams).mockReturnValue({
        get: (parametro: string) => {
            if (parametro === "rol") {
                return rol;
            }
            return null;
        },
    } as ReturnType<typeof useSearchParams>);
}

function completarFormulario() {
    fireEvent.change(screen.getByLabelText("Nombre de Usuario*"), {
        target: { value: "usuario1" },
    });

    fireEvent.change(screen.getByLabelText("Contraseña*"), {
        target: { value: "clave12345" },
    });

    fireEvent.change(screen.getByLabelText("Confirmación de Contraseña*"), {
        target: { value: "clave12345" },
    });

    fireEvent.change(screen.getByLabelText("Nombre*"), {
        target: { value: "Huerta Sur" },
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: 99123456"), {
        target: { value: "99123456" },
    });

    fireEvent.change(screen.getByPlaceholderText("Número de local"), {
        target: { value: "101" },
    });

    fireEvent.change(screen.getAllByRole("combobox")[2], {
        target: { value: "1" },
    });
}

describe("FormularioAltaUsuario", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        configurarSearchParams();
    });

    it("muestra el formulario de alta de usuario", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        expect(
            screen.getByRole("heading", { name: "Alta de usuario" }),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Registrar un nuevo usuario en la plataforma"),
        ).toBeInTheDocument();

        expect(screen.getByLabelText("Rol del usuario*")).toBeInTheDocument();
        expect(screen.getByLabelText("Nombre de Usuario*")).toBeInTheDocument();
        expect(screen.getByLabelText("Contraseña*")).toBeInTheDocument();
        expect(
            screen.getByLabelText("Confirmación de Contraseña*"),
        ).toBeInTheDocument();

        expect(screen.queryByLabelText("Nombre*")).not.toBeInTheDocument();
        expect(
            screen.queryByPlaceholderText("Ej: 99123456"),
        ).not.toBeInTheDocument();
    });

    it("selecciona el rol operador y muestra sus campos", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        expect(screen.getByLabelText("Nombre*")).toBeInTheDocument();
        expect(
            screen.getByLabelText("Código de país"),
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Ej: 99123456"),
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Número de local"),
        ).toBeInTheDocument();

        expect(screen.getByText("Seleccionar nave")).toBeInTheDocument();

        expect(screen.getByText("Nave Central")).toBeInTheDocument();
        expect(screen.getByText("Nave Norte")).toBeInTheDocument();
    });

    it("selecciona operador automáticamente cuando el rol viene en la URL", () => {
        configurarSearchParams("operador");

        render(<FormularioAltaUsuario naves={naves} />);

        expect(screen.getByLabelText("Rol del usuario*")).toHaveValue("operador");
        expect(screen.getByLabelText("Nombre*")).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText("Número de local"),
        ).toBeInTheDocument();
    });

    it("permite cambiar el código de país", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        const codigoPais = screen.getByLabelText("Código de país");

        expect(codigoPais).toHaveValue("+598");

        fireEvent.change(codigoPais, {
            target: { value: "+54" },
        });

        expect(codigoPais).toHaveValue("+54");
    });

    it("permite seleccionar una nave", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        const selects = screen.getAllByRole("combobox");

        const nave = selects[2];

        fireEvent.change(nave, {
            target: { value: "2" },
        });

        expect(nave).toHaveValue("2");
    });

    it("permite agregar un segundo local", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        expect(
            screen.getAllByPlaceholderText("Número de local"),
        ).toHaveLength(1);

        fireEvent.click(screen.getByRole("button", { name: "+ Agregar local" }));

        expect(
            screen.getAllByPlaceholderText("Número de local"),
        ).toHaveLength(2);

        expect(screen.getByText("Local 2")).toBeInTheDocument();
    });

    it("no permite eliminar el primer local", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        const botonesEliminar = screen.getAllByRole("button", {
            name: "Eliminar local",
        });

        expect(botonesEliminar).toHaveLength(1);
        expect(botonesEliminar[0]).toBeDisabled();
    });

    it("permite eliminar un local adicional", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        fireEvent.click(screen.getByRole("button", { name: "+ Agregar local" }));

        expect(
            screen.getAllByPlaceholderText("Número de local"),
        ).toHaveLength(2);

        const botonesEliminar = screen.getAllByRole("button", {
            name: "Eliminar local",
        });

        expect(botonesEliminar).toHaveLength(2);
        expect(botonesEliminar[0]).toBeDisabled();
        expect(botonesEliminar[1]).not.toBeDisabled();

        fireEvent.click(botonesEliminar[1]);

        expect(
            screen.getAllByPlaceholderText("Número de local"),
        ).toHaveLength(1);
    });

    it("permite agregar y eliminar la fecha de fin de contrato", () => {
        configurarSearchParams("operador");

        const { container } = render(<FormularioAltaUsuario naves={naves} />);

        expect(
            screen.getByRole("button", { name: "+ Agregar fin de contrato" })
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "+ Agregar fin de contrato" })
        );

        const fecha = container.querySelector('input[type="date"]');

        expect(fecha).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Eliminar fecha" })
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "Eliminar fecha" })
        );

        expect(
            container.querySelector('input[type="date"]')
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "+ Agregar fin de contrato" })
        ).toBeInTheDocument();
    });

    it("limpia los datos del formulario", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        fireEvent.change(screen.getByLabelText("Nombre de Usuario*"), {
            target: { value: "usuario1" },
        });

        fireEvent.change(screen.getByLabelText("Contraseña*"), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText("Confirmación de Contraseña*"), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText("Nombre*"), {
            target: { value: "Huerta Sur" },
        });

        fireEvent.change(screen.getByPlaceholderText("Ej: 99123456"), {
            target: { value: "99123456" },
        });

        fireEvent.click(screen.getByRole("button", { name: "+ Agregar local" }));

        fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

        expect(screen.getByLabelText("Nombre de Usuario*")).toHaveValue("");
        expect(screen.getByLabelText("Contraseña*")).toHaveValue("");
        expect(
            screen.getByLabelText("Confirmación de Contraseña*"),
        ).toHaveValue("");

        expect(screen.getByLabelText("Nombre*")).toHaveValue("");
        expect(
            screen.getByPlaceholderText("Ej: 99123456"),
        ).toHaveValue("");

        expect(screen.getByLabelText("Código de país")).toHaveValue("+598");

        expect(
            screen.getAllByPlaceholderText("Número de local"),
        ).toHaveLength(1);
    });

    it("muestra error cuando se selecciona un rol todavía no disponible", async () => {
        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "productor" },
        });

        fireEvent.change(screen.getByLabelText("Nombre de Usuario*"), {
            target: { value: "usuario1" },
        });

        fireEvent.change(screen.getByLabelText("Contraseña*"), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText("Confirmación de Contraseña*"), {
            target: { value: "clave12345" },
        });

        fireEvent.click(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        expect(
            await screen.findByText(
                "Esta alta todavía no está disponible para el rol seleccionado.",
            ),
        ).toBeInTheDocument();

        expect(altaOperador).not.toHaveBeenCalled();
    });

    it("envía correctamente el alta de un operador", async () => {
        vi.mocked(altaOperador).mockResolvedValue({
            esValido: true,
            id: 25,
            mensaje: "Operador creado correctamente.",
        });

        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        completarFormulario();

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        await waitFor(() => {
            expect(altaOperador).toHaveBeenCalledTimes(1);
        });

        expect(altaOperador).toHaveBeenCalledWith({
            rol: "operador",
            nombreUsuario: "usuario1",
            contraseña: "clave12345",
            confirmacionContraseña: "clave12345",
            nombre: "Huerta Sur",
            codigoPais: "+598",
            telefono: "99123456",
            locales: [
                {
                    numeroLocal: "101",
                    naveId: 1,
                    contrato: "",
                },
            ],
        });

        expect(
            await screen.findByRole("status"),
        ).toHaveTextContent("Operador creado correctamente.");

        expect(
            screen.getByText("Operador creado satisfactoriamente"),
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "¿Desea precargar productos para este operador?",
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", { name: "Precargar productos" }),
        ).toHaveAttribute("href", "/precargar-productos");
    });

    it("limpia el formulario después de un alta exitosa", async () => {
        vi.mocked(altaOperador).mockResolvedValue({
            esValido: true,
            id: 25,
            mensaje: "Operador creado correctamente.",
        });

        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        completarFormulario();

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        await waitFor(() => {
            expect(altaOperador).toHaveBeenCalled();
        });

        expect(screen.getByLabelText("Nombre de Usuario*")).toHaveValue("");
        expect(screen.getByLabelText("Contraseña*")).toHaveValue("");
        expect(
            screen.getByLabelText("Confirmación de Contraseña*"),
        ).toHaveValue("");
        expect(screen.getByLabelText("Nombre*")).toHaveValue("");
        expect(
            screen.getByPlaceholderText("Ej: 99123456"),
        ).toHaveValue("");

        expect(
            screen.getAllByPlaceholderText("Número de local"),
        ).toHaveLength(1);
    });

    it("muestra los errores devueltos por altaOperador", async () => {
        vi.mocked(altaOperador).mockResolvedValue({
            esValido: false,
            errores: [
                "Ya existe un usuario con ese nombre de usuario.",
                "El local 101 ya existe en la nave seleccionada.",
            ],
        });

        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        completarFormulario();

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        expect(
            await screen.findByText(
                "Ya existe un usuario con ese nombre de usuario.",
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "El local 101 ya existe en la nave seleccionada.",
            ),
        ).toBeInTheDocument();

        expect(
            screen.queryByText("Operador creado satisfactoriamente"),
        ).not.toBeInTheDocument();
    });

    it("cierra el popup al seleccionar Ahora no", async () => {
        vi.mocked(altaOperador).mockResolvedValue({
            esValido: true,
            id: 25,
            mensaje: "Operador creado correctamente.",
        });

        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        completarFormulario();

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        expect(
            await screen.findByText("Operador creado satisfactoriamente"),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "Ahora no" }),
        );

        expect(
            screen.queryByText("Operador creado satisfactoriamente"),
        ).not.toBeInTheDocument();
    });

    it("muestra Registrando mientras el alta está en proceso", async () => {
        let resolver: (
            resultado: {
                esValido: true;
                id: number;
                mensaje: string;
            },
        ) => void;

        vi.mocked(altaOperador).mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }),
        );

        render(<FormularioAltaUsuario naves={naves} />);

        fireEvent.change(screen.getByLabelText("Rol del usuario*"), {
            target: { value: "operador" },
        });

        completarFormulario();

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        expect(
            await screen.findByRole("button", { name: "Registrando..." }),
        ).toBeDisabled();

        resolver!({
            esValido: true,
            id: 25,
            mensaje: "Operador creado correctamente.",
        });

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Registrar usuario" }),
            ).not.toBeDisabled();
        });
    });
});
