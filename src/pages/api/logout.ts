import type { APIRoute } from "astro";
import { SESSION_COOKIE } from "../../lib/auth";

/**
 * GET /api/logout
 *
 * Borra la cookie pt_session server-side (via Set-Cookie header) y redirige
 * a /login. Esto evita el bucle que ocurría cuando logout() intentaba borrar
 * la cookie client-side pero el browser la seguía enviando en el siguiente request.
 */
export const GET: APIRoute = async ({ cookies, redirect }) => {
    cookies.delete(SESSION_COOKIE, { path: "/" });
    return redirect("/login", 302);
};
