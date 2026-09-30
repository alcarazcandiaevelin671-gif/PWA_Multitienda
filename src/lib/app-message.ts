'use client';

import { userFacingError } from '@/lib/user-facing-error';

export type AppMessage = {
  title: string;
  text: string;
  type?: 'info' | 'success' | 'error';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const listeners = new Set<(message: AppMessage | null) => void>();

export function subscribeAppMessage(listener: (message: AppMessage | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showAppMessage(
  text: string,
  title?: string,
  type: AppMessage['type'] = 'info'
) {
  const fallback = type === 'success'
    ? 'La operación se completó correctamente.'
    : type === 'error'
      ? 'Ocurrió un error. Inténtalo de nuevo.'
      : 'No se pudo completar la acción. Inténtalo de nuevo.';
  const resolvedTitle =
    title ??
    (type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : 'Mensaje');

  listeners.forEach((listener) => listener({ title: resolvedTitle, text: userFacingError(text, fallback), type }));
}

export function closeAppMessage() {
  listeners.forEach((listener) => listener(null));
}

export function showAppConfirm(message: string, title = 'Confirmación'): Promise<boolean> {
  return new Promise((resolve) => {
    const payload: AppMessage = {
      title,
      text: message,
      type: 'info',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        closeAppMessage();
        resolve(true);
      },
      onCancel: () => {
        closeAppMessage();
        resolve(false);
      },
    };

    listeners.forEach((listener) => listener(payload));
  });
}
