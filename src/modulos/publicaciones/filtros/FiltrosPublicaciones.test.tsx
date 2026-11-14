import { cleanup, render, screen, fireEvent, waitFor } from "@/test-utils";
import styles from "./FiltrosPublicaciones.module.css";
import FiltrosPublicaciones from "./FiltrosPublicaciones";
import type { PublicacionListado } from "../../consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "../../consulta-mercado/acciones/PublicacionesProductor";
import { MAXIMO_DIGITOS_PRECIO } from "@/modulos/publicaciones/precio-publicacion";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrdenPublicaciones } from "./FiltrosPublicaciones";

const obtenerNombreOperador = (publicacion: PublicacionListado) => publicacion.operador.nombreFantasia;
const obtenerNombreProductor = (publicacion: PublicacionProductorListado) => publicacion.productor.nombreFantasia;

const publicaciones: PublicacionListado[] = [
    {
        id: 1,
        precio: 100,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Manzana",
        variedad: "Gala",
        envase: "Caja", kilos: "",
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 1,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "099000001",
        },
    },
];

const publicacionesVariedadUnica: PublicacionListado[] = [
    {
        ...publicaciones[0],
        especie: "Pera",
        variedad: "-",
    },
];

const publicacionesPrueba: PublicacionListado[] = [
    {
        id: 1,
        precio: 100,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Manzana",
        variedad: "Gala",
        envase: "Caja", kilos: "",
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 1,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "099000001",
        },
    },
    {
        id: 2,
        precio: 200,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Manzana",
        variedad: "Red",
        envase: "Bolsa", kilos: "",
        categoria: "II",
        calibre: "Mediano",
        codigoCalibre: "M",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 2,
            nombreFantasia: "Mercado Verde",
            whatsApp: "099000002",
        },
    },
    {
        id: 3,
        precio: 300,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Pera",
        variedad: "Williams",
        envase: "Caja", kilos: "",
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 3,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "099000003",
        },
    },
    {
        id: 4,
        precio: 400,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Pera",
        variedad: "Packham",
        envase: "Bolsa", kilos: "",
        categoria: "E",
        calibre: "Pequeño",
        codigoCalibre: "P",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 4,
            nombreFantasia: "Mercado Verde",
            whatsApp: "099000004",
        },
    },
];

const publicacionesEnvase: PublicacionListado[] = [
    {
        ...publicacionesPrueba[0],
        id: 1,
        variedad: "Gala",
        envase: "Caja", kilos: "",
    },
    {
        ...publicacionesPrueba[0],
        id: 5,
        variedad: "Gala",
        envase: "Bolsa", kilos: "",
    },
];

const publicacionesConPrecioNulo: PublicacionListado[] = [
    {
        ...publicacionesPrueba[0],
        id: 5,
        precio: null,
    },
    {
        ...publicacionesPrueba[1],
        id: 6,
        precio: 200,
    },
    {
        ...publicacionesPrueba[2],
        id: 7,
        precio: null,
    },
];

const publicacionesCombinacionInvalida: PublicacionListado[] = [
    {
        id: 1,
        precio: 100,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Manzana",
        variedad: "Gala",
        envase: "Caja", kilos: "",
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 1,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "123456789",
        },
    },
    {
        id: 2,
        precio: 200,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Manzana",
        variedad: "Red",
        envase: "Caja", kilos: "",
        categoria: "I",
        calibre: "Mediano",
        codigoCalibre: "M",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 1,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "123456789",
        },
    },
    {
        id: 3,
        precio: 300,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: "Manzana",
        variedad: "Red",
        envase: "Caja", kilos: "",
        categoria: "II",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 1,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "123456789",
        },
    },
];

