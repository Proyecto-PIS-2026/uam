import { escuchaPublicaciones } from "@/infraestructura/tiempo-real/escuchar-publicaciones";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { obtenerOperadorAutorizado } from "@/modulos/usuarios/operadores/operador-actual";
import { Temporal } from "temporal-polyfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(solicitud: Request) {
    const busqueda = new URL(solicitud.url).searchParams;
    const parametros = busqueda.getAll("operadorId");
    const parametrosPublicos = busqueda.getAll("operadorPublicoId");
    if (parametros.length > 0 && parametrosPublicos.length > 0) {
        return Response.json({ error: "Seleccione un único canal de publicaciones." }, { status: 400 });
    }
    const filtro = parametros.length > 0 ? parametros : parametrosPublicos;
    if (filtro.length > 0 && (filtro.length !== 1 || !/^[1-9]\d*$/.test(filtro[0]) || !Number.isSafeInteger(Number(filtro[0])))) {
        return Response.json({ error: "El operador no es válido." }, { status: 400 });
    }
    const operadorPublicoId = parametrosPublicos.length > 0 ? Number(parametrosPublicos[0]) : undefined;
    let operadorId: number | undefined;
    let duracion = 55000;
    if (parametros.length > 0) {
        const sesion = await obtenerSesion();
        if (!sesion) return Response.json({ error: "Debe iniciar sesión." }, { status: 401 });
        try {
            const operador = await obtenerOperadorAutorizado(Number(parametros[0]));
            if (!autorizado("operador.publicacion.consultarPropias", sesion, operador)) {
                return Response.json({ error: "No tiene permisos." }, { status: 403 });
            }
            operadorId = operador.id;
            duracion = Math.max(0, Math.min(duracion, sesion.expiraEn * 1000 - Date.now()));
            if (duracion === 0) return Response.json({ error: "La sesión expiró." }, { status: 401 });
        } catch (error) {
            if (error instanceof ErrorAutorizacion) return Response.json({ error: error.message }, { status: error.status });
            return Response.json({ error: "No se pudo abrir la conexión." }, { status: 503 });
        }
    }
    const codificador = new TextEncoder();
    let cerrar: (cancelado?: boolean) => void = () => {};
    const stream = new ReadableStream<Uint8Array>({
        start(controlador) {
            let cerrado = false;
            let desuscribir = () => {};
            const abortar = () => cerrar();
            cerrar = (cancelado = false) => {
                if (cerrado) return;
                cerrado = true;
                clearTimeout(temporizador);
                clearInterval(pulso);
                desuscribir();
                solicitud.signal.removeEventListener("abort", abortar);
                if (!cancelado) controlador.close();
            };
            const enviar = (contenido: string) => {
                if (cerrado) return;
                if ((controlador.desiredSize ?? 0) < -10) {
                    cerrar();
                    return;
                }
                controlador.enqueue(codificador.encode(contenido));
            };
            const pulso = setInterval(() => enviar(": pulso\n\n"), 15000);
            const temporizador = setTimeout(cerrar, duracion);
            solicitud.signal.addEventListener("abort", abortar, { once: true });
            if (solicitud.signal.aborted) {
                cerrar();
                return;
            }
            desuscribir = escuchaPublicaciones.suscribir((cambio) => {
                const operadorFiltrado = operadorId ?? operadorPublicoId;
                if (cambio && operadorFiltrado !== undefined && cambio.operadorId !== operadorFiltrado) return;
                const version = escuchaPublicaciones.obtenerVersion(operadorFiltrado);
                const fecha = Temporal.Now.plainDateISO("America/Montevideo").toString();
                const datos = operadorId === undefined || cambio?.publicacionId === undefined ? {} : { publicacionId: cambio.publicacionId };
                enviar(`${cambio ? "" : "retry: 3000\n"}id: ${version}:${fecha}\nevent: ${cambio ? "cambio" : "conectado"}\ndata: ${JSON.stringify(datos)}\n\n`);
            });
            if (cerrado) desuscribir();
        },
        cancel() { cerrar(true); },
    });
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "private, no-cache, no-store, no-transform",
            "X-Accel-Buffering": "no",
        },
    });
}
