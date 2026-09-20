"use client";

import { useRef, useState, type ChangeEvent, type SubmitEvent } from "react";

type DatosFormulario = {
	especie: string;
	variedad: string;
	calibre: string;
	categoria: string;
	presentacion: string;
	disponibilidad: boolean;
	precio: string;
	fotografia: string;
};

const datosIniciales: DatosFormulario = {
	especie: "",
	variedad: "",
	calibre: "",
	categoria: "",
	presentacion: "",
	disponibilidad: true,
	precio: "",
	fotografia: "",
};

export default function NuevaPublicacionPage() {
	const [datos, setDatos] = useState(datosIniciales);
	const [errores, setErrores] = useState<string[]>([]);
	const [mensaje, setMensaje] = useState("");
	const [vistaPrevia, setVistaPrevia] = useState("");

    const drawerRef = useRef<HTMLDialogElement>(null);

	function actualizarCampo(campo: keyof DatosFormulario, valor: string | boolean) {
		setDatos((actuales) => ({ ...actuales, [campo]: valor }) /*Fucion que recibe actuales y devuelve nuevos datos */ );
		setErrores([]);
		setMensaje("");
	}

	function seleccionarFotografia(evento: ChangeEvent<HTMLInputElement>) {
		const archivo = evento.target.files?.[0];
		if (!archivo) return;

		actualizarCampo("fotografia", archivo.name);
		setVistaPrevia(URL.createObjectURL(archivo));
	}

	async function enviarFormulario(evento: SubmitEvent<HTMLFormElement>) {
		evento.preventDefault();
		setErrores([]);
		setMensaje("");

		const respuesta = await fetch("/api/publicaciones", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(datos),
		});
		const resultado = await respuesta.json();

		if (!respuesta.ok) {
			setErrores((resultado.errores == null) ? ["No se pudo validar la publicación."] : resultado.errores);
			return;
		}

		setMensaje(resultado.mensaje);
	}

	return (
		<main className="min-h-screen bg-[#f6f5f0] px-4 py-6 text-[#1a1a1a] sm:px-8 sm:py-10">

                <button
                    type="button"
                    onClick={() => drawerRef.current?.showModal()}
                    className="rounded-lg bg-[#008332] px-5 py-3 font-bold text-white hover:bg-[#005d29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008332]"
                > Nueva publicación </button>

                <dialog
                    ref={drawerRef}                 
                    aria-labelledby="titulo-nueva-publicacion"
                    className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-[#f6f5f0] p-0 text-[#1a1a1a] shadow-xl backdrop:bg-black/40 sm:max-w-2xl"
                >

                <div className="p-4 sm:p-8">

                    <div className="mb-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => drawerRef.current?.close()}
                            className="min-h-11 rounded-lg border border-[red-600] bg-white px-4 py-2 text-red-800 font-semibold hover:bg-[#FEF2F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008332]"
                        > Cerrar </button>
                    </div>

    
                    <header className="mb-6 border-b border-[#deded7] pb-5 sm:mb-8">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#008332]">Mercado del operador</p>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Nueva publicación</h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-[#5e665f]">Completá los datos del producto para ofrecerlo a los compradores.</p>
                    </header>


                    <form className="rounded-2xl border border-[#deded7] bg-white p-5 shadow-sm sm:p-8" onSubmit={enviarFormulario}>

                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-[#005d29]">Datos del producto</h2>
                            <p className="mt-1 text-sm text-[#5e665f]">Los campos principales son necesarios para publicar.</p>
                        </div>


                        <div className="grid gap-5 sm:grid-cols-2">

                    
                            <label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
                                Especie 
                                {errores.length > 0 && (
                                    <p role="alert" className="m-0 w-fit p-0 text-[11px] leading-tight text-[#8f2929]" >
                                        {errores[0]}
                                    </p>
                                )}
                                <input className="mt-2 min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-base font-normal normal-case tracking-normal outline-none transition focus:border-[#008332] focus:ring-2 focus:ring-[#a8d05d]" value={datos.especie} onChange={(evento) => actualizarCampo("especie", evento.target.value)} placeholder="Ejemplo: tomate" />
                            </label>

                            <label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
                                Variedad
                                {errores.length > 0 && (
                                    <p role="alert" className="m-0 w-fit p-0 text-[11px] leading-tight text-[#8f2929]" >
                                        {errores[1]}
                                    </p>
                                )}
                                <input className="mt-2 min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-base font-normal normal-case tracking-normal outline-none transition focus:border-[#008332] focus:ring-2 focus:ring-[#a8d05d]" value={datos.variedad} onChange={(evento) => actualizarCampo("variedad", evento.target.value)} placeholder="Ejemplo: redondo" />
                            </label>

                            <label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
                                Calibre
                                {errores.length > 0 && (
                                    <p role="alert" className="m-0 w-fit p-0 text-[11px] leading-tight text-[#8f2929]" >
                                        {errores[2]}
                                    </p>
                                )}
                                <input className="mt-2 min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-base font-normal normal-case tracking-normal outline-none transition focus:border-[#008332] focus:ring-2 focus:ring-[#a8d05d]" value={datos.calibre} onChange={(evento) => actualizarCampo("calibre", evento.target.value)} placeholder="Ejemplo: mediano" />
                            </label>

                            <label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
                                Categoría
                                {errores.length > 0 && (
                                    <p role="alert" className="m-0 w-fit p-0 text-[11px] leading-tight text-[#8f2929]" >
                                        {errores[3]}
                                    </p>
                                )}
                                <input className="mt-2 min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-base font-normal normal-case tracking-normal outline-none transition focus:border-[#008332] focus:ring-2 focus:ring-[#a8d05d]" value={datos.categoria} onChange={(evento) => actualizarCampo("categoria", evento.target.value)} placeholder="Ejemplo: primera" />
                            </label>

                            <label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
                                Presentación
                                {errores.length > 0 && (
                                    <p role="alert" className="m-0 w-fit p-0 text-[11px] leading-tight text-[#8f2929]" >
                                        {errores[4]}
                                    </p>
                                )}
                                <input className="mt-2 min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-base font-normal normal-case tracking-normal outline-none transition focus:border-[#008332] focus:ring-2 focus:ring-[#a8d05d]" value={datos.presentacion} onChange={(evento) => actualizarCampo("presentacion", evento.target.value)} placeholder="Ejemplo: cajón" />
                            </label>

                            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-sm font-bold text-[#465047] sm:mt-6">
                                <input className="h-5 w-5 accent-[#008332] focus:ring-2 focus:ring-[#a8d05d]" type="checkbox" checked={datos.disponibilidad} onChange={(evento) => actualizarCampo("disponibilidad", evento.target.checked)} />
                                Disponible
                            </label>

                        </div>

                        <div className="mt-8 border-t border-[#deded7] pt-6">
                            <h2 className="text-lg font-bold text-[#005d29]">Información opcional</h2>
                            <div className="mt-4 grid gap-5 sm:grid-cols-2">

                                <label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
                                    Precio <span className="font-normal normal-case tracking-normal text-[#6c746d]">(opcional)</span>
                                    <input className="mt-2 min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 text-base font-normal normal-case tracking-normal outline-none transition focus:border-[#008332] focus:ring-2 focus:ring-[#a8d05d]" value={datos.precio} onChange={(evento) => actualizarCampo("precio", evento.target.value)} inputMode="decimal" placeholder="Ejemplo: 1250,50" />
                                </label>

                                <label className="text-xs font-bold uppercase tracking-wide text-[#465047]">
                                    Fotografía <span className="font-normal normal-case tracking-normal text-[#6c746d]">(opcional)</span>
                                    <input className="mt-2 block min-h-12 w-full rounded-lg border border-[#deded7] bg-[#f6f5f0] px-3 py-3 text-sm font-normal normal-case tracking-normal file:mr-3 file:rounded-md file:border-0 file:bg-[#e9f2e5] file:px-3 file:py-1 file:font-semibold file:text-[#005d29] focus:border-[#008332] focus:outline-none focus:ring-2 focus:ring-[#a8d05d]" type="file" accept="image/*" onChange={seleccionarFotografia} />
                                </label>

                            </div>
                        </div>

                        {
                            vistaPrevia &&
                            <div className="mt-5 overflow-hidden rounded-xl border border-[#deded7] bg-[#f6f5f0] p-3">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#465047]">Vista previa</p>
                                <img className="max-h-56 w-full rounded-lg object-cover sm:max-h-64" src={vistaPrevia} alt="Vista previa de la fotografía" />
                            </div>
                        }

                        <p className="mt-4 text-sm leading-5 text-[#5e665f]">La fotografía solo se previsualiza localmente. Falta implementar la carga al servidor y el acceso a la cámara.</p>
                        <button className="mt-6 min-h-12 w-full rounded-lg bg-[#008332] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#005d29] focus:outline-none focus:ring-2 focus:ring-[#a8d05d] focus:ring-offset-2 active:bg-[#005d29]" type="submit">Simular alta</button>
                    </form>

                    {
                        mensaje &&
                        <p role="status" className="mt-5 rounded-xl border border-[#a8d05d] bg-[#e9f2e5] p-4 text-sm font-semibold text-[#005d29]">{mensaje}</p>
                    }
                </div>
            </dialog>    
		</main>
	);
}
