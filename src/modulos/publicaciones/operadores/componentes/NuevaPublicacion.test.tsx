import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ alCerrar: vi.fn(), alCrear: vi.fn(), esWeb: false }));

vi.mock("@mui/material/useMediaQuery", () => ({ default: () => mocks.esWeb }));
vi.mock("@mui/material/Drawer", () => ({
    default: ({ open, anchor, children, onClose }: { open: boolean; anchor: string; children: ReactNode; onClose: () => void }) => open ? <section className="MuiDrawer-paper" role="dialog" aria-label="Nueva publicación" data-anchor={anchor}>{children}<button type="button" onClick={onClose}>Cerrar desde fondo</button></section> : null,
}));

import NuevaPublicacion from "./NuevaPublicacion";

const catalogos = {
    especies: [{ id: 2, nombre: "Manzana" }],
    variedades: [{ id: 3, nombre: "Royal", especieId: 2 }],
    presentaciones: [{ id: 4, nombre: "Caja", variedadId: 3 }],
    categorias: [{ id: 5, nombre: "Primera", especieId: 2 }],
    calibres: [{ id: 6, nombre: "Grande" }],
    paises: [{ id: 7, nombre: "Uruguay" }],
};

function renderDrawer(abierto = true) {
    return render(<NuevaPublicacion operadorId={9} abierto={abierto} alCerrar={mocks.alCerrar} alCrear={mocks.alCrear} />);
}

function prepararFetch(resultadoAlta: Record<string, unknown> = { mensaje: "Publicación creada correctamente.", id: 15 }, estadoAlta = 201) {
    vi.stubGlobal("fetch", vi.fn((_url: string, opciones?: RequestInit) => {
        const resultado = opciones?.method === "POST" ? resultadoAlta : catalogos;
        const status = opciones?.method === "POST" ? estadoAlta : 200;
        return Promise.resolve(new Response(JSON.stringify(resultado), { status }));
    }));
}

function completarFormulario(formulario: HTMLFormElement) {
    const campos = within(formulario);
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^País de origen/ }));
    fireEvent.click(screen.getByRole("option", { name: "Uruguay" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Especie/ }));
    fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Variedad/ }));
    fireEvent.click(screen.getByRole("option", { name: "Royal" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Presentación/ }));
    fireEvent.click(screen.getByRole("option", { name: "Caja" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Categoría/ }));
    fireEvent.click(screen.getByRole("option", { name: "Primera" }));
    fireEvent.mouseDown(campos.getByRole("combobox", { name: /^Calibre/ }));
    fireEvent.click(screen.getByRole("option", { name: "Grande" }));
    fireEvent.change(campos.getByLabelText("Precio en pesos"), { target: { value: "1250" } });
}

