"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { modificarMiPerfilAdministrador } from "@/modulos/usuarios/administradores/modificar-mi-perfil";
import type { MiPerfilAdministrador } from "@/modulos/usuarios/administradores/consultar-mi-perfil";

export default function FormularioEditarMiPerfil({ perfil }: { perfil: MiPerfilAdministrador }) {
    const router = useRouter();
    const [nombre, setNombre] = useState(perfil.nombre);
    const [correo, setCorreo] = useState(perfil.correo);
    const [errores, setErrores] = useState<string[]>([]);
    const [guardando, setGuardando] = useState(false);
    const enviando = useRef(false);

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (enviando.current) return;
        enviando.current = true;
        setGuardando(true);
        setErrores([]);
        try {
            const resultado = await modificarMiPerfilAdministrador({ nombre, correo });
            if (!resultado.esValido) {
                setErrores(resultado.errores);
                return;
            }
            router.push("/mi-perfil");
            router.refresh();
        } catch {
            setErrores(["No se pudieron guardar los cambios. Intentá nuevamente."]);
        } finally {
            enviando.current = false;
            setGuardando(false);
        }
    }

    return (
        <form onSubmit={guardar} noValidate className="flex w-full flex-col gap-5 rounded-2xl border p-6" aria-label="Editar mi perfil">
            <div className="flex flex-col gap-2">
                <label htmlFor="mi-perfil-usuario">Nombre de usuario</label>
                <input id="mi-perfil-usuario" className="rounded-lg border p-3" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="username" disabled={guardando} required minLength={3} />
            </div>
            <div className="flex flex-col gap-2">
                <label htmlFor="mi-perfil-correo">Correo electrónico</label>
                <input id="mi-perfil-correo" className="rounded-lg border p-3" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" disabled={guardando} required />
                <p className="text-sm text-gray-500">Usá el nuevo correo para iniciar sesión después de guardarlo.</p>
            </div>
            {errores.length > 0 && <div role="alert" className="text-red-700">{errores.join(" ")}</div>}
            <div className="flex flex-wrap gap-3">
                <button type="submit" className="boton-primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
                <button type="button" className="boton-secundario" disabled={guardando} onClick={() => router.push("/mi-perfil")}>Cancelar</button>
            </div>
        </form>
    );
}
