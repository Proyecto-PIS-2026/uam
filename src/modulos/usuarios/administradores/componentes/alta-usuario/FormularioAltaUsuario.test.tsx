import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormularioAltaUsuario from "./FormularioAltaUsuario";
import { altaOperador } from "@/modulos/usuarios/operadores/altaOperador";
import { altaProductor } from "@/modulos/usuarios/productores/altaProductor";
import { useSearchParams } from "next/navigation";

vi.mock("next/navigation", () => ({
    useSearchParams: vi.fn(),
}));

vi.mock("@/modulos/usuarios/operadores/altaOperador", () => ({
    altaOperador: vi.fn(),
}));

vi.mock("@/modulos/usuarios/productores/altaProductor", () => ({
    altaProductor: vi.fn(),
}));

vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: ({ titulo, subtitulo }: { titulo: string; subtitulo: string }) => (
        <div>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
        </div>
    ),
}));

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

function seleccionarOpcion(campo: string, opcion: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: new RegExp(`^${campo}`) }));
    fireEvent.click(screen.getByRole("option", { name: opcion }));
}

function completarFormulario() {
    fireEvent.change(screen.getByLabelText(/^Nombre de Usuario\s*\*$/), {
        target: { value: "usuario1" },
    });

    fireEvent.change(screen.getByLabelText(/^Contraseña\s*\*$/), {
        target: { value: "clave12345" },
    });

    fireEvent.change(screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/), {
        target: { value: "clave12345" },
    });

    fireEvent.change(screen.getByLabelText(/^Nombre\s*\*$/), {
        target: { value: "Huerta Sur" },
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: 99123456"), {
        target: { value: "99123456" },
    });

    fireEvent.change(screen.getByPlaceholderText("Número de local"), {
        target: { value: "101" },
    });

    seleccionarOpcion("Nave", "Nave Central");
}

