'use client';

import { useEffect, useState } from 'react';
import { AppMessage, closeAppMessage, showAppMessage, subscribeAppMessage } from '@/lib/app-message';

export default function AppMessageLayer() {
  const [message, setMessage] = useState<AppMessage | null>(null);

  useEffect(() => {
    const originalAlert = window.alert.bind(window);
    const unsubscribe = subscribeAppMessage((next) => setMessage(next));

    window.alert = (text?: string) => {
      showAppMessage(String(text ?? ''));
      return undefined;
    };

    return () => {
      window.alert = originalAlert;
      unsubscribe();
      closeAppMessage();
    };
  }, []);

  if (!message) return null;

  const isConfirm = Boolean(message.onConfirm || message.onCancel);

  return (
    <div className="app-message-backdrop" role="dialog" aria-modal="true" aria-live="assertive">
      <div className="app-message-card">
        <div className="app-message-icon">{isConfirm ? '?' : 'i'}</div>
        <div className="app-message-content">
          <h3>{message.title}</h3>
          <p>{message.text}</p>
        </div>

        {isConfirm ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                message.onCancel?.();
              }}
              className="app-message-button-secondary"
            >
              {message.cancelText || 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={() => {
                message.onConfirm?.();
              }}
              className="app-message-button"
            >
              {message.confirmText || 'Aceptar'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => closeAppMessage()} className="app-message-button">
            Aceptar
          </button>
        )}
      </div>
    </div>
  );
}
