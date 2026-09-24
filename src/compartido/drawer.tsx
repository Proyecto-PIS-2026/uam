"use client";

import type { ReactNode } from "react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
};

export default function Drawer({ isOpen, onClose, children }: Props) {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 h-3/4 bg-white pt-14 px-6 pb-6">
            <button
                type="button"
                className="absolute right-4 top-2 text-gray-400 hover:text-gray-600 text-3xl"
                onClick={onClose}
            >
                x
            </button>
            {children}
        </div>
    );
}