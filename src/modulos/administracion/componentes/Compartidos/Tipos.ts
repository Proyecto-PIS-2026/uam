export type TipoUsuario =
    | "ADMINISTRADOR"
    | "OPERADOR"
    | "PRODUCTOR";

export type TipoNave = "A" | "B" | "D" | "E" | "Tinglado";

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
    whatsApp: string;
    fotoPerfil: string | null;
    comentario: string | null;
    locales: LocalParaModificar[];
}

export interface ProductorParaModificar extends UsuarioBase {
    rol: "PRODUCTOR";
    productorId: number;
    whatsApp: string;
}

export type UsuarioParaModificar =
    | AdministradorParaModificar
    | OperadorParaModificar
    | ProductorParaModificar;

export interface LocalParaModificar {
    id: number;
    numeroLocal: number;
    finContrato: string | null;
    nave: TipoNave;
}

export interface DatosModificarUsuarios {
    usuarios: UsuarioParaModificar[];
}