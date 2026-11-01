export const DEPARTAMENTOS_URUGUAY = [
    "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida",
    "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha",
    "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
] as const;

function claveDepartamento(valor: string): string {
    return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
        .trim().replace(/^departamento\s+(?:de\s+)?/, "").replace(/\s+(?:department|departamento)$/, "")
        .replace(/\s+/g, " ");
}

export function normalizarDepartamento(valor: unknown): string | null {
    if (typeof valor !== "string") return null;
    const clave = claveDepartamento(valor);
    return DEPARTAMENTOS_URUGUAY.find((departamento) => claveDepartamento(departamento) === clave) ?? null;
}

export function obtenerDepartamentos(ubicaciones: ReadonlyArray<{ departamento?: string | null }>): string[] {
    const departamentos = new Set(ubicaciones.map((ubicacion) => normalizarDepartamento(ubicacion.departamento))
        .filter((departamento): departamento is string => departamento !== null));
    return [...departamentos].sort((a, b) => a.localeCompare(b, "es"));
}
