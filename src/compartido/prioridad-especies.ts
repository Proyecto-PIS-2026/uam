// Orden de las especies con mayor volumen de venta solicitado por la UAM.
const especiesPrioritarias = [
    "Papa",
    "Banana",
    "Naranja",
    "Manzana",
    "Tomate",
    "Cebolla",
    "Boniato",
    "Zanahoria",
    "Mandarina",
    "Morrón",
    "Sandía",
    "Limón",
    "Calabacín",
    "Zapallo",
    "Lechuga",
];

function normalizarNombre(nombre: string): string {
    return nombre.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const posicionPrioritaria = new Map(
    especiesPrioritarias.map((nombre, indice) => [normalizarNombre(nombre), indice]),
);

export function compararEspeciesPorPrioridad(primera: string, segunda: string): number {
    const posicionPrimera = posicionPrioritaria.get(normalizarNombre(primera));
    const posicionSegunda = posicionPrioritaria.get(normalizarNombre(segunda));

    if (posicionPrimera !== undefined && posicionSegunda !== undefined) return posicionPrimera - posicionSegunda;
    if (posicionPrimera !== undefined) return -1;
    if (posicionSegunda !== undefined) return 1;

    return primera.localeCompare(segunda, "es", { sensitivity: "base" });
}
