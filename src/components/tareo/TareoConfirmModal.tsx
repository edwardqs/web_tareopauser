import React from "react";

type Props = {
    mesLabel: string;
    cerrando: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function TareoConfirmModal({ mesLabel, cerrando, onCancel, onConfirm }: Props) {
    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            <div className="card" style={{ width: "420px", padding: "28px", textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔒</div>
                <h3 style={{ marginBottom: "8px" }}>¿Cerrar tareo de {mesLabel}?</h3>
                <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginBottom: "20px" }}>
                    Esta acción guardará todos los datos y marcará el tareo como <strong>cerrado</strong>. El JEFE podrá visualizarlo. Esta acción <strong>no se puede deshacer</strong>.
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                    <button className="btn btn--ghost" onClick={onCancel} disabled={cerrando}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn--primary"
                        style={{ background: "var(--color-danger)", borderColor: "var(--color-danger)" }}
                        onClick={onConfirm}
                        disabled={cerrando}
                    >
                        {cerrando ? "Cerrando..." : "Sí, cerrar tareo"}
                    </button>
                </div>
            </div>
        </div>
    );
}
