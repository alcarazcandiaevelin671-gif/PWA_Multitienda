'use client';

/**
 * [PÁGINA] Página /auth/mfa: verificación en dos pasos (TOTP). Configura el código con QR la primera vez y lo pide en cada ingreso.
 */
/* eslint-disable @next/next/no-img-element -- el QR es un SVG en data URL generado por Supabase */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/shared/supabase/client';
import { userFacingError } from '@/shared/lib/user-facing-error';

type Step = 'cargando' | 'configurar' | 'verificar' | 'error';

/** Solo rutas internas (evita redirecciones abiertas). */
function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** Sube los tokens nuevos (nivel aal2) a las cookies del servidor para que el middleware los vea. */
async function syncServerSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
  });
  if (!response.ok) throw new Error('No se pudo validar la sesión en el servidor.');
}

export default function MfaPage() {
  const [step, setStep] = useState<Step>('cargando');
  const [next, setNext] = useState('/');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // En desarrollo React ejecuta los efectos dos veces: sin esta guarda se pedían dos QR a la vez
  // y el segundo fallaba ("ya existe"), dejando la pantalla sin QR.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const destination = safeNext(new URLSearchParams(window.location.search).get('next'));
    setNext(destination);

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace('/auth/login');
          return;
        }
        const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (level?.currentLevel === 'aal2') {
          await syncServerSession();
          window.location.replace(destination);
          return;
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const verified = factors.totp.find((factor) => factor.status === 'verified');
        if (verified) {
          setFactorId(verified.id);
          setStep('verificar');
          return;
        }

        // Sin código configurado: se limpian inscripciones a medio terminar y se genera un QR nuevo.
        const all = (factors.all ?? []) as Array<{ id: string; factor_type: string; status: string }>;
        await Promise.all(all
          .filter((factor) => factor.factor_type === 'totp' && factor.status !== 'verified')
          .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));
        const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          // Nombre único: Supabase no permite dos factores con el mismo nombre.
          friendlyName: `Portal Guairá ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
        });
        if (enrollError) throw enrollError;
        setFactorId(enrolled.id);
        setQrCode(enrolled.totp.qr_code);
        setSecret(enrolled.totp.secret);
        setStep('configurar');
      } catch (cause) {
        // Mensaje propio: el traductor genérico convertía "already exists" en un aviso sobre el correo.
        const detalle = cause instanceof Error ? cause.message : '';
        setError(`No se pudo preparar la verificación en dos pasos.${detalle ? ` Detalle: ${detalle}` : ''} Presiona "Reintentar".`);
        setStep('error');
      }
    };
    void load();
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('El código tiene 6 números. Revísalo en tu aplicación de autenticación.');
      return;
    }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (verifyError) throw verifyError;
      await syncServerSession();
      window.location.replace(next);
    } catch (cause) {
      const detalle = cause instanceof Error ? cause.message : String(cause ?? '');
      if (/invalid totp|invalid code|code.*(invalid|expired)/i.test(detalle)) {
        setError('El código no coincide. Revisa que la hora de tu celular esté en automático (Ajustes → Fecha y hora) '
          + 'y escribe el código que se muestra ahora. Si escaneaste un QR de otro intento, borra esa cuenta en la app y escanea el QR de esta pantalla.');
      } else {
        setError(`${userFacingError(cause, 'No se pudo verificar el código.')}${detalle ? ` (Detalle: ${detalle})` : ''}`);
      }
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
    await supabase.auth.signOut();
    window.location.replace('/auth/login');
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-xl flex-col justify-center px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-wider text-primary-700">Verificación en dos pasos</p>

        {step === 'cargando' && <p className="mt-4 text-sm text-slate-500">Preparando la verificación…</p>}

        {step === 'configurar' && (
          <>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Configura tu código de seguridad</h1>
            <p className="mt-2 text-sm text-slate-600">
              Para entrar a la administración se pide, además de la contraseña, un código de 6 números
              que cambia cada 30 segundos en tu celular. Se configura una sola vez.
            </p>
            <ol className="mt-5 space-y-4 text-sm text-slate-700">
              <li>
                <strong>1. Instala una app de autenticación</strong> en tu celular (gratis):
                Google Authenticator, Microsoft Authenticator o Authy.
              </li>
              <li>
                <strong>2. En la app, toca &quot;+&quot; → &quot;Escanear código QR&quot;</strong> y apunta la cámara a este código:
                <div className="mt-3 flex justify-center">
                  {qrCode && <img src={qrCode} alt="Código QR para la app de autenticación" className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2" />}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  ¿No puedes escanear? En la app elige <strong>&quot;Introducir clave de configuración&quot;</strong>,
                  pon como nombre &quot;Portal Guairá&quot; y escribe esta clave:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-800">{secret}</code>
                  <button type="button" onClick={() => void copySecret()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-primary-300">
                    {copied ? 'Copiada ✓' : 'Copiar'}
                  </button>
                </div>
              </li>
              <li><strong>3. Escribe abajo el código de 6 números</strong> que muestra la app para &quot;Portal Guairá&quot;.</li>
            </ol>
          </>
        )}

        {step === 'verificar' && (
          <>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Ingresa tu código</h1>
            <p className="mt-2 text-sm text-slate-600">
              Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator o Authy) y escribe el código
              de 6 números de <strong>Portal Guairá</strong>.
            </p>
          </>
        )}

        {step === 'error' && (
          <button type="button" onClick={() => window.location.reload()} className="mt-6 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white hover:bg-primary-700">
            Reintentar
          </button>
        )}

        {(step === 'configurar' || step === 'verificar') && factorId && (
          <form onSubmit={(event) => void submit(event)} className="mt-6">
            <label htmlFor="mfa-code" className="text-sm font-bold text-slate-800">Código de 6 números</label>
            <input
              id="mfa-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="mt-4 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {busy ? 'Verificando…' : step === 'configurar' ? 'Activar y continuar' : 'Verificar y continuar'}
            </button>
          </form>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 text-xs">
          <Link href="/" className="font-bold text-slate-500 hover:text-primary-700">Volver al inicio</Link>
          <button type="button" onClick={() => void signOut()} className="font-bold text-slate-500 hover:text-rose-700">Cerrar sesión</button>
        </div>
      </section>
    </main>
  );
}
