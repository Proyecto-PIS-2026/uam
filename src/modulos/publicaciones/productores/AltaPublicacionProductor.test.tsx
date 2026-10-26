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
        <button onClick={() => alConfirmar({ latitud: -34.9, longitud: -56.2, departamento: "Montevideo", nombreLugar: "Ruta 5" })}>Usar ubicación</button>
        <button onClick={() => alConfirmar({ latitud: -34.9, longitud: -56.2, departamento: "Montevideo", nombreLugar: null })}>Usar departamento</button>
        <button onClick={alCerrar}>Cerrar mapa</button>
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
    fireEvent.click(await screen.findByRole("button", { name: "Agregar producto" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar ubicación de retiro" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
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
    expect(screen.getByRole("button", { name: "Seleccionar ubicación de retiro" })).toBeInTheDocument();
    expect(screen.queryByText("Ruta 5")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre del punto de retiro 1")).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole("button", { name: "Eliminar punto de retiro 1" }));
        expect(screen.queryByText("Ruta 5")).not.toBeInTheDocument();
        enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string)).toMatchObject({ ubicaciones: [] });
    });

    it("permite publicar solo la especie sin ubicación ni otros datos", async () => {
        const fetchMock = prepararFetch();
        await abrirAlta();
        elegir("Especie", "Manzana");
        const formulario = screen.getByRole("button", { name: "Confirmar" }).closest("form")!;
        expect(formulario.checkValidity()).toBe(true);
        enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string)).toMatchObject({
            especieId: 2, variedadId: null, presentacionId: null, categoriaId: null,
            calibreId: null, paisId: null, precio: null, cantidadUnidades: null,
            ubicaciones: [],
        });
    });

    it.each([true, false])("guarda varios puntos de retiro y permite quitar uno sin perder los restantes (escritorio=%s)", async (esWeb) => {
        mocks.esWeb = esWeb;
        const fetchMock = prepararFetch();
        await abrirAlta();
        elegir("Especie", "Manzana");
        seleccionarUbicacion();
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 2"), { target: { value: " Depósito " } });
        fireEvent.change(screen.getByLabelText("Enlace de Google Maps 2"), { target: { value: "https://maps.app.goo.gl/deposito" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 3"), { target: { value: "Punto descartado" } });
        fireEvent.click(screen.getByRole("button", { name: "Eliminar punto de retiro 3" }));

        expect(screen.getAllByRole("group", { name: /^Punto de retiro/ })).toHaveLength(2);
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Ruta 5");
        expect(screen.getByLabelText("Nombre del punto de retiro 2")).toHaveValue(" Depósito ");
        enviarFormulario();
        expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        const envio = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string).ubicaciones).toEqual([
            { nombreUbicacion: "Ruta 5", urlMaps: "https://www.google.com/maps?q=-34.9,-56.2" },
            { nombreUbicacion: "Depósito", urlMaps: "https://maps.app.goo.gl/deposito" },
        ]);
        fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
        comprobarFormularioVacio();
    });

    it("no envía un punto incompleto aunque se haya contraído el editor", async () => {
        const fetchMock = prepararFetch();
        await abrirAlta();
        elegir("Especie", "Manzana");
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar ubicación de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Cambiar ubicación" }));
        enviarFormulario();
        expect(screen.getByRole("alert")).toHaveTextContent("Cada ubicación debe tener un nombre de hasta 200 caracteres.");
        expect(fetchMock.mock.calls.filter(([, opciones]) => opciones?.method === "POST")).toHaveLength(0);
        fireEvent.click(screen.getByRole("button", { name: "Cambiar ubicación" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("");
    });

    it("indica que está cargando hasta recibir los catálogos", async () => {
        let resolver!: (respuesta: Response) => void;
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
        render(<AltaPublicacionProductor productorId={4} />);
        expect(screen.getByRole("status")).toHaveTextContent("Cargando datos...");
        await act(async () => resolver(new Response(JSON.stringify(catalogos))));
        expect(await screen.findByRole("button", { name: "Agregar producto" })).toBeEnabled();
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
        expect(await screen.findByRole("alert")).toHaveTextContent(respuesta instanceof Error ? "Sin conexión" : "No se pudieron cargar los datos.");
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
        expect(JSON.parse(envio[1]!.body as string)).toEqual({ productorId: 4, especieId: 2, variedadId: 3, presentacionId: 4, categoriaId: 5, calibreId: 6, paisId: 7, ubicaciones: [{ nombreUbicacion: "Ruta 5", urlMaps: "https://www.google.com/maps?q=-34.9,-56.2" }], disponibilidad: true, precio: null, fotografia: "", cantidadUnidades: null });
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
        await screen.findByRole("combobox", { name: /^Especie/ });
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
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Ruta 5");
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
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Ruta 5");
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar mapa" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Ruta 5");
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Usar departamento" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Montevideo");
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

        expect(screen.getByRole("status")).toHaveTextContent("Cargando datos...");
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
