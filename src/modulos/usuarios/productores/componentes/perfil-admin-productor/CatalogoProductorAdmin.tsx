import type { PublicacionPerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";
import TarjetaPublicacionProductorAdmin from "./TarjetaPublicacionProductorAdmin";

type CatalogoProductorAdminProps = {
    publicaciones: PublicacionPerfilAdminProductor[];
};

export default function CatalogoProductorAdmin({publicaciones}: CatalogoProductorAdminProps) {

    return (
        <>
            {publicaciones.length === 0 ? (
                <p>El productor no tiene publicaciones.</p>
            ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {publicaciones.map((publicacion) => (
                        <li key={publicacion.id}>
                            <TarjetaPublicacionProductorAdmin publicacion={publicacion} />
                        </li>
                    ))}
                </ul>
            )}
        </>         
    );
}