import { consultarPublicaciones } from "./Publicaciones";

type FilaPublicacion = {
	id: number | string;
	precio: number | null;
	foto: string | null;
	especie: string;
	variedad: string;
	presentacion: string;
	categoria: string;
	calibre: string;
	codigoCalibre: string;
	operadorId: number | string;
	operadorNombreFantasia: string;
	operadorWhatsApp: string;
};

const { consulta, plan, query } = vi.hoisted(() => {
	const plan = { sql: "consulta de publicaciones" };

	const tablas = {
		publicacionOperador: {
			publicacionId: "publicacionOperador.publicacionId",
			operadorId: "publicacionOperador.operadorId"
		},
		publicacion: {
			id: "publicacion.id",
			presentacionId: "publicacion.presentacionId",
			categoriaId: "publicacion.categoriaId",
			calibreId: "publicacion.calibreId",
			precio: "publicacion.precio",
			foto: "publicacion.foto",
			publicacionActiva: "publicacion.publicacionActiva",
			publicacionDisponible: "publicacion.publicacionDisponible"
		},
		presentacion: {
			id: "presentacion.id",
			variedadId: "presentacion.variedadId",
			nombrePresentacion: "presentacion.nombrePresentacion"
		},
		variedad: {
			id: "variedad.id",
			especieId: "variedad.especieId",
			nombreVariedad: "variedad.nombreVariedad"
		},
			especie: {
			id: "especie.id",
			nombreEspecie: "especie.nombreEspecie"
		},
			categoria: {
			id: "categoria.id",
			nombreCategoria: "categoria.nombreCategoria"
		},
		calibre: {
			id: "calibre.id",
			nombreCalibre: "calibre.nombreCalibre",
			codigoCalibre: "calibre.codigoCalibre"
		},
			operador: {
			id: "operador.id",
			nombreFantasia: "operador.nombreFantasia",
			whatsApp: "operador.whatsApp"
		}
	};

	const operaciones = {
		eq: vi.fn((izquierda, derecha) => ({
		tipo: "eq",
		izquierda,
		derecha,
		})),
		and: vi.fn((...condiciones) => ({
		tipo: "and",
		condiciones,
		})),
	};

	return {
		plan,
		query: vi.fn<() => Promise<FilaPublicacion[]>>(),

		consulta: {
		innerJoin: vi.fn((_tabla, callback) => {
			callback(tablas, operaciones);
			return consulta;
		}),

		select: vi.fn((callback) => {
			callback(tablas);
			return consulta;
		}),

		where: vi.fn((callback) => {
			callback(tablas, operaciones);
			return consulta;
		}),

		build: vi.fn().mockReturnValue(plan),
		},
	};
});

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
	db: {
		sql: {
		public: {
			publicacionOperador: consulta,
			publicacion: {},
			presentacion: {},
			variedad: {},
			especie: {},
			categoria: {},
			calibre: {},
			operador: {},
		},
		},
		runtime: () => ({ query }),
	},
}));

function crearFila(id = 7): FilaPublicacion {
	return {
		id,
		precio: 150,
		foto: "/tomate.jpg",
		especie: "Tomate",
		variedad: "Perita",
		presentacion: "Cajón",
		categoria: "Primera",
		calibre: "Mediano",
		codigoCalibre: "M",
		operadorId: 10,
		operadorNombreFantasia: "Huerta Sur",
		operadorWhatsApp: "099123456",
	};
}

describe("consultarPublicaciones", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		query.mockReset();
		query.mockResolvedValue([]);
	});

	it("devuelve una lista vacía cuando no hay publicaciones", async () => {
		expect(await consultarPublicaciones()).toEqual({
		publicaciones: [],
		});
	});

	it("ejecuta el plan construido para consultar las publicaciones", async () => {
		await consultarPublicaciones();

		expect(consulta.build).toHaveBeenCalledTimes(1);
		expect(query).toHaveBeenCalledExactlyOnceWith(plan);
	});

	it("mapea los datos de la publicación y agrupa los datos del operador", async () => {
		query.mockResolvedValue([crearFila()]);

		expect(await consultarPublicaciones()).toEqual({
		publicaciones: [
			{
			id: 7,
			precio: 150,
			foto: "/tomate.jpg",
			especie: "Tomate",
			variedad: "Perita",
			presentacion: "Cajón",
			categoria: "Primera",
			calibre: "Mediano",
			codigoCalibre: "M",
			operador: {
				id: 10,
				nombreFantasia: "Huerta Sur",
				whatsApp: "099123456",
			},
			},
		],
		});
	});

	it.each([
		[150, 150],
		[1234.5, 1234.5],
		[0, 0],
	])(
		"mantiene el precio %s recibido de la consulta",
		async (precio, esperado) => {
		query.mockResolvedValue([
			{ ...crearFila(), precio },
		]);

		const { publicaciones } = await consultarPublicaciones();

		expect(publicaciones).toHaveLength(1);
		expect(publicaciones[0].precio).toBe(esperado);
		},
	);

	it("conserva la foto nula cuando la publicación no tiene imagen", async () => {
		query.mockResolvedValue([
		{ ...crearFila(), foto: null },
		]);

		const { publicaciones } = await consultarPublicaciones();

		expect(publicaciones).toHaveLength(1);
		expect(publicaciones[0].foto).toBeNull();
	});

	it("mantiene el orden de los resultados y el operador de cada publicación", async () => {
		query.mockResolvedValue([
		crearFila(7),
		{
			...crearFila(2),
			operadorId: 20,
			operadorNombreFantasia: "Frutas Norte",
			operadorWhatsApp: "098654321",
		},
		crearFila(9),
		]);

		const { publicaciones } = await consultarPublicaciones();

		expect(publicaciones.map((publicacion) => publicacion.id)).toEqual([
		7,
		2,
		9,
		]);

		expect(publicaciones.map((publicacion) => publicacion.operador)).toEqual([
		{
			id: 10,
			nombreFantasia: "Huerta Sur",
			whatsApp: "099123456",
		},
		{
			id: 20,
			nombreFantasia: "Frutas Norte",
			whatsApp: "098654321",
		},
		{
			id: 10,
			nombreFantasia: "Huerta Sur",
			whatsApp: "099123456",
		},
		]);
	});

	it("propaga el error cuando falla la consulta a la base de datos", async () => {
		const error = new Error(
		"No se pudo consultar las publicaciones",
		);

		query.mockRejectedValue(error);

		await expect(consultarPublicaciones()).rejects.toBe(error);
	});

	it("construye la consulta con todos los joins necesarios", async () => {
		await consultarPublicaciones();

		expect(consulta.innerJoin).toHaveBeenCalledTimes(7);
		expect(consulta.select).toHaveBeenCalledTimes(1);
		expect(consulta.where).toHaveBeenCalledTimes(1);
		expect(consulta.build).toHaveBeenCalledTimes(1);
	});

	it("conserva el precio nulo cuando la publicación no tiene precio", async () => {
		query.mockResolvedValue([
		{ ...crearFila(), precio: null },
		]);

		const { publicaciones } = await consultarPublicaciones();

		expect(publicaciones).toHaveLength(1);
		expect(publicaciones[0].precio).toBeNull();
	});
});