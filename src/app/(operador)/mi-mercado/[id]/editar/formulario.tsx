"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { CambiosPublicacionOperador } from "@/modulos/publicaciones/operadores/modificar-publicacion";
import { guardarEdicionPublicacion } from "../../actions";

type Props = {
    publicacionOperadorId: number;
    nombreEspecie: string;
    nombreVariedad: string;
    inicial: CambiosPublicacionOperador;
    calibres: { id: number; nombreCalibre: string }[];
    presentaciones: { id: number; nombrePresentacion: string; nombreVariedad: string }[];
    categorias: { id: number; nombreCategoria: string }[];
};

export default function FormularioEdicion({
    publicacionOperadorId,
    nombreEspecie,
    nombreVariedad,
    inicial,
    calibres,
    presentaciones,
    categorias,
}: Props) {
    const router = useRouter();
    const inputImagen = useRef<HTMLInputElement>(null);
    const [datos, setDatos] = useState(inicial);
    const [textoVariedad, setTextoVariedad] = useState(nombreVariedad);
    const [guardando, setGuardando] = useState(false);
    const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
    const [error, setError] = useState("");
    const [guardado, setGuardado] = useState(false);
    const variedadValida =
        textoVariedad.trim() !== "" && textoVariedad.trim() !== "-";
    const nombreProducto = variedadValida
        ? `${nombreEspecie} · ${textoVariedad}`
        : nombreEspecie;

    function cambiarPrecio(cantidad: number) {
        const precioActual = Number(datos.precio ?? 0);
        const nuevoPrecio = Math.max(0, precioActual + cantidad);
        setDatos({ ...datos, precio: String(nuevoPrecio) });
    }

    async function seleccionarImagen(archivo?: File) {
        if (!archivo) return;
        if (!archivo.type.startsWith("image/")) {
            setError("Seleccioná un archivo de imagen.");
            return;
        }
        try {
            const foto = await comprimirImagen(archivo);
            setDatos((actuales) => ({ ...actuales, foto }));
            setError("");
        } catch {
            setError("No se pudo procesar la imagen. Probá con otra foto.");
        }
    }

    function enviar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setConfirmacionAbierta(true);
    }

    async function confirmarGuardado() {
        setConfirmacionAbierta(false);
        setGuardando(true);
        setError("");
        setGuardado(false);

        try {
            const presentacionActual = presentaciones.find((item) => item.id === datos.presentacionId);
            const presentacionesDeVariedad = presentaciones.filter((item) => igual(item.nombreVariedad, textoVariedad));
            const presentacionElegida = presentacionesDeVariedad.find((item) => item.id === datos.presentacionId) ?? presentacionesDeVariedad[0];

            if (!presentacionActual || !presentacionElegida) {
                throw new Error("Esa variedad no existe en las opciones actuales. Escribí una variedad existente para poder guardarla.");
            }

            await guardarEdicionPublicacion(publicacionOperadorId, {
                ...datos,
                presentacionId: presentacionElegida.id,
            });
            setGuardado(true);
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "No se pudieron guardar los cambios."
            );
        } finally {
            setGuardando(false);
        }
    }

    return (
        <main className="min-h-screen bg-white px-3 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-5xl">
                <form onSubmit={enviar} className="space-y-8">
                    <section className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(180px,220px)_1fr] sm:gap-6">
                        <div className="group relative mx-auto aspect-square w-52 max-w-full overflow-hidden rounded-full bg-[#e7f1e9] text-center text-base text-[#495563] sm:mx-1">
                            <button type="button" onClick={() => inputImagen.current?.click()} className="group absolute inset-0 flex items-center justify-center outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#006633]" aria-label={datos.foto ? "Cambiar fotografía" : "Subir fotografía"}>
                                {datos.foto ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={datos.foto} alt={nombreProducto} className="h-full w-full object-cover" />
                                ) : (
                                    <span>Sin fotografía</span>
                                )}
                                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-2 text-xs font-semibold text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">{datos.foto ? "Cambiar foto" : "Subir foto"}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDatos((actuales) => ({ ...actuales, foto: null }))}
                                className="absolute inset-x-0 top-0 bg-black/55 px-2 py-2 text-xs font-semibold text-white opacity-0 transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white group-hover:opacity-100 group-focus-within:opacity-100"
                                aria-label="Borrar foto"
                            >
                                Borrar foto
                            </button>
                        </div>
                        <input ref={inputImagen} type="file" accept="image/*" className="sr-only" onChange={(event) => { void seleccionarImagen(event.target.files?.[0]); event.currentTarget.value = ""; }} />

                        <div className="min-w-0">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h1 className="text-3xl font-extrabold leading-tight text-[#006633] sm:text-4xl">
                                        {nombreEspecie}
                                    </h1>
                                    {variedadValida && (
                                        <p className="mt-1 text-2xl font-semibold text-[#006633]">
                                            {nombreVariedad}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    aria-pressed={datos.disponible}
                                    onClick={() => setDatos((actuales) => ({ ...actuales, disponible: !actuales.disponible }))}
                                    className={`shrink-0 rounded-full px-5 py-1.5 text-sm font-semibold transition ${datos.disponible ? "bg-[#e7f1e9] text-[#006633] hover:bg-[#7fb58d] hover:text-[#002b15]" : "bg-[#fee2e2] text-[#b42318] hover:bg-[#f87171] hover:text-[#65140e]"}`}
                                >
                                    {datos.disponible ? "Disponible" : "No disponible"}
                                </button>
                            </div>

                            <label className="sr-only" htmlFor="precio-publicacion">Precio</label>
                            <div className="flex h-[74px] items-center justify-between gap-3 rounded-2xl border border-[#dedede] p-2.5">
                                <button
                                    type="button"
                                    onClick={() => cambiarPrecio(-10)}
                                    aria-label="Disminuir precio en 10"
                                    className="h-full w-[70px] shrink-0 rounded-xl bg-[#006633] text-2xl font-bold text-white hover:bg-[#005329]"
                                >−</button>
                                <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                                    <span className="text-3xl font-extrabold text-[#171717]">$</span>
                                    <input
                                        id="precio-publicacion"
                                        className="w-full min-w-0 border-0 bg-transparent p-0 text-center text-3xl font-extrabold text-[#171717] outline-none"
                                        type="number"
                                        min="0"
                                        max="9999999999.99"
                                        step="0.01"
                                        value={datos.precio ?? ""}
                                        onChange={(e) => setDatos({ ...datos, precio: e.target.value || null })}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => cambiarPrecio(10)}
                                    aria-label="Aumentar precio en 10"
                                    className="h-full w-[70px] shrink-0 rounded-xl bg-[#006633] text-2xl font-bold text-white hover:bg-[#005329]"
                                >+</button>
                            </div>
                        </div>
                    </section>

                    <section className="relative rounded-2xl border border-[#dedede]">
                        <FilaEditable etiqueta="Presentación">
                            <SelectorDesplegable ariaLabel="Presentación" valorVacio="-" value={datos.presentacionId} opciones={presentaciones.map((item) => ({ id: item.id, nombre: item.nombrePresentacion }))} onChange={(id) => { const item = presentaciones.find((opcion) => opcion.id === id); if (item) { setDatos((actuales) => ({ ...actuales, presentacionId: item.id })); setTextoVariedad(item.nombreVariedad); } }} />
                        </FilaEditable>
                        <FilaEditable etiqueta="Calibre">
                            <SelectorDesplegable ariaLabel="Calibre" valorVacio="Sin Variación" value={datos.calibreId} opciones={calibres.map((item) => ({ id: item.id, nombre: item.nombreCalibre }))} onChange={(id) => setDatos((actuales) => ({ ...actuales, calibreId: id }))} />
                        </FilaEditable>
                        <FilaEditable etiqueta="Categoría">
                            <SelectorDesplegable ariaLabel="Categoría" valorVacio="-" value={datos.categoriaId} opciones={categorias.map((item) => ({ id: item.id, nombre: item.nombreCategoria }))} onChange={(id) => setDatos((actuales) => ({ ...actuales, categoriaId: id }))} />
                        </FilaEditable>
                        <FilaEditable etiqueta="Variedad">
                            <input aria-label="Variedad" type="text" value={textoVariedad} onChange={(event) => setTextoVariedad(event.target.value)} className="w-[60%] min-w-0 border-0 border-b border-transparent bg-transparent p-1 text-right text-lg font-semibold text-[#006633] outline-none focus:border-[#006633] focus:ring-0" />
                        </FilaEditable>
                    </section>

                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    {guardado && <p role="status" className="text-sm text-[#006633]">Cambios guardados.</p>}
                    <div className="flex justify-end">
                        <button type="submit" disabled={guardando} className="rounded-xl bg-[#006633] px-6 py-3 font-semibold text-white transition hover:bg-[#005329] disabled:opacity-50">
                            {guardando ? "Guardando…" : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </div>
            {confirmacionAbierta && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmacionAbierta(false); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="confirmar-cambios-titulo" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h2 id="confirmar-cambios-titulo" className="text-xl font-bold text-[#20252a]">¿Guardar los cambios?</h2>
                        <p className="mt-2 text-sm text-[#495563]">Se actualizarán los datos de esta publicación.</p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setConfirmacionAbierta(false)} disabled={guardando} className="rounded-xl border border-[#d5ded8] px-4 py-2.5 font-semibold text-[#303b34] hover:bg-[#f2f7f3] disabled:opacity-50">Cancelar</button>
                            <button type="button" onClick={() => void confirmarGuardado()} disabled={guardando} className="rounded-xl bg-[#006633] px-4 py-2.5 font-semibold text-white hover:bg-[#005329] disabled:opacity-50">{guardando ? "Guardando…" : "Confirmar"}</button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}

function FilaEditable({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
    return (
        <div className="flex min-h-[61px] items-center justify-between gap-4 border-b border-[#dedede] px-5 last:border-b-0 sm:px-6">
            <span className="shrink-0 text-base text-[#20252a]">{etiqueta}</span>
            {children}
        </div>
    );
}

function SelectorDesplegable({
    ariaLabel,
    valorVacio = "-",
    value,
    opciones,
    onChange,
}: {
    ariaLabel: string;
    valorVacio?: string;
    value: number;
    opciones: { id: number; nombre: string }[];
    onChange: (id: number) => void;
}) {
    const [abierto, setAbierto] = useState(false);
    const seleccionada = opciones.find((opcion) => opcion.id === value);

    return (
        <div
            className="relative w-56 min-w-36 max-w-[65%]"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAbierto(false);
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape") setAbierto(false);
                if (event.key === "ArrowDown") setAbierto(true);
            }}
        >
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={abierto}
                onClick={() => setAbierto((actual) => !actual)}
                className="flex min-h-10 w-full cursor-pointer items-center justify-end gap-2 rounded-lg px-2 text-right text-lg font-semibold text-[#006633] outline-none transition hover:bg-[#f2f7f3] focus-visible:ring-2 focus-visible:ring-[#006633]/30"
            >
                <span className="truncate">{seleccionada?.nombre ?? valorVacio}</span>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`h-4 w-4 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}>
                    <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {abierto && (
                <div role="listbox" aria-label={ariaLabel} className="absolute right-0 top-full z-20 mt-1 max-h-60 w-max min-w-full max-w-[min(80vw,22rem)] overflow-auto rounded-xl border border-[#dce5df] bg-white p-1 text-left shadow-lg">
                    {opciones.map((opcion) => (
                        <button
                            type="button"
                            role="option"
                            aria-selected={opcion.id === value}
                            key={opcion.id}
                            onClick={() => { onChange(opcion.id); setAbierto(false); }}
                            className={`block w-full rounded-lg px-3 py-2 text-left text-base leading-snug whitespace-normal transition ${opcion.id === value ? "bg-[#e7f1e9] font-semibold text-[#006633]" : "text-[#303b34] hover:bg-[#f2f7f3]"}`}
                        >
                            {opcion.nombre}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function igual(a: string, b: string) {
    return a.trim().localeCompare(b.trim(), undefined, { sensitivity: "accent" }) === 0;
}

async function comprimirImagen(archivo: File): Promise<string> {
    const bitmap = await createImageBitmap(archivo);
    const lado = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    let ancho = Math.max(1, Math.round(bitmap.width * lado));
    let alto = Math.max(1, Math.round(bitmap.height * lado));

    try {
        for (let intento = 0; intento < 8; intento += 1) {
            const canvas = document.createElement("canvas");
            canvas.width = ancho;
            canvas.height = alto;
            const contexto = canvas.getContext("2d");
            if (!contexto) throw new Error("No se pudo procesar la imagen.");
            contexto.drawImage(bitmap, 0, 0, ancho, alto);

            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/jpeg", Math.max(0.4, 0.82 - intento * 0.07)),
            );
            if (blob && blob.size <= 600_000) {
                return await new Promise<string>((resolve, reject) => {
                    const lector = new FileReader();
                    lector.onload = () => typeof lector.result === "string" ? resolve(lector.result) : reject(new Error("Imagen inválida."));
                    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
                    lector.readAsDataURL(blob);
                });
            }

            ancho = Math.max(1, Math.round(ancho * 0.8));
            alto = Math.max(1, Math.round(alto * 0.8));
        }
    } finally {
        bitmap.close();
    }

    throw new Error("La imagen es demasiado grande.");
}
