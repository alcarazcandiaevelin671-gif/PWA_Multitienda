# Ingreso de administradores con verificación en dos pasos

Para entrar al **Panel de administración** del Portal Guairá ahora se necesitan dos cosas:

1. Tu **correo y contraseña** (o tu cuenta de Google).
2. Un **código de 6 números** que genera una app en tu celular y cambia cada 30 segundos.

Así, aunque alguien consiga tu contraseña, no puede entrar al panel sin tu celular.
La configuración se hace **una sola vez**; después solo escribes el código cada vez que ingresas.

---

## Antes de empezar

- **Instala una app de autenticación** en tu celular (son gratuitas):
  **Google Authenticator** (recomendada), Microsoft Authenticator, Duo Mobile o Authy.
- **Pon la hora del celular en automático.** Es lo más importante: si la hora está desfasada,
  los códigos no coinciden.
  - Android: Ajustes → Sistema (o Administración general) → Fecha y hora → activa
    "Fecha y hora automáticas" y "Zona horaria automática".
  - iPhone: Ajustes → General → Fecha y hora → activa "Ajuste automático".
- Ten a mano la computadora y el celular al mismo tiempo.

---

## Primera vez: configurar tu código

1. Abre el sitio del portal e ingresa a **Iniciar sesión**.
2. Escribe tu **correo y contraseña** y presiona **Ingresar**
   (o usa **Continuar con Google** si tu cuenta es de Google).
3. Como eres administrador, el sistema te lleva a la pantalla
   **"Configura tu código de seguridad"**, que muestra un **código QR**.
4. En tu celular, abre la app de autenticación y agrega una cuenta:
   - **Google Authenticator:** toca **"+"** → **"Escanear un código QR"**.
   - **Duo Mobile:** toca **"+"** → **"Usar código QR"**.
   - **Microsoft Authenticator:** toca **"+"** → "Otra cuenta" → escanear.
5. Apunta la cámara al QR de la pantalla de la computadora.
   - Si Duo muestra un aviso sobre "copia de respaldo", es solo una recomendación:
     toca **Continuar** u **Omitir**.
6. En la app aparece la cuenta **"Portal Guairá"** con un código de **6 números**.
7. Escribe esos 6 números en la pantalla de la computadora y presiona
   **"Activar y continuar"**. Entras al panel.

### Si la cámara no lee el QR

Debajo del QR hay una **clave de texto** con un botón **Copiar**. Esa clave se escribe
**en la app del celular**, no en la página. Con Google Authenticator:

1. Toca **"+"** → **"Ingresar una clave de configuración"**.
2. Cuenta: `Portal Guairá` · Clave: la clave copiada · Tipo: **Basada en el tiempo**.
3. Toca **Agregar** y escribe en la página el código de 6 números que aparece.

> ⚠️ **No recargues la página después de escanear.** Cada recarga genera un QR nuevo y el que
> ya escaneaste deja de servir. Si recargaste, borra la cuenta "Portal Guairá" de la app y
> escanea el QR nuevo.

---

## Las siguientes veces: ingresar con tu correo y tu código

1. **Iniciar sesión** → correo y contraseña (o Google).
2. Aparece **"Ingresa tu código"**.
3. Abre la app del celular y escribe el código de 6 números de **Portal Guairá**.
4. Presiona **"Verificar y continuar"** → entras al panel.

---

## Si algo no funciona

| Problema | Solución |
|---|---|
| "El código no coincide" | Revisa que la hora del celular esté en automático (apágala y enciéndela) y usa el código que se muestra **en ese momento**. Si está por cambiar, espera al siguiente. |
| Recargué la página después de escanear | Borra "Portal Guairá" de la app, cierra sesión, vuelve a entrar y escanea el QR nuevo. |
| Cambié o perdí el celular | Pídele al otro administrador que borre tu factor en **Supabase → Authentication → Users → (tu usuario) → MFA**. La próxima vez que entres verás un QR nuevo para configurarlo otra vez. |
| La pantalla muestra un error con "Detalle" | Toma una captura y envíala al equipo. |

## Reglas de seguridad

- Cada administrador configura **su propio código en su propio celular**. No compartas el QR,
  la clave de texto ni los códigos.
- Activa el **bloqueo de pantalla** del celular y, si la app lo ofrece, la **copia de respaldo**
  de las cuentas.
- Nunca envíes los códigos por chat ni por correo: nadie del equipo te los va a pedir.
