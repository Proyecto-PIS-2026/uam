function valorCargado(valor: string | null | undefined): string {
    const limpio = valor?.trim() ?? "";
    return limpio === "-" ? "" : limpio;
}

export function formatearEmpaquetado(envase?: string | null, kilos?: string | null): string {
    const nombreEnvase = valorCargado(envase);
    const peso = valorCargado(kilos);
    if (nombreEnvase && peso) return `${nombreEnvase} (${peso} kg)`;
    if (peso) return `${peso} kg`;
    return nombreEnvase;
}
