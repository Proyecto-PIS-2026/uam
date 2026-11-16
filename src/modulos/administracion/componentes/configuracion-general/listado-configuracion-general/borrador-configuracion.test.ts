import { describe, expect, it } from "vitest";
import { CLAVES_AGING_FOTOS } from "@/modulos/publicaciones/claves-aging-fotos";
import { CLAVES_VIGENCIA_PUBLICACIONES } from "@/modulos/publicaciones/claves-vigencia-publicaciones";
import { CLAVE_ANTICIPACION_AVISO_LOCALES } from "@/modulos/usuarios/operadores/configuracion-avisos-locales";
import { normalizarConfiguracion, validarBorradorConfiguracion } from "./borrador-configuracion";

const [habilitado, vigencia, avisos, anticipacion] = CLAVES_AGING_FOTOS.OPERADOR;

describe("validación del guardado general", () => {
    it("permite activar vencimiento y avisos junto con sus plazos en el mismo lote", () => {
        const cambios = { [habilitado]: "true", [vigencia]: "005", [avisos]: "true", [anticipacion]: "002" };
        const validacion = validarBorradorConfiguracion(normalizarConfiguracion(cambios), cambios);
        expect(validacion).toEqual({ errores: {}, mensaje: "", cambios: { ...cambios, [vigencia]: "5", [anticipacion]: "2" } });
    });

    it("marca el plazo inválido comparando ambos valores pendientes", () => {
        const cambios = { [vigencia]: "5", [anticipacion]: "5" };
        const valores = normalizarConfiguracion({ [habilitado]: "true", [avisos]: "true", ...cambios });
        expect(validarBorradorConfiguracion(valores, cambios)).toMatchObject({
            errores: { [anticipacion]: true }, mensaje: "La anticipación debe ser menor que la vigencia.",
        });
    });

    it("marca todos los campos requeridos faltantes y devuelve un mensaje general", () => {
        const cambios = { [habilitado]: "true", [avisos]: "true", url_lista_inteligente: "", incremento_precio: "" };
        const validacion = validarBorradorConfiguracion(normalizarConfiguracion(cambios), cambios);
        expect(validacion.errores).toEqual({ [vigencia]: true, [anticipacion]: true, url_lista_inteligente: true, incremento_precio: true });
        expect(validacion.mensaje).toBe("Faltan completar campos.");
    });

    it("no bloquea cambios ajenos por plazos vacíos de funciones desactivadas", () => {
        const cambios = { incremento_precio: "25" };
        expect(validarBorradorConfiguracion(normalizarConfiguracion(cambios), cambios).errores).toEqual({});
    });

    it("mantiene los avisos de publicaciones independientes del vencimiento administrativo", () => {
        const [activo, plazo, notifica, aviso] = CLAVES_VIGENCIA_PUBLICACIONES.PRODUCTOR;
        const cambios = { [notifica]: "true", [aviso]: "2" };
        const valores = normalizarConfiguracion({ [activo]: "false", [plazo]: "", ...cambios });
        expect(validarBorradorConfiguracion(valores, cambios).errores).toEqual({});
    });

    it.each(["0", "365"])("permite %s días de anticipación para locales", (dias) => {
        const cambios = { [CLAVE_ANTICIPACION_AVISO_LOCALES]: dias };
        expect(validarBorradorConfiguracion(normalizarConfiguracion(cambios), cambios).errores).toEqual({});
    });

    it.each(["366", ""])("rechaza la anticipación de locales %j", (dias) => {
        const cambios = { [CLAVE_ANTICIPACION_AVISO_LOCALES]: dias };
        expect(validarBorradorConfiguracion(normalizarConfiguracion(cambios), cambios).errores).toEqual({ [CLAVE_ANTICIPACION_AVISO_LOCALES]: true });
    });

    it.each(["https://uam.com.uy/lista.html", "javascript:alert(1)", " https://uam.com.uy/lista.pdf"])("rechaza URL inválida %s antes de guardar", (url) => {
        const cambios = { url_lista_inteligente: url };
        expect(validarBorradorConfiguracion(normalizarConfiguracion(cambios), cambios).errores).toEqual({ url_lista_inteligente: true });
    });

    it("respeta el máximo de vigencia de fotos", () => {
        const cambios = { [vigencia]: "36501" };
        expect(validarBorradorConfiguracion(normalizarConfiguracion(cambios), cambios).errores).toEqual({ [vigencia]: true });
    });
});
