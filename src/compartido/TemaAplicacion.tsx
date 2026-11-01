"use client";

import type { ReactNode } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const paletaSecundaria = { main: "#005d29", dark: "#004a21", light: "#e6efea", contrastText: "#ffffff" };

const tema = createTheme({
    cssVariables: true,
    palette: {
        mode: "light",
        primary: paletaSecundaria,
        secondary: paletaSecundaria,
        error: { main: "#b42318", dark: "#912018", light: "#fef3f2" },
        warning: { main: "#946200", light: "#fff8e6" },
        success: paletaSecundaria,
        background: { default: "#f6f5f0", paper: "#ffffff" },
        text: { primary: "#1a1a1a", secondary: "#5f5f5f", disabled: "#767676" },
        divider: "#dedede",
    },
    typography: {
        fontFamily: "var(--font-geist-sans), sans-serif",
        button: { fontSize: "0.875rem", fontWeight: 600, textTransform: "none" },
    },
    shape: { borderRadius: 8 },
    components: {
        MuiFormLabel: {
            styleOverrides: {
                asterisk: {
                    color: "var(--color-foreground)",
                    "&.Mui-error": { color: "var(--color-foreground)" },
                },
            },
        },
        MuiButton: {
            defaultProps: { color: "secondary" },
            styleOverrides: {
                root: {
                    minHeight: "var(--alto-control)",
                    padding: "var(--padding-control)",
                    borderRadius: "var(--radio-control)",
                    fontSize: "var(--tamano-texto-secundario)",
                },
            },
        },
        MuiTextField: { defaultProps: { color: "secondary" } },
        MuiCheckbox: { defaultProps: { color: "secondary" } },
        MuiSwitch: { defaultProps: { color: "secondary" } },
        MuiCircularProgress: { defaultProps: { color: "secondary" } },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radio-control)",
                    "&:hover:not(.Mui-disabled):not(.Mui-error) .MuiOutlinedInput-notchedOutline": {
                        borderColor: "var(--color-secondary)",
                    },
                    "&:not(.MuiInputBase-multiline)": {
                        height: "var(--alto-control)",
                        "& > .MuiOutlinedInput-input": {
                            boxSizing: "border-box",
                            height: "100%",
                            paddingTop: 0,
                            paddingBottom: 0,
                        },
                    },
                },
                notchedOutline: { borderColor: "var(--color-border)" },
            },
        },
        MuiSelect: {
            defaultProps: {
                MenuProps: {
                    slotProps: {
                        paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } },
                    },
                },
            },
            styleOverrides: {
                outlined: {
                    boxSizing: "border-box",
                    height: "100%",
                    minHeight: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    lineHeight: "var(--alto-control)",
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontSize: "var(--tamano-texto)",
                    lineHeight: "var(--interlineado-texto)",
                    "&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible, &.Mui-focusVisible": {
                        backgroundColor: "var(--color-secondary-soft)",
                        color: "var(--color-secondary)",
                    },
                },
            },
        },
        MuiFormControl: {
            defaultProps: { color: "secondary" },
            styleOverrides: {
                root: {
                    "&:has(> .MuiOutlinedInput-root:not(.MuiInputBase-multiline)) > .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)": {
                        top: 0,
                        transform: "translate(14px, calc(var(--alto-control) / 2 - 50%)) scale(1)",
                    },
                },
            },
        },
        MuiDialog: { styleOverrides: { paper: { borderRadius: "var(--radio-panel)" } } },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    padding: "var(--padding-panel)",
                    color: "var(--color-secondary)",
                    fontSize: "var(--tamano-titulo-seccion)",
                    fontWeight: 700,
                    lineHeight: "var(--interlineado-titulo-pagina)",
                },
            },
        },
        MuiDialogContent: { styleOverrides: { root: { padding: "var(--padding-panel)" } } },
        MuiDialogActions: { styleOverrides: { root: { padding: "var(--padding-panel)" } } },
    },
});

export default function TemaAplicacion({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={tema}>{children}</ThemeProvider>;
}