describe("NuevaPublicacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.esWeb = false;
        prepararFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([undefined, false])("permite publicar solo la especie respetando la disponibilidad inicial %s", async (disponibilidadInicial) => {
        render(<NuevaPublicacion operadorId={9} disponibilidadInicial={disponibilidadInicial} abierto alCerrar={mocks.alCerrar} alCrear={mocks.alCrear} />);
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toHaveProperty("checked", disponibilidadInicial ?? true);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Especie/ }));
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const formulario = screen.getByRole("button", { name: "Confirmar" }).closest("form")!;
        expect(formulario.checkValidity()).toBe(true);
        fireEvent.submit(formulario);
        await waitFor(() => expect(mocks.alCrear).toHaveBeenCalledOnce());
        const envio = vi.mocked(fetch).mock.calls.find(([, config]) => config?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string)).toMatchObject({
            especieId: 2, variedadId: null, presentacionId: null, categoriaId: null,
            calibreId: null, paisId: null, precio: null, cantidadUnidades: null,
            disponibilidad: disponibilidadInicial ?? true,
        });
    });

    it("muestra el formulario del operador actual", async () => {
        renderDrawer();
        expect(screen.getByRole("heading", { name: "Nueva publicación" })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
    });

    it.each([undefined, false])("conserva el formulario bloqueado mientras carga con disponibilidad inicial %s", async (disponibilidadInicial) => {
        let resolver!: (respuesta: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; }));
        vi.stubGlobal("fetch", fetchMock);
        render(<NuevaPublicacion operadorId={9} disponibilidadInicial={disponibilidadInicial} abierto alCerrar={mocks.alCerrar} alCrear={mocks.alCrear} />);
        const confirmar = screen.getByRole("button", { name: "Confirmar" });
        const formulario = confirmar.closest("form")!;
        const precio = screen.getByLabelText("Precio en pesos");
        const disponibilidad = screen.getByRole("switch", { name: "Publicación disponible" });

        expect(formulario).toHaveAttribute("aria-busy", "true");
        expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        for (const selector of screen.getAllByRole("combobox")) expect(selector).toHaveAttribute("aria-disabled", "true");
        for (const control of [precio, screen.getByLabelText(/^Unidades/), disponibilidad, screen.getByLabelText("Fotografía"), screen.getByLabelText("Fotografía desde galería"), confirmar]) {
            expect(control).toBeDisabled();
        }
        for (const nombre of ["Cámara", "Galería", "Aumentar precio en 10", "Disminuir precio en 10"]) {
            expect(screen.getByRole("button", { name: nombre })).toBeDisabled();
        }
        expect(disponibilidad).toHaveProperty("checked", disponibilidadInicial ?? true);
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
        fireEvent.submit(formulario);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => resolver(new Response(JSON.stringify(catalogos))));
        expect(confirmar.closest("form")).toBe(formulario);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBe(disponibilidad);
        expect(formulario).toHaveAttribute("aria-busy", "false");
        expect(confirmar).toBeEnabled();
        expect(precio).toBeEnabled();
        expect(disponibilidad).toBeEnabled();
        expect(disponibilidad).toHaveProperty("checked", disponibilidadInicial ?? true);
    });

    it.each([new Response("{}", { status: 500 }), new Error("Sin conexión")])("mantiene el formulario bloqueado y avisa con un toast si falla el catálogo", async (respuesta) => {
        vi.stubGlobal("fetch", vi.fn(() => respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta)));
        renderDrawer();
        const confirmar = screen.getByRole("button", { name: "Confirmar" });
        const formulario = confirmar.closest("form")!;

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los datos del formulario.");
        expect(within(formulario).queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirmar" }).closest("form")).toBe(formulario);
        expect(formulario).toHaveAttribute("aria-busy", "false");
        expect(confirmar).toBeDisabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        fireEvent.submit(formulario);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(mocks.alCrear).not.toHaveBeenCalled();
    });

    it("prioriza las especies UAM presentes y ordena el resto sin modificar el catálogo recibido", async () => {
        const especies = [
            { id: 8, nombre: "Pera" }, { id: 9, nombre: "Tomate" }, { id: 10, nombre: "Ajo" },
            { id: 11, nombre: "Banana" }, catalogos.especies[0], { id: 12, nombre: "Papa" },
        ];
        Object.freeze(especies);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...catalogos, especies }) }));
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Especie/ }));
        expect(screen.getAllByRole("option").filter((opcion) => opcion.getAttribute("aria-disabled") !== "true").map((opcion) => opcion.textContent))
            .toEqual(["Papa", "Banana", "Manzana", "Tomate", "Ajo", "Pera"]);
        expect(especies.map((opcion) => opcion.nombre)).toEqual(["Pera", "Tomate", "Ajo", "Banana", "Manzana", "Papa"]);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Manzana");
    });

    it("ajusta el precio con el incremento configurado", async () => {
        render(<NuevaPublicacion operadorId={9} incrementoPrecio={25} abierto alCerrar={mocks.alCerrar} alCrear={mocks.alCrear} />);
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const precio = screen.getByLabelText("Precio en pesos");
        fireEvent.change(precio, { target: { value: "100" } });
        fireEvent.click(screen.getByRole("button", { name: "Aumentar precio en 25" }));
        expect(precio).toHaveValue("125");
        fireEvent.click(screen.getByRole("button", { name: "Disminuir precio en 25" }));
        expect(precio).toHaveValue("100");
        fireEvent.change(precio, { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "Disminuir precio en 25" }));
        expect(precio).toHaveValue("");
        fireEvent.click(screen.getByRole("button", { name: "Aumentar precio en 25" }));
        expect(precio).toHaveValue("25");
        fireEvent.click(screen.getByRole("button", { name: "Disminuir precio en 25" }));
        expect(precio).toHaveValue("");
        fireEvent.change(precio, { target: { value: "5" } });
        fireEvent.click(screen.getByRole("button", { name: "Disminuir precio en 25" }));
        expect(precio).toHaveValue("");
    });

    it("rechaza cero y entradas inválidas sin transformarlas en otro precio", async () => {
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const precio = screen.getByLabelText("Precio en pesos");
        fireEvent.change(precio, { target: { value: "1250" } });
        for (const valor of ["0", "00", "12a.50", "12.5", "12,5", "1e3", "+2", "-2", "10000000000"]) {
            fireEvent.change(precio, { target: { value: valor } });
            expect(precio).toHaveValue("1250");
        }
    });

    it("ofrece cámara primero y también galería en mobile", async () => {
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const camara = screen.getByLabelText("Fotografía");
        const galeria = screen.getByLabelText("Fotografía desde galería");
        const abrirCamara = vi.spyOn(camara, "click").mockImplementation(() => {});
        const abrirGaleria = vi.spyOn(galeria, "click").mockImplementation(() => {});
        expect(camara).toHaveAttribute("capture", "environment");
        expect(galeria).not.toHaveAttribute("capture");
        fireEvent.click(screen.getByRole("button", { name: "Cámara" }));
        expect(abrirCamara).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole("button", { name: "Galería" }));
        expect(abrirGaleria).toHaveBeenCalledOnce();
        abrirCamara.mockRestore();
        abrirGaleria.mockRestore();
    });

    it("mantiene el selector de archivos en web", async () => {
        mocks.esWeb = true;
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const archivo = screen.getByLabelText("Fotografía");
        const abrirSelector = vi.spyOn(archivo, "click").mockImplementation(() => {});
        expect(archivo).not.toHaveAttribute("capture");
        expect(screen.queryByRole("button", { name: "Galería" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Editar foto" }));
        expect(abrirSelector).toHaveBeenCalledOnce();
        abrirSelector.mockRestore();
    });

    it("muestra la vista previa de una fotografía válida", async () => {
        vi.stubGlobal("FileReader", class {
            result = "data:image/png;base64,aW1hZ2Vu";
            onload: (() => void) | null = null;
            readAsDataURL() { this.onload?.(); }
        });
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByAltText("Vista previa de la fotografía")).toBeInTheDocument();
    });

    it("conserva la foto elegida al cancelar el selector de galería", async () => {
        vi.stubGlobal("FileReader", class {
            result = "data:image/png;base64,aW1hZ2Vu";
            onload: (() => void) | null = null;
            readAsDataURL() { this.onload?.(); }
        });
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByAltText("Vista previa de la fotografía")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Fotografía desde galería"), { target: { files: [] } });
        expect(screen.getByAltText("Vista previa de la fotografía")).toBeInTheDocument();
    });

    it("espera a que termine la lectura de la foto antes de confirmar", async () => {
        let terminarLectura: (() => void) | undefined;
        vi.stubGlobal("FileReader", class {
            result = "data:image/png;base64,aW1hZ2Vu";
            onload: (() => void) | null = null;
            readAsDataURL() { terminarLectura = () => this.onload?.(); }
        });
        renderDrawer();
        const confirmar = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(confirmar).toBeEnabled());

        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(confirmar).toBeDisabled();

        await act(async () => { terminarLectura?.(); });
        expect(confirmar).toBeEnabled();
        expect(screen.getByAltText("Vista previa de la fotografía")).toBeInTheDocument();
    });

    it("acepta una foto de 10 MB elegida desde la galería", async () => {
        vi.stubGlobal("FileReader", class {
            result = "data:image/png;base64,aW1hZ2Vu";
            onload: (() => void) | null = null;
            readAsDataURL() { this.onload?.(); }
        });
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const archivo = new File([new Uint8Array(10 * 1024 * 1024)], "foto.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Fotografía desde galería"), { target: { files: [archivo] } });
        expect(await screen.findByAltText("Vista previa de la fotografía")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("rechaza una fotografía inválida", async () => {
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const archivo = new File(["texto"], "archivo.txt", { type: "text/plain" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("La fotografía debe ser PNG, JPEG o WebP");
    });

    it("rechaza una fotografía mayor a 10 MB", async () => {
        renderDrawer();
        await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled());
        const archivo = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "foto.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [archivo] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("hasta 10 MB");
    });

    it("muestra los errores devueltos al enviar", async () => {
        prepararFetch({ errores: ["La publicación no es válida."] }, 400);
        renderDrawer();
        const boton = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(boton).toBeEnabled());
        const formulario = boton.closest("form");
        if (!formulario) throw new Error("No se encontró el formulario de publicación.");
        fireEvent.submit(formulario);
        expect(await screen.findByRole("alert")).toHaveTextContent("La publicación no es válida.");
        expect(within(formulario).getByRole("alert")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cerrar notificación" })).not.toBeInTheDocument();
    });

    it("muestra los fallos técnicos en un toast y conserva el formulario para reintentar", async () => {
        prepararFetch({ errores: ["No se pudo guardar la publicación."] }, 500);
        renderDrawer();
        const boton = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(boton).toBeEnabled());
        const formulario = boton.closest("form")!;
        completarFormulario(formulario);
        fireEvent.submit(formulario);

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la publicación.");
        expect(within(formulario).queryByRole("alert")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("1250");
        expect(boton).toBeEnabled();
        expect(mocks.alCrear).not.toHaveBeenCalled();
    });

    it.each(["", "1250"])("envía el precio %s y comunica el alta sin navegar a otra página", async (precio) => {
        renderDrawer();
        const boton = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(boton).toBeEnabled());
        const formulario = boton.closest("form");
        if (!formulario) throw new Error("No se encontró el formulario de publicación.");
        completarFormulario(formulario);
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: precio } });
        fireEvent.submit(formulario);
        await waitFor(() => expect(mocks.alCrear).toHaveBeenCalledWith("Publicación creada correctamente."));
        expect(fetch).toHaveBeenCalledWith("/api/publicaciones", expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"operadorId":9'),
        }));
        const envio = vi.mocked(fetch).mock.calls.find(([, opciones]) => opciones?.method === "POST")!;
        expect(JSON.parse(envio[1]!.body as string).precio).toBe(precio || null);
    });

    it("bloquea el asa móvil y el cierre desde el fondo mientras guarda", async () => {
        renderDrawer();
        const boton = screen.getByRole("button", { name: "Confirmar" });
        await waitFor(() => expect(boton).toBeEnabled());
        const formulario = boton.closest("form")!;
        completarFormulario(formulario);
        const asa = document.querySelector("[data-drawer-handle]");
        expect(asa).toHaveAttribute("data-disabled", "false");

        let terminar!: (respuesta: Response) => void;
        vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { terminar = resolve; }));
        fireEvent.submit(formulario);

        expect(asa).toHaveAttribute("data-disabled", "true");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar desde fondo" }));
        expect(mocks.alCerrar).not.toHaveBeenCalled();

        await act(async () => terminar(new Response(JSON.stringify({ mensaje: "Publicación creada correctamente." }), { status: 201 })));
        expect(asa).toHaveAttribute("data-disabled", "false");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar desde fondo" }));
        expect(mocks.alCerrar).toHaveBeenCalledOnce();
    });

    it("permite cancelar el alta sin enviar el formulario", () => {
        renderDrawer();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(mocks.alCerrar).toHaveBeenCalled();
        expect(mocks.alCrear).not.toHaveBeenCalled();
    });

    it("no muestra el drawer cuando está cerrado", () => {
        renderDrawer(false);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("abre el drawer desde abajo en mobile", () => {
        renderDrawer();
        expect(screen.getByRole("dialog", { name: "Nueva publicación" })).toHaveAttribute("data-anchor", "bottom");
    });

    it("abre el drawer desde la derecha en web", () => {
        mocks.esWeb = true;
        renderDrawer();
        expect(screen.getByRole("dialog", { name: "Nueva publicación" })).toHaveAttribute("data-anchor", "right");
    });
});
