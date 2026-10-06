import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaOperador } from "./altaOperador";

function armarDatos(naveId: number, sobrescribir: Record<string, unknown> = {}) {
	return {
		rol: "operador",
		nombreUsuario: "probandotest",
		contraseña: "clave12345",
		confirmacionContraseña: "clave12345",
		nombre: "probandotest",
		codigoPais: "+598",
		telefono: "099123456",
		locales: [{ numeroLocal: "999", naveId, contrato: "2029-02-28" }],
		...sobrescribir,
	};
}

async function borrarAlta(operadorId: number) {
	const operador = await db.orm.public.Operador.where({ id: operadorId }).first();
	await db.orm.public.Local.where({ operadorId }).delete();
	await db.orm.public.Operador.where({ id: operadorId }).delete();
	if (operador) await db.orm.public.Usuario.where({ id: operador.usuarioId }).delete();
}

describe("alta de operador", () => {
	beforeEach(async () => {
		const usuario = await db.orm.public.Usuario.where({ username: "probandotest" }).first();
		if (!usuario) return;
		const operador = await db.orm.public.Operador.where({ usuarioId: usuario.id }).first();
		if (operador) await borrarAlta(operador.id);
		else await db.orm.public.Usuario.where({ id: usuario.id }).delete();
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

        const resultado = await altaOperador(armarDatos(nave.id));
        expect(resultado.esValido).toBe(true);
        if (!resultado.esValido) return;

        const operador = await db.orm.public.Operador.where({ id: resultado.id }).first();
        expect(operador).toBeDefined(); 
        if (!operador) return;

        const usuario = await db.orm.public.Usuario.where({ id: operador.usuarioId }).first();
        expect(usuario).toBeDefined();
        expect(usuario?.username).toBe("probandotest");
        expect(usuario?.rol).toBe("OPERADOR");
        const local = await db.orm.public.Local.where({ operadorId: operador.id, naveId: nave.id, numeroLocal: "999", }).first();
        expect(local).toBeDefined(); 
        expect(local?.numeroLocal).toBe("999"); 
        expect(local?.naveId).toBe(nave.id);
        await borrarAlta(resultado.id);

    })

    it("rechaza el alta cuando la nave no existe", async () => {
       const resultado = await altaOperador(armarDatos(999999999)); 
       expect(resultado).toEqual({ esValido: false, errores: [ "Alguna de las naves seleccionadas ya no está disponible. Actualizá el formulario.", ], });
    })

    it("rechaza el alta cuando ya existe el nombre de usuario", async () => { 
        const nave = await db.orm.public.Nave.all().then((naves) => naves[0]); 
        expect(nave).toBeDefined(); if (!nave) return; 

        const primerResultado = await altaOperador(armarDatos(nave.id)); 
        expect(primerResultado.esValido).toBe(true); 
        if (!primerResultado.esValido) return; 

        const segundoResultado = await altaOperador( armarDatos(nave.id, { nombre: "otro operador", }), ); 
        expect(segundoResultado).toEqual({ esValido: false, errores: [ "Ya existe un usuario con ese nombre de usuario.", ], }); 
        await borrarAlta(primerResultado.id); 
    })

    it("rechaza el alta cuando ya existe un operador con el mismo nombre", async () => {
        const nave = await db.orm.public.Nave.all().then((naves) => naves[0]); 
        expect(nave).toBeDefined(); if (!nave) return; 

        const primerResultado = await altaOperador(armarDatos(nave.id)); 
        expect(primerResultado.esValido).toBe(true); 
        if (!primerResultado.esValido) return; 

        const segundoResultado = await altaOperador( armarDatos(nave.id, { nombreUsuario: "otro_usuario_test", }), ); 
        expect(segundoResultado).toEqual({ esValido: false, errores: [ "Ya existe un operador con ese nombre.", ], }); 

        await borrarAlta(primerResultado.id); 
    })

    it("rechaza el alta cuando el local ya existe en la nave", async () => { 
        const nave = await db.orm.public.Nave.all().then((naves) => naves[0]); 
        expect(nave).toBeDefined(); 
        if (!nave) return; 

        const localExistente = await db.orm.public.Local .where({ naveId: nave.id, numeroLocal: "999", }) .first(); 
        if (localExistente) { 
            return; 
        } 

        const primerResultado = await altaOperador(armarDatos(nave.id)); 
        expect(primerResultado.esValido).toBe(true); 
        if (!primerResultado.esValido) 
            return; 

        const segundoResultado = await altaOperador( armarDatos(nave.id, { nombreUsuario: "otro_usuario_test", nombre: "otro operador", }), ); 
        expect(segundoResultado).toEqual({ esValido: false, errores: [ "El local 999 ya existe en la nave seleccionada.", ], }); 

        await borrarAlta(primerResultado.id); 
    });    
});