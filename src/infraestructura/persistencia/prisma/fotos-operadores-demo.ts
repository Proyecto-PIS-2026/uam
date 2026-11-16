export function fotoOperador(nombreOperador: string, archivos: Map<string, string>): string | null {
  const base = nombreOperador.toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  for (const extension of [".webp", ".jpeg", ".jpg", ".png", ".jfif"]) {
    const archivo = archivos.get(`${base}${extension}`);
    if (archivo) return `/operadores/${encodeURIComponent(archivo)}`;
  }
  return null;
}
