import contactEmailTemplate from "./contact-email.html";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store"
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers
    }
  });
}

function parseAllowedOrigins(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  if (!allowedOrigins.length) return true;
  return allowedOrigins.includes(origin);
}

function buildCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const allowOrigin = isAllowedOrigin(origin, allowedOrigins) ? origin || "*" : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function sanitize(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value) {
  return value.replace(/\n/g, "<br>");
}

function renderEmailTemplate(payload) {
  const submittedAt = new Intl.DateTimeFormat("es-EC", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Guayaquil"
  }).format(new Date());

  const replacements = {
    "{{nombre}}": escapeHtml(payload.nombre),
    "{{empresa}}": escapeHtml(payload.empresa),
    "{{email}}": escapeHtml(payload.email),
    "{{email_href}}": encodeURIComponent(payload.email),
    "{{sector}}": escapeHtml(payload.sector),
    "{{mensaje_html}}": nl2br(escapeHtml(payload.mensaje)),
    "{{submitted_at}}": escapeHtml(submittedAt)
  };

  return Object.entries(replacements).reduce(
    (html, [token, value]) => html.replaceAll(token, value),
    contactEmailTemplate
  );
}

function buildHtmlEmail(payload) {
  return renderEmailTemplate(payload);
}

function buildTextEmail(payload) {
  return [
    "Nuevo lead desde lytiks.solutions",
    "",
    `Nombre: ${payload.nombre}`,
    `Empresa: ${payload.empresa}`,
    `Email: ${payload.email}`,
    `Sector: ${payload.sector}`,
    "",
    "Mensaje:",
    payload.mensaje
  ].join("\n");
}

async function sendViaResend(env, payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      reply_to: payload.email,
      subject: `Nuevo lead web Lytiks · ${payload.empresa}`,
      text: buildTextEmail(payload),
      html: buildHtmlEmail(payload)
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || "Resend no aceptó la solicitud.";
    throw new Error(message);
  }

  return data;
}

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(request, env);
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (!isAllowedOrigin(origin, allowedOrigins)) {
      return json({ ok: false, error: "Origin no permitido." }, 403, corsHeaders);
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Método no permitido." }, 405, corsHeaders);
    }

    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) {
      return json({ ok: false, error: "Configuración incompleta del correo." }, 500, corsHeaders);
    }

    let rawPayload;
    try {
      rawPayload = await request.json();
    } catch {
      return json({ ok: false, error: "Payload inválido." }, 400, corsHeaders);
    }

    const payload = {
      nombre: sanitize(rawPayload.nombre, 120),
      empresa: sanitize(rawPayload.empresa, 120),
      email: sanitize(rawPayload.email, 160),
      sector: sanitize(rawPayload.sector, 120) || "No especificado",
      mensaje: sanitize(rawPayload.mensaje, 4000),
      website: sanitize(rawPayload.website, 255)
    };

    if (payload.website) {
      return json({ ok: true }, 200, corsHeaders);
    }

    if (!payload.nombre || !payload.empresa || !payload.email || !payload.mensaje) {
      return json({ ok: false, error: "Faltan campos obligatorios." }, 400, corsHeaders);
    }

    if (!EMAIL_RE.test(payload.email)) {
      return json({ ok: false, error: "El email no es válido." }, 400, corsHeaders);
    }

    try {
      const result = await sendViaResend(env, payload);
      return json({ ok: true, id: result?.id || null }, 200, corsHeaders);
    } catch (error) {
      return json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "No fue posible enviar el correo."
        },
        502,
        corsHeaders
      );
    }
  }
};
