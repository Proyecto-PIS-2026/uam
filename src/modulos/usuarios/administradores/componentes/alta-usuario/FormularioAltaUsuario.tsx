"use client";
import styles from "./FormularioAltaUsuario.module.css";
import { useState, type FormEvent } from "react";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";

export default function FormularioAltaUsuario() {
    const [rol, setRol] = useState("");
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [contraseña, setContraseña] = useState("");
    const [confirmacioncontraseña, setConfirmacionContraseña] = useState("");
    const [nombre, setNombre] = useState("");
    const [telefono, settelefono] = useState("");
    const [locales, setLocales] = useState([
        { nombre: "", nave: "", contrato: "" }
    ]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        "hacer el alta en la bd";
    }

    function agregarLocal() {
        setLocales([...locales, { nombre: "", nave: "", contrato: "" }]);
    }
        
    function eliminarLocal(index: number) {
        if (locales.length === 1) {
            return;
        }

        setLocales(locales.filter((_, i) => i !== index));
    }

    return (
        <section className="contenedor-pagina flex flex-col gap-6">
            <EncabezadoPagina
                titulo="Alta de usuario"
                subtitulo="Registrar un nuevo usuario en la plataforma"
            />

            <form onSubmit={handleSubmit} className={styles.formulario}>
                <div className={styles.campo}>
                    <label htmlFor="rol" className={styles.label}>
                        Rol del usuario<span className="text-red-500">*</span>
                    </label>
                    <select
                        id="rol"
                        value={rol}
                        onChange={(e) => setRol(e.target.value)}
                        required
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="" disabled>
                            Seleccionar un rol
                        </option>
                        <option value="operador">Operador</option>
                        <option value="productor">Productor</option>
                        <option value="administrador">Administrador</option>
                    </select>
                </div>

                <div className={styles.campo}>
                    <label htmlFor="nombreUsuario" className={styles.label}>
                        Nombre de Usuario<span className="text-red-500">*</span>
                    </label>
                    <input
                        id="nombreUsuario"
                        type="text"
                        placeholder="Ingresar nombre de usuario"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className={styles.campo}>
                    <label htmlFor="contrseña" className={styles.label}>
                        Contraseña<span className="text-red-500">*</span>
                    </label>
                    <input
                        id="contraseña"
                        type="text"
                        placeholder="Ingresar contraseña"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className={styles.campo}>
                    <label htmlFor="confirmacionContraseña" className={styles.label}>
                        Confirmación de Contraseña<span className="text-red-500">*</span>
                    </label>
                    <input
                        id="nombreUsuario"
                        type="text"
                        placeholder="ingresar confirmación de contraseña"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                
                {rol === "operador" && (
                <>
                    <div className={styles.campo}>
                        <label htmlFor="nombre" className={styles.label}>
                            Nombre<span className="text-red-500">*</span>
                        </label>
                        <input
                            id="nombre"
                            type="text"
                            placeholder="Ingresar nombre"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div className={styles.campo}>
                        <label htmlFor="numero" className={styles.label}>
                            Numero de Teléfono (whatsApp)<span className="text-red-500">*</span>
                        </label>
                        <input
                            id="numero"
                            type="text"
                            placeholder="Ingresar número de teléfono"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <label htmlFor="locales" className={styles.label}>
                            Locales <span className="text-red-500">(Mínimo 1)</span>
                        </label>
                        {locales.map((local, index) => (
                            <div key={index} className="flex flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="Nombre del local"
                                    value={local.nombre}
                                    onChange={(e) => {
                                        const nuevosLocales = [...locales];
                                        nuevosLocales[index].nombre = e.target.value;
                                        setLocales(nuevosLocales);
                                    }}
                                    className="w-1/3 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                                />

                                <select
                                    value={local.nave}
                                    onChange={(e) => {
                                        const nuevosLocales = [...locales];
                                        nuevosLocales[index].nave = e.target.value;
                                        setLocales(nuevosLocales);
                                    }}
                                    className="w-1/4 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">Seleccionar nave</option>
                                    <option value="nave1">Nave A</option>
                                    <option value="nave2">Nave B</option>
                                    <option value="nave3">Nave C</option>
                                    <option value="nave4">Nave D</option>
                                </select>

                                <input
                                    type="text"
                                    placeholder="Contrato"
                                    value={local.contrato}
                                    onChange={(e) => {
                                        const nuevosLocales = [...locales];
                                        nuevosLocales[index].contrato = e.target.value;
                                        setLocales(nuevosLocales);
                                    }}
                                    className="w-1/3 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                                />

                                <button
                                    type="button"
                                    onClick={() => eliminarLocal(index)}
                                    disabled={index === 0}
                                    className={`rounded-lg border border-border px-4 py-2 text-sm font-medium ${
                                        index === 0 ? "invisible" : "hover:bg-muted"
                                    }`}
                                >
                                    Eliminar
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={agregarLocal}
                            className="w-fit rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                        >
                            + Agregar nuevo local
                        </button>
                    </div>
                </>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="reset"
                            onClick={() => {
                                setRol("");
                                setNombreUsuario("");
                                setContraseña("");
                                setConfirmacionContraseña("");
                                setNombre("");
                                settelefono("");
                                setLocales([{ nombre: "", nave: "", contrato: "" }]);
                            }}
                        className="rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted"
                    >
                        Limpiar
                    </button>

                    <button
                        type="submit"
                        className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                        Registrar usuario
                    </button>
                </div>
            </form>
        </section>
    );
}
