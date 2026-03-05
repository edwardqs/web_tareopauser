/**
 * middleware.ts — Protección server-side de rutas
 *
 * Verifica que el request tenga una cookie "pt_session" válida.
 * Si no la tiene, redirige a /login antes de que Astro renderice la página.
 *
 * Este middleware reemplaza la protección client-side que existía antes
 * (sessionStorage + window.location.href = "/login"), que era bypasseable
 * accediendo directamente a la URL.
 */
import { defineMiddleware } from "astro:middleware";
import { verifySession } from "./lib/session";

/** Rutas que NO requieren autenticación */
const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname } = context.url;

    // Permitir assets del framework y rutas públicas
    if (
        pathname.startsWith("/_astro/") ||
        pathname.startsWith("/favicon") ||
        PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    ) {
        return next();
    }

    // Verificar cookie de sesión
    const sessionCookie = context.cookies.get("pt_session");
    if (!sessionCookie?.value) {
        return context.redirect("/login");
    }

    const user = verifySession(sessionCookie.value);
    
    if (!user || !user.id || !user.rol) {
        // Cookie malformada o firma inválida — forzar re-login
        context.cookies.delete("pt_session", { path: "/" });
        return context.redirect("/login");
    }

    // Opcional: inyectar usuario en locals para acceso fácil en endpoints/páginas
    context.locals.user = user;

    return next();
});
