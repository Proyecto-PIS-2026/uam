import type { db } from "@/infraestructura/persistencia/prisma/db";
import { enviarNotificacion } from "@/modulos/notificaciones/notificaciones";

export async function notificarEdicionAdministrativa(
    cliente: Pick<typeof db, "orm">,
    usuarioId: number,
    publicacionId: number,
    tipo: "OPERADOR" | "PRODUCTOR",
): Promise<void> {
    const mercado = tipo === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor";
    await enviarNotificacion({
        texto: "Una de tus publicaciones fue modificada por la administración de la UAM. Comunicate con la administración de la UAM.",
        usuarios: [usuarioId],
        url: `${mercado}?publicacion=${publicacionId}`,
    }, cliente);
}
