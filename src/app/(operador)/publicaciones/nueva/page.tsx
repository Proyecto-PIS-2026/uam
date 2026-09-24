"use client";

import { useEffect, useRef, useState, type ChangeEvent, type SubmitEvent } from "react";
import Image from "next/image";
import { ConfirmModal } from "@/compartido/componentes/ConfirmModal";
import type { DatosAltaPublicacionOperador } from "@/modulos/publicaciones/validarAltaPublicacionOperador";

type Opcion = { id: number; nombre: string };
type OpcionRelacionada = Opcion & { especieId?: number | null; variedadId?: number };
type Catalogos = {
	operadores: Opcion[];
	especies: Opcion[];
	variedades: OpcionRelacionada[];
	presentaciones: OpcionRelacionada[];
	categorias: OpcionRelacionada[];
	calibres: Opcion[];
	paises: Opcion[];
};

type PublicacionOperador = {
	id: number;
	fecha: string;
	especie: string;
	variedad: string;
	presentacion: string;
	categoria: string;
	calibre: string;
	pais: string;
	precio: string | null;
	disponible: boolean;
};

type Formulario = Omit<DatosAltaPublicacionOperador, "precio" | "fotografia"> & { precio: string; fotografia: string };

const datosIniciales: Formulario = {
	operadorId: 0,
	especieId: 0,
	variedadId: 0,
	presentacionId: 0,
	calibreId: 0,
	categoriaId: 0,
	paisId: 0,
	disponibilidad: true,
	precio: "",
	fotografia: "",
};

const estiloCampo = "mt-2 min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#008332] focus:ring-2 focus:ring-[#a8d05d]";