describe("FiltrosPublicaciones", () => {

    const seleccionarFiltro = (nombre: string, valor: string) => {
        fireEvent.mouseDown(screen.getByRole("combobox", { name: nombre }));
        fireEvent.click(screen.getByRole("option", { name: valor }));
    };

    const seleccionarOrden = (valor: string) => {
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("menuitemradio", { name: valor }));
    };

    const comprobarOrdenActivo = (valor: string) => {
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(screen.getByRole("menuitemradio", { name: valor })).toHaveAttribute("aria-checked", "true");
        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    };

    it("incluye publicaciones con solo especie sin agregar opciones vacías a los filtros", () => {
        const alFiltrar = vi.fn();
        const minima: PublicacionListado = { ...publicaciones[0], id: 2, variedad: "", envase: "", kilos: "", categoria: "", calibre: "", codigoCalibre: "", pais: "", precio: null };
        const disponibles = [...publicaciones, minima];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={disponibles} especieFiltro="Manzana" alFiltrar={alFiltrar} />);

        expect(alFiltrar).toHaveBeenLastCalledWith(disponibles);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Gala"]);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        expect(alFiltrar).toHaveBeenLastCalledWith(publicaciones);
        seleccionarFiltro("Variedad", "Todas");
        expect(alFiltrar).toHaveBeenLastCalledWith(disponibles);
    });

    it("ofrece las naves disponibles y consulta por su nombre exacto", () => {
        const alConsultar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} opcionesRemotas={publicaciones} especieFiltro="" navesDisponibles={["B", "Tinglado", "A", "A"]} alConsultar={alConsultar} />);

        expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Todas");
        expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ nave: "Todas" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Nave" }));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Nave A", "Nave B", "Tinglado"]);
        fireEvent.click(screen.getByRole("option", { name: "Nave B" }));
        expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ nave: "B" }));

        seleccionarFiltro("Nave", "Tinglado");
        expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ nave: "Tinglado" }));
        seleccionarFiltro("Nave", "Todas");
        expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ nave: "Todas" }));
    });

    it("combina nave con los demás filtros y la restablece al limpiar", () => {
        const alConsultar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} opcionesRemotas={publicacionesPrueba} especieFiltro="" navesDisponibles={["A", "B"]} alConsultar={alConsultar} />);

        seleccionarFiltro("Nave", "Nave A");
        seleccionarFiltro("Especie", "Manzana");
        seleccionarFiltro("Variedad", "Gala");
        seleccionarFiltro("Empaquetado", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "Frutas del Sur" } });
        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "50" } });
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "200" } });
        seleccionarOrden("Mayor Precio");

        expect(alConsultar).toHaveBeenLastCalledWith({
            busqueda: "Frutas del Sur", especie: "Manzana", variedad: "Gala", envase: "Caja", kilos: "Todas",
            categoria: "I", calibre: "Grande", precioMinimo: "50", precioMaximo: "200", orden: "precioDesc", nave: "A",
        });

        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Todas");
        expect(alConsultar).toHaveBeenLastCalledWith({
            busqueda: "", especie: "Todas", variedad: "Todas", envase: "Todas", kilos: "Todas",
            categoria: "Todas", calibre: "Todas", precioMinimo: "", precioMaximo: "", orden: "ninguno", nave: "Todas",
        });
    }, 500_000);

    it.each([false, true])("omite Nave y su parámetro cuando no se habilita el filtro (consulta remota: %s)", (remota) => {
        const alConsultar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} opcionesRemotas={remota ? publicaciones : undefined} especieFiltro="" alConsultar={alConsultar} />);

        expect(screen.queryByRole("combobox", { name: "Nave" })).not.toBeInTheDocument();
        expect(alConsultar.mock.calls.at(-1)?.[0]).not.toHaveProperty("nave");
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "Manzana" } });
        expect(alConsultar.mock.calls.at(-1)?.[0]).not.toHaveProperty("nave");
    });

    it("conserva la nave seleccionada durante recargas sin resultados ni la opción original", () => {
        const alConsultar = vi.fn();
        const advertencia = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} opcionesRemotas={publicaciones} especieFiltro="" totalRemoto={1} navesDisponibles={["A", "B"]} alConsultar={alConsultar} />);
            seleccionarFiltro("Nave", "Nave B");
            alConsultar.mockClear();

            vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={[]} opcionesRemotas={[]} especieFiltro="" totalRemoto={0} navesDisponibles={["A"]} alConsultar={alConsultar} />);

            expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Nave B");
            expect(screen.getByText("0 publicaciones")).toBeInTheDocument();
            expect(alConsultar).not.toHaveBeenCalled();
            fireEvent.mouseDown(screen.getByRole("combobox", { name: "Nave" }));
            expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Nave A", "Nave B"]);
            fireEvent.click(screen.getByRole("option", { name: "Nave B" }));
            fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "Sin coincidencias" } });
            expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ busqueda: "Sin coincidencias", nave: "B" }));

            vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={[]} opcionesRemotas={[]} especieFiltro="" totalRemoto={0} navesDisponibles={[]} alConsultar={alConsultar} />);
            expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Nave B");
            seleccionarFiltro("Nave", "Todas");
            expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ nave: "Todas" }));
            expect(advertencia).not.toHaveBeenCalled();
        } finally {
            advertencia.mockRestore();
        }
    });

    it("mantiene visible la opción Todas aunque todavía no haya naves disponibles", () => {
        const alConsultar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={[]} opcionesRemotas={[]} especieFiltro="" navesDisponibles={[]} alConsultar={alConsultar} />);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Nave" }));
        expect(screen.getAllByRole("option")).toHaveLength(1);
        expect(screen.getByRole("option", { name: "Todas" })).toBeInTheDocument();
        expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ nave: "Todas" }));
    });

    it("descarta categoría y calibre desaparecidos al editar las publicaciones", () => {
        const alFiltrar = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro="" alFiltrar={alFiltrar}/>);
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");

        const actualizadas = [{ ...publicaciones[0], categoria: "II", calibre: "Pequeño" }];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={actualizadas} especieFiltro="" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Todas");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Todos");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual(actualizadas);
    });

    it("descarta una especie eliminada y sus filtros dependientes, y notifica al padre", () => {
        const alFiltrar = vi.fn();
        const alCambiarEspecie = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar} alCambiarEspecie={alCambiarEspecie}/>);
        seleccionarFiltro("Especie", "Manzana");
        seleccionarFiltro("Variedad", "Gala");
        seleccionarFiltro("Empaquetado", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");
        alCambiarEspecie.mockClear();

        const restantes = [publicacionesPrueba[3]];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={restantes} especieFiltro="" alFiltrar={alFiltrar} alCambiarEspecie={alCambiarEspecie}/>);

        for (const nombre of ["Especie", "Variedad", "Categoría"]) {
            expect(screen.getByRole("combobox", { name: nombre })).toHaveTextContent("Todas");
        }
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Todos");
        expect(alCambiarEspecie).toHaveBeenCalledExactlyOnceWith("Todas");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual(restantes);
    });

    it("descarta una variedad desaparecida y su envase, conservando las otras selecciones válidas", () => {
        const alFiltrar = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);
        seleccionarFiltro("Variedad", "Gala");
        seleccionarFiltro("Empaquetado", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");

        const actualizadas = [{ ...publicaciones[0], variedad: "Red", envase: "Bolsa" }];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={actualizadas} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveTextContent("Manzana");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Todas");
        expect(screen.getByRole("combobox", { name: "Empaquetado" })).toHaveTextContent("Todos");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("I");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Grande");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual(actualizadas);
    });

    it("descarta un envase desaparecida y conserva la variedad elegida", () => {
        const alFiltrar = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesEnvase} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);
        seleccionarFiltro("Variedad", "Gala");
        seleccionarFiltro("Empaquetado", "Caja");

        const restantes = [publicacionesEnvase[1]];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={restantes} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Gala");
        expect(screen.getByRole("combobox", { name: "Empaquetado" })).toHaveTextContent("Todos");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual(restantes);
    });

    it.each(["Categoría", "Calibre"])("conserva %s cuando una baja invalida la combinación y esa fue la última faceta elegida", (ultimaFaceta) => {
        const alFiltrar = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesCombinacionInvalida} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);
        const selecciones = ultimaFaceta === "Categoría" ? [["Calibre", "Grande"], ["Categoría", "I"]] : [["Categoría", "I"], ["Calibre", "Grande"]];
        for (const [nombre, valor] of selecciones) seleccionarFiltro(nombre, valor);

        const restantes = publicacionesCombinacionInvalida.slice(1);
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={restantes} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent(ultimaFaceta === "Categoría" ? "I" : "Todas");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent(ultimaFaceta === "Calibre" ? "Grande" : "Todos");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual([restantes[ultimaFaceta === "Categoría" ? 0 : 1]]);
    });

    it("conserva filtros válidos, búsqueda, rango de precio y orden cuando se actualiza el listado", () => {
        const alFiltrar = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);
        seleccionarFiltro("Variedad", "Gala");
        seleccionarFiltro("Empaquetado", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "Manzana" } });
        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "50" } });
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "200" } });
        seleccionarOrden("Menor Precio");

        const actualizadas = [{ ...publicaciones[0], precio: 150 }, { ...publicaciones[0], id: 2, precio: 75 }];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={actualizadas} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Gala");
        expect(screen.getByRole("combobox", { name: "Empaquetado" })).toHaveTextContent("Caja");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("I");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Grande");
        expect(screen.getByLabelText("Buscar publicaciones")).toHaveValue("Manzana");
        expect(screen.getByLabelText("Precio Mínimo")).toHaveValue("50");
        expect(screen.getByLabelText("Precio Máximo")).toHaveValue("200");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual([actualizadas[1], actualizadas[0]]);
    });

    it("renderiza los controles principales", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);

        // Buscador y filtros principales
        expect(screen.getByLabelText("Buscar publicaciones")).toBeInTheDocument();
        expect(screen.getByLabelText("Especie")).toBeInTheDocument();
        expect(screen.getByLabelText("Precio Mínimo")).toBeInTheDocument();
        expect(screen.getByLabelText("Precio Máximo")).toBeInTheDocument();

        // Botones principales
        expect(screen.getByRole("button", { name: /más filtros/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /ordenar por/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeInTheDocument();

        // Filtros adicionales
        expect(screen.getByLabelText("Variedad")).toBeInTheDocument();
        expect(screen.getByLabelText("Empaquetado")).toBeInTheDocument();
        expect(screen.getByLabelText("Calibre")).toBeInTheDocument();
        expect(screen.getByLabelText("Categoría")).toBeInTheDocument();

        // Opciones de ordenamiento
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(screen.queryByRole("menuitemradio", { name: /sin ordenar/i })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: /menor precio/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: /mayor precio/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: /^a-z$/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: /^z-a$/i })).toBeInTheDocument();
    });

    // Tests de estado inicial
    it("mantiene cerrados inicialmente los filtros adicionales y el ordenamiento", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const filtrosExtendidos = document.querySelector(`.${styles.filtrosExtendidos}`);
        expect(filtrosExtendidos).toBeInTheDocument();
        expect(document.querySelector(`.${styles.filtrosAbiertos}`)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ordenar por" })).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("abre y cierra los filtros adicionales al hacer click en Más filtros", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const layoutFiltros = document.querySelector(`.${styles.layoutFiltros}`);
        const botonMasFiltros = screen.getByRole("button", { name: /más filtros/i });
        expect(layoutFiltros).not.toHaveClass(styles.filtrosAbiertos);
        fireEvent.click(botonMasFiltros);
        expect(layoutFiltros).toHaveClass(styles.filtrosAbiertos);
        fireEvent.click(botonMasFiltros);
        expect(layoutFiltros).not.toHaveClass(styles.filtrosAbiertos);
    });

    it("abre las opciones de ordenamiento y permite cerrarlas con Escape", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const selectorOrden = screen.getByRole("button", { name: "Ordenar por" });
        expect(selectorOrden).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(selectorOrden);
        expect(selectorOrden).toHaveAttribute("aria-expanded", "true");
        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
        expect(selectorOrden).toHaveAttribute("aria-expanded", "false");
    });

    it("renderiza correctamente los campos de búsqueda y precio", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        expect(buscador).toHaveAttribute("type", "search");
        expect(precioMinimo).toHaveAttribute("type", "text");
        expect(precioMinimo).toHaveAttribute("inputmode", "numeric");
        expect(precioMinimo).toHaveAttribute("pattern", "0*[1-9][0-9]*");
        expect(precioMinimo).toHaveAttribute("placeholder", "Sin mínimo");
        expect(precioMaximo).toHaveAttribute("type", "text");
        expect(precioMaximo).toHaveAttribute("inputmode", "numeric");
        expect(precioMaximo).toHaveAttribute("pattern", "0*[1-9][0-9]*");
        expect(precioMaximo).toHaveAttribute("placeholder", "Sin máximo");
    });

    it("rechaza separadores, signos y letras en ambos precios, incluso al pegar", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");

        fireEvent.change(precioMinimo, { target: { value: "100" } });
        fireEvent.change(precioMaximo, { target: { value: "400" } });
        const llamadasValidas = alFiltrar.mock.calls.length;

        for (const valorInvalido of ["100.5", "100,5", "-100", "+100", "1e2", "abc"]) {
            fireEvent.change(precioMinimo, { target: { value: valorInvalido } });
            fireEvent.change(precioMaximo, { target: { value: valorInvalido } });
            expect(precioMinimo).toHaveValue("100");
            expect(precioMaximo).toHaveValue("400");
        }

        fireEvent.paste(precioMinimo, { clipboardData: { getData: () => "1.000" } });
        fireEvent.change(precioMinimo, { target: { value: "1.000" } });
        expect(precioMinimo).toHaveValue("100");
        expect(alFiltrar).toHaveBeenCalledTimes(llamadasValidas);
    });

    it("ordena las opciones con las tildes según el alfabeto español", () => {
        const nombres = ["Zeta", "Ágata", "Berro"];
        const publicacionesConOpciones = nombres.map((nombre, indice) => ({
            ...publicaciones[0],
            id: indice + 1,
            especie: "Manzana",
            variedad: nombre,
            envase: "Zeta", kilos: "",
            categoria: "Zeta",
            calibre: "Zeta",
        })).concat(["Ágata", "Berro"].map((nombre, indice) => ({
            ...publicaciones[0],
            id: indice + 4,
            especie: "Manzana",
            variedad: "Ágata",
            envase: nombre, kilos: "",
            categoria: nombre,
            calibre: nombre,
        })));
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConOpciones} especieFiltro=""/>);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Ágata", "Berro", "Zeta"]);
        fireEvent.click(screen.getByRole("option", { name: "Ágata" }));

        for (const [nombre, opcionInicial] of [["Empaquetado", "Todos"], ["Categoría", "Todas"], ["Calibre", "Todos"]]) {
            fireEvent.mouseDown(screen.getByRole("combobox", { name: nombre }));
            expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual([opcionInicial, "Ágata", "Berro", "Zeta"]);
            fireEvent.click(screen.getByRole("option", { name: opcionInicial }));
        }
    });

    it("prioriza las especies UAM y ordena las restantes con tildes según el alfabeto español", () => {
        const publicacionesConEspecies = ["Zanahoria", "Árbol", "Berro"].map((especie, indice) => ({
            ...publicaciones[0],
            id: indice + 1,
            especie,
        }));
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConEspecies} especieFiltro=""/>);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Zanahoria", "Árbol", "Berro"]);
    });

    it.each(["ninguno", "prioridad", "alfabeticoAsc", "precioDesc"] as const)("prioriza las especies del selector aunque el listado use el orden %s", (ordenInicial) => {
        const publicacionesConEspecies = ["Pera", "Morrón", "Banana", "Acelga", "Papa"].map((especie, indice) => ({
            ...publicaciones[0],
            id: indice + 1,
            especie,
        }));
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConEspecies} especieFiltro="" ordenInicial={ordenInicial}/>);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Papa", "Banana", "Morrón", "Acelga", "Pera"]);
    });

    it("cierra el menú de ordenamiento al seleccionar una opción", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const selectorOrden = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(selectorOrden);
        expect(selectorOrden).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Menor Precio" }));
        expect(selectorOrden).toHaveAttribute("aria-expanded", "false");
        comprobarOrdenActivo("Menor Precio");
    });

    it("mantiene el orden recibido cuando no se indica orden inicial", () => {
        const alFiltrar = vi.fn();
        const alCambiarOrden = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar} alCambiarOrden={alCambiarOrden} />);

        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.id)).toEqual([1, 2, 3, 4]);
        expect(alCambiarOrden).not.toHaveBeenCalled();
    });

    it("cambia visualmente la opción activa del ordenamiento", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro="" ordenInicial="alfabeticoAsc" />);
        const selectorOrden = screen.getByRole("button", { name: "Ordenar por" });

        fireEvent.click(selectorOrden);
        expect(screen.getByRole("menuitemradio", { name: "Por volumen" })).toHaveAttribute("aria-checked", "true");
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Menor Precio" }));

        comprobarOrdenActivo("Menor Precio");

        fireEvent.click(selectorOrden);
        expect(screen.getByRole("menuitemradio", { name: "Menor Precio" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toHaveAttribute("aria-checked", "false");
    });

    it("muestra la cantidad de publicaciones inicial", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        expect(screen.getByText("1 publicación")).toBeInTheDocument();
    });

    it("muestra el plural cuando hay varias publicaciones", () => {
        const variasPublicaciones = [
            publicaciones[0],
            {
                ...publicaciones[0],
                id: 2,
            },
        ];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={variasPublicaciones} especieFiltro=""/>);
        expect(screen.getByText("2 publicaciones")).toBeInTheDocument();
    });

    it("inicia los filtros con sus valores por defecto", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        expect(screen.getByLabelText("Especie")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Variedad")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Empaquetado")).toHaveTextContent("Todos");
        expect(screen.getByLabelText("Categoría")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Calibre")).toHaveTextContent("Todos");
    });

    it("solo condiciona variedad a especie; envase y kilos son independientes", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        const envase = screen.getByLabelText("Empaquetado");
        // Antes de seleccionar especie
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(envase).not.toHaveAttribute("aria-disabled", "true");
        expect(screen.getByLabelText("Kilos")).not.toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        // Despues de seleccionar especie
        expect(variedad).not.toHaveAttribute("aria-disabled");
        expect(envase).not.toHaveAttribute("aria-disabled", "true");
        expect(screen.getByLabelText("Kilos")).not.toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        // Despues de seleccionar variedad
        expect(envase).not.toHaveAttribute("aria-disabled");
    });

    it('selecciona automáticamente la variedad "-" y mantiene Envase habilitado', () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesVariedadUnica} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        const envase = screen.getByLabelText("Empaquetado");
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(envase).not.toHaveAttribute("aria-disabled", "true");
        expect(screen.getByLabelText("Kilos")).not.toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Pera" }));
        expect(variedad).toHaveTextContent("-");
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(envase).not.toHaveAttribute("aria-disabled");
    });

    it("limpia los filtros al hacer click en Limpiar filtros", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(buscador, { target: { value: "manzana" } });
        fireEvent.change(precioMinimo, { target: { value: "50" } });
        fireEvent.change(precioMaximo, { target: { value: "200" } });
        expect(buscador).toHaveValue("manzana");
        expect(precioMinimo).toHaveValue("50");
        expect(precioMaximo).toHaveValue("200");
        fireEvent.click(screen.getByRole("button", { name: /limpiar filtros/i }));
        expect(buscador).toHaveValue("");
        expect(precioMinimo).toHaveValue("");
        expect(precioMaximo).toHaveValue("");
    });

    it("muestra la cantidad de publicaciones al filtrar por especie", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        expect(screen.getByText("2 publicaciones")).toBeInTheDocument();
    });

    it("devuelve las publicaciones filtradas por especie mediante alFiltrar", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado[0].especie).toBe("Manzana");
        expect(resultado[1].especie).toBe("Manzana");
    });

    it("filtra las publicaciones por variedad", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const variedad = screen.getByLabelText("Variedad");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].variedad).toBe("Gala");
    });

    it("filtra las publicaciones por envase", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesEnvase} especieFiltro="" alFiltrar={alFiltrar}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const variedad = screen.getByLabelText("Variedad");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        const envase = screen.getByLabelText("Empaquetado");
        fireEvent.mouseDown(envase);
        fireEvent.click(screen.getByRole("option", { name: "Caja" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].envase).toBe("Caja");
    });

    it("filtra las publicaciones por categoría", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const categoria = screen.getByLabelText("Categoría");
        fireEvent.mouseDown(categoria);
        fireEvent.click(screen.getByRole("option", { name: "E" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].categoria).toBe("E");
    });

    it("filtra las publicaciones por calibre", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const calibre = screen.getByLabelText("Calibre");
        fireEvent.mouseDown(calibre);
        fireEvent.click(screen.getByRole("option", { name: "Pequeño" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].calibre).toBe("Pequeño");
    });

    it("filtra las publicaciones por búsqueda de texto", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        fireEvent.change(buscador, { target: { value: "manzana" } });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado.every((publicacion) => publicacion.especie === "Manzana")).toBe(true); 
    });

    it("filtra inmediatamente sin distinguir tildes", () => {
        const alFiltrar = vi.fn();
        const publicacionesConTildes = [
            { ...publicacionesPrueba[0], especie: "Ananá" },
            publicacionesPrueba[1],
        ];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConTildes} especieFiltro="" alFiltrar={alFiltrar}/>);

        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "anana" } });

        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.especie)).toEqual(["Ananá"]);
        expect(screen.getByText("1 publicación")).toBeInTheDocument();
    });

    it("filtra las publicaciones por nombre de operador", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        fireEvent.change(buscador, { target: { value: "Mercado Verde" } });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado.every((publicacion) => publicacion.operador.nombreFantasia === "Mercado Verde")).toBe(true);
    });

    it("filtra las publicaciones por precio minimo", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        fireEvent.change(precioMinimo, { target: { value: "250" } });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado[0].precio).toBe(300);
        expect(resultado[1].precio).toBe(400);
        fireEvent.change(precioMinimo, { target: { value: "250" } });
        fireEvent.change(precioMinimo, { target: { value: "-10" } });
        expect(precioMinimo).toHaveValue("250");
    });

    it("filtra las publicaciones por precio maximo", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(precioMaximo, { target: { value: "250" } });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado[0].precio).toBe(100);
        expect(resultado[1].precio).toBe(200);
        fireEvent.change(precioMaximo, { target: { value: "250" } });
        fireEvent.change(precioMaximo, { target: { value: "-10" } });
        expect(precioMaximo).toHaveValue("250");
    });

    it("filtra las publicaciones por rango de precio", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(precioMinimo, { target: { value: "150" } });
        fireEvent.change(precioMaximo, { target: { value: "350" } });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado.every((publicacion) => publicacion.precio !== null && publicacion.precio >= 150 && publicacion.precio <= 350)).toBe(true)
    });

    it.each(["Precio Mínimo", "Precio Máximo"])("acepta sólo un entero positivo o vacío en %s", (campo) => {
        const alConsultar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} opcionesRemotas={publicacionesPrueba} especieFiltro="" alConsultar={alConsultar}/>);
        const entrada = screen.getByLabelText(campo);
        expect(entrada).toHaveAttribute("inputmode", "numeric");
        expect(entrada).toHaveAttribute("maxlength", String(MAXIMO_DIGITOS_PRECIO));
        expect(screen.getByLabelText("Precio Mínimo")).toHaveAttribute("placeholder", "Sin mínimo");

        fireEvent.change(entrada, { target: { value: "9".repeat(MAXIMO_DIGITOS_PRECIO) } });
        expect(entrada).toHaveValue("9".repeat(MAXIMO_DIGITOS_PRECIO));
        fireEvent.change(entrada, { target: { value: "0250" } });
        expect(entrada).toHaveValue("0250");
        alConsultar.mockClear();
        for (const valor of ["0", "000", "-1", "1.5", "1,5", "1e3", "+1", "texto", " ", "9".repeat(MAXIMO_DIGITOS_PRECIO + 1)]) {
            fireEvent.change(entrada, { target: { value: valor } });
            expect(entrada).toHaveValue("0250");
        }
        expect(alConsultar).not.toHaveBeenCalled();

        fireEvent.change(entrada, { target: { value: "" } });
        expect(entrada).toHaveValue("");
        expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ precioMinimo: "", precioMaximo: "" }));
    });

    it("quitar ambos límites restaura publicaciones con y sin precio", () => {
        const alFiltrar = vi.fn();
        const ordenEsperado = [publicacionesConPrecioNulo[1], publicacionesConPrecioNulo[0], publicacionesConPrecioNulo[2]];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConPrecioNulo} especieFiltro="" alFiltrar={alFiltrar} />);
        expect(alFiltrar).toHaveBeenLastCalledWith(ordenEsperado);
        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "300" } });
        expect(alFiltrar).toHaveBeenLastCalledWith([publicacionesConPrecioNulo[1]]);
        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "" } });
        expect(alFiltrar).toHaveBeenLastCalledWith([publicacionesConPrecioNulo[1]]);
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "" } });
        expect(alFiltrar).toHaveBeenLastCalledWith(ordenEsperado);
    });

    it("no devuelve publicaciones cuando el rango de precio es inválido", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(precioMinimo, { target: { value: "350" } });
        fireEvent.change(precioMaximo, { target: { value: "150" } });
        const resultado =  alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(0);
    });

    it("ordena las publicaciones por precio ascendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        seleccionarOrden("Menor Precio");
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.precio)).toEqual([100, 200, 300, 400]);
    });

    it("ordena las publicaciones por precio descendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        seleccionarOrden("Mayor Precio");
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.precio)).toEqual([400, 300, 200, 100]);
    });

    it("ordena las publicaciones alfabéticamente de A a Z", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar} />);
        seleccionarOrden("A-Z");
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => [publicacion.especie, publicacion.variedad])).toEqual([["Manzana", "Gala"], ["Manzana", "Red"], ["Pera", "Williams"], ["Pera", "Packham"]]);
    });

    it("aplica A-Z desde el inicio cuando se indica ordenInicial", () => {
        const alFiltrar = vi.fn();
        const alCambiarOrden = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" ordenInicial="alfabeticoAsc" alFiltrar={alFiltrar} alCambiarOrden={alCambiarOrden} />);
        comprobarOrdenActivo("Por volumen");
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.id)).toEqual([1, 2, 3, 4]);
        expect(alCambiarOrden).not.toHaveBeenCalled();
    });

    it("restaura el orden inicial A-Z y avisa al limpiar filtros", () => {
        const alFiltrar = vi.fn();
        const alCambiarOrden = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" ordenInicial="alfabeticoAsc" alFiltrar={alFiltrar} alCambiarOrden={alCambiarOrden} />);
        seleccionarOrden("Mayor Precio");
        expect(alCambiarOrden).toHaveBeenLastCalledWith("precioDesc");
        expect((alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id)).toEqual([4, 3, 2, 1]);
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        comprobarOrdenActivo("Por volumen");
        expect(alCambiarOrden).toHaveBeenCalledTimes(2);
        expect(alCambiarOrden).toHaveBeenLastCalledWith("alfabeticoAsc");
        expect((alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id)).toEqual([1, 2, 3, 4]);
    });

    it("aplica la prioridad configurada mediante Por volumen", () => {
        const alFiltrar = vi.fn();
        const datos = [
            { ...publicaciones[0], id: 1, especie: "Pera", variedad: "Williams" },
            { ...publicaciones[0], id: 2, especie: "Manzana", variedad: "Red" },
            { ...publicaciones[0], id: 3, especie: "Papa", variedad: "-" },
            { ...publicaciones[0], id: 4, especie: "Manzana", variedad: "Gala" },
            { ...publicaciones[0], id: 5, especie: "Acelga", variedad: "-" },
            { ...publicaciones[0], id: 6, especie: "Banana", variedad: "-" },
        ];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={datos} especieFiltro="" ordenInicial="prioridad" alFiltrar={alFiltrar} />);
        const ids = () => (alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id);
        expect(ids()).toEqual([3, 6, 2, 4, 5, 1]);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(screen.queryByRole("menuitemradio", { name: "Sin ordenar" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Por volumen" })).toHaveAttribute("aria-checked", "true");
        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "manzana" } });
        expect(ids()).toEqual([2, 4]);
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(ids()).toEqual([3, 6, 2, 4, 5, 1]);
    });

    it("recupera la prioridad al limpiar filtros o elegir Por volumen sin volver a montar", () => {
        const alFiltrar = vi.fn();
        const datos = [
            { ...publicaciones[0], id: 1, especie: "Pera" },
            { ...publicaciones[0], id: 2, especie: "Papa" },
            { ...publicaciones[0], id: 3, especie: "Acelga" },
        ];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={datos} especieFiltro="" ordenInicial="prioridad" alFiltrar={alFiltrar}/>);
        const ids = () => (alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id);

        expect(ids()).toEqual([2, 3, 1]);
        seleccionarOrden("A-Z");
        expect(ids()).toEqual([3, 2, 1]);
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(ids()).toEqual([2, 3, 1]);
        comprobarOrdenActivo("Por volumen");
        seleccionarOrden("A-Z");
        expect(ids()).toEqual([3, 2, 1]);
        seleccionarOrden("Por volumen");
        expect(ids()).toEqual([2, 3, 1]);
    });

    it("ordena las publicaciones alfabéticamente de Z a A", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar} />);
        seleccionarOrden("Z-A");
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => [publicacion.especie, publicacion.variedad])).toEqual([["Pera", "Williams"], ["Pera", "Packham"], ["Manzana", "Gala"], ["Manzana", "Red"]]);
    });

    it("filtra por varias palabras sin distinguir mayúsculas y minúsculas", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        fireEvent.change(buscador, { target: { value: "MANZANA mercado" } });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].id).toBe(2);
        expect(resultado[0].especie).toBe("Manzana");
        expect(resultado[0].operador.nombreFantasia).toBe("Mercado Verde");
    });

    it("no ofrece Sin ordenar en el menú público", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" />);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(screen.queryByRole("menuitemradio", { name: "Sin ordenar" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Más actualizadas" })).toBeInTheDocument();
        expect(screen.getAllByRole("menuitemradio")).toHaveLength(6);
    });

    it("coloca las publicaciones sin precio al final al ordenar por precio", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConPrecioNulo} especieFiltro="" alFiltrar={alFiltrar}/>);
        seleccionarOrden("Menor Precio");
        const resultado = alFiltrar.mock.calls.at(-1)?.[0];
        expect(resultado).toHaveLength(3);
        expect(resultado[0].precio).toBe(200);
        expect(resultado[1].precio).toBeNull();
        expect(resultado[2].precio).toBeNull();
    });

    it("mantiene las publicaciones sin precio al final al ordenar por precio descendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConPrecioNulo} especieFiltro="" alFiltrar={alFiltrar}/>);
        seleccionarOrden("Mayor Precio");
        const resultado = alFiltrar.mock.calls.at(-1)?.[0];
        expect(resultado).toHaveLength(3);
        expect(resultado[0].precio).toBe(200);
        expect(resultado[1].precio).toBeNull();
        expect(resultado[2].precio).toBeNull();
    });

    it("restaura todas las variedades al seleccionar Todas", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        expect(variedad).toHaveTextContent("Todas");
        expect(variedad).not.toHaveAttribute("aria-disabled");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Todas" }));
        expect(especie).toHaveTextContent("Todas");
        expect(variedad).toHaveTextContent("Todas");
        expect(variedad).toHaveAttribute("aria-disabled", "true");
    });

    it("mantiene categoría y calibre válidos al cambiar la variedad", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        const categoria = screen.getByLabelText("Categoría");
        const calibre = screen.getByLabelText("Calibre");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        fireEvent.mouseDown(categoria);
        fireEvent.click(screen.getByRole("option", { name: "I" }));
        fireEvent.mouseDown(calibre);
        fireEvent.click(screen.getByRole("option", { name: "Grande" }));
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        expect(categoria).toHaveTextContent("I");
        expect(calibre).toHaveTextContent("Grande");
    });

    it("restablece categoría y calibre cuando dejan de ser válidos al cambiar la variedad", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const categoria = screen.getByLabelText("Categoría");
        fireEvent.mouseDown(categoria);
        fireEvent.click(screen.getByRole("option", { name: "I" }));
        const calibre = screen.getByLabelText("Calibre");
        fireEvent.mouseDown(calibre);
        fireEvent.click(screen.getByRole("option", { name: "Grande" }));
        const variedad = screen.getByLabelText("Variedad");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Red" }));
        expect(categoria).toHaveTextContent("Todas");
        expect(calibre).toHaveTextContent("Todos");
    });

    it("permite restablecer el calibre seleccionando Todos", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro=""/>);
        const calibre = screen.getByLabelText("Calibre");
        fireEvent.mouseDown(calibre);
        fireEvent.click(screen.getByRole("option", { name: "Grande" }));
        expect(calibre).toHaveTextContent("Grande");
        fireEvent.mouseDown(calibre);
        fireEvent.click(screen.getByRole("option", { name: "Todos" }));
        expect(calibre).toHaveTextContent("Todos");
    });

    it("restablece la categoría cuando el calibre seleccionado deja de ser válido", () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const publicacionesPruebaCalibre: PublicacionListado[] = [
                {
                    ...publicacionesPrueba[0],
                    id: 1,
                    variedad: "Gala",
                    categoria: "I",
                    calibre: "Grande",
                },
                {
                    ...publicacionesPrueba[1],
                    id: 2,
                    variedad: "Red",
                    categoria: "I",
                    calibre: "Mediano",
                },
            ];

            render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPruebaCalibre} especieFiltro=""/>);
            const categoria = screen.getByLabelText("Categoría");
            fireEvent.mouseDown(categoria);
            fireEvent.click(screen.getByRole("option", { name: "I" }));
            const calibre = screen.getByLabelText("Calibre");
            publicacionesPruebaCalibre[0].calibre = "Mediano";
            fireEvent.mouseDown(calibre);
            fireEvent.click(screen.getByRole("option", { name: "Grande" }));
            expect(categoria).toHaveTextContent("Todas");
        } finally {
            consoleError.mockRestore();
        }
    });

    it("restablece el calibre cuando la categoría seleccionada deja de ser válida", () => {
            const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const publicacionesPruebaCategoria: PublicacionListado[] = [
                {
                    ...publicacionesPrueba[0],
                    id: 1,
                    variedad: "Gala",
                    categoria: "I",
                    calibre: "Grande",
                },
                {
                    ...publicacionesPrueba[1],
                    id: 2,
                    variedad: "Red",
                    categoria: "II",
                    calibre: "Grande",
                },
            ];

            render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPruebaCategoria} especieFiltro=""/>);
            const calibre = screen.getByLabelText("Calibre");
            fireEvent.mouseDown(calibre);
            fireEvent.click(screen.getByRole("option", { name: "Grande" }));
            const categoria = screen.getByLabelText("Categoría");
            publicacionesPruebaCategoria[0].categoria = "II";
            fireEvent.mouseDown(categoria);
            fireEvent.click(screen.getByRole("option", { name: "I" }));
            expect(calibre).toHaveTextContent("Todos");
        } finally {
            consoleError.mockRestore();
        }

    });

    it("mantiene la categoría y restablece el calibre cuando la combinación deja de ser válida", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesCombinacionInvalida} especieFiltro=""/>);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Calibre" }));
        fireEvent.click(screen.getByRole("option", { name: "Grande" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Categoría" }));
        fireEvent.click(screen.getByRole("option", { name: "I" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        fireEvent.click(screen.getByRole("option", { name: "Red" }));
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("I");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Todos");
    });

    it("mantiene el calibre y restablece la categoría cuando la combinación deja de ser válida", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesCombinacionInvalida} especieFiltro=""/>);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Categoría" }));
        fireEvent.click(screen.getByRole("option", { name: "I" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Calibre" }));
        fireEvent.click(screen.getByRole("option", { name: "Grande" }));
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("I");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Grande");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        fireEvent.click(screen.getByRole("option", { name: "Red" }));
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Todas");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Grande");
    });

    it("aplica la especie recibida como filtro inicial", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado.every((publicacion) => publicacion.especie === "Manzana")).toBe(true);
    });

    it("permite filtrar envase al ingresar con una especie cuya única variedad es guion", () => {
        const alFiltrar = vi.fn();
        const publicaciones = [
            { ...publicacionesVariedadUnica[0], id: 1, envase: "Caja" },
            { ...publicacionesVariedadUnica[0], id: 2, envase: "Bolsa" },
        ];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro="Pera" alFiltrar={alFiltrar} />);

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveAttribute("aria-disabled", "true");
        const envase = screen.getByRole("combobox", { name: "Empaquetado" });
        expect(envase).not.toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(envase);
        fireEvent.click(screen.getByRole("option", { name: "Bolsa" }));

        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual([publicaciones[1]]);
    });

    it("filtra publicaciones por nombre de productor", () => {
        const base: PublicacionProductorListado = {
            id: 1,
            precio: 100,
            fecha: "2026-10-03T15:00:00.000Z",
            foto: null,
            especie: "Manzana",
            variedad: "Gala",
            envase: "Caja", kilos: "",
            categoria: "I",
            calibre: "Grande",
            codigoCalibre: "G",
            pais: "Uruguay",
            tipoPublicacion: "PRODUCTOR",
            productor: {
                id: 1,
                nombreFantasia: "Mercado Verde",
                fotoPerfil: null,
                whatsApp: "099000001",
            },
            ubicaciones: [],
        };

        const otraPublicacion: PublicacionProductorListado = {
            ...base,
            id: 2,
            productor: {
                ...base.productor,
                id: 2,
                nombreFantasia: "Frutas del Sur",
            },
        };
        const alFiltrar = vi.fn();
        render(
            <FiltrosPublicaciones
                publicaciones={[base, otraPublicacion]}
                especieFiltro=""
                obtenerNombreFantasia={obtenerNombreProductor}
                alFiltrar={alFiltrar}
            />
        );
        expect(screen.queryByRole("combobox", { name: "Nave" })).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), {target: { value: "mercado verde" }});
        expect(alFiltrar).toHaveBeenLastCalledWith([base]);
    });
});

