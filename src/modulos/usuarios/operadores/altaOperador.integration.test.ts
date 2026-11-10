import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaOperador } from "./altaOperador";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const identificador = randomUUID().replaceAll("-", "").slice(0, 10);
const nombreUsuarioPrueba = `operador_${identificador}`;
const nombrePrueba = `Operador prueba ${identificador}`;
const nombreAlternativoPrueba = `Otro operador ${identificador}`;
const usuariosDePrueba = new Set<string>();

function armarDatos(naveId: number, sobrescribir: Record<string, unknown> = {}) {
	const datos = {
		rol: "operador",
		nombreUsuario: nombreUsuarioPrueba,
		contraseña: "clave12345",
		confirmacionContraseña: "clave12345",
		nombre: nombrePrueba,
		codigoPais: "+598",
		telefono: "099123456",
		locales: [{ numeroLocal: "999", naveId, contrato: "2029-02-28" }],
		...sobrescribir,
	};
	usuariosDePrueba.add(String(datos.nombreUsuario));
	return datos;
}

async function buscarNumeroLocalLibre(naveId: number): Promise<string> {
    let numero = 9000;

    while (
        await db.orm.public.Local.where({
            naveId,
            numeroLocal: String(numero),
        }).first()
    ) {
        numero++;
    }

    return String(numero);
}

async function borrarAlta(operadorId: number) {
	const operador = await db.orm.public.Operador.where({ id: operadorId }).first();
	await db.orm.public.Local.where({ operadorId }).delete();
	await db.orm.public.Operador.where({ id: operadorId }).delete();
	if (operador) await db.orm.public.Usuario.where({ id: operador.usuarioId }).delete();
}

describe("alta de operador", () => {
	afterEach(async () => {
		for (const username of usuariosDePrueba) {
			const usuario = await db.orm.public.Usuario.where({ username }).first();
			if (!usuario) continue;
			const operador = await db.orm.public.Operador.where({ usuarioId: usuario.id }).first();
			if (operador) await borrarAlta(operador.id);
			else await db.orm.public.Usuario.where({ id: usuario.id }).delete();
		}
		usuariosDePrueba.clear();
	});

	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await altaOperador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos del operador no son válidos."],
		});
	});

    it("crea el usuario, operador y local correctamente", async () => {
        const nave = await db.orm.public.Nave.all().then((naves) => naves[0]);
        expect(nave).toBeDefined();
        if (!nave) return;

        const numeroLocal = await buscarNumeroLocalLibre(nave.id);

        const resultado = await altaOperador(
            armarDatos(nave.id, {
                locales: [{
                    numeroLocal,
                    naveId: nave.id,
                    contrato: "2029-02-28",
                }],
            }),
        );

        expect(resultado.esValido).toBe(true);
        if (!resultado.esValido) return;

        const operador = await db.orm.public.Operador.where({ id: resultado.id }).first();
        expect(operador).toBeDefined();
        if (!operador) return;

        const usuario = await db.orm.public.Usuario.where({ id: operador.usuarioId }).first();
        expect(usuario).toBeDefined();
        expect(usuario?.username).toBe(nombreUsuarioPrueba);
        expect(usuario?.rol).toBe("OPERADOR");

        const local = await db.orm.public.Local.where({
            operadorId: operador.id,
            naveId: nave.id,
            numeroLocal,
        }).first();

        expect(local).toBeDefined();
        expect(local?.numeroLocal).toBe(numeroLocal);
        expect(local?.naveId).toBe(nave.id);

        await borrarAlta(resultado.id);
    });

    it("rechaza el alta cuando la nave no existe", async () => {
       const resultado = await altaOperador(armarDatos(999999999)); 
       expect(resultado).toEqual({ esValido: false, errores: [ "Alguna de las naves seleccionadas ya no está disponible. Actualizá el formulario.", ], });
    })

    it("rechaza el alta cuando ya existe el nombre de usuario", async () => { 
        const nave = await db.orm.public.Nave.all().then((naves) => naves[0]); 
        expect(nave).toBeDefined(); if (!nave) return; 

        const numeroLocal = await buscarNumeroLocalLibre(nave.id);

        const primerResultado = await altaOperador(
            armarDatos(nave.id, {
                locales: [{
                    numeroLocal,
                    naveId: nave.id,
                    contrato: "2029-02-28",
                }],
            }),
        );
        expect(primerResultado.esValido).toBe(true); 
        if (!primerResultado.esValido) return; 

        const segundoResultado = await altaOperador(armarDatos(nave.id, { nombre: nombreAlternativoPrueba }));
        expect(segundoResultado).toEqual({ esValido: false, errores: [ "Ya existe un usuario con ese nombre de usuario.", ], }); 
        await borrarAlta(primerResultado.id); 
    })

    it("rechaza el alta cuando ya existe un operador con el mismo nombre", async () => {
        const nave = await db.orm.public.Nave.all().then((naves) => naves[0]); 
        expect(nave).toBeDefined(); if (!nave) return; 

        const numeroLocal = await buscarNumeroLocalLibre(nave.id);

        const primerResultado = await altaOperador(
            armarDatos(nave.id, {
                locales: [{
                    numeroLocal,
                    naveId: nave.id,
                    contrato: "2029-02-28",
                }],
            }),
        );
        expect(primerResultado.esValido).toBe(true); 
        if (!primerResultado.esValido) return; 

        const segundoResultado = await altaOperador(armarDatos(nave.id, { nombreUsuario: `${nombreUsuarioPrueba}_otro` }));
        expect(segundoResultado).toEqual({ esValido: false, errores: [ "Ya existe un operador con ese nombre.", ], }); 

        await borrarAlta(primerResultado.id); 
    })

    it("rechaza el alta cuando el local ya existe en la nave", async () => {
        const nave = await db.orm.public.Nave.all().then((naves) => naves[0]);
        expect(nave).toBeDefined();
        if (!nave) return;

        const numeroLocal = await buscarNumeroLocalLibre(nave.id);

        const primerResultado = await altaOperador(
            armarDatos(nave.id, {
                locales: [{
                    numeroLocal,
                    naveId: nave.id,
                    contrato: "2029-02-28",
                }],
            }),
        );

        expect(primerResultado.esValido).toBe(true);
        if (!primerResultado.esValido) return;

        const segundoResultado = await altaOperador(
            armarDatos(nave.id, {
                nombreUsuario: `${nombreUsuarioPrueba}_otro`,
                nombre: nombreAlternativoPrueba,
                locales: [{
                    numeroLocal,
                    naveId: nave.id,
                    contrato: "2029-02-28",
                }],
            }),
        );

        expect(segundoResultado).toEqual({
            esValido: false,
            errores: ["El local " + numeroLocal + " ya existe en la nave seleccionada."],
        });

        await borrarAlta(primerResultado.id);
    });
});
