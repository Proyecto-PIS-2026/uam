"use client";

import SearchIcon from "@mui/icons-material/Search";
import { MenuItem, TextField } from "@mui/material";
import BotonOrdenar from "@/compartido/componentes/BotonOrdenar";
import AvisoErrorToast from "@/compartido/componentes/AvisoErrorToast";
import BotonDesplegable from "@/compartido/componentes/BotonDesplegable";
import { esEntradaPrecioPublicacion, MAXIMO_DIGITOS_PRECIO } from "@/modulos/publicaciones/precio-publicacion";
import styles from "./FiltrosPublicaciones.module.css";
import { useFiltrosPublicaciones } from "./useFiltrosPublicaciones";
import type { PublicacionFiltrable, FiltrosPublicacionesProps, OrdenPublicaciones } from "./tipos";

export type { OrdenPublicaciones } from "./tipos";

const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

export default function FiltrosPublicaciones<T extends PublicacionFiltrable>(props: FiltrosPublicacionesProps<T>) {
    const { ordenamientoHabilitado = true } = props;
    const {
        busqueda, setBusqueda, precioMinimo, setPrecioMinimo,
        precioMaximo, setPrecioMaximo, especie, variedad,
        envase, kilos, categoria, calibre,
        nave, setNave, mostrarFiltros, setMostrarFiltros,
        idFiltrosExtendidos, mostrarNave, especies, naves,
        variedades, envases, opcionesKilos, categorias,
        calibres, ordenElegido, cambiarOrden, variedadUnica,
        cantidadResultados, limpiarFiltros, rangoPrecioInvalido, manejarCambioEspecie,
        manejarCambioVariedad, manejarCambioEnvase, manejarCambioKilos, manejarCambioCategoria,
        manejarCambioCalibre,
    } = useFiltrosPublicaciones(props);

    return (
        <div className={styles.contenedor}>
            <AvisoErrorToast mensaje={rangoPrecioInvalido ? "El precio máximo no puede ser menor al mínimo." : null} />
            <div className={`${styles.layoutFiltros} ${mostrarFiltros ? styles.filtrosAbiertos : ""} ${mostrarNave ? styles.conFiltroNave : ""}`}>
                <TextField fullWidth size="small" label="Buscar publicaciones" type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.filtroBuscador}`}
                    slotProps={{input: {startAdornment: (<SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }}/>)}}}
                />
                <TextField select fullWidth label="Especie" value={especie} onChange={(e) => manejarCambioEspecie(e.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroEspecie}`} slotProps={propiedadesMenuSelect}>
                    <MenuItem value="Todas" className={styles.opcionSelect}>
                        Todas
                    </MenuItem>
                    {especies.map((opcion) => (
                        <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                            {opcion}
                        </MenuItem>
                    ))}
                </TextField>
                {mostrarNave && (
                    <TextField select fullWidth label="Nave" value={nave} onChange={(evento) => setNave(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroNave}`} slotProps={propiedadesMenuSelect}>
                        <MenuItem value="Todas" className={styles.opcionSelect}>Todas</MenuItem>
                        {naves.map((opcion) => (
                            <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                {opcion === "Tinglado" ? opcion : `Nave ${opcion}`}
                            </MenuItem>
                        ))}
                    </TextField>
                )}
                <div className={styles.filtroPrecioMinimo}>
                    <TextField fullWidth size="small" id="precio-minimo" label="Precio Mínimo" type="text" value={precioMinimo} placeholder="Sin mínimo" className={styles.selectMui}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "0*[1-9][0-9]*",
                                maxLength: MAXIMO_DIGITOS_PRECIO,
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (esEntradaPrecioPublicacion(valor)) setPrecioMinimo(valor);
                        }}
                    />
                </div>
                <div className={styles.filtroPrecioMaximo}>
                    <TextField fullWidth size="small" id="precio-maximo" label="Precio Máximo" type="text" value={precioMaximo} placeholder="Sin máximo" className={styles.selectMui} error={rangoPrecioInvalido}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "0*[1-9][0-9]*",
                                maxLength: MAXIMO_DIGITOS_PRECIO,
                            },
                        }}
                        onChange={(evento) => {
                            const valor = evento.target.value;
                            if (esEntradaPrecioPublicacion(valor)) setPrecioMaximo(valor);
                        }}
                    />
                </div>
                <div id={idFiltrosExtendidos} className={styles.filtrosExtendidos}>
                    <div className={styles.filtrosVariedadEnvase}>
                        <TextField select fullWidth label="Variedad" value={variedadUnica ? "-" : variedad} onChange={(e) => manejarCambioVariedad(e.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroVariedad}`} disabled={especie === "Todas" || variedadUnica} slotProps={propiedadesMenuSelect}>
                            {!variedadUnica && (
                                <MenuItem value="Todas" className={styles.opcionSelect}>
                                    Todas
                                </MenuItem>
                            )}
                            {variedades.map((opcion) => (
                                <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField select fullWidth label="Empaquetado" value={envase} onChange={(evento) => manejarCambioEnvase(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroEnvase}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>
                                Todos
                            </MenuItem>
                            {envases.map((opcion) => (
                                <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField select fullWidth label="Kilos" value={kilos} onChange={(evento) => manejarCambioKilos(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroKilos}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>Todos</MenuItem>
                            {opcionesKilos.map((opcion) => <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>{opcion === "-" ? "-" : `${opcion} kg`}</MenuItem>)}
                        </TextField>
                    </div>
                    <div className={styles.filtrosCategoriaCalibre}>
                        <TextField select fullWidth label="Categoría" value={categorias.includes(categoria) ? categoria : "Todas"} onChange={(evento) => manejarCambioCategoria(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroCategoria}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>
                                Todas
                            </MenuItem>
                            {categorias.map((opcion) => (
                                <MenuItem key={opcion} value={opcion} className={styles.opcionSelect}>
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField select fullWidth label="Calibre" value={calibres.includes(calibre) ? calibre : "Todas"} onChange={(evento) => manejarCambioCalibre(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroCalibre}`} slotProps={propiedadesMenuSelect}>
                            <MenuItem value="Todas" className={styles.opcionSelect}>
                                Todos
                            </MenuItem>
                            {calibres.map((opcion) => (
                                <MenuItem
                                    key={opcion}
                                    value={opcion}
                                    className={styles.opcionSelect}
                                >
                                    {opcion}
                                </MenuItem>
                            ))}
                        </TextField>
                    </div>
                </div>
                <div className={styles.barraOpciones}>
                    <BotonDesplegable className={styles.botonExtendidos} abierto={mostrarFiltros} aria-controls={idFiltrosExtendidos} onClick={() => setMostrarFiltros((valorActual) => !valorActual)}>
                        Más filtros
                    </BotonDesplegable>
                    {ordenamientoHabilitado && (
                        <BotonOrdenar<OrdenPublicaciones | "predeterminado">
                            valor={ordenElegido}
                            alCambiar={cambiarOrden}
                            className={styles.botonOrdenar}
                            opciones={[
                                { valor: "predeterminado", etiqueta: "Por volumen" },
                                { valor: "precioAsc", etiqueta: "Menor Precio" },
                                { valor: "precioDesc", etiqueta: "Mayor Precio" },
                                { valor: "alfabeticoAsc", etiqueta: "A-Z" },
                                { valor: "alfabeticoDesc", etiqueta: "Z-A" },
                                { valor: "fechaDesc", etiqueta: "Más actualizadas" },
                            ]}
                        />
                    )}
                </div>
            </div>

            <div className={styles.pie}>
                <span className={styles.resultados}> {cantidadResultados}{" "} {cantidadResultados === 1 ? "publicación" : "publicaciones"}</span>
                <button type="button" className={styles.limpiar} onClick={limpiarFiltros}> Limpiar filtros </button>
            </div>
        </div>
    );
}
