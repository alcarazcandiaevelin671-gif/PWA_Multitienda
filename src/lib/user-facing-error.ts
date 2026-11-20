const ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/invalid login credentials|invalid email or password/i, 'El correo o la contraseña son incorrectos.'],
  [/email not confirmed|email address not confirmed/i, 'Confirma tu correo electrónico antes de iniciar sesión.'],
  [/user already registered|already registered|already exists/i, 'Ya existe una cuenta con ese correo electrónico.'],
  [/invalid email|email address is invalid/i, 'El correo electrónico no tiene un formato válido.'],
  [/weak password|password should|password must|password is too short/i, 'La contraseña no cumple los requisitos de seguridad.'],
  [/too many requests|rate limit|request rate/i, 'Se realizaron demasiados intentos. Espera un momento e inténtalo de nuevo.'],
  [/invalid api key|bad jwt|jwt expired|refresh token/i, 'La conexión con el servicio expiró o no es válida. Inténtalo nuevamente.'],
  [/row.level security|permission denied|not authorized|unauthorized|forbidden/i, 'No tienes permisos para realizar esta acción.'],
  [/failed to fetch|fetch failed|network request failed|network error/i, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
  [/not found|does not exist|no rows/i, 'No se encontró la información solicitada.'],
  [/duplicate key|foreign key constraint|invalid input value for enum|violates .* constraint/i, 'Algunos datos no coinciden con las opciones permitidas. Revísalos e inténtalo de nuevo.'],
];

const SPANISH_MESSAGE = /[áéíóúñ¿¡]|\b(no se|no pudo|no puede|no tienes|el correo|la contraseña|la cuenta|el pedido|la tienda|el comercio|los datos|las contraseñas|inténtalo|intenta de nuevo|revisa|selecciona|confirma|inicia sesión|ocurrió|completa|actualiza|ya existe|debes|tu solicitud|tu cuenta)\b/i;

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message.trim();
  }
  return '';
}

export function userFacingError(error: unknown, fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.') {
  const message = extractMessage(error);
  if (!message) return fallback;

  const translation = ERROR_TRANSLATIONS.find(([pattern]) => pattern.test(message));
  if (translation) return translation[1];
  if (SPANISH_MESSAGE.test(message)) return message;

  return fallback;
}