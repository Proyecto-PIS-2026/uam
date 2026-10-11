export type TipoUsuario =
    | "ADMINISTRADOR"
    | "OPERADOR"
    | "PRODUCTOR";

export interface UsuarioBase {
    id: number;
    username: string;
    rol: TipoUsuario;
}

export interface AdministradorParaModificar extends UsuarioBase {
    rol: "ADMINISTRADOR";
    administradorId: number;
    email: string;
}

export interface OperadorParaModificar extends UsuarioBase {
    rol: "OPERADOR";
    operadorId: number;
    nombreFantasia: string;
}

export interface ProductorParaModificar extends UsuarioBase {
    rol: "PRODUCTOR";
    productorId: number;
}

export type UsuarioParaModificar =
    | AdministradorParaModificar
    | OperadorParaModificar
    | ProductorParaModificar;

export interface DatosModificarUsuarios {
    usuarios: UsuarioParaModificar[];
}