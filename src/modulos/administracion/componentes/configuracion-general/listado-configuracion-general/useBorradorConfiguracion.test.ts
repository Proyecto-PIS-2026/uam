import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBorradorConfiguracion } from "./useBorradorConfiguracion";

describe("borrador de configuración general", () => {
    it("descarta todos los cambios sin alterar los valores guardados", () => {
        const inicial = { vigencia: "30", aviso: "7" };
        const { result } = renderHook(() => useBorradorConfiguracion(inicial));
        act(() => result.current.cambiar({ vigencia: "5", aviso: "2" }));
        expect(result.current.cambios).toEqual({ vigencia: "5", aviso: "2" });
        expect(result.current.guardado).toEqual(inicial);
        act(() => result.current.cancelar());
        expect(result.current.valores).toEqual(inicial);
        expect(result.current.cambios).toEqual({});
    });

    it("confirma el lote normalizado y cancelar vuelve a ese último guardado", () => {
        const { result } = renderHook(() => useBorradorConfiguracion({ vigencia: "30", aviso: "7" }));
        act(() => result.current.cambiar({ vigencia: "005", aviso: "002" }));
        act(() => result.current.confirmar({ vigencia: "5", aviso: "2" }));
        expect(result.current.cambios).toEqual({});
        expect(result.current.valores).toEqual({ vigencia: "5", aviso: "2" });
        act(() => result.current.cambiar({ aviso: "1" }));
        act(() => result.current.cancelar());
        expect(result.current.valores.aviso).toBe("2");
    });

    it("una actualización del servidor conserva borradores y actualiza los campos sin modificar", () => {
        const { result, rerender } = renderHook(({ configuracion }) => useBorradorConfiguracion(configuracion), {
            initialProps: { configuracion: { vigencia: "30", aviso: "7" } },
        });
        act(() => result.current.cambiar({ vigencia: "50" }));
        rerender({ configuracion: { vigencia: "40", aviso: "10" } });
        expect(result.current.valores).toEqual({ vigencia: "50", aviso: "10" });
        expect(result.current.cambios).toEqual({ vigencia: "50" });
        act(() => result.current.cancelar());
        expect(result.current.valores).toEqual({ vigencia: "40", aviso: "10" });
    });

    it("volver al valor guardado quita la marca sin confirmar", () => {
        const { result } = renderHook(() => useBorradorConfiguracion({ aviso: "7" }));
        act(() => result.current.cambiar({ aviso: "3" }));
        act(() => result.current.cambiar({ aviso: "7" }));
        expect(result.current.cambios).toEqual({});
    });
});
