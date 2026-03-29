# Lytiks Contact API

Landing page estática desplegada en GitHub Pages y formulario de contacto listo para enviarse con `Cloudflare Workers + Resend`.

## Archivos agregados

- `worker/contact.js`: endpoint serverless para recibir el formulario y reenviarlo por correo.
- `worker/contact-email.html`: plantilla HTML base del correo de notificación.
- `wrangler.jsonc`: configuración del Worker.
- `.dev.vars.example`: ejemplo de variables para desarrollo local.
- `index.html`: formulario conectado a API con fallback a `mailto:` si el endpoint aún no está definido.

## Stack recomendado

- Frontend: `GitHub Pages`
- API: `Cloudflare Workers`
- Email transaccional: `Resend`

## Variables necesarias

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL="Lytiks Web <info@lytiks.solutions>"
RESEND_TO_EMAIL="info@lytiks.solutions"
ALLOWED_ORIGINS="https://lytiks.solutions,https://www.lytiks.solutions,https://paveragilces.github.io"
```

## Despliegue

1. Instala Wrangler:

```bash
npm install -D wrangler
```

2. Inicia sesión en Cloudflare:

```bash
npx wrangler login
```

3. Para pruebas locales, usa uno de estos dos formatos:

- `.env`
- `.dev.vars`

No uses ambos al mismo tiempo. Si prefieres `.dev.vars`, puedes copiar `.dev.vars.example` y pegar tu `RESEND_API_KEY`.

4. Para pruebas locales:

```bash
npx wrangler dev
```

5. Cuando el Worker esté listo, despliega:

```bash
npx wrangler deploy
```

6. Copia la URL final del Worker y pégala en `index.html` dentro de:

```html
<meta name="lytiks-contact-endpoint" content="https://TU-WORKER.workers.dev/contact">
```

7. En Resend, verifica el dominio o subdominio desde el que vas a enviar. Si usas `info@lytiks.solutions`, el dominio `lytiks.solutions` debe estar verificado.

## Notas

- Si el endpoint no está configurado todavía, el formulario abre `mailto:` como respaldo.
- El Worker acepta `POST` y `OPTIONS`, valida origen, campos obligatorios y usa honeypot básico anti-spam.
- Para producción, conviene mantener `RESEND_API_KEY` como secreto en Cloudflare.
- Wrangler admite `.env` para desarrollo local, pero eso no despliega los secretos a producción por sí solo.