describe("ordenamiento configurado por el administrador", () => {
    const datosOrdenamiento = [
        { especie: "Tomate", variedad: "", envase: "Caja", kilos: "", categoria: "I", calibre: "M", codigoCalibre: "M", precio: 30, fecha: "2026-11-01T12:00:00.000Z" },
        { especie: "Acelga", variedad: "", envase: "Caja", kilos: "", categoria: "I", calibre: "M", codigoCalibre: "M", precio: 50, fecha: "2026-11-01T12:00:01.000Z" },
        { especie: "Papa", variedad: "", envase: "Caja", kilos: "", categoria: "I", calibre: "M", codigoCalibre: "M", precio: 10, fecha: "2026-11-01T12:00:02.000Z" },
    ];

    const obtenerNombre = () => "Operador de prueba";

    function prepararOrdenamiento(ordenInicial: OrdenPublicaciones = "alfabeticoAsc", ordenamientoHabilitado = true) {
        const props = {
            publicaciones: datosOrdenamiento,
            especieFiltro: "",
            obtenerNombreFantasia: obtenerNombre,
            ordenInicial,
            ordenamientoHabilitado,
            alFiltrar: vi.fn(),
            alConsultar: vi.fn(),
            alCambiarOrden: vi.fn(),
        };

        return { ...render(<FiltrosPublicaciones {...props} />), props };
    }

    function nombresFiltrados(callback: ReturnType<typeof vi.fn>) {
        const ultimaLlamada = callback.mock.calls.at(-1);
        return (ultimaLlamada?.[0] as typeof datosOrdenamiento).map((publicacion) => publicacion.especie);
    }

    async function elegirOrdenConfigurado(etiqueta: string) {
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(await screen.findByRole("menuitemradio", { name: etiqueta }));
        await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    }

    afterEach(cleanup);

    it("oculta Ordenar por cuando está deshabilitado", () => {
        prepararOrdenamiento("alfabeticoAsc", false);
        expect(screen.queryByRole("button", { name: "Ordenar por" })).not.toBeInTheDocument();
    });

    it("mantiene disponibles la búsqueda y los demás filtros", () => {
        prepararOrdenamiento("alfabeticoAsc", false);
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Más filtros" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeEnabled();
    });

    it("ofrece las cinco opciones públicas", async () => {
        prepararOrdenamiento("prioridad");
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(await screen.findByRole("menuitemradio", { name: "Menor Precio" })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Mayor Precio" })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Z-A" })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Más actualizadas" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitemradio", { name: "Más vendidas" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitemradio", { name: "Sin ordenar" })).not.toBeInTheDocument();
        expect(screen.getAllByRole("menuitemradio")).toHaveLength(6);
    });

    it.each([
        { orden: "alfabeticoAsc", esperado: ["Acelga", "Papa", "Tomate"] },
        { orden: "alfabeticoDesc", esperado: ["Tomate", "Papa", "Acelga"] },
        { orden: "precioAsc", esperado: ["Papa", "Tomate", "Acelga"] },
        { orden: "precioDesc", esperado: ["Acelga", "Tomate", "Papa"] },
        { orden: "prioridad", esperado: ["Papa", "Tomate", "Acelga"] },
    ] satisfies { orden: OrdenPublicaciones; esperado: string[] }[])("aplica el predeterminado $orden con el switch apagado", ({ orden, esperado }) => {
        const { props } = prepararOrdenamiento(orden, false);
        expect(nombresFiltrados(props.alFiltrar)).toEqual(esperado);
        expect(props.alConsultar.mock.calls.at(-1)![0]).toMatchObject({ orden });
    });

    it("permite elegir otro orden cuando está habilitado", async () => {
        const { props } = prepararOrdenamiento();
        await elegirOrdenConfigurado("Mayor Precio");

        expect(props.alCambiarOrden).toHaveBeenCalledExactlyOnceWith("precioDesc");
        expect(nombresFiltrados(props.alFiltrar)).toEqual(["Acelga", "Tomate", "Papa"]);
        expect(props.alConsultar.mock.calls.at(-1)![0]).toMatchObject({ orden: "precioDesc" });
    });

    it.each(["prioridad", "precioAsc", "alfabeticoDesc"] as const)("Por volumen comunica el orden administrativo %s a la consulta", async (ordenInicial) => {
        const { props } = prepararOrdenamiento(ordenInicial);
        const iniciales = nombresFiltrados(props.alFiltrar);
        await elegirOrdenConfigurado("Mayor Precio");
        await elegirOrdenConfigurado("Por volumen");

        expect(nombresFiltrados(props.alFiltrar)).toEqual(iniciales);
        expect(props.alCambiarOrden).toHaveBeenLastCalledWith(ordenInicial);
        expect(props.alConsultar.mock.calls.at(-1)![0]).toMatchObject({ orden: ordenInicial });
    });

    it("ignora la selección local al deshabilitar el ordenamiento", async () => {
        const { rerender, props } = prepararOrdenamiento();
        await elegirOrdenConfigurado("Z-A");
        expect(nombresFiltrados(props.alFiltrar)).toEqual(["Tomate", "Papa", "Acelga"]);

        rerender(<FiltrosPublicaciones {...props} ordenamientoHabilitado={false} />);

        expect(screen.queryByRole("button", { name: "Ordenar por" })).not.toBeInTheDocument();
        expect(nombresFiltrados(props.alFiltrar)).toEqual(["Acelga", "Papa", "Tomate"]);
        expect(props.alConsultar.mock.calls.at(-1)![0]).toMatchObject({ orden: "alfabeticoAsc" });
    });

    it("respeta un nuevo predeterminado cuando el switch está apagado", () => {
        const { rerender, props } = prepararOrdenamiento("alfabeticoAsc", false);

        rerender(<FiltrosPublicaciones {...props} ordenInicial="precioDesc" />);

        expect(nombresFiltrados(props.alFiltrar)).toEqual(["Acelga", "Tomate", "Papa"]);
        expect(props.alConsultar.mock.calls.at(-1)![0]).toMatchObject({ orden: "precioDesc" });
    });

    it("mantiene el predeterminado al buscar con el switch apagado", () => {
        const { props } = prepararOrdenamiento("alfabeticoDesc", false);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "Papa" } });

        expect(nombresFiltrados(props.alFiltrar)).toEqual(["Papa"]);
        expect(props.alConsultar.mock.calls.at(-1)![0]).toMatchObject({ orden: "alfabeticoDesc" });
    });

    it("restaura el orden inicial al limpiar filtros si no es prioridad", async () => {
        const { props } = prepararOrdenamiento();
        await elegirOrdenConfigurado("Z-A");
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

        expect(nombresFiltrados(props.alFiltrar)).toEqual(["Acelga", "Papa", "Tomate"]);
        expect(props.alCambiarOrden).toHaveBeenLastCalledWith("alfabeticoAsc");
    });
});

