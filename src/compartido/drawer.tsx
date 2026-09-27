"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
};

export default function Drawer({ isOpen, onClose, children }: Props) {
    useEffect(() => {
        if (!isOpen) return;

        const overflowAnterior = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = overflowAnterior;
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
        >
            <div
                className="
                    absolute bottom-0 left-0 right-0
                    max-h-[70dvh]
                    overflow-y-auto
                    rounded-t-2xl
                    bg-surface
                    px-6 pb-2 pt-5

                    sm:bottom-auto
                    sm:left-auto
                    sm:right-0
                    sm:top-0
                    sm:h-full
                    sm:max-h-none
                    sm:w-[460px]
                    sm:rounded-none
                    lg:w-[500px]
                "
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className="absolute right-4 top-2 text-3xl text-muted hover:text-foreground"
                    onClick={onClose}
                    aria-label="Cerrar"
                >
                    ×
                </button>

                {children}
            </div>
        </div>
    );
}