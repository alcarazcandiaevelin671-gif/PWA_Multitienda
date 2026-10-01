'use client';

export type ConfigSection = 'identity' | 'security' | 'preferences' | 'notifications' | 'privacy' | 'account';

const sections: Array<{ id: ConfigSection; label: string; description: string }> = [
  { id: 'identity', label: 'Identidad y perfil', description: 'Datos personales y correo' },
  { id: 'security', label: 'Seguridad', description: 'Contraseña, MFA y conexiones' },
  { id: 'preferences', label: 'Preferencias', description: 'Idioma, formato y tema' },
  { id: 'notifications', label: 'Notificaciones', description: 'Canales y tipos de avisos' },
  { id: 'privacy', label: 'Privacidad y datos', description: 'Exportación y controles' },
  { id: 'account', label: 'Información de la cuenta', description: 'Rol y estado de solo lectura' },
];

export default function ConfiguracionLayout({
  activeSection,
  onSectionChange,
  children,
}: {
  activeSection: ConfigSection;
  onSectionChange: (section: ConfigSection) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Tu cuenta</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900">Configuración</h1>
        <p className="mt-2 text-sm text-slate-600">Administrá tu cuenta, seguridad, preferencias y privacidad.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Secciones de configuración" className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {sections.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onSectionChange(section.id)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition ${active ? 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-100' : 'text-slate-700 hover:bg-white hover:text-blue-700'}`}
                >
                  <span className="block text-sm font-bold">{section.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{section.description}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          <label className="mb-4 block lg:hidden">
            <span className="mb-1 block text-xs font-bold text-slate-600">Sección</span>
            <select
              value={activeSection}
              onChange={(event) => onSectionChange(event.target.value as ConfigSection)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
            </select>
          </label>
          {children}
        </div>
      </div>
    </div>
  );
}