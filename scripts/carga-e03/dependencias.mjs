export class DependenciaFallida extends Error {
  constructor(sesion, causa) {
    super("No se pudo observar el cambio porque no se confirmó el guardado de " + sesion, { cause: causa });
    this.name = "DependenciaFallida";
    this.dependencia = sesion;
    this.origen = causa instanceof DependenciaFallida ? causa.origen : sesion;
  }
}

export function crearPendiente(sesion) {
  let resolve, reject;
  const promise = new Promise((ok, error) => { resolve = ok; reject = error; });
  void promise.catch(() => {});
  return { sesion, promise, resolve, reject };
}

export async function esperarDependencia(pendiente) {
  try { return await pendiente.promise; }
  catch (causa) { throw new DependenciaFallida(pendiente.sesion, causa); }
}

export async function publicarResultado(pendiente, accion, recuperado) {
  try {
    const resultado = await accion();
    pendiente.resolve(resultado);
    return resultado;
  } catch (error) {
    let confirmado;
    try { confirmado = recuperado?.(); }
    catch {
      pendiente.reject(error);
      throw error;
    }
    if (confirmado) pendiente.resolve(confirmado);
    else pendiente.reject(error);
    throw error;
  }
}
