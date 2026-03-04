/**
 * stores.ts — Estado global reactivo con Nano Stores
 *
 * Reemplaza el patrón anterior de:
 *   - sessionStorage polling (setInterval 500ms en DashboardStats)
 *   - CustomEvent "pt:periodo-changed" (en TareoJefePanel, TareoMaestroWrapper)
 *   - Lecturas repetidas de sessionStorage en cada componente
 *
 * Los stores se inicializan UNA VEZ desde sessionStorage cuando el módulo
 * se carga (en el cliente). Los componentes React suscriben con useStore()
 * y re-renderizan automáticamente si el store cambia.
 *
 * Nota: el selector global de periodo en Layout.astro hace window.location.reload()
 * en cada cambio, por lo que los stores se re-inicializan en cada navegación.
 */

import { atom } from "nanostores";
import type { SessionUser } from "./auth";

// ─── Helper ───────────────────────────────────────────────────────────────────

function fromSessionStorage<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

// ─── Periodo global (anio + mes) ──────────────────────────────────────────────

const now = new Date();

/**
 * Periodo de planilla actualmente seleccionado.
 * Inicializado desde sessionStorage["pt_periodo"] al cargar la página.
 * El selector global en Layout.astro actualiza sessionStorage y hace reload,
 * por lo que este store siempre tiene el valor correcto al montar los componentes.
 */
export const $periodo = atom(
    fromSessionStorage("pt_periodo", {
        anio: now.getFullYear(),
        mes: now.getMonth() + 1,
    })
);

// ─── Usuario de sesión ────────────────────────────────────────────────────────

/**
 * Usuario actualmente autenticado.
 * Inicializado desde sessionStorage["pt_auth"] al cargar la página.
 * null solo si no hay sesión activa (el middleware redirige antes de llegar aquí).
 */
export const $user = atom<SessionUser | null>(
    fromSessionStorage<SessionUser | null>("pt_auth", null)
);
