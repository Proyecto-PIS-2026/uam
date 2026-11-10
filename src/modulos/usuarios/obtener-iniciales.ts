export function obtenerIniciales(nombre: string): string {
    return nombre.trim().split(/\s+/).slice(0, 2)
        .map((palabra) => palabra.charAt(0))
        .join("")
        .toLocaleUpperCase("es");
}
