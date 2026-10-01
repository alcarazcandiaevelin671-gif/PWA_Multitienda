'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ConfiguracionLayout, { type ConfigSection } from '@/components/configuracion/ConfiguracionLayout';
import IdentidadSection from '@/components/configuracion/IdentidadSection';
import PrivacidadSection from '@/components/configuracion/PrivacidadSection';
import PreferenciasSection from '@/components/configuracion/PreferenciasSection';
import NotificacionesSection from '@/components/configuracion/NotificacionesSection';
import SeguridadSection from '@/components/configuracion/SeguridadSection';
import { getSettingsProfile, type SettingsProfile } from '@/services/settings.service';
import { userFacingError } from '@/lib/user-facing-error';

const roleLabel = (role: string | null) => {
  const normalized = String(role ?? '').toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') return 'Administrador';
  if (normalized === 'comerciante') return 'Comerciante';
  if (normalized === 'cliente') return 'Cliente';
  return 'No disponible en el perfil';
};

export default function ConfiguracionPage() {
  const [activeSection, setActiveSection] = useState<ConfigSection>('identity');
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    getSettingsProfile()
      .then((result) => {
        if (current) setProfile(result);
      })
      .catch((cause) => {
        if (current) setError(userFacingError(cause, 'No se pudo cargar la configuración de la cuenta.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="h-20 animate-pulse rounded-2xl bg-slate-200" /><div className="mt-6 grid gap-5 lg:grid-cols-[240px_1fr]"><div className="h-72 animate-pulse rounded-2xl bg-slate-100" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div></div>;
  }

  if (!profile) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center"><section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-black text-slate-900">Configuración</h1><p role="alert" className="mt-3 text-sm text-slate-600">{error || 'Inicia sesión para administrar la configuración de tu cuenta.'}</p><Link href="/auth/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Iniciar sesión</Link></section></div>;
  }

  const content = activeSection === 'identity'
    ? <IdentidadSection profile={profile} onProfileChange={setProfile} />
    : activeSection === 'security'
      ? <SeguridadSection role={profile.rol} />
      : activeSection === 'preferences'
        ? <PreferenciasSection userId={profile.id} />
        : activeSection === 'notifications'
          ? <NotificacionesSection userId={profile.id} />
          : activeSection === 'privacy'
            ? <PrivacidadSection userId={profile.id} />
            : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-extrabold text-slate-900">Información de la cuenta</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[
              ['UUID', profile.id],
              ['Correo de Auth', profile.email],
              ['Rol', roleLabel(profile.rol)],
              ['Estado', profile.activo === null ? 'No disponible en el perfil' : profile.activo ? 'Activo' : 'Inactivo'],
              ['Cuenta creada', profile.creado_en ? new Date(profile.creado_en).toLocaleDateString('es-PY') : 'No disponible'],
              ['Último inicio de sesión', profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString('es-PY') : 'No disponible'],
              ['Correo verificado', profile.email_verified ? 'Sí, confirmado por Supabase Auth' : 'Pendiente según Supabase Auth'],
            ].map(([label, value]) => <div key={label} className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-xs font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl><p className="mt-4 text-xs text-slate-500">Rol, estado y fechas son informativos y no se pueden editar desde esta página.</p></section>;

  return <ConfiguracionLayout activeSection={activeSection} onSectionChange={setActiveSection}>{content}</ConfiguracionLayout>;
}