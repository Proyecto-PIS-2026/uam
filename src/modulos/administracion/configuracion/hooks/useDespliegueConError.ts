"use client";

import { useState } from "react";

export function useDespliegueConError(activo: boolean, error: boolean, modificado: boolean): boolean {
    const [corrigiendo, setCorrigiendo] = useState(false);
    const mantenerAbierto = error || corrigiendo && modificado && !activo;
    if (corrigiendo !== mantenerAbierto) setCorrigiendo(mantenerAbierto);
    return activo || mantenerAbierto;
}
