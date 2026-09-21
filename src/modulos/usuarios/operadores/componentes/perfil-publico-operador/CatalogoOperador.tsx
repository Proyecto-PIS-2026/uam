type CatalogoOperadorProps = {
    publicaciones: unknown[];
};

export default function CatalogoOperador({ publicaciones }: CatalogoOperadorProps) {
	void publicaciones;

    const contenido = (
        <div>Catálgo</div>
    );

    return contenido;
}