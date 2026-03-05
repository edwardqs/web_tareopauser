import { type SessionUser } from "./auth";
import crypto from "node:crypto";

const SECRET = import.meta.env.SECRET_KEY || "pauser-secret-key-2026";

export function signSession(user: SessionUser): string {
    // Usamos URL-safe base64 para evitar problemas en cookies?
    // Standard base64 is fine if we encodeURIComponent, but here we just put it in cookie directly?
    // Use standard base64 for payload.
    const payload = btoa(JSON.stringify(user));
    const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    return `${payload}.${signature}`;
}

export function verifySession(token: string): SessionUser | null {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    
    const expectedSignature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    
    // Constant time comparison prevents timing attacks (optional but good practice)
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
    }
    
    try {
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}

// ─── Supabase JWT Helper ────────────────────────────────────────────────────────
// Genera un JWT válido para Supabase Auth (simulado) para habilitar RLS
// Requiere que SUPABASE_JWT_SECRET esté configurado en .env (mismo que en Supabase Dashboard > API)

function base64url(str: string): string {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createSupabaseToken(userId: string, role: string = "authenticated", expirySeconds: number = 86400): string {
    const jwtSecret = import.meta.env.SUPABASE_JWT_SECRET || import.meta.env.SECRET_KEY || "pauser-secret-key-2026";
    
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        sub: userId,
        role: role,
        exp: Math.floor(Date.now() / 1000) + expirySeconds,
        iat: Math.floor(Date.now() / 1000),
        aud: "authenticated"
    };
    
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac("sha256", jwtSecret).update(signatureInput).digest("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        
    return `${signatureInput}.${signature}`;
}
