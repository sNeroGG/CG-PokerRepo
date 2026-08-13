import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export default function OfflinePage() {
  return (
    <main className="auth-page flex min-h-dvh items-center justify-center p-5 text-center">
      <section className="auth-panel w-full max-w-sm space-y-5">
        <WifiOff
          className="mx-auto text-casino-gold"
          size={38}
          strokeWidth={1.4}
          aria-hidden
        />
        <div>
          <h1 className="font-display text-xl text-white">{BRAND_NAME}</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
            {BRAND_TAGLINE}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-white/65">
          No hay conexión. Las salas necesitan internet para sincronizarse de
          forma segura con los demás jugadores.
        </p>
        <Link href="/" className="auth-btn-secondary">
          <RefreshCw size={17} aria-hidden />
          Reintentar conexión
        </Link>
      </section>
    </main>
  );
}
