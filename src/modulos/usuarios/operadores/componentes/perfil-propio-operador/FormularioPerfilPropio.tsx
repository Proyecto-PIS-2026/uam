"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import SelectorFotoPerfil, { argumentosFotoPerfil, type CambioFotoPerfil } from "@/modulos/usuarios/componentes/SelectorFotoPerfil";
import { modificarPerfilPropio } from "../../acciones/modificarPerfilPropio";
import type { PerfilPropioOperador } from "../../consultasPerfilPropio";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import styles from "./FormularioPerfilPropio.module.css";

const CODIGOS_PAIS = [
    { codigo: "+598", pais: "Uruguay" },
    { codigo: "+54", pais: "Argentina" },
    { codigo: "+55", pais: "Brasil" },
    { codigo: "+56", pais: "Chile" },
    { codigo: "+595", pais: "Paraguay" },
];

function separar(contacto: string | null) {
    const codigo = CODIGOS_PAIS.find((item) => contacto?.startsWith(item.codigo))?.codigo ?? "+598";
    const telefono = contacto?.startsWith(codigo) ? contacto.slice(codigo.length) : "";
    return { codigo, telefono };
}

function extraerLicencia(comentario: string | null) {
    const coincidencia = comentario?.match(/^Licencia:\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})\s*(?:\r?\n\r?\n)?([\s\S]*)$/);
    return {
        inicio: coincidencia?.[1] ?? "",
        fin: coincidencia?.[2] ?? "",
        comentario: coincidencia?.[3] ?? comentario ?? "",
    };
}

export default function FormularioPerfilPropio({ perfil, alCancelar }: { perfil: PerfilPropioOperador; alCancelar: () => void }) {
    const router = useRouter();
    const { notificar } = useNotificacionToast();
    const actual = separar(perfil.contacto);
    const [codigoPais, setCodigoPais] = useState(actual.codigo);
    const [telefono, setTelefono] = useState(actual.telefono);
    const [nombre, setNombre] = useState(perfil.nombre);
    const licencia = extraerLicencia(perfil.comentario);
    const [enLicencia, setEnLicencia] = useState(perfil.enLicencia);
    const [inicioLicencia, setInicioLicencia] = useState(licencia.inicio);
    const [finLicencia, setFinLicencia] = useState(licencia.fin);
    const [comentario, setComentario] = useState(licencia.comentario);
    const [foto, setFoto] = useState<CambioFotoPerfil>(undefined);
    const [errores, setErrores] = useState<string[]>([]);
    const [guardando, setGuardando] = useState(false);
    const enCurso = useRef(false);
    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (enCurso.current) return;
        enCurso.current = true;
        setGuardando(true);
        setErrores([]);
        try {
            const resultado = await modificarPerfilPropio({
                nombre,
                codigoPais,
                telefono,
                enLicencia,
                inicioLicencia,
                finLicencia,
                comentario,
            }, ...argumentosFotoPerfil(foto));
            if (!resultado.esValido) {
                setErrores(resultado.errores);
                return;
            }
            notificar(resultado.mensaje, "success");
            alCancelar();
            router.refresh();
        } catch {
            setErrores(["No se pudieron guardar los cambios. Intentá nuevamente."]);
        } finally {
            enCurso.current = false;
            setGuardando(false);
        }
    }

    return (
        <main className={styles.pagina}>
            <div className={styles.contenedor}>
                <BotonVolver onClick={alCancelar} disabled={guardando} className={styles.volver}>
                    Volver a mi perfil
                </BotonVolver>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <h1 className={styles.titulo}>Editar mi perfil</h1>
                    <p className={styles.descripcion}>Actualizar información de <strong>{perfil.nombreUsuario}</strong></p>
                </header>
                <form className={styles.formulario} onSubmit={guardar} noValidate>
                    <section className={styles.seccion}>
                        <SelectorFotoPerfil fotoActual={perfil.fotoPerfil} cambio={foto} alCambiar={setFoto} alError={(mensaje) => setErrores([mensaje])} deshabilitado={guardando} />
                        <TextField label="Nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} disabled={guardando} fullWidth />
                        
                        <div className={styles.telefono}>
                            <TextField select label="Código de país" value={codigoPais} onChange={(event) => setCodigoPais(event.target.value)} disabled={guardando}>
                                {CODIGOS_PAIS.map(({ codigo, pais }) => <MenuItem key={codigo} value={codigo}>{codigo} ({pais})</MenuItem>)}
                            </TextField>
                            <TextField label="WhatsApp" required type="tel" value={telefono} onChange={(event) => { if (/^[0-9]*$/.test(event.target.value)) setTelefono(event.target.value); }} disabled={guardando} />
                        </div>
                        <p className={styles.aviso}>
                            <WarningAmberOutlinedIcon aria-hidden="true" className={styles.iconoAviso} />
                            <span>La declaración de licencia en la aplicación no sustituye la solicitud formal ante el área jurídica de la UAM.</span>
                        </p>
                        <label className={styles.licencia} htmlFor="perfil-propio-licencia" data-activa={enLicencia}>
                            <span className={styles.textoLicencia}>
                                <span className={styles.etiquetaLicencia}>En licencia</span>
                                <span className={styles.estadoLicencia}>{enLicencia ? "Sí" : "No"}</span>
                            </span>
                            <Switch
                                checked={enLicencia}
                                onChange={(_, valor) => setEnLicencia(valor)}
                                disabled={guardando}
                                slotProps={{ input: { id: "perfil-propio-licencia", role: "switch", "aria-label": "En licencia" } }}
                            />
                        </label>
                        {enLicencia && (
                            <>
                                <div className={styles.fechasLicencia}>
                                    <TextField
                                        label="Inicio de licencia"
                                        type="date"
                                        value={inicioLicencia}
                                        onChange={(event) => setInicioLicencia(event.target.value)}
                                        disabled={guardando}
                                        slotProps={{ htmlInput: { min: new Date().toISOString().slice(0, 10) }, inputLabel: { shrink: true } }}
                                        size="small"
                                    />
                                    <TextField
                                        label="Fin de licencia"
                                        type="date"
                                        value={finLicencia}
                                        onChange={(event) => setFinLicencia(event.target.value)}
                                        disabled={guardando}
                                        slotProps={{ htmlInput: { min: inicioLicencia || new Date().toISOString().slice(0, 10) }, inputLabel: { shrink: true } }}
                                        size="small"
                                    />
                                </div>
                            <TextField label="Mensaje de recomendación (opcional)" multiline minRows={3} value={comentario} onChange={(event) => setComentario(event.target.value)} disabled={guardando} fullWidth />
                            </>
                        )}
                    </section>
                    {errores.length > 0 && <div className={styles.error} role="alert">{errores.map((error) => <p key={error}>{error}</p>)}</div>}
                    <div className={styles.acciones}>
                        <button className={styles.cancelar} type="button" onClick={alCancelar} disabled={guardando}>Cancelar</button>
                        <button className={styles.guardar} type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar cambios"}</button>
                    </div>
                </form>
            </div>
        </main>
    );
}
