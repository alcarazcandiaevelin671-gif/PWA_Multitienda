/**
 * [FRONTEND] Aviso que el registro le deja a la página de inicio de sesión: qué tipo de cuenta se
 * creó, si falta confirmar el correo y el correo para completarlo. Queda solo en esta pestaña
 * (sessionStorage) y se borra al leerlo; no viaja en la dirección de la página.
 */
export type AvisoRegistro = {
  tipo: 'cliente' | 'comerciante';
  email: string;
  confirmarCorreo: boolean;
};

const CLAVE = 'pg-aviso-registro';

export function avisarRegistro(aviso: AvisoRegistro) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(aviso));
  } catch {
    // Navegación privada o almacenamiento bloqueado: el inicio de sesión muestra el aviso general.
  }
}

export function leerAvisoRegistro(): AvisoRegistro | null {
  try {
    const guardado = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    if (!guardado) return null;
    const aviso = JSON.parse(guardado) as Partial<AvisoRegistro>;
    if (aviso.tipo !== 'cliente' && aviso.tipo !== 'comerciante') return null;
    return { tipo: aviso.tipo, email: String(aviso.email ?? ''), confirmarCorreo: Boolean(aviso.confirmarCorreo) };
  } catch {
    return null;
  }
}
