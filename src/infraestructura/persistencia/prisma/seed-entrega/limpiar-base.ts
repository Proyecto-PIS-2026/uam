import { all } from "@prisma/orm-postgres/orm-client";
import type { ClienteSeed } from "./datos-base";

export async function limpiarBase(cliente: ClienteSeed): Promise<void> {
  const modelos = cliente.orm.public;
  await modelos.EjecucionTareaProgramada.where(() => all()).deleteAll();
  await modelos.EstadisticaVisita.where(() => all()).deleteAll();
  await modelos.EstadisticaContacto.where(() => all()).deleteAll();
  await modelos.EstadisticaContactoPublicacion.where(() => all()).deleteAll();
  await modelos.EstadisticaPublicacion.where(() => all()).deleteAll();
  await modelos.EstadisticaCantidadPublicacion.where(() => all()).deleteAll();
  await modelos.CachePreciosReferencia.where(() => all()).deleteAll();
  await modelos.Imagen.where(() => all()).deleteAll();
  await modelos.Notificacion.where(() => all()).deleteAll();
  await modelos.AvisoVencimientoLocal.where(() => all()).deleteAll();
  await modelos.SesionRevocada.where(() => all()).deleteAll();
  await modelos.Ubicacion.where(() => all()).deleteAll();
  await modelos.PublicacionOperador.where(() => all()).deleteAll();
  await modelos.PublicacionProductor.where(() => all()).deleteAll();
  await modelos.Publicacion.where(() => all()).deleteAll();
  await modelos.Envase.where(() => all()).deleteAll();
  await modelos.KilosEmpaquetado.where(() => all()).deleteAll();
  await modelos.Local.where(() => all()).deleteAll();
  await modelos.Nave.where(() => all()).deleteAll();
  await modelos.Operador.where(() => all()).deleteAll();
  await modelos.Productor.where(() => all()).deleteAll();
  await modelos.Administrador.where(() => all()).deleteAll();
  await modelos.Usuario.where(() => all()).deleteAll();
  await modelos.Variedad.where(() => all()).deleteAll();
  await modelos.Categoria.where(() => all()).deleteAll();
  await modelos.HistoricoPrecios.where(() => all()).deleteAll();
  await modelos.Especie.where(() => all()).deleteAll();
  await modelos.Calibre.where(() => all()).deleteAll();
  await modelos.Pais.where(() => all()).deleteAll();
  await modelos.Configuracion.where(() => all()).deleteAll();
}
