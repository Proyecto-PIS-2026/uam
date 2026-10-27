import { render, screen, fireEvent } from "@testing-library/react";
import styles from "./FiltrosPublicaciones.module.css";
import FiltrosPublicaciones from "./FiltrosPublicaciones";
import type { PublicacionListado } from "../../consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "../../consulta-mercado/acciones/PublicacionesProductor";
import { MAXIMO_DIGITOS_PRECIO } from "@/modulos/publicaciones/precio-publicacion";

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
        presentacion: "Caja",
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
        presentacion: "Caja",
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
        presentacion: "Bolsa",
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
        presentacion: "Caja",
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
        presentacion: "Bolsa",
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

const publicacionesPresentacion: PublicacionListado[] = [
    {
        ...publicacionesPrueba[0],
        id: 1,
        variedad: "Gala",
        presentacion: "Caja",
    },
    {
        ...publicacionesPrueba[0],
        id: 5,
        variedad: "Gala",
        presentacion: "Bolsa",
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
        presentacion: "Caja",
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
        presentacion: "Caja",
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
        presentacion: "Caja",
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

    it("incluye publicaciones con solo especie sin agregar opciones vacías a los filtros", () => {
        const alFiltrar = vi.fn();
        const minima: PublicacionListado = { ...publicaciones[0], id: 2, variedad: "", presentacion: "", categoria: "", calibre: "", codigoCalibre: "", pais: "", precio: null };
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
        seleccionarFiltro("Presentación", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "Frutas del Sur" } });
        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "50" } });
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "200" } });
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Mayor Precio" }));

        expect(alConsultar).toHaveBeenLastCalledWith({
            busqueda: "Frutas del Sur", especie: "Manzana", variedad: "Gala", presentacion: "Caja",
            categoria: "I", calibre: "Grande", precioMinimo: "50", precioMaximo: "200", orden: "precioDesc", nave: "A",
        });

        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Todas");
        expect(alConsultar).toHaveBeenLastCalledWith({
            busqueda: "", especie: "Todas", variedad: "Todas", presentacion: "Todas",
            categoria: "Todas", calibre: "Todas", precioMinimo: "", precioMaximo: "", orden: "ninguno", nave: "Todas",
        });
    });

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
        seleccionarFiltro("Presentación", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");
        alCambiarEspecie.mockClear();

        const restantes = [publicacionesPrueba[3]];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={restantes} especieFiltro="" alFiltrar={alFiltrar} alCambiarEspecie={alCambiarEspecie}/>);

        for (const nombre of ["Especie", "Variedad", "Presentación", "Categoría"]) {
            expect(screen.getByRole("combobox", { name: nombre })).toHaveTextContent("Todas");
        }
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Todos");
        expect(alCambiarEspecie).toHaveBeenCalledExactlyOnceWith("Todas");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual(restantes);
    });

    it("descarta una variedad desaparecida y su presentación, conservando las otras selecciones válidas", () => {
        const alFiltrar = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);
        seleccionarFiltro("Variedad", "Gala");
        seleccionarFiltro("Presentación", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");

        const actualizadas = [{ ...publicaciones[0], variedad: "Red", presentacion: "Bolsa" }];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={actualizadas} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveTextContent("Manzana");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Todas");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveTextContent("Todas");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("I");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Grande");
        expect(alFiltrar.mock.calls.at(-1)?.[0]).toEqual(actualizadas);
    });

    it("descarta una presentación desaparecida y conserva la variedad elegida", () => {
        const alFiltrar = vi.fn();
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPresentacion} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);
        seleccionarFiltro("Variedad", "Gala");
        seleccionarFiltro("Presentación", "Caja");

        const restantes = [publicacionesPresentacion[1]];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={restantes} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Gala");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveTextContent("Todas");
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
        seleccionarFiltro("Presentación", "Caja");
        seleccionarFiltro("Categoría", "I");
        seleccionarFiltro("Calibre", "Grande");
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "Manzana" } });
        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "50" } });
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "200" } });
        fireEvent.click(screen.getByRole("button", { name: /menor precio/i }));

        const actualizadas = [{ ...publicaciones[0], precio: 150 }, { ...publicaciones[0], id: 2, precio: 75 }];
        vista.rerender(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={actualizadas} especieFiltro="Manzana" alFiltrar={alFiltrar}/>);

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Gala");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveTextContent("Caja");
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
        expect(screen.getByLabelText("Presentación")).toBeInTheDocument();
        expect(screen.getByLabelText("Calibre")).toBeInTheDocument();
        expect(screen.getByLabelText("Categoría")).toBeInTheDocument();

        // Opciones de ordenamiento
        expect(screen.getByRole("button", { name: /sin ordenar/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /menor precio/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /mayor precio/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^a-z$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^z-a$/i })).toBeInTheDocument();
    });

    // Tests de estado inicial
    it("mantiene cerrados inicialmente los filtros adicionales y el ordenamiento", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const filtrosExtendidos = document.querySelector(`.${styles.filtrosExtendidos}`);
        const listaOrdenamiento = document.querySelector(`.${styles.listaOrdenamiento}`);
        expect(filtrosExtendidos).toBeInTheDocument();
        expect(listaOrdenamiento).toBeInTheDocument();
        expect(document.querySelector(`.${styles.filtrosAbiertos}`)).not.toBeInTheDocument();
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
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

    it("abre y cierra las opciones de ordenamiento al hacer click en Ordenar por", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const listaOrdenamiento = document.querySelector(`.${styles.listaOrdenamiento}`);
        const botonOrdenar = screen.getByRole("button", { name: /ordenar por/i });

        // Filtros ordenamientos antes de abrir
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
        fireEvent.click(botonOrdenar);

        // Filtros ordenamientos abiertos
        expect(listaOrdenamiento).toHaveClass(styles.listaOrdenamientoAbierta);

        // Filtros ordenamientos cerradis
        fireEvent.click(botonOrdenar);
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
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
        expect(precioMaximo).toHaveAttribute("placeholder", "Sin límite");
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
            presentacion: "Zeta",
            categoria: "Zeta",
            calibre: "Zeta",
        })).concat(["Ágata", "Berro"].map((nombre, indice) => ({
            ...publicaciones[0],
            id: indice + 4,
            especie: "Manzana",
            variedad: "Ágata",
            presentacion: nombre,
            categoria: nombre,
            calibre: nombre,
        })));
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConOpciones} especieFiltro=""/>);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Ágata", "Berro", "Zeta"]);
        fireEvent.click(screen.getByRole("option", { name: "Ágata" }));

        for (const [nombre, opcionInicial] of [["Presentación", "Todas"], ["Categoría", "Todas"], ["Calibre", "Todos"]]) {
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
        const listaOrdenamiento = document.querySelector(`.${styles.listaOrdenamiento}`);
        const botonOrdenar = screen.getByRole("button", { name: /ordenar por/i });
        fireEvent.click(botonOrdenar);
        expect(listaOrdenamiento).toHaveClass(styles.listaOrdenamientoAbierta);
        fireEvent.click(screen.getByRole("button", { name: /menor precio/i }));
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
    });

    it("mantiene Sin ordenar y el orden recibido cuando no se indica orden inicial", () => {
        const alFiltrar = vi.fn();
        const alCambiarOrden = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar} alCambiarOrden={alCambiarOrden}/>);
        const sinOrdenar = screen.getByRole("button", {  name: /sin ordenar/i });
        expect(sinOrdenar).toHaveClass(styles.opcionOrdenamientoActiva);
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.id)).toEqual([1, 2, 3, 4]);
        expect(alCambiarOrden).not.toHaveBeenCalled();
    });

    it("cambia visualmente la opción activa del ordenamiento", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const botonOrdenar = screen.getByRole("button", {  name: /ordenar por/i });
        fireEvent.click(botonOrdenar);
        const sinOrdenar = screen.getByRole("button", { name: /sin ordenar/i });
        const menorPrecio = screen.getByRole("button", { name: /menor precio/i });
        expect(sinOrdenar).toHaveClass(styles.opcionOrdenamientoActiva);
        fireEvent.click(menorPrecio);
        expect(menorPrecio).toHaveClass(styles.opcionOrdenamientoActiva);
        expect(sinOrdenar).not.toHaveClass(styles.opcionOrdenamientoActiva);
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
        expect(screen.getByLabelText("Presentación")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Categoría")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Calibre")).toHaveTextContent("Todos");
    });

    it("habilita los filtros dependientes de forma secuencial", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        const presentacion = screen.getByLabelText("Presentación");
        // Antes de seleccionar especie
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(presentacion).toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        // Despues de seleccionar especie
        expect(variedad).not.toHaveAttribute("aria-disabled");
        expect(presentacion).toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        // Despues de seleccionar variedad
        expect(presentacion).not.toHaveAttribute("aria-disabled");
    });

    it('selecciona automáticamente la variedad "-" y habilita Presentación', () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesVariedadUnica} especieFiltro=""/>);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        const presentacion = screen.getByLabelText("Presentación");
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(presentacion).toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Pera" }));
        expect(variedad).toHaveTextContent("-");
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(presentacion).not.toHaveAttribute("aria-disabled");
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

    it("filtra las publicaciones por presentación", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPresentacion} especieFiltro="" alFiltrar={alFiltrar}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const variedad = screen.getByLabelText("Variedad");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        const presentacion = screen.getByLabelText("Presentación");
        fireEvent.mouseDown(presentacion);
        fireEvent.click(screen.getByRole("option", { name: "Caja" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].presentacion).toBe("Caja");
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
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConPrecioNulo} especieFiltro="" alFiltrar={alFiltrar}/>);
        expect(alFiltrar).toHaveBeenLastCalledWith(publicacionesConPrecioNulo);

        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "300" } });
        expect(alFiltrar).toHaveBeenLastCalledWith(publicacionesConPrecioNulo.filter((publicacion) => publicacion.precio !== null));

        fireEvent.change(screen.getByLabelText("Precio Mínimo"), { target: { value: "" } });
        expect(alFiltrar).toHaveBeenLastCalledWith(publicacionesConPrecioNulo.filter((publicacion) => publicacion.precio !== null));
        fireEvent.change(screen.getByLabelText("Precio Máximo"), { target: { value: "" } });
        expect(alFiltrar).toHaveBeenLastCalledWith(publicacionesConPrecioNulo);
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
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.precio)).toEqual([100, 200, 300, 400]);
    });

    it("ordena las publicaciones por precio descendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Mayor Precio" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.precio)).toEqual([400, 300, 200, 100]);
    });

    it("ordena las publicaciones alfabéticamente de A a Z", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar}/>);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "A-Z" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => [publicacion.especie, publicacion.variedad])).toEqual([["Manzana", "Gala"], ["Manzana", "Red"], ["Pera", "Packham"], ["Pera", "Williams"]]);
    });

    it("aplica A-Z desde el inicio cuando se indica ordenInicial", () => {
        const alFiltrar = vi.fn();
        const alCambiarOrden = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" ordenInicial="alfabeticoAsc" alFiltrar={alFiltrar} alCambiarOrden={alCambiarOrden}/>);

        expect(screen.getByRole("button", { name: "A-Z" })).toHaveClass(styles.opcionOrdenamientoActiva);
        expect(screen.getByRole("button", { name: "Sin ordenar" })).not.toHaveClass(styles.opcionOrdenamientoActiva);
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.id)).toEqual([1, 2, 4, 3]);
        expect(alCambiarOrden).not.toHaveBeenCalled();
    });

    it("restaura el orden inicial A-Z y avisa al limpiar filtros", () => {
        const alFiltrar = vi.fn();
        const alCambiarOrden = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" ordenInicial="alfabeticoAsc" alFiltrar={alFiltrar} alCambiarOrden={alCambiarOrden}/>);

        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Mayor Precio" }));
        expect(alCambiarOrden).toHaveBeenLastCalledWith("precioDesc");
        expect((alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id)).toEqual([4, 3, 2, 1]);

        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(screen.getByRole("button", { name: "A-Z" })).toHaveClass(styles.opcionOrdenamientoActiva);
        expect(alCambiarOrden).toHaveBeenCalledTimes(2);
        expect(alCambiarOrden).toHaveBeenLastCalledWith("alfabeticoAsc");
        expect((alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id)).toEqual([1, 2, 4, 3]);
    });

    it("aplica la prioridad solo como orden inicial y no la ofrece en el menú público", () => {
        const alFiltrar = vi.fn();
        const datos = [
            { ...publicaciones[0], id: 1, especie: "Pera", variedad: "Williams" },
            { ...publicaciones[0], id: 2, especie: "Manzana", variedad: "Red" },
            { ...publicaciones[0], id: 3, especie: "Papa", variedad: "-" },
            { ...publicaciones[0], id: 4, especie: "Manzana", variedad: "Gala" },
            { ...publicaciones[0], id: 5, especie: "Acelga", variedad: "-" },
            { ...publicaciones[0], id: 6, especie: "Banana", variedad: "-" },
        ];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={datos} especieFiltro="" ordenInicial="prioridad" alFiltrar={alFiltrar}/>);
        const ids = () => (alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id);

        expect(ids()).toEqual([3, 6, 4, 2, 5, 1]);
        expect(screen.queryByRole("button", { name: "Sin ordenar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /prioridad/i })).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Buscar publicaciones"), { target: { value: "manzana" } });
        expect(ids()).toEqual([4, 2]);
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(ids()).toEqual([3, 6, 4, 2, 5, 1]);
    });

    it("conserva A-Z después de limpiar filtros y solo vuelve a prioridad al montar de nuevo", () => {
        const alFiltrar = vi.fn();
        const datos = [
            { ...publicaciones[0], id: 1, especie: "Pera" },
            { ...publicaciones[0], id: 2, especie: "Papa" },
            { ...publicaciones[0], id: 3, especie: "Acelga" },
        ];
        const vista = render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={datos} especieFiltro="" ordenInicial="prioridad" alFiltrar={alFiltrar}/>);
        const ids = () => (alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[]).map((publicacion) => publicacion.id);

        expect(ids()).toEqual([2, 3, 1]);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "A-Z" }));
        expect(ids()).toEqual([3, 2, 1]);
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(ids()).toEqual([3, 2, 1]);
        expect(screen.getByRole("button", { name: "A-Z" })).toHaveClass(styles.opcionOrdenamientoActiva);

        vista.unmount();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={datos} especieFiltro="" ordenInicial="prioridad" alFiltrar={alFiltrar}/>);
        expect(ids()).toEqual([2, 3, 1]);
    });

    it("ordena las publicaciones alfabéticamente de Z a A", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro="" alFiltrar={alFiltrar} />);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Z-A" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => [ publicacion.especie, publicacion.variedad])).toEqual([["Pera", "Williams"], ["Pera", "Packham"], ["Manzana", "Red"], ["Manzana", "Gala"]]);
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

    it("permite volver a seleccionar Sin ordenar", () => {
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesPrueba} especieFiltro=""/>);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        fireEvent.click(botonOrdenar);
        const sinOrdenar = screen.getByRole("button", {name: "Sin ordenar"});
        fireEvent.click(sinOrdenar);
        expect(sinOrdenar).toHaveClass(styles.opcionOrdenamientoActiva);
    });

    it("coloca las publicaciones sin precio al final al ordenar por precio", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConPrecioNulo} especieFiltro="" alFiltrar={alFiltrar}/>);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0];
        expect(resultado).toHaveLength(3);
        expect(resultado[0].precio).toBe(200);
        expect(resultado[1].precio).toBeNull();
        expect(resultado[2].precio).toBeNull();
    });

    it("mantiene las publicaciones sin precio al final al ordenar por precio descendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicacionesConPrecioNulo} especieFiltro="" alFiltrar={alFiltrar}/>);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Mayor Precio" }));
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

    it("permite filtrar presentación al ingresar con una especie cuya única variedad es guion", () => {
        const alFiltrar = vi.fn();
        const publicaciones = [
            { ...publicacionesVariedadUnica[0], id: 1, presentacion: "Caja" },
            { ...publicacionesVariedadUnica[0], id: 2, presentacion: "Bolsa" },
        ];
        render(<FiltrosPublicaciones obtenerNombreFantasia={obtenerNombreOperador} publicaciones={publicaciones} especieFiltro="Pera" alFiltrar={alFiltrar} />);

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveAttribute("aria-disabled", "true");
        const presentacion = screen.getByRole("combobox", { name: "Presentación" });
        expect(presentacion).not.toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(presentacion);
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
            presentacion: "Caja",
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