describe("FormularioAltaUsuario", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        configurarSearchParams();
    });

    it("vuelve a la lista de usuarios", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        expect(screen.getByRole("link", { name: "Volver al panel administrativo" }))
            .toHaveAttribute("href", "/administracion#usuarios");
    });

    it("muestra el formulario de alta de usuario", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        expect(
            screen.getByRole("heading", { name: "Alta de usuario" }),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Registrar un nuevo usuario en la plataforma"),
        ).toBeInTheDocument();

        expect(screen.getByLabelText(/^Rol del usuario\s*\*$/)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Nombre de Usuario\s*\*$/)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Contraseña\s*\*$/)).toBeInTheDocument();
        expect(
            screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/),
        ).toBeInTheDocument();

        expect(screen.queryByLabelText(/^Nombre\s*\*$/)).not.toBeInTheDocument();
        expect(
            screen.queryByPlaceholderText("Ej: 99123456"),
        ).not.toBeInTheDocument();
    });

    it("selecciona el rol operador y muestra sus campos", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

        expect(screen.getByLabelText(/^Nombre\s*\*$/)).toBeInTheDocument();
        expect(
            screen.getByLabelText("Código de país"),
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Ej: 99123456"),
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Número de local"),
        ).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Nave/ }));

        expect(screen.getByText("Seleccionar nave")).toBeInTheDocument();

        expect(screen.getByText("Nave Central")).toBeInTheDocument();
        expect(screen.getByText("Nave Norte")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("option", { name: "Nave Central" }));
    });

    it("selecciona operador automáticamente cuando el rol viene en la URL", () => {
        configurarSearchParams("operador");

        render(<FormularioAltaUsuario naves={naves} />);

        expect(screen.getByRole("combobox", { name: /^Rol del usuario/ })).toHaveTextContent("Operador");
        expect(screen.getByLabelText(/^Nombre\s*\*$/)).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText("Número de local"),
        ).toBeInTheDocument();
    });

    it.each(["A22", "22B", "-22", "+22", "2.2", "2,2", "2e2"])(
        "rechaza el número de local inválido %s sin cambiar lo escrito",
        (valor) => {
            configurarSearchParams("operador");
            render(<FormularioAltaUsuario naves={naves} />);
            const campo = screen.getByPlaceholderText("Número de local");

            fireEvent.change(campo, { target: { value: "022" } });
            fireEvent.change(campo, { target: { value: valor } });

            expect(campo).toHaveValue("022");
            expect(altaOperador).not.toHaveBeenCalled();
        },
    );

    it("rechaza un pegado inválido y permite vaciar y reescribir el local con ceros iniciales", () => {
        configurarSearchParams("operador");
        render(<FormularioAltaUsuario naves={naves} />);
        const campo = screen.getByPlaceholderText("Número de local") as HTMLInputElement;

        expect(campo).toHaveAttribute("type", "text");
        expect(campo).toHaveAttribute("inputmode", "numeric");
        fireEvent.change(campo, { target: { value: "022" } });
        fireEvent.input(campo, {
            target: { value: "12 A34" },
            inputType: "insertFromPaste",
            data: "12 A34",
        });
        expect(campo).toHaveValue("022");

        fireEvent.change(campo, { target: { value: "" } });
        expect(campo).toHaveValue("");
        expect(campo.validity.valueMissing).toBe(true);

        fireEvent.input(campo, {
            target: { value: "0022" },
            inputType: "insertFromPaste",
            data: "0022",
        });
        expect(campo).toHaveValue("0022");
        expect(campo.checkValidity()).toBe(true);
    });

    it("permite cambiar el código de país", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

        const codigoPais = screen.getByRole("combobox", { name: "Código de país" });

        expect(codigoPais).toHaveTextContent("+598 (Uruguay)");

        seleccionarOpcion("Código de país", "+54 (Argentina)");

        expect(codigoPais).toHaveTextContent("+54 (Argentina)");
    });

    it("permite seleccionar una nave", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

        const selects = screen.getAllByRole("combobox");

        const nave = selects[2];

        seleccionarOpcion("Nave", "Nave Norte");

        expect(nave).toHaveTextContent("Nave Norte");
    });

    it("permite agregar un segundo local", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

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

        seleccionarOpcion("Rol del usuario", "Operador");

        const botonesEliminar = screen.getAllByRole("button", {
            name: "Eliminar local",
        });

        expect(botonesEliminar).toHaveLength(1);
        expect(botonesEliminar[0]).toBeDisabled();
    });

    it("permite eliminar un local adicional", () => {
        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

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

        seleccionarOpcion("Rol del usuario", "Operador");

        fireEvent.change(screen.getByLabelText(/^Nombre de Usuario\s*\*$/), {
            target: { value: "usuario1" },
        });

        fireEvent.change(screen.getByLabelText(/^Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Nombre\s*\*$/), {
            target: { value: "Huerta Sur" },
        });

        fireEvent.change(screen.getByPlaceholderText("Ej: 99123456"), {
            target: { value: "99123456" },
        });

        fireEvent.click(screen.getByRole("button", { name: "+ Agregar local" }));

        fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

        expect(screen.getByLabelText(/^Nombre de Usuario\s*\*$/)).toHaveValue("");
        expect(screen.getByLabelText(/^Contraseña\s*\*$/)).toHaveValue("");
        expect(
            screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/),
        ).toHaveValue("");

        expect(screen.getByLabelText(/^Nombre\s*\*$/)).toHaveValue("");
        expect(
            screen.getByPlaceholderText("Ej: 99123456"),
        ).toHaveValue("");

        expect(screen.getByRole("combobox", { name: "Código de país" })).toHaveTextContent("+598 (Uruguay)");

        expect(
            screen.getAllByPlaceholderText("Número de local"),
        ).toHaveLength(1);
    });

    it("muestra error cuando se selecciona administrador", async () => {
        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Administrador");

        fireEvent.change(screen.getByLabelText(/^Nombre de Usuario\s*\*$/), {
            target: { value: "usuario1" },
        });

        fireEvent.change(screen.getByLabelText(/^Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!,
        );

        expect(
            await screen.findByText(
                "Esta alta todavía no está disponible para el rol seleccionado.",
            ),
        ).toBeInTheDocument();

        expect(altaOperador).not.toHaveBeenCalled();
        expect(altaProductor).not.toHaveBeenCalled();
    });

    it("envía correctamente el alta de un operador conservando ceros iniciales del local", async () => {
        vi.mocked(altaOperador).mockResolvedValue({
            esValido: true,
            id: 25,
            mensaje: "Operador creado correctamente.",
        });

        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

        completarFormulario();

        fireEvent.change(screen.getByPlaceholderText("Número de local"), {
            target: { value: "022" },
        });

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
                    numeroLocal: "022",
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
                "¿Desea precargar productos para este usuario?",
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", { name: "Precargar productos" }),
        ).toHaveAttribute("href", "/gestion-operadores/25");
    });

    it("envía correctamente el alta de un productor", async () => {
        vi.mocked(altaProductor).mockResolvedValue({
            esValido: true,
            id: 30,
            mensaje: "Productor creado correctamente.",
        });

        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Productor");

        fireEvent.change(screen.getByLabelText(/^Nombre de Usuario\s*\*$/), {
            target: { value: "productor1" },
        });

        fireEvent.change(screen.getByLabelText(/^Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Nombre\s*\*$/), {
            target: { value: "Huerta Sur" },
        });

        expect(screen.getByRole("combobox", { name: "Código de país" })).toHaveTextContent("+598 (Uruguay)");
        expect(screen.queryByPlaceholderText("Número de local")).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText("Ej: 99123456"), {
            target: { value: "99123456" },
        });

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!,
        );

        await waitFor(() => {
            expect(altaProductor).toHaveBeenCalledTimes(1);
        });

        expect(altaProductor).toHaveBeenCalledWith({
            rol: "productor",
            nombreUsuario: "productor1",
            contraseña: "clave12345",
            confirmacionContraseña: "clave12345",
            nombre: "Huerta Sur",
            codigoPais: "+598",
            telefono: "99123456",
        });

        expect(
            await screen.findByRole("status"),
        ).toHaveTextContent("Productor creado correctamente.");

        expect(
            screen.getByText("Productor creado satisfactoriamente"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("¿Desea precargar productos para este usuario?"),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", { name: "Precargar productos" }),
        ).toHaveAttribute("href", "/gestion-productores/30");

        expect(altaOperador).not.toHaveBeenCalled();
    });

    it("limpia el formulario después de un alta exitosa", async () => {
        vi.mocked(altaOperador).mockResolvedValue({
            esValido: true,
            id: 25,
            mensaje: "Operador creado correctamente.",
        });

        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

        completarFormulario();

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        await waitFor(() => {
            expect(altaOperador).toHaveBeenCalled();
        });

        expect(screen.getByLabelText(/^Nombre de Usuario\s*\*$/)).toHaveValue("");
        expect(screen.getByLabelText(/^Contraseña\s*\*$/)).toHaveValue("");
        expect(
            screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/),
        ).toHaveValue("");
        expect(screen.getByLabelText(/^Nombre\s*\*$/)).toHaveValue("");
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

        seleccionarOpcion("Rol del usuario", "Operador");

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

    it("muestra los errores devueltos por altaProductor", async () => {
        vi.mocked(altaProductor).mockResolvedValue({
            esValido: false,
            errores: [
                "Ya existe un usuario con ese nombre de usuario.",
            ],
        });

        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Productor");

        fireEvent.change(screen.getByLabelText(/^Nombre de Usuario\s*\*$/), {
            target: { value: "productor1" },
        });

        fireEvent.change(screen.getByLabelText(/^Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Nombre\s*\*$/), {
            target: { value: "Huerta Sur" },
        });

        fireEvent.change(screen.getByPlaceholderText("Ej: 99123456"), {
            target: { value: "99123456" },
        });

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!,
        );

        expect(
            await screen.findByText(
                "Ya existe un usuario con ese nombre de usuario.",
            ),
        ).toBeInTheDocument();

        expect(
            screen.queryByText("Productor creado satisfactoriamente"),
        ).not.toBeInTheDocument();
    });

    it.each(["Ahora no", "Escape"])("el diálogo de alta enfoca su acción inicial y cierra con %s", async (cierre) => {
        vi.mocked(altaOperador).mockResolvedValue({
            esValido: true,
            id: 25,
            mensaje: "Operador creado correctamente.",
        });

        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Operador");

        completarFormulario();

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }),
        );

        expect(
            await screen.findByText("Operador creado satisfactoriamente"),
        ).toBeInTheDocument();

        expect(screen.getByRole("dialog", { name: "Operador creado satisfactoriamente" })).toHaveAttribute("aria-modal", "true");
        expect(screen.getByRole("button", { name: "Ahora no" })).toHaveFocus();
        if (cierre === "Escape") {
            fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
            fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        } else {
            fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
        }

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("avisa si falla el alta sin borrar los datos ni abrir la precarga", async () => {
        vi.mocked(altaOperador).mockRejectedValueOnce(new Error("Sin conexión"));
        render(<FormularioAltaUsuario naves={naves} />);
        seleccionarOpcion("Rol del usuario", "Operador");
        completarFormulario();

        fireEvent.submit(screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!);

        expect(await screen.findByRole("alert"))
            .toHaveTextContent("No se pudo registrar el usuario. Intentá de nuevo.");
        expect(screen.getByLabelText(/^Nombre de Usuario\s*\*$/)).toHaveValue("usuario1");
        expect(screen.getByRole("button", { name: "Registrar usuario" })).not.toBeDisabled();
        expect(screen.queryByText("Operador creado satisfactoriamente")).not.toBeInTheDocument();
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

        seleccionarOpcion("Rol del usuario", "Operador");

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

        fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));
        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Registrar usuario" }),
            ).not.toBeDisabled();
        });
    });

    it("muestra error cuando ya existe un productor con ese nombre", async () => {
        vi.mocked(altaProductor).mockResolvedValue({
            esValido: false,
            errores: ["Ya existe un productor con ese nombre."],
        });

        render(<FormularioAltaUsuario naves={naves} />);

        seleccionarOpcion("Rol del usuario", "Productor");

        fireEvent.change(screen.getByLabelText(/^Nombre de Usuario\s*\*$/), {
            target: { value: "productor1" },
        });

        fireEvent.change(screen.getByLabelText(/^Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Confirmación de Contraseña\s*\*$/), {
            target: { value: "clave12345" },
        });

        fireEvent.change(screen.getByLabelText(/^Nombre\s*\*$/), {
            target: { value: "Huerta Sur" },
        });

        fireEvent.change(screen.getByPlaceholderText("Ej: 99123456"), {
            target: { value: "99123456" },
        });

        fireEvent.submit(
            screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!,
        );

        expect(
            await screen.findByText("Ya existe un productor con ese nombre."),
        ).toBeInTheDocument();
    });
});
