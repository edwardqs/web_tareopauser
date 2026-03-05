// import { verifyTareoLogin } from "./supabase";

export const SESSION_KEY = "pt_auth";
export const SESSION_COOKIE = "pt_session";

// ─── Cookie helpers (cliente) ──────────────────────────────────────────────────

// (Funciones setSessionCookie y clearSessionCookie eliminadas ya que la cookie es HTTP-only y manejada server-side)

// ─── Rate Limiting (localStorage) ──────────────────────────────────────────────

const RL_KEY = "pt_rl"; // Rate Limit Key

function getBlockedMs(): number {
    if (typeof window === "undefined") return 0;
    try {
        const raw = localStorage.getItem(RL_KEY);
        if (!raw) return 0;
        const data = JSON.parse(raw);
        if (data.blockedUntil && data.blockedUntil > Date.now()) {
            return data.blockedUntil - Date.now();
        }
    } catch {}
    return 0;
}

function registerFailedAttempt() {
    if (typeof window === "undefined") return;
    try {
        const raw = localStorage.getItem(RL_KEY);
        let data = { tries: 0, blockedUntil: 0 };
        if (raw) data = JSON.parse(raw);

        data.tries += 1;
        if (data.tries >= 3) {
            // Bloquear 30 segundos
            data.blockedUntil = Date.now() + 30000;
            data.tries = 0;
        }
        localStorage.setItem(RL_KEY, JSON.stringify(data));
    } catch {}
}

function resetRateLimit() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(RL_KEY);
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface SessionUser {
    id: string;
    nombre: string;
    position: string;
    sede: string;
    business_unit: string | null;
    rol: "jefe" | "analista";
    token?: string;
}

// ─── Login principal ───────────────────────────────────────────────────────────

export async function login(
    dni: string,
    password: string
): Promise<{ ok: boolean; error?: string; blockedMs?: number }> {
    // 1. Verificar rate limit
    const blockedMs = getBlockedMs();
    if (blockedMs > 0) {
        return {
            ok: false,
            error: `Demasiados intentos. Espera ${Math.ceil(blockedMs / 1000)} segundos.`,
            blockedMs,
        };
    }

    // 2. Validación mínima en cliente (no revela información)
    if (!dni.trim() || !password) {
        return { ok: false, error: "Ingresa tu DNI y contraseña." };
    }

    try {
        // 3. Llamada al endpoint API server-side (Set-Cookie seguro)
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dni, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            registerFailedAttempt();
            return {
                ok: false,
                error: data.error || "Credenciales incorrectas o sin acceso autorizado.",
                blockedMs: getBlockedMs(),
            };
        }

        // 4. Login exitoso
        // La cookie HTTP-only ya fue seteada por el servidor.
        // Guardamos sessionUser en sessionStorage solo para la UI.
        const sessionUser: SessionUser = {
            ...data.user,
            token: data.token // Guardamos el token JWT de Supabase para RLS
        };

        console.log("[Auth] Login exitoso:", sessionUser);

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        
        // Configurar el token en el cliente Supabase (si existe función helper)
        if (data.token) {
            import("./supabase").then(({ setSupabaseToken }) => {
                setSupabaseToken(data.token);
            });
        }

        resetRateLimit();
        return { ok: true };
    } catch (e) {
        console.error("[Auth] Login error:", e);
        return { ok: false, error: "Error de conexión." };
    }
}

// ─── Helpers de sesión ────────────────────────────────────────────────────────

export function isLoggedIn(): boolean {
    if (typeof window === "undefined") return false;
    return !!sessionStorage.getItem(SESSION_KEY);
}

export function getSessionUser(): SessionUser | null {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as SessionUser;
    } catch {
        return null;
    }
}

export function logout(): void {
    // Limpiar sessionStorage primero
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem("pt_periodo");
    // Navegar al endpoint server-side que borra la cookie via Set-Cookie header.
    // NO usar clearSessionCookie() aquí: el borrado client-side llega tarde y
    // el siguiente request (a /login) todavía lleva la cookie, causando el bucle:
    // 302 /login → 200 / → redirect a /login → ...
    window.location.href = "/api/logout";
}
