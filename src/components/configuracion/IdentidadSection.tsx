'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { showAppConfirm } from '@/lib/app-message';
import {
  deleteProfileAvatar,
  updateAuthEmail,
  updateSettingsIdentity,
  uploadProfileAvatar,
  type SettingsProfile,
} from '@/services/settings.service';

export default function IdentidadSection({
  profile,
  onProfileChange,
}: {
  profile: SettingsProfile;
  onProfileChange: (profile: SettingsProfile) => void;
}) {
  const [name, setName] = useState(profile.nombre_completo ?? '');
  const [phone, setPhone] = useState(profile.telefono_contacto ?? '');
  const [email, setEmail] = useState(profile.email);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(profile.nombre_completo ?? '');
    setPhone(profile.telefono_contacto ?? '');
    setEmail(profile.email);
  }, [profile]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const saveIdentity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateSettingsIdentity({ nombre_completo: name, telefono_contacto: phone });
      onProfileChange({ ...profile, nombre_completo: name.trim(), telefono_contacto: phone });
      setMessage('Datos personales guardados.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los datos.');
    } finally {
      setSaving(false);
    }
  };

  const requestEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim().toLowerCase() === profile.email.toLowerCase()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateAuthEmail(email);
      setMessage('Solicitud enviada. Sigue las instrucciones de verificación enviadas por Supabase.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo solicitar el cambio de correo.');
    } finally {
      setSaving(false);
    }
  };

  const saveAvatar = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const url = await uploadProfileAvatar(selectedFile);
      await updateSettingsIdentity({ avatar_url: url });
      onProfileChange({ ...profile, avatar_url: url });
      setSelectedFile(null);
      setPreview(null);
      setMessage('Foto de perfil actualizada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la foto.');
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = async () => {
    if (!profile.avatar_url || !(await showAppConfirm('Se quitará la foto de perfil actual.', 'Quitar foto'))) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateSettingsIdentity({ avatar_url: null });
      onProfileChange({ ...profile, avatar_url: null });
      await deleteProfileAvatar(profile.avatar_url);
      setMessage('Foto de perfil eliminada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la foto.');
    } finally {
      setSaving(false);
    }
  };

  const avatar = preview ?? profile.avatar_url;
  const aliasBase = (profile.email.split('@')[0] || profile.nombre_completo || 'usuario')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 30);
  const displayAlias = aliasBase || 'usuario';

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-slate-900">Identidad y perfil</h2>
          <p className="mt-1 text-sm text-slate-600">Actualiza tus datos personales. El rol y el identificador son de solo lectura.</p>
        </div>

        {message && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        <form onSubmit={saveIdentity} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Nombre completo
            <input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <div className="text-sm font-semibold text-slate-700">
            Alias
            <p className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700">@{displayAlias} <span className="ml-1 text-xs text-slate-500">derivado, no guardado</span></p>
          </div>
          <label className="text-sm font-semibold text-slate-700">
            Teléfono
            <input type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <button type="submit" disabled={saving} className="w-fit rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar datos personales'}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-900">Correo electrónico</h2>
        <form onSubmit={requestEmailChange} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
            Correo autenticado
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <button type="submit" disabled={saving || email.trim().toLowerCase() === profile.email.toLowerCase()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Solicitar cambio</button>
        </form>
        <p className="mt-2 text-xs font-semibold text-slate-600">{profile.email_verified ? '✓ Correo verificado por Supabase Auth' : '⚠ Correo pendiente de verificación según Supabase Auth'}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-900">Foto de perfil</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {avatar ? <Image src={avatar} alt="Vista previa de la foto de perfil" fill unoptimized className="object-cover" /> : <span className="flex h-full items-center justify-center text-3xl" aria-hidden="true">👤</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Elegir foto
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setPreview(file ? URL.createObjectURL(file) : null);
              }} />
            </label>
            {selectedFile && <button type="button" disabled={saving} onClick={() => void saveAvatar()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">Guardar foto</button>}
            {profile.avatar_url && <button type="button" disabled={saving} onClick={() => void removeAvatar()} className="rounded-xl px-3 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Eliminar foto</button>}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">JPG, PNG o WebP; máximo 5 MB. La política del bucket `avatars` debe permitir la operación para que se complete.</p>
      </section>
    </div>
  );
}