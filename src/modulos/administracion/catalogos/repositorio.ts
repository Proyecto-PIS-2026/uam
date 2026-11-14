import { db } from "@/infraestructura/persistencia/prisma/db";
import type { DatosCatalogo, ElementoCatalogo, TipoCatalogo } from "./tipos";

export type TransaccionCatalogo = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ClienteLectura = Pick<TransaccionCatalogo, "orm">;

const identificadoresBloqueo: Record<TipoCatalogo, number> = { empaquetados: 1, kilos: 2, calibres: 3, categorias: 4 };

export async function consultarCatalogo(cliente: ClienteLectura, tipo: TipoCatalogo): Promise<ElementoCatalogo[]> {
    let elementos: ElementoCatalogo[];
    switch (tipo) {
        case "empaquetados":
            elementos = (await cliente.orm.public.Envase.select("id", "nombreEnvase").all())
                .map(({ id, nombreEnvase }) => ({ id, nombre: nombreEnvase }));
            break;
        case "kilos":
            elementos = (await cliente.orm.public.KilosEmpaquetado.select("id", "valor").all())
                .map(({ id, valor }) => ({ id, nombre: valor }));
            break;
        case "calibres":
            elementos = (await cliente.orm.public.Calibre.select("id", "codigoCalibre", "nombreCalibre").all())
                .map(({ id, codigoCalibre, nombreCalibre }) => ({ id, nombre: nombreCalibre, codigo: codigoCalibre }));
            break;
        case "categorias":
            elementos = (await cliente.orm.public.Categoria.select("id", "nombreCategoria").all())
                .map(({ id, nombreCategoria }) => ({ id, nombre: nombreCategoria }));
            break;
    }
    return elementos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true, sensitivity: "base" }) || a.id - b.id);
}

export async function bloquearCatalogo(tx: TransaccionCatalogo, tipo: TipoCatalogo): Promise<void> {
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1723, ${identificadoresBloqueo[tipo]})`
        .returnsRow({ locked: "pg/int4@1" }).build());
}

export async function bloquearElemento(tx: TransaccionCatalogo, tipo: TipoCatalogo, id: number): Promise<boolean> {
    // FOR UPDATE también excluye las nuevas referencias de claves foráneas mientras se comprueba el uso.
    const consulta = tipo === "empaquetados" ? db.raw.sql`SELECT id FROM envase WHERE id = ${id} FOR UPDATE`
        : tipo === "kilos" ? db.raw.sql`SELECT id FROM "kilosEmpaquetado" WHERE id = ${id} FOR UPDATE`
        : tipo === "calibres" ? db.raw.sql`SELECT id FROM calibre WHERE id = ${id} FOR UPDATE`
        : db.raw.sql`SELECT id FROM categoria WHERE id = ${id} FOR UPDATE`;
    const existentes = await tx.query(consulta.returnsRow({ id: "pg/int4@1" }).build());
    return existentes.length > 0;
}

export async function guardarValor(tx: TransaccionCatalogo, tipo: TipoCatalogo, datos: DatosCatalogo, id?: number): Promise<void> {
    switch (tipo) {
        case "empaquetados":
            if (id === undefined) await tx.orm.public.Envase.create({ nombreEnvase: datos.nombre });
            else await tx.orm.public.Envase.where({ id }).update({ nombreEnvase: datos.nombre });
            break;
        case "kilos":
            if (id === undefined) await tx.orm.public.KilosEmpaquetado.create({ valor: datos.nombre });
            else await tx.orm.public.KilosEmpaquetado.where({ id }).update({ valor: datos.nombre });
            break;
        case "calibres":
            if (id === undefined) await tx.orm.public.Calibre.create({ codigoCalibre: datos.codigo!, nombreCalibre: datos.nombre });
            else await tx.orm.public.Calibre.where({ id }).update({ codigoCalibre: datos.codigo!, nombreCalibre: datos.nombre });
            break;
        case "categorias":
            if (id === undefined) await tx.orm.public.Categoria.create({ nombreCategoria: datos.nombre, especieId: null });
            else await tx.orm.public.Categoria.where({ id }).update({ nombreCategoria: datos.nombre, especieId: null });
            break;
    }
}

export async function tienePublicaciones(tx: TransaccionCatalogo, tipo: TipoCatalogo, id: number): Promise<boolean> {
    const filtro = tipo === "empaquetados" ? { envaseId: id }
        : tipo === "kilos" ? { kilosId: id }
        : tipo === "calibres" ? { calibreId: id }
        : { categoriaId: id };
    return (await tx.orm.public.Publicacion.where(filtro).select("id").first()) !== null;
}

export async function eliminarValor(tx: TransaccionCatalogo, tipo: TipoCatalogo, id: number): Promise<void> {
    switch (tipo) {
        case "empaquetados": await tx.orm.public.Envase.where({ id }).delete(); break;
        case "kilos": await tx.orm.public.KilosEmpaquetado.where({ id }).delete(); break;
        case "calibres": await tx.orm.public.Calibre.where({ id }).delete(); break;
        case "categorias": await tx.orm.public.Categoria.where({ id }).delete(); break;
    }
}
