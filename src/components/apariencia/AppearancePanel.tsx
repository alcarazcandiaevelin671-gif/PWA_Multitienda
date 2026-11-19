'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { saveAppearance } from '@/services/settings.service';
import {
  DEFAULT_APPEARANCE,
  NEUTRAL_LABELS,
  THEME_PRESETS,
  applyAppearance,
  computeAppearanceTokens,
  normalizeAppearance,
  readStoredAppearance,
  type Appearance,
  type FontScale,
  type HeaderStyle,
  type NeutralTone,
  type RadiusStyle,
} from '@/lib/appearance';
import { userFacingError } from '@/lib/user-facing-error';

const NEUTRAL_SWATCH: Record<NeutralTone, string> = {
  malva: '#7b7082', pizarra: '#64748b', piedra: '#78716c', zinc: '#71717a',
};

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
            value === option.value
              ? 'border-primary-500 bg-primary-50 text-primary-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-0.5"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="block truncate text-[11px] text-slate-500">{hint}</span>
      </span>
      <input
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase());
        }}
        maxLength={7}
        aria-label={`${label} (código hexadecimal)`}
        className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs uppercase text-slate-700"
      />
    </label>
  );
}

/** Mini vista previa: usa las mismas clases que la app, así refleja el tema en vivo. */
function Preview() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-slate-200 bg-page text-[10px] shadow-sm">
      <div className="zone-header flex items-center justify-between border-b border-slate-200 border-t-2 border-t-accent-600 px-3 py-2">
        <span className="font-black text-slate-900">Portal Guairá</span>
        <span className="rounded-md bg-primary-600 px-2 py-0.5 font-bold text-white">Ingresar</span>
      </div>
      <div className="zone-hero border-b border-slate-800 px-3 py-3 text-white">
        <p className="font-bold uppercase tracking-wider text-primary-500">Directorio comercial</p>
        <p className="text-sm font-black">Comercio Local.</p>
        <p className="text-slate-400">Tiendas y servicios del Guairá</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          <p className="font-bold text-slate-800">Producto</p>
          <p className="text-slate-500">Descripción breve</p>
          <p className="mt-1 font-black text-primary-600">Gs. 45.000</p>
        </div>
        <div className="flex flex-col justify-between rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 p-2 text-white">
          <p className="font-bold">Total</p>
          <p className="text-sm font-black">Gs. 90.000</p>
        </div>
      </div>
      <div className="zone-footer border-t border-slate-800 px-3 py-2 text-center text-slate-400">© Portal Guairá</div>
    </div>
  );
}

type Props = {
  /** Dentro de Configuración (sin cabecera propia de panel lateral). */
  embedded?: boolean;
  onClose?: () => void;
};