function CampoSelect({ nombre, valor, opciones, cambiar, deshabilitado = false }: {
	nombre: string;
	valor: number;
	opciones: Opcion[];
	cambiar: (id: number) => void;
	deshabilitado?: boolean;
}) {
	return (
		<label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
			{nombre}
			<select className={estiloCampo} value={valor || ""} onChange={(evento) => cambiar(Number(evento.target.value))} required disabled={deshabilitado}>
				<option value="">Seleccioná {nombre.toLowerCase()}</option>
				{opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
			</select>
		</label>
	);
}

export default function NuevaPublicacionPage() {
	const drawerRef = useRef<HTMLDialogElement>(null);
	const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
	const [datos, setDatos] = useState<Formulario>(datosIniciales);
	const [errores, setErrores] = useState<string[]>([]);
	const [mensaje, setMensaje] = useState("");
	const [cargando, setCargando] = useState(true);
	const [guardando, setGuardando] = useState(false);
	const [publicaciones, setPublicaciones] = useState<PublicacionOperador[]>([]);
	const [cargandoPublicaciones, setCargandoPublicaciones] = useState(false);
	const [eliminandoId, setEliminandoId] = useState<number | null>(null);
	const [publicacionPendiente, setPublicacionPendiente] = useState<PublicacionOperador | null>(null);
	const [errorLista, setErrorLista] = useState("");
	const [versionLista, setVersionLista] = useState(0);

	useEffect(() => {
		let activo = true;
		fetch("/api/publicaciones")
			.then(async (respuesta) => {
				if (!respuesta.ok) throw new Error("No se pudieron cargar los datos del formulario.");
				return respuesta.json() as Promise<Catalogos>;
			})
			.then((resultado) => { if (activo) setCatalogos(resultado); })
			.catch(() => { if (activo) setErrores(["No se pudieron cargar los datos del formulario."]); })
			.finally(() => { if (activo) setCargando(false); });
		return () => { activo = false; };
	}, []);

	useEffect(() => {
		if (!datos.operadorId) return;
		const controlador = new AbortController();
		fetch(`/api/publicaciones/operador/${datos.operadorId}`, { signal: controlador.signal })
			.then(async (respuesta) => {
				if (!respuesta.ok) throw new Error("No se pudieron cargar las publicaciones.");
				return respuesta.json() as Promise<{ publicaciones: PublicacionOperador[] }>;
			})
			.then((resultado) => { setPublicaciones(resultado.publicaciones); setErrorLista(""); })
			.catch((error) => { if (error.name !== "AbortError") setErrorLista("No se pudieron cargar las publicaciones."); })
			.finally(() => { if (!controlador.signal.aborted) setCargandoPublicaciones(false); });
		return () => controlador.abort();
	}, [datos.operadorId, versionLista]);

	function seleccionarOperador(operadorId: number) {
		actualizar({ operadorId });
		setPublicaciones([]);
		setErrorLista("");
		setCargandoPublicaciones(operadorId > 0);
	}

	async function eliminarPublicacion(publicacion: PublicacionOperador) {
		setEliminandoId(publicacion.id);
		setErrorLista("");
		try {
			const respuesta = await fetch(`/api/publicaciones/${publicacion.id}?operadorId=${datos.operadorId}`, { method: "DELETE" });
			const resultado = await respuesta.json();
			if (!respuesta.ok) {
				setErrorLista(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");
				return;
			}
			setPublicaciones((actuales) => actuales.filter((item) => item.id !== publicacion.id));
			setVersionLista((actual) => actual + 1);
		} catch {
			setErrorLista("No se pudo conectar con el servidor.");
		} finally {
			setEliminandoId(null);
			setPublicacionPendiente(null);
		}
	}

	function actualizar(cambio: Partial<Formulario>) {
		setDatos((actuales) => ({ ...actuales, ...cambio }));
		setErrores([]);
		setMensaje("");
	}

	async function seleccionarFotografia(evento: ChangeEvent<HTMLInputElement>) {
		const archivo = evento.target.files?.[0];
		if (!archivo) { actualizar({ fotografia: "" }); return; }
		if (!(["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) || archivo.size > 2_000_000) {
			actualizar({ fotografia: "" });
			setErrores(["La fotografía debe ser PNG, JPEG o WebP y pesar menos de 2 MB."]);
			evento.target.value = "";
			return;
		}
		try {
			const fotografia = await new Promise<string>((resolver, rechazar) => {
				const lector = new FileReader();
				lector.onload = () => resolver(String(lector.result));
				lector.onerror = () => rechazar(new Error("No se pudo leer la fotografía."));
				lector.readAsDataURL(archivo);
			});
			actualizar({ fotografia });
		} catch {
			setErrores(["No se pudo leer la fotografía."]);
		}
	}

	async function enviarFormulario(evento: SubmitEvent<HTMLFormElement>) {
		evento.preventDefault();
		setErrores([]);
		setMensaje("");
		setGuardando(true);
		try {
			const respuesta = await fetch("/api/publicaciones", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(datos),
			});
			const resultado = await respuesta.json();
			if (!respuesta.ok) {
				setErrores(resultado.errores ?? ["No se pudo guardar la publicación."]);
				return;
			}
			setMensaje(`${resultado.mensaje} ID: ${resultado.id}`);
			setDatos({ ...datosIniciales, operadorId: datos.operadorId });
			setVersionLista((actual) => actual + 1);
		} catch {
			setErrores(["No se pudo conectar con el servidor."]);
		} finally {
			setGuardando(false);
		}
	}

	const variedades = catalogos?.variedades.filter((item) => item.especieId === datos.especieId) ?? [];
	const presentaciones = catalogos?.presentaciones.filter((item) => item.variedadId === datos.variedadId) ?? [];
	const categorias = catalogos?.categorias.filter((item) => item.especieId === null || item.especieId === datos.especieId) ?? [];

	return (
		<main className="min-h-screen bg-[#f6f5f0] px-4 py-6 text-[#1a1a1a] sm:px-8 sm:py-10">
			<div className="mx-auto max-w-5xl">
				<header className="mb-6 flex flex-wrap items-end justify-between gap-4">
					<div><h1 className="text-3xl font-bold">Publicaciones del operador</h1><p className="mt-2 text-sm text-[#5e665f]">Seleccioná un operador para ver y administrar sus publicaciones.</p></div>
					<button type="button" onClick={() => drawerRef.current?.showModal()} className="rounded-lg bg-[#008332] px-5 py-3 font-bold text-white hover:bg-[#005d29]">Nueva publicación</button>
				</header>
				<div className="mb-5 max-w-sm"><CampoSelect nombre="Operador" valor={datos.operadorId} opciones={catalogos?.operadores ?? []} cambiar={seleccionarOperador} deshabilitado={cargando || !catalogos} /></div>
				{errorLista && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{errorLista}</p>}
				{datos.operadorId === 0 ? <p className="rounded-xl bg-white p-5 text-sm text-[#5e665f]">Elegí un operador para ver sus publicaciones.</p> :
					cargandoPublicaciones ? <p className="rounded-xl bg-white p-5 text-sm">Cargando publicaciones...</p> :
					publicaciones.length === 0 ? <p className="rounded-xl bg-white p-5 text-sm">Este operador no tiene publicaciones.</p> :
					<div className="grid gap-4 md:grid-cols-2">
						{publicaciones.map((publicacion) => <article key={publicacion.id} className="rounded-xl border border-[#deded7] bg-white p-5 shadow-sm">
							<div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{publicacion.especie} · {publicacion.variedad}</h2><p className="text-xs text-[#5e665f]">#{publicacion.id} · {new Date(publicacion.fecha).toLocaleDateString("es-UY")}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${publicacion.disponible ? "bg-[#e9f2e5] text-[#005d29]" : "bg-gray-100 text-gray-600"}`}>{publicacion.disponible ? "Disponible" : "No disponible"}</span></div>
							<p className="text-sm">{publicacion.presentacion} · {publicacion.categoria} · {publicacion.calibre}</p>
							<p className="mt-1 text-sm text-[#5e665f]">Origen: {publicacion.pais}</p>
							<p className="mt-1 text-sm font-semibold">{publicacion.precio === null ? "Sin precio" : `$ ${publicacion.precio}`}</p>
							<button type="button" onClick={() => setPublicacionPendiente(publicacion)} disabled={eliminandoId !== null} className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">Eliminar publicación</button>
						</article>)}
					</div>}
			</div>
			<dialog ref={drawerRef} aria-labelledby="titulo-nueva-publicacion" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-[#f6f5f0] p-0 text-[#1a1a1a] shadow-xl backdrop:bg-black/40 sm:max-w-2xl">
				<div className="p-4 sm:p-8">
					<div className="mb-4 flex justify-end"><button type="button" onClick={() => drawerRef.current?.close()} className="min-h-11 rounded-lg bg-white px-4 py-2 font-semibold text-red-800">Cerrar</button></div>
					<header className="mb-6 border-b border-[#deded7] pb-5">
						<p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#008332]">Mercado del operador</p>
						<h1 id="titulo-nueva-publicacion" className="text-3xl font-bold">Nueva publicación</h1>
						<p className="mt-2 text-sm text-[#5e665f]">Completá los datos del producto para ofrecerlo a los compradores.</p>
					</header>
					{errores.length > 0 && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{errores.map((error, indice) => <p key={indice}>{error}</p>)}</div>}
					{mensaje && <p role="status" className="mb-4 rounded-lg bg-[#e9f2e5] p-4 text-sm font-semibold text-[#005d29]">{mensaje}</p>}
					<form className="rounded-2xl border border-[#deded7] bg-white p-5 shadow-sm sm:p-8" onSubmit={enviarFormulario}>
						<h2 className="mb-5 text-lg font-bold text-[#005d29]">Datos de la publicación</h2>
						<div className="grid gap-5 sm:grid-cols-2">
							<CampoSelect nombre="Operador" valor={datos.operadorId} opciones={catalogos?.operadores ?? []} cambiar={seleccionarOperador} deshabilitado={cargando || !catalogos} />
							<CampoSelect nombre="País de origen" valor={datos.paisId} opciones={catalogos?.paises ?? []} cambiar={(paisId) => actualizar({ paisId })} deshabilitado={cargando || !catalogos} />
							<CampoSelect nombre="Especie" valor={datos.especieId} opciones={catalogos?.especies ?? []} cambiar={(especieId) => actualizar({ especieId, variedadId: 0, presentacionId: 0, categoriaId: 0 })} deshabilitado={cargando || !catalogos} />
							<CampoSelect nombre="Variedad" valor={datos.variedadId} opciones={variedades} cambiar={(variedadId) => actualizar({ variedadId, presentacionId: 0 })} deshabilitado={!datos.especieId} />
							<CampoSelect nombre="Presentación" valor={datos.presentacionId} opciones={presentaciones} cambiar={(presentacionId) => actualizar({ presentacionId })} deshabilitado={!datos.variedadId} />
							<CampoSelect nombre="Categoría" valor={datos.categoriaId} opciones={categorias} cambiar={(categoriaId) => actualizar({ categoriaId })} deshabilitado={!datos.especieId} />
							<CampoSelect nombre="Calibre" valor={datos.calibreId} opciones={catalogos?.calibres ?? []} cambiar={(calibreId) => actualizar({ calibreId })} deshabilitado={cargando || !catalogos} />
							<label className="flex min-h-12 items-center gap-3 rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-sm font-bold text-[#465047] sm:mt-6">
								<input className="h-5 w-5 accent-[#008332]" type="checkbox" checked={datos.disponibilidad} onChange={(evento) => actualizar({ disponibilidad: evento.target.checked })} />Disponible
							</label>
						</div>
						<h2 className="mb-4 mt-8 border-t border-[#deded7] pt-6 text-lg font-bold text-[#005d29]">Información opcional</h2>
						<div className="grid gap-5 sm:grid-cols-2">
							<label className="text-xs font-bold uppercase tracking-wide text-[#465047]">Precio<input className={estiloCampo} value={datos.precio} onChange={(evento) => actualizar({ precio: evento.target.value })} inputMode="decimal" placeholder="Ejemplo: 1250,50" /></label>
							<label className="text-xs font-bold uppercase tracking-wide text-[#465047]">Fotografía<input className="mt-2 block w-full text-sm font-normal normal-case" type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarFotografia} /></label>
						</div>
						{datos.fotografia && <div className="mt-5 rounded-xl border border-[#deded7] p-3"><p className="mb-2 text-xs font-bold uppercase">Vista previa</p><Image unoptimized width={640} height={360} className="max-h-56 w-full rounded-lg object-cover" src={datos.fotografia} alt="Vista previa de la fotografía" /></div>}
						<button className="mt-6 min-h-12 w-full rounded-lg bg-[#008332] px-5 py-3 text-sm font-bold uppercase text-white disabled:opacity-50" type="submit" disabled={guardando || !catalogos}>{guardando ? "Guardando..." : "Crear publicación"}</button>
					</form>
				</div>
			</dialog>
			<ConfirmModal
				abierto={publicacionPendiente !== null}
				titulo="Eliminar publicación"
				descripcion={publicacionPendiente ? `¿Querés eliminar la publicación #${publicacionPendiente.id} de ${publicacionPendiente.especie} (${publicacionPendiente.variedad})? Esta acción no se puede deshacer.` : ""}
				textoConfirmar="Sí, eliminar"
				procesando={eliminandoId !== null}
				alCancelar={() => setPublicacionPendiente(null)}
				alConfirmar={() => { if (publicacionPendiente) void eliminarPublicacion(publicacionPendiente); }}
			/>
		</main>
	);
}
