import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { UbicacionSeleccionada } from "./LeafletLocationPicker";

const mocks = vi.hoisted(() => ({ esWeb: true }));
vi.mock("@mui/material/useMediaQuery", () => ({ default: () => mocks.esWeb }));
vi.mock("@mui/material/Drawer", () => ({
    default: ({ open, anchor, children, onClose }: { open: boolean; anchor: string; children: ReactNode; onClose: () => void }) => open ? <section className="MuiDrawer-paper" role="dialog" aria-label="Nueva publicación de Productor" data-anchor={anchor}>{children}<button onClick={onClose}>Cerrar panel</button></section> : null,
}));
vi.mock("./LeafletLocationPicker", () => ({
    default: ({ abierto, alConfirmar, alCerrar }: { abierto: boolean; alConfirmar: (ubicacion: UbicacionSeleccionada) => void; alCerrar: () => void }) => abierto ? <section role="dialog" aria-label="Seleccionar ubicación">
        <button type="button" onClick={() => alConfirmar({ latitud: -34.9, longitud: -56.2, departamento: "Montevideo", nombreLugar: "Ruta 5" })}>Usar ubicación</button>
        <button type="button" onClick={() => alConfirmar({ latitud: -34.5, longitud: -56.3, departamento: "Canelones", nombreLugar: "Depósito" })}>Usar otra ubicación</button>
        <button type="button" onClick={() => alConfirmar({ latitud: -34.9, longitud: -56.2, departamento: "Montevideo", nombreLugar: "Montevideo" })}>Usar departamento</button>
        <button type="button" onClick={alCerrar}>Cerrar mapa</button>
    </section> : null,
}));

import AltaPublicacionProductor, { DrawerAltaPublicacionProductor } from "./AltaPublicacionProductor";

const catalogos = {
    especies: [{ id: 2, nombre: "Manzana" }, { id: 8, nombre: "Pera" }],
    variedades: [{ id: 3, nombre: "Royal", especieId: 2 }, { id: 9, nombre: "Williams", especieId: 8 }],
    presentaciones: [{ id: 4, nombre: "Caja", variedadId: 3 }, { id: 10, nombre: "Bolsa", variedadId: 9 }],
    categorias: [{ id: 5, nombre: "Primera", especieId: 2 }, { id: 11, nombre: "General", especieId: null }],
    calibres: [{ id: 6, nombre: "Grande" }], paises: [{ id: 7, nombre: "Uruguay" }],
};

function prepararFetch(resultado: Record<string, unknown> = { mensaje: "Publicación creada correctamente." }, status = 201) {
    const fetchMock = vi.fn((_url: string, opciones?: RequestInit) => Promise.resolve(new Response(JSON.stringify(opciones?.method === "POST" ? resultado : catalogos), { status: opciones?.method === "POST" ? status : 200 })));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

async function abrirAlta() {
    render(<AltaPublicacionProductor productorId={4} />);
    const agregar = screen.getByRole("button", { name: "Agregar producto" });
    await waitFor(() => expect(agregar).toBeEnabled());
    fireEvent.click(agregar);
    return screen.getByRole("dialog", { name: "Nueva publicación de Productor" });
}

function elegir(campo: string, opcion: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: new RegExp(`^${campo}`) }));
    fireEvent.click(screen.getByRole("option", { name: opcion }));
}

function completarFormulario() {
    elegir("Especie", "Manzana"); elegir("Variedad", "Royal"); elegir("Presentación", "Caja");
    elegir("Categoría", "Primera"); elegir("Calibre", "Grande"); elegir("País de origen", "Uruguay");
    seleccionarUbicacion();
}

function seleccionarUbicacion() {
    fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar ubicación" }));
}

function enviarFormulario() {
    fireEvent.submit(screen.getByRole("button", { name: "Confirmar" }).closest("form")!);
}

