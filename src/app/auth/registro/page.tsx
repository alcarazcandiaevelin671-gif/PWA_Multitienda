'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const LocationPicker = dynamic(() => import('@/components/ui/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-400">
      Cargando mapa del Guairá...
    </div>
  ),
});

type Opcion = { id: number; nombre: string };

const INPUT_CLASS = 'w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200';
const LABEL_CLASS = 'mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600';

export default function RegistroVendedorPage() {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
    nombreComercio: '',
    descripcion: '',
    categoriaPrincipal: '',
    distritoId: '',
    direccion: '',
    telefonoComercial: '',
    latitud: -25.7806,
    longitud: -56.4486,
  });
  const [distritos, setDistritos] = useState<Opcion[]>([]);
  const [categorias, setCategorias] = useState<Opcion[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      const [districtResult, categoryResult] = await Promise.all([
        supabase.from('distritos').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

      if (!active) return;
      if (districtResult.error) {
        setError('No se pudieron cargar los distritos. Inténtalo nuevamente más tarde.');
      } else {
        setDistritos(districtResult.data || []);
      }
      if (!categoryResult.error) setCategorias(categoryResult.data || []);
      setLoadingOptions(false);
    };

    loadOptions();
    return () => { active = false; };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(formData.password)) {
      setError('La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula y un número.');
      return;
    }
    if (!formData.distritoId) {
      setError('Selecciona el distrito donde se encuentra tu comercio.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/registro-vendedor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCompleto: formData.nombreCompleto,
          email: formData.email,
          telefono: formData.telefono,
          password: formData.password,
          nombreComercio: formData.nombreComercio,
          descripcion: formData.descripcion,
          categoriaPrincipal: formData.categoriaPrincipal,
          distritoId: Number(formData.distritoId),
          direccion: formData.direccion,
          telefonoComercial: formData.telefonoComercial,
          latitud: formData.latitud,
          longitud: formData.longitud,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo completar el registro.');
      setConfirmationRequired(Boolean(result.confirmationRequired));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Ocurrió un error al registrar el comercio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_1.2fr]">
        <aside className="bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-900 p-8 text-white lg:p-10">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-100">
            PORTAL GUAIRÁ
          </div>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">¡Lleva tu comercio al mundo digital!</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sky-100/80">
            Registra tu negocio en el Portal Comercial Guairá y conecta tus productos con nuevos clientes.
          </p>

          <div className="mt-8 space-y-4 text-sm text-sky-50/90">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">🏪</div>
              <p className="mt-2 font-bold">Haz visible tu comercio local</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">📍</div>
              <p className="mt-2 font-bold">Conecta con clientes de tu distrito</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">⚡</div>
              <p className="mt-2 font-bold">Gestiona tus productos desde un solo lugar</p>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-black text-slate-900">Registro de nuevo vendedor</h2>
              <p className="mt-2 text-sm text-slate-500">Completa tus datos personales y los de tu comercio para comenzar.</p>
            </div>

            {error && (
              <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {confirmationRequired ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <p className="font-bold text-emerald-900">Tu solicitud de vendedor fue registrada.</p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-800">
                  {confirmationRequired
                    ? 'El comercio quedó pendiente de aprobación y no aparecerá como activo hasta que sea revisado. Revisa tu correo para confirmar la cuenta; después podrás iniciar sesión y consultar el estado de la solicitud.'
                    : 'El comercio quedó pendiente de aprobación y no aparecerá como activo hasta que sea revisado. Ya puedes iniciar sesión y consultar el estado de la solicitud.'}
                </p>
                <Link href="/auth/login?registro=vendedor" className="mt-5 inline-flex rounded-xl bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-700">
                  Ir a iniciar sesión
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-4" aria-labelledby="datos-personales">
                  <h3 id="datos-personales" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Datos personales y de acceso</h3>
                  <div>
                    <label htmlFor="nombreCompleto" className={LABEL_CLASS}>Nombre y apellido *</label>
                    <input id="nombreCompleto" name="nombreCompleto" type="text" autoComplete="name" required minLength={3} maxLength={120} value={formData.nombreCompleto} onChange={handleChange} placeholder="Ej. María Benítez" className={INPUT_CLASS} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="telefono" className={LABEL_CLASS}>Teléfono personal *</label>
                      <input id="telefono" name="telefono" type="tel" autoComplete="tel" inputMode="tel" required pattern="[+0-9() .-]{7,20}" value={formData.telefono} onChange={handleChange} placeholder="0981 123 456" className={INPUT_CLASS} />
                    </div>
                    <div>
                      <label htmlFor="email" className={LABEL_CLASS}>Correo electrónico *</label>
                      <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={formData.email} onChange={handleChange} placeholder="correo@ejemplo.com" className={INPUT_CLASS} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="password" className={LABEL_CLASS}>Contraseña *</label>
                      <div className="relative">
                        <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} value={formData.password} onChange={handleChange} placeholder="Mínimo 10 caracteres" className={`${INPUT_CLASS} pr-12`} />
                        <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                          {showPassword ? (
                            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" /><path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-4.29 5.3" /><path d="M6.61 6.61A17.75 17.75 0 0 0 2 12s3.5 7 10 7a10.65 10.65 0 0 0 5.39-1.61" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className={LABEL_CLASS}>Confirmar contraseña *</label>
                      <div className="relative">
                        <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} value={formData.confirmPassword} onChange={handleChange} placeholder="Repite la contraseña" className={`${INPUT_CLASS} pr-12`} />
                        <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700" aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}>
                          {showConfirmPassword ? (
                            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" /><path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-4.29 5.3" /><path d="M6.61 6.61A17.75 17.75 0 0 0 2 19a10.65 10.65 0 0 0 5.39-1.61" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Usa al menos 10 caracteres, con una mayúscula, una minúscula y un número.</p>
                </section>

                <section className="space-y-4" aria-labelledby="datos-comercio">
                  <h3 id="datos-comercio" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Datos del comercio</h3>
                  <div>
                    <label htmlFor="nombreComercio" className={LABEL_CLASS}>Nombre del comercio *</label>
                    <input id="nombreComercio" name="nombreComercio" type="text" required minLength={2} maxLength={120} value={formData.nombreComercio} onChange={handleChange} placeholder="Ej. Artesanías Villarrica" className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label htmlFor="descripcion" className={LABEL_CLASS}>Descripción</label>
                    <textarea id="descripcion" name="descripcion" rows={3} maxLength={1500} value={formData.descripcion} onChange={handleChange} placeholder="Cuéntales a tus clientes qué ofrece tu comercio" className={INPUT_CLASS} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="categoriaPrincipal" className={LABEL_CLASS}>Rubro</label>
                      <select id="categoriaPrincipal" name="categoriaPrincipal" value={formData.categoriaPrincipal} onChange={handleChange} className={INPUT_CLASS}>
                        <option value="">Seleccionar rubro (opcional)</option>
                        {categorias.map((categoria) => <option key={categoria.id} value={categoria.nombre}>{categoria.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="distritoId" className={LABEL_CLASS}>Distrito *</label>
                      <select id="distritoId" name="distritoId" required value={formData.distritoId} onChange={handleChange} disabled={loadingOptions || distritos.length === 0} className={INPUT_CLASS}>
                        <option value="">{loadingOptions ? 'Cargando distritos...' : 'Seleccionar distrito'}</option>
                        {distritos.map((distrito) => <option key={distrito.id} value={distrito.id}>{distrito.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  {!loadingOptions && distritos.length === 0 && <p className="text-sm text-red-700">No hay distritos activos disponibles. Contacta al administrador del portal.</p>}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="direccion" className={LABEL_CLASS}>Dirección</label>
                      <input id="direccion" name="direccion" type="text" maxLength={250} value={formData.direccion} onChange={handleChange} placeholder="Calle, número o referencia" className={INPUT_CLASS} />
                    </div>
                    <div>
                      <label htmlFor="telefonoComercial" className={LABEL_CLASS}>Teléfono comercial *</label>
                      <input id="telefonoComercial" name="telefonoComercial" type="tel" inputMode="tel" required pattern="[+0-9() .-]{7,20}" value={formData.telefonoComercial} onChange={handleChange} placeholder="0981 123 456" className={INPUT_CLASS} />
                    </div>
                  </div>
                  <LocationPicker onLocationChange={(latitud, longitud) => setFormData((current) => ({ ...current, latitud, longitud }))} />
                </section>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-900">
                  Al enviar la solicitud, tu comercio quedará pendiente de aprobación. No se publicará como activo antes de la revisión.
                </div>
                <button type="submit" disabled={loading || loadingOptions || distritos.length === 0} className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? 'Registrando solicitud...' : 'Registrar nuevo vendedor'}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-slate-500">
              ¿Ya tienes cuenta de vendedor?{' '}
              <Link href="/auth/login" className="font-bold text-sky-600 hover:underline">Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