export default function AppearancePanel({ embedded = false, onClose }: Props) {
  const [saved, setSaved] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [draft, setDraft] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Copias para la limpieza al cerrar el panel (se actualizan después de cada render).
  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  useEffect(() => {
    draftRef.current = draft;
    savedRef.current = saved;
  }, [draft, saved]);

  useEffect(() => {
    const stored = readStoredAppearance() ?? DEFAULT_APPEARANCE;
    setSaved(stored);
    setDraft(stored);
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    // Al cerrar sin guardar, volver a lo guardado (los cambios se ven en vivo mientras se edita).
    return () => {
      if (JSON.stringify(draftRef.current) !== JSON.stringify(savedRef.current)) applyAppearance(savedRef.current, { persist: false });
    };
  }, []);

  const tokens = useMemo(() => computeAppearanceTokens(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const update = (patch: Partial<Appearance>, fromPreset = false) => {
    const next = normalizeAppearance({ ...draft, ...patch, preset: fromPreset ? patch.preset : 'personalizado' });
    setDraft(next);
    setMessage('');
    applyAppearance(next, { persist: false }); // vista previa en vivo
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (userId) await saveAppearance(draft);
      applyAppearance(draft, { owner: userId });
      setSaved(draft);
      setMessage(userId
        ? 'Personalización guardada en tu cuenta: se aplicará en todos tus dispositivos.'
        : 'Personalización guardada en este dispositivo. Iniciá sesión para conservarla en tu cuenta.');
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo guardar la personalización.'));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => update({ ...DEFAULT_APPEARANCE }, true);

  return (
    <div className={embedded ? '' : 'flex h-full flex-col'}>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">🎨 Personalizar</h2>
            <p className="text-xs text-slate-500">Los cambios se ven al instante. Guardalos para conservarlos.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-lg font-bold text-slate-500 hover:bg-slate-100">✕</button>
        </div>
      )}

      <div className={embedded ? 'space-y-6' : 'flex-1 space-y-6 overflow-y-auto px-5 py-5'}>
        <Preview />

        {/* Temas */}
        <section>
          <h3 className="mb-2 text-sm font-black text-slate-900">Temas</h3>
          {(['Clásicos', 'Paletas de color'] as const).map((grupo) => (
            <div key={grupo} className="mb-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{grupo}</p>
              <div className="grid grid-cols-2 gap-2">
                {THEME_PRESETS.filter((preset) => preset.grupo === grupo).map((preset) => {
                  const active = draft.preset === preset.id;
                  const a = preset.appearance;
                  const swatches = preset.muestra ?? [a.hero, a.primary, a.accent, a.background];
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => update({ ...a }, true)}
                      aria-pressed={active}
                      className={`rounded-xl border p-2.5 text-left transition ${active ? 'border-primary-500 ring-2 ring-primary-200' : 'border-slate-200 hover:border-primary-200'} bg-white`}
                    >
                      <span className="flex h-7 overflow-hidden rounded-lg">
                        {swatches.map((color, index) => (
                          <span key={index} className="flex-1" style={{ backgroundColor: color }} />
                        ))}
                      </span>
                      <span className="mt-1.5 block text-xs font-black text-slate-800">{preset.nombre}</span>
                      <span className="block text-[10px] leading-tight text-slate-500">{preset.descripcion}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {draft.preset === 'personalizado' && (
            <p className="mt-2 text-xs font-semibold text-primary-700">✏️ Tema personalizado</p>
          )}
        </section>

        {/* Colores de marca */}
        <section className="space-y-2">
          <h3 className="text-sm font-black text-slate-900">Colores de marca</h3>
          <ColorField label="Color principal" hint="Botones, enlaces y precios" value={draft.primary} onChange={(primary) => update({ primary })} />
          <ColorField label="Color de acento" hint="Degradados, insignias y detalles" value={draft.accent} onChange={(accent) => update({ accent })} />
        </section>

        {/* Zonas */}
        <section className="space-y-3">
          <h3 className="text-sm font-black text-slate-900">Zonas</h3>
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-600">Encabezado (barra superior)</p>
            <Segmented<HeaderStyle>
              label="Estilo del encabezado"
              value={draft.header}
              onChange={(header) => update({ header })}
              options={[{ value: 'claro', label: 'Blanco' }, { value: 'tinte', label: 'Tinte de color' }, { value: 'vidrio', label: 'Vidrio' }]}
            />
          </div>
          <ColorField label="Portadas" hint="Inicio, cabecera de tiendas y del panel" value={draft.hero} onChange={(hero) => update({ hero })} />
          <ColorField label="Pie de página" hint="Zona inferior del sitio" value={draft.footer} onChange={(footer) => update({ footer })} />
          <ColorField label="Fondo de página" hint="Se mantiene claro para leer bien" value={draft.background} onChange={(background) => update({ background })} />
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-600">Tono de los grises (textos, bordes, fondos)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(NEUTRAL_LABELS) as NeutralTone[]).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => update({ neutral: tone })}
                  aria-pressed={draft.neutral === tone}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-[11px] font-bold transition ${
                    draft.neutral === tone ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200'
                  }`}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: NEUTRAL_SWATCH[tone] }} />
                  {NEUTRAL_LABELS[tone]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Forma y lectura */}
        <section className="space-y-3">
          <h3 className="text-sm font-black text-slate-900">Forma y lectura</h3>
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-600">Bordes</p>
            <Segmented<RadiusStyle>
              label="Bordes"
              value={draft.radius}
              onChange={(radius) => update({ radius })}
              options={[{ value: 'recto', label: 'Rectos' }, { value: 'normal', label: 'Normales' }, { value: 'redondeado', label: 'Redondeados' }]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-600">Tamaño del texto</p>
            <Segmented<FontScale>
              label="Tamaño del texto"
              value={draft.fontScale}
              onChange={(fontScale) => update({ fontScale })}
              options={[{ value: 'compacto', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'grande', label: 'Grande' }]}
            />
          </div>
        </section>

        {tokens.adjustments.length > 0 && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-bold">Ajustes automáticos de legibilidad</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {tokens.adjustments.map((text) => <li key={text}>{text}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className={embedded ? 'mt-6' : 'border-t border-slate-200 px-5 py-4'}>
        {message && <p role="status" className="mb-2 text-xs font-semibold text-emerald-700">{message}</p>}
        {error && <p role="alert" className="mb-2 text-xs font-semibold text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-primary-300">
            Restablecer
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : dirty ? 'Guardar personalización' : 'Guardado ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
