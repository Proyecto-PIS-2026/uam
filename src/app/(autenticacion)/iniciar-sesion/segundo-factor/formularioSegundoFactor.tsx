"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { cancelarVerificacion, verificarSegundoFactor, type EstadoSegundoFactor } from "./acciones";

type Props = { vinculacion: boolean; correo: string; secreto: string | null; qr: string | null; expiraEn: number; intentosRestantes: number };
const estadoInicial: EstadoSegundoFactor = {};

export default function FormularioSegundoFactor({ vinculacion, correo, secreto, qr, expiraEn, intentosRestantes }: Props) {
    const [estado, accion, pendiente] = useActionState(verificarSegundoFactor, estadoInicial);
    const [segundosRestantes, cambiarSegundosRestantes] = useState<number | null>(null);
    const [mensajeCopia, cambiarMensajeCopia] = useState("");
    useEffect(() => {
        function actualizarTiempo() {
            const segundos = Math.max(0, expiraEn - Math.floor(Date.now() / 1000));
            cambiarSegundosRestantes(segundos);
            if (segundos === 0) window.location.replace("/iniciar-sesion?segundoFactor=vencido");
        }
        actualizarTiempo();
        const intervalo = setInterval(actualizarTiempo, 1000);
        return () => clearInterval(intervalo);
    }, [expiraEn]);

    async function copiarClave() {
        try {
            await navigator.clipboard.writeText(secreto!);
            cambiarMensajeCopia("Clave copiada.");
        } catch {
            cambiarMensajeCopia("No pudimos copiar la clave. Podés seleccionarla y copiarla manualmente.");
        }
    }

    return (
        <div className="w-full max-w-md secciones-pagina rounded-[var(--radio-panel)] border border-border bg-surface p-[var(--padding-panel)] shadow-[var(--sombra-panel)]">
            {vinculacion && (
                <>
                    <ol className="list-decimal space-y-4 pl-5 text-sm">
                        <li>Abrí Google Authenticator u otra aplicación compatible.</li>
                        <li>Tocá “+” y escaneá este QR.</li>
                    </ol>
                    {qr && <Image src={qr} alt="Código QR para vincular la cuenta con la aplicación de autenticación" width={256} height={256} unoptimized className="mx-auto h-auto max-w-full" />}
                    <details className="text-sm">
                        <summary className="cursor-pointer font-medium">¿No podés escanearlo?</summary>
                        <div className="mt-3 space-y-2">
                            <p>Agregá la cuenta manualmente con estos datos:</p>
                            <p>Nombre de la cuenta: <strong>UAM — {correo}</strong></p>
                            <p>Clave: <code className="break-all" data-testid="clave-segundo-factor">{secreto}</code></p>
                            <button type="button" onClick={copiarClave} className="boton-secundario">Copiar clave</button>
                            <p role="status">{mensajeCopia}</p>
                            <p>Tipo de clave: <strong>Basada en tiempo</strong></p>
                        </div>
                    </details>
                    <p className="text-sm">No compartas el QR ni la clave.</p>
                    <p className="text-sm">3. Ingresá el código de seis dígitos de la aplicación.</p>
                </>
            )}
            <form action={accion} className="secciones-pagina">
                <div>
                    <label htmlFor="codigo" className="mb-2 block text-sm font-medium">Código de verificación</label>
                    <input id="codigo" name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required className="campo-formulario" />
                </div>
                {estado.error ? <p role="alert" className="text-sm text-danger">{estado.error}</p> : <p className="text-sm">Tenés {intentosRestantes} {intentosRestantes === 1 ? "intento disponible" : "intentos disponibles"}.</p>}
                <button type="submit" disabled={pendiente || segundosRestantes === 0} className="boton-primario w-full">{pendiente ? "Verificando..." : vinculacion ? "Confirmar e ingresar" : "Verificar e ingresar"}</button>
                <button type="submit" formAction={cancelarVerificacion} formNoValidate disabled={pendiente} className="boton-secundario w-full">Cancelar y volver al inicio de sesión</button>
            </form>
            {vinculacion && <p className="text-sm">Si cancelás o vence el plazo, vinculá nuevamente con el nuevo QR.</p>}
        </div>
    );
}
