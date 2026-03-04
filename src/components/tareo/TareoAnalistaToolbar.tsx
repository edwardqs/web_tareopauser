import React from "react";

type Props = {
    buscar: string;
    setBuscar: (v: string) => void;
    autosaveStatus: "idle" | "pending" | "saved";
    esReadonly: boolean;
    guardando: boolean;
    guardarTodo: () => void;
    tareoEstado: string | undefined;
    readonly: boolean;
    onExportar: (tipo: "pdf" | "excel") => void;
    onCerrar: () => void;
    erroresCount?: number;
};

export default function TareoAnalistaToolbar({
    buscar, setBuscar, autosaveStatus, esReadonly,
    guardando, guardarTodo, tareoEstado, readonly,
    onExportar, onCerrar, erroresCount = 0,
}: Props) {
    return (
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <input
                type="text"
                placeholder="🔍 Buscar por nombre, DNI o cargo..."
                className="form-input"
                style={{ width: "300px" }}
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
            />
            {erroresCount > 0 && (
                <span style={{ fontSize: "12px", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "4px" }}
                    title="Ve a la pestaña 'Días Laborados' para ver los detalles">
                    ⚠️ {erroresCount} {erroresCount === 1 ? "fila con error" : "filas con errores"} de validación
                </span>
            )}
            {autosaveStatus === "pending" && (
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    ⏳ Guardando...
                </span>
            )}
            {autosaveStatus === "saved" && (
                <span style={{ fontSize: "12px", color: "var(--color-success)", display: "flex", alignItems: "center", gap: "4px" }}>
                    ✓ Guardado
                </span>
            )}
            <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
                <button className="btn btn--ghost" style={{ fontSize: "12px" }} onClick={() => onExportar("pdf")} title="Exportar planilla a PDF">
                    📄 PDF
                </button>
                <button className="btn btn--ghost" style={{ fontSize: "12px" }} onClick={() => onExportar("excel")} title="Exportar planilla a Excel">
                    📊 Excel
                </button>
                {!esReadonly && (
                    <button className="btn btn--primary" style={{ fontSize: "12px" }} onClick={guardarTodo} disabled={guardando}>
                        {guardando ? "Guardando..." : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                                </svg>
                                Guardar
                            </>
                        )}
                    </button>
                )}
                {!readonly && tareoEstado === "borrador" && (
                    <button
                        className="btn btn--danger"
                        style={{ fontSize: "12px", background: "rgba(248,113,113,0.15)", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}
                        onClick={onCerrar}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Cerrar Tareo del Mes
                    </button>
                )}
            </div>
        </div>
    );
}
