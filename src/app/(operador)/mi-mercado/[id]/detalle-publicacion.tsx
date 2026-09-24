"use client";

type Props = {
    nombreProducto: string;
    precio: number;
    restar: () => void;
    sumar: () => void;
};

export default function DetallePublicacion({ nombreProducto, precio, restar, sumar }: Props) {

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h1 className="text-4xl font-extrabold text-foreground">
                {nombreProducto}
            </h1>

            <div className="mt-6">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-white font-bold text-xl"
                        onClick={restar}
                    >
                        −
                    </button>
                    <p className="min-w-18 text-center text-xl font-extrabold text-foreground">
                        {precio === 0 ?
                            "Sin precio" : 
                            `$${precio}`}
                    </p>
                    <button 
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-white font-bold text-xl"
                        onClick={sumar}
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
}