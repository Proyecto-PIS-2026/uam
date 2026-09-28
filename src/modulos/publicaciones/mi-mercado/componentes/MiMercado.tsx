"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HojasDecorativas from "../../../../compartido/HojasDecorativas";
import { ConfirmModal } from "../../../../compartido/componentes/ConfirmModal";
import DrawerEditarPublicacion, { type PublicacionParaEditar } from "../../operadores/componentes/DrawerEditarPublicacion";
import NuevaPublicacion from "../../operadores/componentes/NuevaPublicacion";
import type { OpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import type { CambiosPublicacionOperador } from "../../operadores/modificar-publicacion";
import TarjetaPublicacion from "./TarjetaPublicacion";

export type Publicacion = {
    id: number;
    publicacionOperadorId: number;
    paisId: number;
    foto: string | null;
    precio: string | null;
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    presentacion: {
        id: number;
        nombrePresentacion: string;
        variedad: {
            id: number;
            nombreVariedad: string;
            especie: {
                id: number;
                nombreEspecie: string;
                fotoEspecie: string | null;
            };
        };
    };
    categoria: {
        id: number;
        nombreCategoria: string;
    };
    calibre: {
        id: number;
        codigoCalibre: string;
        nombreCalibre: string;
    };
};

type Props = {
    operadorId: number;
    abrirAltaInicial?: boolean;
    publicaciones: Publicacion[];
    incrementoPrecio: number;
    opcionesEdicion: OpcionesEdicionPublicacion;
};

export default function MiMercado({
    operadorId,
    abrirAltaInicial = false,
    publicaciones,
    incrementoPrecio,
    opcionesEdicion,
}: Props) {
    const router = useRouter();
    const [altaAbierta, setAltaAbierta] = useState(abrirAltaInicial);
    const [agruparPorEspecie, setAgruparPorEspecie] = useState(true);
    const [seleccion, setSeleccion] = useState<{ publicacion: Publicacion; listado: Publicacion[] } | null>(null);
    const [listadoPendiente, setListadoPendiente] = useState<Publicacion[] | null>(null);
    const [publicacionPendiente, setPublicacionPendiente] = useState<Publicacion | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [idsEliminados, setIdsEliminados] = useState<number[]>([]);
    const publicacionesVisibles = publicaciones.filter((publicacion) => !idsEliminados.includes(publicacion.id));

    let publicacionSeleccionada = seleccion?.publicacion ?? null;
    if (seleccion && seleccion.listado !== publicaciones) {
        publicacionSeleccionada = publicaciones.find((publicacion) => publicacion.id === seleccion.publicacion.id) ?? seleccion.publicacion;
    }

    const publicacionParaEditar: PublicacionParaEditar | null = publicacionSeleccionada ? {
        publicacionOperadorId: publicacionSeleccionada.publicacionOperadorId,
        publicacionId: publicacionSeleccionada.id,
        especieId: publicacionSeleccionada.presentacion.variedad.especie.id,
        variedadId: publicacionSeleccionada.presentacion.variedad.id,
        especie: publicacionSeleccionada.presentacion.variedad.especie.nombreEspecie,
        variedad: publicacionSeleccionada.presentacion.variedad.nombreVariedad,
        presentacion: publicacionSeleccionada.presentacion.nombrePresentacion,
        categoria: publicacionSeleccionada.categoria.nombreCategoria,
        calibre: publicacionSeleccionada.calibre.nombreCalibre,
        precio: publicacionSeleccionada.precio,
        foto: publicacionSeleccionada.foto,
        categoriaId: publicacionSeleccionada.categoria.id,
        calibreId: publicacionSeleccionada.calibre.id,
        presentacionId: publicacionSeleccionada.presentacion.id,
        paisId: publicacionSeleccionada.paisId,
        disponible: publicacionSeleccionada.publicacionDisponible,
    } : null;

    function abrirAlta() {
        setError("");
        setMensaje("");
        setAltaAbierta(true);
    }

    function cerrarAlta() {
        setAltaAbierta(false);
        if (abrirAltaInicial) router.replace("/mi-mercado", { scroll: false });
    }

    function publicacionCreada(mensaje: string) {
        setMensaje(mensaje);
        cerrarAlta();
        router.refresh();
    }

    function consultarPublicacion(publicacion: Publicacion) {
        setError("");
        setMensaje("");
        setSeleccion({ publicacion, listado: publicaciones });
    }

    function solicitarBaja(publicacion: Publicacion) {
        setError("");
        setMensaje("");
        setPublicacionPendiente(publicacion);
    }

    async function guardarCambios(publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) {
        if (!publicacionSeleccionada || publicacionSeleccionada.publicacionOperadorId !== publicacionOperadorId) {
            throw new Error("La publicación seleccionada cambió.");
        }
        setError("");

        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify(cambios));
        if (fotoNueva) formulario.set("fotografia", fotoNueva);

        const respuesta = await fetch(`/api/publicaciones/${publicacionSeleccionada.id}`, { method: "PATCH", body: formulario });
        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.errores?.[0] ?? "No se pudieron guardar los cambios.");

        setListadoPendiente(publicaciones);
        setMensaje(resultado.mensaje ?? "Publicación actualizada.");
        router.refresh();
    }

    async function eliminarPublicacion() {
        if (!publicacionPendiente || eliminando) return;
        const publicacion = publicacionPendiente;
        setEliminando(true);
        setError("");
        try {
            const respuesta = await fetch(`/api/publicaciones/${publicacion.id}`, { method: "DELETE" });
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");

            setIdsEliminados((actuales) => [...actuales, publicacion.id]);
            setPublicacionPendiente(null);
            setSeleccion((actual) => actual?.publicacion.id === publicacion.id ? null : actual);
            setMensaje(resultado.mensaje ?? "Publicación eliminada.");
            router.refresh();
        } catch (error) {
            setError(error instanceof Error ? error.message : "No se pudo conectar con el servidor.");
            setPublicacionPendiente(null);
        } finally {
            setEliminando(false);
        }
    }

    const gruposPorEspecie = new Map<
        number,
        {
            especie: Publicacion["presentacion"]["variedad"]["especie"];
            items: Publicacion[];
        }
    >();

    for (const pub of publicacionesVisibles) {
        const especie = pub.presentacion.variedad.especie;

        if (!gruposPorEspecie.has(especie.id)) {
            gruposPorEspecie.set(especie.id, {
                especie,
                items: [],
            });
        }

        gruposPorEspecie.get(especie.id)!.items.push(pub);
    }

    const grupos = Array.from(gruposPorEspecie.values());

    return (
        <main className="relative isolate min-h-screen bg-background">
            {/* <HojasDecorativas variante="fondo" /> */}
            <div className="contenedor-pagina relative z-10">

                {/* Encabezado */}
                <header className="encabezado-pagina relative isolate mb-7 overflow-hidden rounded-2xl bg-secondary">
                    <HojasDecorativas variante="separador" />
                    <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-soft">
                                Mis publicaciones
                            </p>

                            <h1 className="titulo-pagina text-white">
                                Mi Mercado
                            </h1>

                            <p className="mt-2 text-sm text-white/80 sm:text-base">
                                Consultá los productos que tenés publicados.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:items-end">
                            <p className="text-sm font-semibold text-white/80">
                                {publicacionesVisibles.length}{" "}{publicacionesVisibles.length === 1 ? "publicación" : "publicaciones"}
                            </p>
                            <button type="button" onClick={abrirAlta} className="rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-secondary hover:bg-primary-soft">Nueva publicación</button>
                        </div>
                    </div>
                </header>

                {error && <p className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
                {mensaje && <p className="mb-4 rounded-lg bg-primary-soft p-4 text-sm text-secondary" role="status">{mensaje}</p>}

                {/* Estado vacío */}
                {publicacionesVisibles.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-foreground">
                            No tenés publicaciones
                        </h2>

                        <p className="mt-2 text-sm text-muted">
                            Cuando tengas productos publicados aparecerán acá.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Controles */}
                        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-xl font-bold text-foreground">
                                Publicaciones
                            </h2>

                            <button
                                type="button"
                                aria-pressed={agruparPorEspecie}
                                onClick={() =>
                                    setAgruparPorEspecie(
                                        (valorActual) => !valorActual
                                    )
                                }
                                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                    agruparPorEspecie
                                        ? "border-primary bg-primary text-white"
                                        : "border-border bg-surface text-foreground hover:border-primary"
                                }`}
                            >
                                {agruparPorEspecie
                                    ? "Desagrupar"
                                    : "Agrupar por especie"}
                            </button>
                        </div>

                        {agruparPorEspecie ? (
                            <div className="space-y-7">
                                {grupos.map(({ especie, items }) => (
                                    <section key={especie.id}>

                                        {/* Encabezado de especie */}
                                        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                                            <h3 className="text-xl font-bold text-foreground">
                                                {especie.nombreEspecie}
                                            </h3>

                                            <span className="text-sm text-muted">
                                                · {items.length}{" "}
                                                {items.length === 1
                                                    ? "publicación"
                                                    : "publicaciones"}
                                            </span>
                                        </div>

                                        {/* Tarjetas */}
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                            {items.map((pub) => (
                                                <TarjetaPublicacion
                                                    key={pub.id}
                                                    pub={pub}
                                                    incrementoPrecio={
                                                        incrementoPrecio
                                                    }
                                                    alConsultar={consultarPublicacion}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {publicacionesVisibles.map((pub) => (
                                    <TarjetaPublicacion
                                        key={pub.id}
                                        pub={pub}
                                        incrementoPrecio={incrementoPrecio}
                                        alConsultar={consultarPublicacion}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
            {altaAbierta && <NuevaPublicacion operadorId={operadorId} abierto={altaAbierta} alCerrar={cerrarAlta} alCrear={publicacionCreada} />}
            <DrawerEditarPublicacion abierto={publicacionSeleccionada !== null} alCerrar={() => setSeleccion(null)} alGuardar={guardarCambios} publicacion={publicacionParaEditar} modoInicial="consulta" alEliminar={() => { if (publicacionSeleccionada) solicitarBaja(publicacionSeleccionada); }} eliminando={eliminando} actualizando={listadoPendiente === publicaciones} errorConsulta={error} {...opcionesEdicion}>
                <ConfirmModal abierto={publicacionPendiente !== null} titulo="Eliminar publicación" descripcion={publicacionPendiente ? `¿Querés eliminar la publicación de ${publicacionPendiente.presentacion.variedad.especie.nombreEspecie}? Esta acción no se puede deshacer.` : ""} textoConfirmar="Sí, eliminar" procesando={eliminando} alCancelar={() => { if (!eliminando) setPublicacionPendiente(null); }} alConfirmar={() => void eliminarPublicacion()} />
            </DrawerEditarPublicacion>
        </main>
    );
}
