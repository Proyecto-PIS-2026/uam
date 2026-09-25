"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingBasketOutlinedIcon from "@mui/icons-material/ShoppingBasketOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import PriceCheckOutlinedIcon from "@mui/icons-material/PriceCheckOutlined";
import Header from "../../../compartido/header";
import HojasDecorativas from "../../../compartido/HojasDecorativas";
import ProductoCard from "./tarjetaProducto";
import styles from "./inicio.module.css";

type EspecieInicio = {
    idEspecie: number;
    nombreEspecie: string;
    fotoGenerica: string | null;
    cantidadOperadores: number;
};

type Props = {
    especies: EspecieInicio[];
};

const especiesPorPagina = 20;

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function Inicio({ especies }: Props) {
    const [busqueda, setBusqueda] = useState("");
    const [orden, setOrden] = useState("a-z");
    const [paginaActual, setPaginaActual] = useState(1);

    const textoBuscado = normalizarTexto(busqueda.trim());
    const especiesFiltradas = especies.filter((especie) =>
        normalizarTexto(especie.nombreEspecie).includes(textoBuscado)
    );

    especiesFiltradas.sort((primera, segunda) => {
        const comparacion = primera.nombreEspecie.localeCompare(segunda.nombreEspecie, "es", { sensitivity: "base" });
        return orden === "z-a" ? -comparacion : comparacion;
    });

    const totalPaginas = Math.ceil(especiesFiltradas.length / especiesPorPagina);
    const paginaVisible = Math.min(paginaActual, Math.max(1, totalPaginas));
    const indiceInicial = (paginaVisible - 1) * especiesPorPagina;
    const especiesPagina = especiesFiltradas.slice(indiceInicial, indiceInicial + especiesPorPagina);

    const contenido = (
        <main className={styles.pagina}>
            <Header />
            <HojasDecorativas variante="fondo" className={styles.hojasPagina} />

            <section className={styles.hero} aria-labelledby="titulo-home">
                <div className={styles.heroTexto}>
                    <h1 className={styles.heroTitulo} id="titulo-home">Mercado de hoy</h1>
                    <p className={styles.heroDescripcion}>Explorá las frutas y hortalizas disponibles y conocé a los operadores del mercado.</p>
                </div>
                <div className={styles.heroImagen}>
                    <Image src="/generico/slider1-scaled.jpg" alt="Vista aérea del Mercado Agroalimentario" fill sizes="100vw" className={styles.heroFoto} />
                </div>
            </section>

            <div className={styles.contenedor}>
                <nav className={styles.accesos} aria-label="Accesos principales">
                    <Link href="/publicaciones" className={styles.acceso}><ShoppingBasketOutlinedIcon aria-hidden="true" className={styles.accesoIcono} /><span>Ver publicaciones</span></Link>
                    <Link href="/operadores" className={styles.acceso}><StorefrontOutlinedIcon aria-hidden="true" className={styles.accesoIcono} /><span>Ver operadores</span></Link>
                    <button type="button" className={styles.acceso}><ChecklistOutlinedIcon aria-hidden="true" className={styles.accesoIcono} /><span>Lista inteligente</span></button>
                    <button type="button" className={styles.acceso}><PriceCheckOutlinedIcon aria-hidden="true" className={styles.accesoIcono} /><span>Precios de referencia</span></button>
                </nav>

                <section aria-labelledby="titulo-especies">
                    <div className={styles.tituloContenedor}>
                        <HojasDecorativas variante="separador" />
                        <h2 className={styles.titulo} id="titulo-especies">Especies</h2>
                        <p className={styles.subtitulo}>{especies.length} especies con operadores</p>
                    </div>

                    <div className={styles.controles}>
                        <div className={styles.buscador}>
                            <SearchIcon aria-hidden="true" className={styles.iconoBusqueda} />
                            <input className={styles.inputBusqueda} type="search" value={busqueda} onChange={(evento) => { setBusqueda(evento.target.value); setPaginaActual(1); }} placeholder="Buscar especies" aria-label="Buscar especies"/>
                        </div>
                        <TextField select label="Ordenar por" value={orden} onChange={(evento) => { setOrden(evento.target.value); setPaginaActual(1); }} size="small" className={styles.selectMui}>
                            <MenuItem value="a-z" className={styles.opcionSelect}>A-Z</MenuItem>
                            <MenuItem value="z-a" className={styles.opcionSelect}>Z-A</MenuItem>
                        </TextField>
                    </div>

                    {especiesPagina.length === 0 ? (
                        <p className={styles.sinResultados}>No hay especies que coincidan con la búsqueda.</p>
                    ) : (
                        <>
                            <div className={styles.lista}>
                                {especiesPagina.map((especie) => (
                                    <ProductoCard key={especie.idEspecie} idEspecie={especie.idEspecie} nombre={especie.nombreEspecie} operadores={especie.cantidadOperadores} imagen={especie.fotoGenerica} />
                                ))}
                            </div>

                            {totalPaginas > 1 && (
                                <nav className={styles.paginacion} aria-label="Páginas de especies">
                                    <button className={styles.botonPagina} type="button" onClick={() => setPaginaActual(paginaVisible - 1)} disabled={paginaVisible === 1}>Anterior</button>
                                    <span className={styles.paginaActual}>Página {paginaVisible} de {totalPaginas}</span>
                                    <button className={styles.botonPagina} type="button" onClick={() => setPaginaActual(paginaVisible + 1)} disabled={paginaVisible === totalPaginas}>Siguiente</button>
                                </nav>
                            )}
                        </>
                    )}
                </section>
            </div>
        </main>
    );

    return contenido;
}
