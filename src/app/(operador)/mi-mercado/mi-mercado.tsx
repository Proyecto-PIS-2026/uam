"use client";

export type Publicacion = {
    id: number;
    foto: string | null;
    precio: string | null;
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    presentacion: {
        nombrePresentacion: string;
        variedad: {
            nombreVariedad: string;
            especie: {
                id: number;
                nombreEspecie: string;
                fotoEspecie: string | null;
            };
        };
    };
    categoria: {
        nombreCategoria: string;
    }
    calibre: {
        codigoCalibre: string;
        nombreCalibre: string;
    }
};

type Props = {
    publicaciones: Publicacion[];
    incrementoPrecio: number;
};

export default function MiMercado({ publicaciones, incrementoPrecio }: Props) {
    const gruposPorEspecie = new Map<
        number,
        { 
            especie: Publicacion["presentacion"]["variedad"]["especie"];
            items: Publicacion[]
        }
    >();


    for (const pub of publicaciones) {
        const especie = pub.presentacion.variedad.especie;
        if (!gruposPorEspecie.has(especie.id)) {
            gruposPorEspecie.set(especie.id, { especie, items: [] });
        }
        gruposPorEspecie.get(especie.id)!.items.push(pub);
    }

    const grupos = Array.from(gruposPorEspecie.values());

    return (
        <main>
            <h1>Mi Mercado</h1>
            {grupos.map(({ especie, items }) => (
                <section key ={especie.id}>
                    <h2>{especie.nombreEspecie}</h2>
                    <ul>
                        {items.map((pub) => (
                            <li key={pub.id}>
                                <div>
                                    {pub.presentacion.variedad.especie.nombreEspecie} · {pub.presentacion.variedad.nombreVariedad}
                                </div>
                                <div>
                                    {pub.categoria.nombreCategoria} · {pub.calibre.nombreCalibre} · {pub.presentacion.nombrePresentacion}
                                </div>
                                <div>
                                    ${pub.precio}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </main>
    );
}