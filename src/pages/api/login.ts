import type { APIRoute } from "astro";
import { verifyTareoLogin } from "../../lib/supabase";
import { signSession, createSupabaseToken } from "../../lib/session";
import type { SessionUser } from "../../lib/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { dni, password } = body;

        if (!dni || !password) {
            return new Response(JSON.stringify({ ok: false, error: "Ingresa tu DNI y contraseña." }), { status: 400 });
        }

        const result = await verifyTareoLogin(dni, password);
        
        if (!result.ok) {
            return new Response(JSON.stringify({ ok: false, error: "Credenciales incorrectas o sin acceso autorizado." }), { status: 401 });
        }

        // Logic from auth.ts (A2 fix included - role derived ONLY from DB)
        const rolFinal: "jefe" | "analista" = (result.rol === "jefe" || result.rol === "analista")
            ? result.rol
            : "analista";
        
        const user: SessionUser = {
            id: result.id!,
            nombre: result.nombre!,
            position: result.position!,
            sede: result.sede!,
            business_unit: result.business_unit ?? null,
            rol: rolFinal,
        };

        const token = signSession(user);
        const sbToken = createSupabaseToken(user.id);
        
        cookies.set("pt_session", token, {
            path: "/",
            httpOnly: true, // Not accessible via JS
            sameSite: "strict",
            maxAge: 86400, // 1 day
            secure: import.meta.env.PROD // Only send over HTTPS in production
        });

        return new Response(JSON.stringify({ ok: true, user, token: sbToken }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        console.error("[Login API] Error:", e);
        return new Response(JSON.stringify({ ok: false, error: "Error interno del servidor." }), { status: 500 });
    }
}
