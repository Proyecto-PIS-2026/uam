export function ordenarOpcionesPorNombre<T extends { nombre: string }>(opciones: readonly T[]): T[] {
    return [...opciones].sort((primera, segunda) =>
        primera.nombre.localeCompare(segunda.nombre, "es", { sensitivity: "base", numeric: true }),
    );
}