describe("ponderación y actualización de publicaciones", () => {
    afterEach(cleanup);

    function crearPublicacion(cambios: Partial<PublicacionListado> = {}): PublicacionListado {
        return {
            id: 1,
            precio: 100,
            fecha: "2026-11-01T12:00:00.000Z",
            foto: null,
            especie: "Tomate",
            variedad: "",
            envase: "", kilos: "",
            cantidadUnidades: null,
            categoria: "",
            calibre: "",
            codigoCalibre: "",
            pais: "",
            tipoPublicacion: "OPERADOR",
            operador: { id: 1, nombreFantasia: "Huerta del Sur", whatsApp: "099123456" },
            ...cambios,
        };
    }

    function preparar(publicaciones: PublicacionListado[], ordenInicial: OrdenPublicaciones = "prioridad", especieFiltro = "") {
        const alFiltrar = vi.fn();
        const alConsultar = vi.fn();
        const alCambiarOrden = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicaciones} especieFiltro={especieFiltro} obtenerNombreFantasia={obtenerNombreOperador} ordenInicial={ordenInicial} alFiltrar={alFiltrar} alConsultar={alConsultar} alCambiarOrden={alCambiarOrden} />);
        return { alFiltrar, alConsultar, alCambiarOrden };
    }

    function idsFiltrados(callback: ReturnType<typeof vi.fn>): number[] {
        return (callback.mock.calls.at(-1)![0] as PublicacionListado[]).map((publicacion) => publicacion.id);
    }

    async function elegirOrden(etiqueta: string) {
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(await screen.findByRole("menuitemradio", { name: etiqueta }));
        await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    }

    it("respeta el menor precio aunque la publicación más cara tenga más datos", () => {
        const barata = crearPublicacion({ id: 1, precio: 100 });
        const completa = crearPublicacion({ id: 2, precio: 200, foto: "/tomate.webp" });
        const { alFiltrar } = preparar([completa, barata], "precioAsc");
        expect(idsFiltrados(alFiltrar)).toEqual([1, 2]);
    });

    it("respeta el mayor precio aunque la publicación más barata tenga más datos", () => {
        const cara = crearPublicacion({ id: 1, precio: 200 });
        const completa = crearPublicacion({ id: 2, precio: 100, foto: "/tomate.webp" });
        const { alFiltrar } = preparar([completa, cara], "precioDesc");
        expect(idsFiltrados(alFiltrar)).toEqual([1, 2]);
    });

    it.each(["precioAsc", "precioDesc"] as const)("desempata precios iguales por puntos entre especies distintas con %s", (orden) => {
        const acelga = crearPublicacion({ id: 1, especie: "Acelga" });
        const tomate = crearPublicacion({ id: 2, foto: "/tomate.webp" });
        const { alFiltrar } = preparar([acelga, tomate], orden);
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it.each(["precioAsc", "precioDesc"] as const)("desempata precios y puntos iguales por fecha con %s", (orden) => {
        const antigua = crearPublicacion({ id: 1, especie: "Acelga" });
        const reciente = crearPublicacion({ id: 2, fecha: "2026-11-01T12:00:01.000Z" });
        const { alFiltrar } = preparar([antigua, reciente], orden);
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it.each(["precioAsc", "precioDesc"] as const)("mantiene las publicaciones sin precio al final con %s", (orden) => {
        const conPrecio = crearPublicacion({ id: 1 });
        const sinPrecio = crearPublicacion({ id: 2, precio: null, foto: "/tomate.webp" });
        const { alFiltrar } = preparar([sinPrecio, conPrecio], orden);
        expect(idsFiltrados(alFiltrar)).toEqual([1, 2]);
    });

    it.each(["precioAsc", "precioDesc"] as const)("desempata publicaciones sin precio por puntos con %s", (orden) => {
        const incompleta = crearPublicacion({ id: 1, precio: null });
        const completa = crearPublicacion({ id: 2, precio: null, foto: "/tomate.webp" });
        const { alFiltrar } = preparar([incompleta, completa], orden);
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it.each([
        { orden: "alfabeticoAsc", esperado: [1, 2] },
        { orden: "alfabeticoDesc", esperado: [2, 1] },
    ] as const)("respeta la especie antes de comparar puntos con $orden", ({ orden, esperado }) => {
        const acelga = crearPublicacion({ id: 1, especie: "Acelga" });
        const tomate = crearPublicacion({ id: 2, foto: "/tomate.webp" });
        const { alFiltrar } = preparar([tomate, acelga], orden);
        expect(idsFiltrados(alFiltrar)).toEqual(esperado);
    });

    it.each(["alfabeticoAsc", "alfabeticoDesc"] as const)("prioriza los puntos sobre la variedad dentro de la misma especie con %s", (orden) => {
        const incompleta = crearPublicacion({ id: 1, variedad: "Americano" });
        const completa = crearPublicacion({ id: 2, variedad: "Perita", foto: "/tomate.webp" });
        const { alFiltrar } = preparar([incompleta, completa], orden);
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it.each(["alfabeticoAsc", "alfabeticoDesc"] as const)("mantiene la fecha descendente al empatar especie y puntos con %s", (orden) => {
        const antigua = crearPublicacion({ id: 1 });
        const reciente = crearPublicacion({ id: 2, fecha: "2026-11-01T12:00:01.000Z" });
        const { alFiltrar } = preparar([antigua, reciente], orden);
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it("respeta las especies prioritarias antes de comparar los puntos", () => {
        const papa = crearPublicacion({ id: 1, especie: "Papa" });
        const tomate = crearPublicacion({ id: 2, foto: "/tomate.webp" });
        const acelga = crearPublicacion({ id: 3, especie: "Acelga", foto: "/acelga.webp", variedad: "Verde" });
        const { alFiltrar } = preparar([acelga, tomate, papa]);
        expect(idsFiltrados(alFiltrar)).toEqual([1, 2, 3]);
    });

    it("ordena las especies no prioritarias alfabéticamente", () => {
        const ajo = crearPublicacion({ id: 1, especie: "Ajo" });
        const acelga = crearPublicacion({ id: 2, especie: "Acelga" });
        const { alFiltrar } = preparar([ajo, acelga]);
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it("aplica puntos y fecha al filtrar una sola especie con Más vendidas", () => {
        const incompleta = crearPublicacion({ id: 1, especie: "Papa", fecha: "2026-11-01T12:00:05.000Z" });
        const completaAntigua = crearPublicacion({ id: 2, especie: "Papa", foto: "/papa.webp" });
        const completaReciente = crearPublicacion({ id: 3, especie: "Papa", foto: "/papa.webp", fecha: "2026-11-01T12:00:01.000Z" });
        const tomate = crearPublicacion({ id: 4 });
        const { alFiltrar } = preparar([incompleta, completaAntigua, tomate, completaReciente], "prioridad", "Papa");
        expect(idsFiltrados(alFiltrar)).toEqual([3, 2, 1]);
    });

    it("prioriza la actualización sobre los puntos al ordenar por fecha", () => {
        const completaAntigua = crearPublicacion({ id: 1, foto: "/tomate.webp" });
        const incompletaReciente = crearPublicacion({ id: 2, fecha: "2026-11-01T12:00:01.000Z" });
        const { alFiltrar } = preparar([completaAntigua, incompletaReciente], "fechaDesc");
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it("desempata fechas iguales por puntos entre especies distintas", () => {
        const acelga = crearPublicacion({ id: 1, especie: "Acelga" });
        const tomate = crearPublicacion({ id: 2, foto: "/tomate.webp" });
        const { alFiltrar } = preparar([acelga, tomate], "fechaDesc");
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it.each<OrdenPublicaciones>(["prioridad", "precioAsc", "precioDesc", "alfabeticoAsc", "alfabeticoDesc", "fechaDesc", "ninguno"])("desempata por ID cuando los demás criterios coinciden con %s", (orden) => {
        const primera = crearPublicacion({ id: 1 });
        const segunda = crearPublicacion({ id: 2 });
        const { alFiltrar } = preparar([segunda, primera], orden);
        expect(idsFiltrados(alFiltrar)).toEqual([1, 2]);
    });

    it("permite seleccionar Más actualizadas y comunica el orden al padre", async () => {
        const antigua = crearPublicacion({ id: 1 });
        const reciente = crearPublicacion({ id: 2, fecha: "2026-11-01T12:00:01.000Z" });
        const { alFiltrar, alConsultar, alCambiarOrden } = preparar([antigua, reciente]);
        await elegirOrden("Más actualizadas");
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
        expect(alCambiarOrden).toHaveBeenCalledExactlyOnceWith("fechaDesc");
        expect(alConsultar).toHaveBeenLastCalledWith(expect.objectContaining({ orden: "fechaDesc" }));
    });

    it("conserva el desempate por puntos después de buscar", () => {
        const incompleta = crearPublicacion({ id: 1 });
        const completa = crearPublicacion({ id: 2, foto: "/tomate.webp" });
        const otraEspecie = crearPublicacion({ id: 3, especie: "Papa" });
        const { alFiltrar } = preparar([incompleta, otraEspecie, completa], "precioAsc");
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "Tomate" } });
        expect(idsFiltrados(alFiltrar)).toEqual([2, 1]);
    });

    it("ordena productores por actualización sin aplicar la ponderación de operadores", () => {
        const base = crearPublicacion();
        const antigua: PublicacionProductorListado = {
            id: base.id,
            precio: base.precio,
            fecha: base.fecha,
            foto: "/tomate.webp",
            especie: base.especie,
            variedad: "Perita",
            envase: "Caja", kilos: "",
            categoria: "I",
            calibre: "Grande",
            codigoCalibre: "G",
            pais: "Uruguay",
            tipoPublicacion: "PRODUCTOR",
            productor: { id: 1, nombreFantasia: "Quinta del Sur", fotoPerfil: null, whatsApp: "099123456" },
            ubicaciones: [],
        };
        const reciente: PublicacionProductorListado = { ...antigua, id: 2, foto: null, fecha: "2026-11-01T12:00:01.000Z" };
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={[antigua, reciente]} especieFiltro="" obtenerNombreFantasia={obtenerNombreProductor} ordenInicial="fechaDesc" alFiltrar={alFiltrar} />);
        expect((alFiltrar.mock.calls.at(-1)![0] as PublicacionProductorListado[]).map((publicacion) => publicacion.id)).toEqual([2, 1]);
    });
});

describe("envase y kilos independientes", () => {
    const datos = [
        { ...publicaciones[0], id: 1, envase: "Cajon", kilos: "20", variedad: "" },
        { ...publicaciones[0], id: 2, envase: "Bolsa", kilos: "20", especie: "Papa", variedad: "" },
        { ...publicaciones[0], id: 3, envase: "Cajon", kilos: "10-12", especie: "Papa", variedad: "" },
    ];

    function seleccionar(nombre: string, opcion: string) {
        fireEvent.mouseDown(screen.getByRole("combobox", { name: nombre }));
        fireEvent.click(screen.getByRole("option", { name: opcion }));
    }

    it("filtra por kilos sin seleccionar envase, especie ni variedad", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={datos} especieFiltro="" obtenerNombreFantasia={obtenerNombreOperador} alFiltrar={alFiltrar} />);
        seleccionar("Kilos", "20 kg");
        expect(alFiltrar.mock.lastCall?.[0].map((p: PublicacionListado) => p.id)).toEqual([1, 2]);
        seleccionar("Empaquetado", "Cajon");
        expect(alFiltrar.mock.lastCall?.[0].map((p: PublicacionListado) => p.id)).toEqual([1]);
        seleccionar("Empaquetado", "Todos");
        expect(screen.getByRole("combobox", { name: "Kilos" })).toHaveTextContent("20 kg");
        expect(alFiltrar.mock.lastCall?.[0].map((p: PublicacionListado) => p.id)).toEqual([1, 2]);
    });

    it("conserva envase y kilos al cambiar de especie y los limpia al solicitarlo", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={datos} especieFiltro="" obtenerNombreFantasia={obtenerNombreOperador} alFiltrar={alFiltrar} />);
        seleccionar("Empaquetado", "Cajon");
        seleccionar("Kilos", "10-12 kg");
        seleccionar("Especie", "Papa");
        expect(screen.getByRole("combobox", { name: "Empaquetado" })).toHaveTextContent("Cajon");
        expect(screen.getByRole("combobox", { name: "Kilos" })).toHaveTextContent("10-12 kg");
        expect(alFiltrar.mock.lastCall?.[0].map((p: PublicacionListado) => p.id)).toEqual([3]);
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(screen.getByRole("combobox", { name: "Empaquetado" })).toHaveTextContent("Todos");
        expect(screen.getByRole("combobox", { name: "Kilos" })).toHaveTextContent("Todos");
        expect(alFiltrar.mock.lastCall?.[0]).toHaveLength(3);
    });
});
