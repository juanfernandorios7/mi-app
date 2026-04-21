"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#111", border: "1px solid #1e1e1e", borderRadius: 24,
        padding: "48px 40px", width: "100%", maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#c8922a", boxShadow: "0 0 8px #c8922a88" }} />
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, letterSpacing: "-0.5px", color: "#e8e0d0" }}>
            Juanfer OS
          </span>
        </div>

        {sent ? (
          <div>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 12, color: "#e8e0d0" }}>
              Revisa tu correo
            </p>
            <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
              Enviamos un magic link a <strong style={{ color: "#c8922a" }}>{email}</strong>. Haz click en el enlace para entrar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 8, color: "#e8e0d0" }}>
              Bienvenido
            </p>
            <p style={{ fontSize: 13, color: "#555", marginBottom: 28 }}>Acceso exclusivo — solo para ti.</p>

            <div style={{ marginBottom: 14 }}>
              <input
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 10,
                  padding: "12px 16px", color: "#e8e0d0", fontSize: 14,
                  fontFamily: "'Syne', sans-serif", outline: "none", width: "100%",
                }}
              />
            </div>

            {error && <p style={{ fontSize: 12, color: "#b05a5a", marginBottom: 12 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px", borderRadius: 10,
                background: "#c8922a18", border: "1px solid #c8922a44",
                color: "#c8922a", fontSize: 14, fontFamily: "'Syne', sans-serif",
                fontWeight: 700, marginBottom: 12, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Enviando..." : "Entrar con Magic Link"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
              <span style={{ fontSize: 11, color: "#444" }}>o</span>
              <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              style={{
                width: "100%", padding: "12px", borderRadius: 10,
                background: "#1a1a1a", border: "1px solid #2a2a2a",
                color: "#aaa", fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span>G</span> Continuar con Google
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
