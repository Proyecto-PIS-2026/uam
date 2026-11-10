import "dotenv/config";
import { parseArgs } from "node:util";
import { migrarImagenesFilesystem, type ReferenciaImagen } from "../src/infraestructura/imagenes/migrar-imagenes-filesystem";

async function main() {
    const { values } = parseArgs({ options: {
        directorio: { type: "string" }, verificar: { type: "boolean", default: false }, help: { type: "boolean", short: "h" },
    } });
    if (values.help) {
        console.log("Uso: npm run db:imagenes:migrar -- [--directorio <ruta>] [--verificar]");
        console.log("Importa a DATABASE_URL sin cambiar claves ni URLs, sobrescribir contenido distinto o borrar archivos originales.");
        console.log("--verificar solamente inventaría y compara. Por defecto, el origen es ./storage.");
        return;
    }
    if (values.directorio !== undefined && !values.directorio.trim()) throw new Error("El directorio no puede estar vacío.");
    if (!process.env.DATABASE_URL) throw new Error("Configurá DATABASE_URL antes de importar las imágenes.");

    const { db } = await import("../src/infraestructura/persistencia/prisma/db");
    try {
        const { AlmacenamientoImagenesPostgres } = await import("../src/infraestructura/imagenes/almacenamiento-postgres");
        const [publicaciones, operadores, productores, especies] = await Promise.all([
            db.orm.public.Publicacion.select("id", "foto").all(),
            db.orm.public.Operador.select("id", "fotoPerfil").all(),
            db.orm.public.Productor.select("id", "fotoPerfil").all(),
            db.orm.public.Especie.select("id", "fotoEspecie").all(),
        ]);
        const referencias: ReferenciaImagen[] = [
            ...publicaciones.map(({ id, foto }) => ({ categoria: "publicaciones" as const, id, url: foto })),
            ...operadores.map(({ id, fotoPerfil }) => ({ categoria: "operadores" as const, id, url: fotoPerfil })),
            ...productores.map(({ id, fotoPerfil }) => ({ categoria: "productores" as const, id, url: fotoPerfil })),
            ...especies.map(({ id, fotoEspecie }) => ({ categoria: "especies" as const, id, url: fotoEspecie })),
        ];
        const reporte = await migrarImagenesFilesystem({ directorio: values.directorio, destino: new AlmacenamientoImagenesPostgres(db), referencias, soloVerificar: values.verificar });
        console.log(JSON.stringify({
            resumen: {
                importadas: reporte.importadas.length, existentes: reporte.existentes.length, pendientes: reporte.pendientes.length,
                conflictos: reporte.conflictos.length, omitidas: reporte.omitidas.length,
                referenciasFaltantes: reporte.referenciasFaltantes.length, referenciasInvalidas: reporte.referenciasInvalidas.length,
            },
            ...reporte,
        }, null, 2));
        if (reporte.conflictos.length || reporte.referenciasFaltantes.length || reporte.referenciasInvalidas.length || reporte.pendientes.length) process.exitCode = 1;
    } finally {
        await db.close();
    }
}

main().catch(() => {
    console.error("No se completó la importación de imágenes. Revisá los argumentos, DATABASE_URL, las migraciones y el acceso al directorio de origen.");
    process.exitCode = 1;
});
