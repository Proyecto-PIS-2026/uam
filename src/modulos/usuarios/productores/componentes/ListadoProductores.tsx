"use client";

import { useState } from "react";
import Link from "next/link";
import SearchIcon from "@mui/icons-material/Search";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import ImagenPublicacion from "@/modulos/publicaciones/componentes/ImagenPublicacion";
import type { ProductorListado } from "../consultas-productores";
import styles from "../../operadores/componentes/listado-operadores/ListadoOperadores.module.css";
import controles from "../../operadores/componentes/listado-operadores/ControlesListadoOperadores.module.css";
import tarjeta from "../../operadores/componentes/listado-operadores/TarjetaOperador.module.css";

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "");
}

export default function ListadoProductores({ productores }: { productores: ProductorListado[] }) {
    const [busqueda, setBusqueda] = useState("");
    const [orden, setOrden] = useState("a-z");
    const textoBuscado = normalizarTexto(busqueda.trim());
    const productoresFiltrados = productores.filter((productor) => normalizarTexto(productor.nombreFantasia).includes(textoBuscado));
    productoresFiltrados.sort((primero, segundo) => {
        const comparacion = primero.nombreFantasia.localeCompare(segundo.nombreFantasia, "es", { sensitivity: "base" });
        return orden === "z-a" ? -comparacion : comparacion;
    });

    return (
        <section className="contenedor-pagina flex flex-col gap-6">
            <header className="encabezado-pagina relative isolate overflow-hidden rounded-2xl bg-secondary">
                <HojasDecorativas />
                <div className="relative z-10">
                    <h1 className="titulo-pagina text-white">Productores</h1>
                    <p className="mt-2 text-sm text-white/80 sm:text-base">Consultá los productores de la plataforma.</p>
                </div>
            </header>

            <div className={controles.contenedor}>
                <TextField fullWidth size="small" label="Buscar productores" type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} className={`${controles.selectMui} ${controles.buscador}`}
                    slotProps={{ input: { startAdornment: <SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }} /> } }} />
                <div className={controles.controles}>
                    <TextField select size="small" label="Ordenar por" value={orden} onChange={(evento) => setOrden(evento.target.value)} className={controles.selectMui}>
                        <MenuItem value="a-z" className={controles.opcionSelect}>A-Z</MenuItem>
                        <MenuItem value="z-a" className={controles.opcionSelect}>Z-A</MenuItem>
                    </TextField>
                </div>
            </div>

            {productoresFiltrados.length === 0 ? (
                <p role="status" className="py-8 text-center text-muted">
                    {productores.length === 0 ? "No hay productores disponibles." : "No se encontraron productores que coincidan con la búsqueda."}
                </p>
            ) : (
                <div className={styles.lista}>
                    {productoresFiltrados.map((productor) => (
                        <Link key={productor.id} href={`/productores/${encodeURIComponent(productor.nombreFantasia)}`} className={tarjeta.tarjeta}>
                            <div className={tarjeta.imagen}>
                                <ImagenPublicacion src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} fill sizes="(max-width: 767px) 64px, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px" className={tarjeta.foto}
                                    reemplazo={<AccountCircleIcon role="img" aria-hidden={false} aria-label={`Foto por defecto de ${productor.nombreFantasia}`} sx={{ fontSize: 64 }} />} />
                            </div>
                            <div className={tarjeta.contenido}>
                                <div className={tarjeta.encabezado}>
                                    <p className={tarjeta.nombre} title={productor.nombreFantasia}>{productor.nombreFantasia}</p>
                                    <p className={tarjeta.locales} title={productor.ubicaciones.join(" | ")}>{productor.ubicaciones.join(" | ") || "Sin puntos de retiro publicados"}</p>
                                </div>
                                <div className={tarjeta.pie}>
                                    <span className={tarjeta.cantidadProductos}>{productor.cantidadProductos}</span>
                                    <span className={tarjeta.textoProductos}>{productor.cantidadProductos === 1 ? "producto" : "productos"}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