function comprobarFormularioVacio() {
    for (const campo of ["Especie", "Variedad", "Presentación", "Categoría", "Calibre", "País de origen"]) {
        const selector = screen.getByRole("combobox", { name: new RegExp(`^${campo}`) });
        expect(selector.parentElement!.querySelector("input")).toHaveValue("");
    }
    for (const campo of ["Variedad", "Presentación", "Categoría"]) {
        expect(screen.getByRole("combobox", { name: new RegExp(`^${campo}`) })).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByLabelText("Precio en pesos")).toHaveValue("");
    expect(screen.getByLabelText("Cantidad (kg)")).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Agregar punto de retiro" })).toBeInTheDocument();
    expect(screen.queryByText("Ruta 5")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Nombre del punto de retiro/)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Seleccionar ubicación" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Vista previa de la fotografía")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Fotografía")).toHaveValue("");
    const galeria = screen.queryByLabelText("Fotografía desde galería");
    if (galeria) expect(galeria).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
}

describe("AltaPublicacionProductor", () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.esWeb = true; prepararFetch(); });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it("permite quitar una ubicación seleccionada antes de crear", async () => {
        const fetchMock = prepararFetch();
        await abrirAlta();
        elegir("Especie", "Manzana");
        seleccionarUbicacion();
        fireEvent.click(screen.getByRole("button", { name: "Quitar punto de retiro 1" }));
        expect(screen.queryByText("Ruta 5")).not.toBeInTheDocument();
        enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string)).toMatchObject({ ubicaciones: [] });
    });

    it.each([undefined, false])("permite publicar solo la especie y restablece la disponibilidad inicial %s", async (disponibilidadInicial) => {
        const fetchMock = prepararFetch();
        const alCrear = vi.fn();
        render(<DrawerAltaPublicacionProductor productorId={4} disponibilidadInicial={disponibilidadInicial} abierto alCrear={alCrear} alCerrar={vi.fn()} />);
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toHaveProperty("checked", disponibilidadInicial ?? true);
        elegir("Especie", "Manzana");
        const formulario = screen.getByRole("button", { name: "Confirmar" }).closest("form")!;
        expect(formulario.checkValidity()).toBe(true);
        enviarFormulario();
        await waitFor(() => expect(alCrear).toHaveBeenCalledWith("Publicación creada correctamente."));
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string)).toMatchObject({
            especieId: 2, variedadId: null, presentacionId: null, categoriaId: null,
            calibreId: null, paisId: null, precio: null, cantidadUnidades: null,
            ubicaciones: [],
            disponibilidad: disponibilidadInicial ?? true,
        });
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toHaveProperty("checked", disponibilidadInicial ?? true);
    });

    it.each([true, false])("guarda varios puntos de retiro y permite quitar uno sin perder los restantes (escritorio=%s)", async (esWeb) => {
        mocks.esWeb = esWeb;
        const fetchMock = prepararFetch();
        await abrirAlta();
        elegir("Especie", "Manzana");
        seleccionarUbicacion();
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Usar otra ubicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Usar departamento" }));
        fireEvent.click(screen.getByRole("button", { name: "Quitar punto de retiro 3" }));

        expect(screen.getAllByRole("button", { name: /^Editar punto de retiro/ })).toHaveLength(2);
        expect(screen.getByText("Ruta 5")).toBeInTheDocument();
        expect(screen.getByText("Depósito")).toBeInTheDocument();
        enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string).ubicaciones).toEqual([
            { nombreUbicacion: "Ruta 5", urlMaps: "https://www.google.com/maps?q=-34.9,-56.2", departamento: "Montevideo" },
            { nombreUbicacion: "Depósito", urlMaps: "https://www.google.com/maps?q=-34.5,-56.3", departamento: "Canelones" },
        ]);
        fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
        comprobarFormularioVacio();
    });

    it("cancelar la selección no agrega puntos incompletos ni impide publicar sin ubicaciones", async () => {
        const fetchMock = prepararFetch();
        await abrirAlta();
        elegir("Especie", "Manzana");
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar mapa" }));
        expect(screen.queryByRole("button", { name: /^Editar punto de retiro/ })).not.toBeInTheDocument();
        enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string).ubicaciones).toEqual([]);
    });

    it("mantiene el botón visible y deshabilitado hasta recibir los catálogos", async () => {
        let resolver!: (respuesta: Response) => void;
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
        render(<AltaPublicacionProductor productorId={4} />);
        const agregar = screen.getByRole("button", { name: "Agregar producto" });
        expect(agregar).toBeDisabled();
        expect(agregar).toHaveAttribute("aria-busy", "true");
        expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
        fireEvent.click(agregar);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await act(async () => resolver(new Response(JSON.stringify(catalogos))));
        expect(screen.getByRole("button", { name: "Agregar producto" })).toBe(agregar);
        expect(agregar).toBeEnabled();
        expect(agregar).toHaveAttribute("aria-busy", "false");
    });

    it.each([undefined, false])("conserva el mismo formulario durante la carga con disponibilidad inicial %s", async (disponibilidadInicial) => {
        let resolver!: (respuesta: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; }));
        vi.stubGlobal("fetch", fetchMock);
        render(<DrawerAltaPublicacionProductor productorId={4} disponibilidadInicial={disponibilidadInicial} abierto alCrear={vi.fn()} alCerrar={vi.fn()} />);
        const confirmar = screen.getByRole("button", { name: "Confirmar" });
        const formulario = confirmar.closest("form")!;
        const precio = screen.getByLabelText("Precio en pesos");
        const disponibilidad = screen.getByRole("switch", { name: "Publicación disponible" });
        const ubicaciones = screen.getByRole("button", { name: "Agregar punto de retiro" });

        expect(formulario).toHaveAttribute("aria-busy", "true");
        expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        for (const selector of screen.getAllByRole("combobox")) expect(selector).toHaveAttribute("aria-disabled", "true");
        for (const control of [precio, screen.getByLabelText("Cantidad (kg)"), disponibilidad, screen.getByLabelText("Fotografía"), ubicaciones, confirmar]) {
            expect(control).toBeDisabled();
        }
        expect(screen.getByRole("button", { name: "Editar foto" })).toBeDisabled();
        expect(disponibilidad).toHaveProperty("checked", disponibilidadInicial ?? true);
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
        fireEvent.submit(formulario);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => resolver(new Response(JSON.stringify(catalogos))));
        expect(screen.getByRole("button", { name: "Confirmar" })).toBe(confirmar);
        expect(confirmar.closest("form")).toBe(formulario);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBe(disponibilidad);
        expect(screen.getByRole("button", { name: "Agregar punto de retiro" })).toBe(ubicaciones);
        expect(formulario).toHaveAttribute("aria-busy", "false");
        expect(confirmar).toBeEnabled();
        expect(precio).toBeEnabled();
        expect(disponibilidad).toBeEnabled();
        expect(ubicaciones).toBeEnabled();
        expect(disponibilidad).toHaveProperty("checked", disponibilidadInicial ?? true);
    });

    it.each([new Response("{}", { status: 500 }), new Error("Sin conexión")])("conserva el formulario bloqueado y avisa con toast si falla la carga del drawer", async (respuesta) => {
        vi.stubGlobal("fetch", vi.fn(() => respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta)));
        render(<DrawerAltaPublicacionProductor productorId={4} abierto alCrear={vi.fn()} alCerrar={vi.fn()} />);
        const confirmar = screen.getByRole("button", { name: "Confirmar" });
        const formulario = confirmar.closest("form")!;

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las opciones de la publicación. Volvé a intentarlo.");
        expect(screen.getByRole("alert").closest('[role="dialog"]')).toBeNull();
        expect(screen.getByRole("button", { name: "Confirmar" }).closest("form")).toBe(formulario);
        expect(formulario).toHaveAttribute("aria-busy", "false");
        expect(confirmar).toBeDisabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Agregar punto de retiro" })).toBeDisabled();
        fireEvent.submit(formulario);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("recupera los catálogos sin recargar la página al reintentar desde el drawer persistente", async () => {
        let resolver!: (respuesta: Response) => void;
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error("Detalle técnico que no debe mostrarse"))
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolver = resolve; }));
        vi.stubGlobal("fetch", fetchMock);
        const props = { productorId: 4, alCrear: vi.fn(), alCerrar: vi.fn() };
        const vista = render(<DrawerAltaPublicacionProductor {...props} abierto />);
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las opciones de la publicación. Volvé a intentarlo.");
        expect(screen.queryByText("Detalle técnico que no debe mostrarse")).not.toBeInTheDocument();
        vista.rerender(<DrawerAltaPublicacionProductor {...props} abierto={false} />);
        vista.rerender(<DrawerAltaPublicacionProductor {...props} abierto />);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const reintentar = screen.getByRole("button", { name: "Reintentar carga" });
        const confirmar = screen.getByRole("button", { name: "Confirmar" });
        const formulario = confirmar.closest("form")!;
        fireEvent.click(reintentar);
        fireEvent.click(reintentar);
        expect(reintentar).toBeDisabled();
        expect(reintentar).toHaveAttribute("aria-busy", "true");
        expect(confirmar).toBeDisabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        expect(formulario).toHaveAttribute("aria-busy", "true");
        fireEvent.submit(formulario);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await act(async () => resolver(new Response(JSON.stringify(catalogos))));
        expect(confirmar).toBeEnabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeEnabled();
        expect(formulario).toHaveAttribute("aria-busy", "false");
        expect(screen.queryByRole("button", { name: "Reintentar carga" })).not.toBeInTheDocument();
        elegir("Especie", "Manzana");
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Manzana");
    });

    it("permite otro reintento si vuelve a fallar sin repetir solicitudes automáticamente", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response("{}", { status: 503 }))
            .mockResolvedValueOnce(new Response("respuesta inválida", { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(catalogos)));
        vi.stubGlobal("fetch", fetchMock);
        render(<AltaPublicacionProductor productorId={4} />);
        await screen.findByRole("alert");
        expect(screen.getByRole("button", { name: "Agregar producto" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar carga" })).toBeEnabled());
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button", { name: "Agregar producto" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Agregar producto" })).toBeEnabled());
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(screen.queryByRole("button", { name: "Reintentar carga" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
        expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
    });

    it("prioriza las especies UAM presentes y ordena el resto sin modificar el catálogo recibido", async () => {
        const especies = [
            catalogos.especies[1], { id: 20, nombre: "Tomate" }, { id: 21, nombre: "Ajo" },
            { id: 22, nombre: "Banana" }, catalogos.especies[0], { id: 23, nombre: "Papa" },
        ];
        Object.freeze(especies);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...catalogos, especies }) }));
        await abrirAlta();
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Especie/ }));
        expect(screen.getAllByRole("option").filter((opcion) => opcion.getAttribute("aria-disabled") !== "true").map((opcion) => opcion.textContent))
            .toEqual(["Papa", "Banana", "Manzana", "Tomate", "Ajo", "Pera"]);
        expect(especies.map((opcion) => opcion.nombre)).toEqual(["Pera", "Tomate", "Ajo", "Banana", "Manzana", "Papa"]);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Manzana");
    });

    it.each([new Response("{}", { status: 500 }), new Error("Sin conexión")])("informa cuando no puede cargar los datos", async (respuesta) => {
        vi.stubGlobal("fetch", vi.fn(() => respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta)));
        render(<AltaPublicacionProductor productorId={4} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las opciones de la publicación. Volvé a intentarlo.");
    });

    it.each([true, false])("adapta el panel y la carga de fotografía a escritorio=%s", async (esWeb) => {
        mocks.esWeb = esWeb;
        const panel = await abrirAlta();
        expect(panel).toHaveAttribute("data-anchor", esWeb ? "right" : "bottom");
        expect(screen.queryByRole("combobox", { name: /^Productor/ })).not.toBeInTheDocument();
        const archivo = screen.getByLabelText("Fotografía");
        if (esWeb) expect(archivo).not.toHaveAttribute("capture");
        else expect(archivo).toHaveAttribute("capture", "environment");
        const seleccionar = vi.spyOn(archivo, "click").mockImplementation(() => undefined);
        fireEvent.click(screen.getByRole("button", { name: esWeb ? "Editar foto" : "Cámara" }));
        expect(seleccionar).toHaveBeenCalledOnce();
        if (esWeb) {
            expect(screen.queryByRole("button", { name: "Galería" })).not.toBeInTheDocument();
        } else {
            const galeria = screen.getByLabelText("Fotografía desde galería");
            expect(galeria).not.toHaveAttribute("capture");
            expect(galeria).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
            const seleccionarGaleria = vi.spyOn(galeria, "click").mockImplementation(() => undefined);
            fireEvent.click(screen.getByRole("button", { name: "Galería" }));
            expect(seleccionarGaleria).toHaveBeenCalledOnce();
            expect(seleccionar).toHaveBeenCalledOnce();
        }
    });

    it("reinicia variedad, presentación y categoría al cambiar de especie", async () => {
        await abrirAlta(); completarFormulario();
        elegir("Especie", "Pera");
        expect(screen.getByRole("combobox", { name: /^Variedad/ })).not.toHaveTextContent("Royal");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("combobox", { name: /^Categoría/ })).not.toHaveTextContent("Primera");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Variedad/ }));
        expect(screen.getByRole("option", { name: "Williams" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Royal" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("option", { name: "Williams" }));
    });

    it("publica para el Productor actual sin precio, cantidad ni fotografía", async () => {
        const fetchMock = prepararFetch();
        await abrirAlta();
        expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
        completarFormulario(); enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string)).toEqual({ productorId: 4, especieId: 2, variedadId: 3, presentacionId: 4, categoriaId: 5, calibreId: 6, paisId: 7, ubicaciones: [{ nombreUbicacion: "Ruta 5", urlMaps: "https://www.google.com/maps?q=-34.9,-56.2", departamento: "Montevideo" }], disponibilidad: true, precio: null, fotografia: "", cantidadUnidades: null });
        expect(screen.queryByRole("dialog", { name: "Nueva publicación de Productor" })).not.toBeInTheDocument();
    });

    it("acepta únicamente enteros y envía cantidad, precio y disponibilidad", async () => {
        const fetchMock = prepararFetch({});
        await abrirAlta(); completarFormulario();
        for (const campo of ["Precio en pesos", "Cantidad (kg)"]) {
            const entrada = screen.getByLabelText(campo);
            fireEvent.change(entrada, { target: { value: "25" } });
            for (const valor of ["2.5", "-1", "texto"]) fireEvent.change(entrada, { target: { value: valor } });
            expect(entrada).toHaveValue("25");
        }
        const precio = screen.getByLabelText("Precio en pesos");
        for (const valor of ["0", "00", "+25", "1e3", "25,5", "10000000000"]) {
            fireEvent.change(precio, { target: { value: valor } });
            expect(precio).toHaveValue("25");
        }
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        expect(JSON.parse(fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")![1]!.body as string)).toMatchObject({ precio: "25", cantidadUnidades: 25, disponibilidad: false });
    });

    it.each([true, false])("abre un formulario limpio después de crear con todos los datos en escritorio=%s", async (esWeb) => {
        mocks.esWeb = esWeb;
        const fetchMock = prepararFetch({ esValido: true, id: 99, mensaje: "Publicación creada correctamente." });
        await abrirAlta(); completarFormulario();
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "120" } });
        fireEvent.change(screen.getByLabelText("Cantidad (kg)"), { target: { value: "35" } });
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        const entradaFoto = esWeb ? "Fotografía" : "Fotografía desde galería";
        fireEvent.change(screen.getByLabelText(entradaFoto), { target: { files: [new File(["foto"], "foto.png", { type: "image/png" })] } });
        await screen.findByAltText("Vista previa de la fotografía");
        enviarFormulario();

        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string)).toMatchObject({ precio: "120", cantidadUnidades: 35, disponibilidad: false, fotografia: expect.stringContaining("data:image/png;base64,") });
        expect(screen.queryByRole("dialog", { name: "Nueva publicación de Productor" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
        comprobarFormularioVacio();
    });

    it("conserva el formulario rechazado y lo limpia al completar un reintento exitoso", async () => {
        const fetchMock = prepararFetch({ esValido: false, errores: ["Revisá los datos de la publicación."] }, 422);
        const alCrear = vi.fn();
        const alCerrar = vi.fn();
        render(<DrawerAltaPublicacionProductor productorId={4} abierto alCrear={alCrear} alCerrar={alCerrar} />);
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        completarFormulario();
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "120" } });
        fireEvent.change(screen.getByLabelText("Cantidad (kg)"), { target: { value: "35" } });
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [new File(["foto"], "foto.png", { type: "image/png" })] } });
        await screen.findByAltText("Vista previa de la fotografía");
        enviarFormulario();

        expect(await screen.findByRole("alert")).toHaveTextContent("Revisá los datos de la publicación.");
        expect(alCrear).not.toHaveBeenCalled();
        expect(alCerrar).not.toHaveBeenCalled();
        for (const [campo, opcion] of [["Especie", "Manzana"], ["Variedad", "Royal"], ["Presentación", "Caja"], ["Categoría", "Primera"], ["Calibre", "Grande"], ["País de origen", "Uruguay"]]) {
            expect(screen.getByRole("combobox", { name: new RegExp(`^${campo}`) })).toHaveTextContent(opcion);
        }
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("120");
        expect(screen.getByLabelText("Cantidad (kg)")).toHaveValue("35");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).not.toBeChecked();
        expect(screen.getByText("Ruta 5")).toBeInTheDocument();
        expect(screen.getByAltText("Vista previa de la fotografía")).toBeInTheDocument();

        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ esValido: true, id: 99, mensaje: "Publicación creada correctamente." }), { status: 201 }));
        enviarFormulario();
        await waitFor(() => expect(alCrear).toHaveBeenCalledExactlyOnceWith("Publicación creada correctamente."));
        expect(alCerrar).not.toHaveBeenCalled();
        comprobarFormularioVacio();
    });

    it("cancelar limpia los datos sin crear una publicación", async () => {
        const fetchMock = prepararFetch();
        await abrirAlta(); completarFormulario();
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "100" } });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("");
        expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
        expect(fetchMock.mock.calls.filter(([, opciones]) => opciones?.method === "POST")).toHaveLength(0);
    });

    it.each(["Cerrar alta", "Cerrar panel"])("permite cerrar con %s", async (nombre) => {
        await abrirAlta();
        fireEvent.click(screen.getByRole("button", { name: nombre }));
        expect(screen.queryByRole("dialog", { name: "Nueva publicación de Productor" })).not.toBeInTheDocument();
    });

    it("permite cambiar la ubicación y cerrar el mapa sin confirmarla", async () => {
        await abrirAlta(); completarFormulario();
        expect(screen.getByText("Ruta 5")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Editar punto de retiro 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar mapa" }));
        expect(screen.getByText("Ruta 5")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Editar punto de retiro 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Usar departamento" }));
        expect(screen.getByText("Montevideo", { exact: true })).toBeInTheDocument();
    });

    it.each([{ errores: ["El producto ya existe."] }, {}])("muestra errores del servidor y permite corregir el formulario", async (resultado) => {
        prepararFetch(resultado, 400);
        await abrirAlta(); completarFormulario(); enviarFormulario();
        expect(await screen.findByRole("alert")).toHaveTextContent("errores" in resultado ? "El producto ya existe." : "No se pudo guardar la publicación.");
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "10" } });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("informa una interrupción de conexión al publicar", async () => {
        const fetchMock = prepararFetch();
        await abrirAlta(); completarFormulario();
        fetchMock.mockRejectedValueOnce(new Error("Sin conexión")); enviarFormulario();
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor.");
        expect(screen.getByRole("alert").closest('[role="dialog"]')).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
    });

    it("permite cerrar el drawer móvil mientras se cargan los catálogos", async () => {
        mocks.esWeb = false;
        let resolver!: (respuesta: Response) => void;
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
        const alCerrar = vi.fn();
        render(<DrawerAltaPublicacionProductor productorId={4} abierto alCrear={vi.fn()} alCerrar={alCerrar} />);

        expect(screen.getByRole("button", { name: "Confirmar" }).closest("form")).toHaveAttribute("aria-busy", "true");
        expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
        expect(document.querySelector("[data-drawer-handle]")).toHaveAttribute("data-disabled", "false");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar panel" }));
        expect(alCerrar).toHaveBeenCalledOnce();

        await act(async () => resolver(new Response(JSON.stringify(catalogos))));
    });

    it("impide envíos repetidos y bloquea el asa y cierre móvil mientras guarda", async () => {
        mocks.esWeb = false;
        const fetchMock = prepararFetch();
        await abrirAlta(); completarFormulario();
        let resolver!: (respuesta: Response) => void;
        fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolver = resolve; }));
        enviarFormulario();
        const boton = screen.getByRole("button", { name: "Guardando..." });
        expect(boton).toBeDisabled();
        expect(document.querySelector("[data-drawer-handle]")).toHaveAttribute("data-disabled", "true");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar panel" }));
        expect(screen.getByRole("dialog", { name: "Nueva publicación de Productor" })).toBeInTheDocument();
        fireEvent.submit(boton.closest("form")!);
        expect(fetchMock.mock.calls.filter(([, opciones]) => opciones?.method === "POST")).toHaveLength(1);
        await act(async () => resolver(new Response(JSON.stringify({ mensaje: "Publicación creada correctamente." }))));
    });

    it.each([
        new File(["texto"], "foto.txt", { type: "text/plain" }),
        new File([], "vacia.png", { type: "image/png" }),
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" }),
    ])("rechaza una fotografía inválida sin mostrar vista previa", async (archivo) => {
        await abrirAlta();
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("La fotografía debe ser PNG, JPEG o WebP y pesar hasta 10 MB.");
        expect(screen.queryByAltText("Vista previa de la fotografía")).not.toBeInTheDocument();
    });

    it.each(["Fotografía", "Fotografía desde galería"])("muestra la fotografía seleccionada mediante %s y permite borrarla", async (entrada) => {
        mocks.esWeb = false;
        await abrirAlta();
        fireEvent.change(screen.getByLabelText(entrada), { target: { files: [] } });
        fireEvent.change(screen.getByLabelText(entrada), { target: { files: [new File(["foto"], "foto.png", { type: "image/png" })] } });
        expect(await screen.findByAltText("Vista previa de la fotografía")).toHaveAttribute("src", expect.stringContaining("data:image/png;base64,"));
        fireEvent.click(screen.getByRole("button", { name: "Borrar foto" }));
        expect(screen.queryByAltText("Vista previa de la fotografía")).not.toBeInTheDocument();
    });

    it("informa cuando no puede leer la fotografía", async () => {
        vi.stubGlobal("FileReader", class {
            onerror: (() => void) | null = null;
            readAsDataURL() { this.onerror?.(); }
        });
        await abrirAlta();
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [new File(["foto"], "foto.png", { type: "image/png" })] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo leer la fotografía.");
    });
});
