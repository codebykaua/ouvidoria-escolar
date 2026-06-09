const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function text(value, status = 200) {
  return new Response(value, { status, headers: { ...JSON_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}
async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
function nowISO() { return new Date().toISOString(); }
function normalizeProtocol(value) { return String(value || "").trim().replace(/\s+/g, "").toUpperCase(); }
function generateProtocol() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return `FALA-CETI-${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
}
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")); }
function sanitizeText(value, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function publicManifestation(row) {
  if (!row) return null;
  return {
    protocolo: row.protocolo,
    identificado: Boolean(row.identificado),
    nome: row.identificado ? row.nome : "",
    turma: row.turma,
    email: "",
    tipo: row.tipo,
    assunto: row.assunto,
    prioridade: row.prioridade,
    status: row.status,
    resposta: row.resposta,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em
  };
}
function adminManifestation(row) {
  if (!row) return null;
  return { ...row, identificado: Boolean(row.identificado) };
}
async function sha256Text(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function base64url(input) {
  let bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(String(input));
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(value) {
  value = value.replace(/-/g, "+").replace(/_/g, "/");
  while (value.length % 4) value += "=";
  return atob(value);
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64url(new Uint8Array(signature));
}
async function createToken(email, env) {
  const payload = { email, exp: Date.now() + 1000 * 60 * 60 * 8 };
  const encoded = base64url(JSON.stringify(payload));
  const signature = await sign(encoded, env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD || "troque-este-segredo");
  return `${encoded}.${signature}`;
}
async function verifyAdmin(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !token.includes(".")) return false;
  const [encoded, signature] = token.split(".");
  const expected = await sign(encoded, env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD || "troque-este-segredo");
  if (signature !== expected) return false;
  try {
    const payload = JSON.parse(fromBase64url(encoded));
    return payload.exp && payload.exp > Date.now();
  } catch { return false; }
}
async function requireAdmin(request, env) {
  const ok = await verifyAdmin(request, env);
  if (!ok) return json({ message: "Sessão administrativa inválida ou expirada." }, 401);
  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function emailLayout({ title, subtitle = "", badge = "", content = "", footer = "Ouvidoria CETI Amargosa" }) {
  return `
  <!doctype html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0; padding:0; background:#eef3f8; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#eef3f8; padding:30px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:650px; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 12px 35px rgba(15,23,42,.12);">
            <tr>
              <td style="background:#0f4c81; background:linear-gradient(135deg,#0f4c81,#1d7fc2); padding:30px 32px; color:#ffffff;">
                <div style="font-size:12px; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; opacity:.92;">
                  Sistema de Ouvidoria Escolar
                </div>
                <h1 style="margin:10px 0 0; font-size:25px; line-height:1.3; font-weight:800; color:#ffffff;">
                  ${escapeHtml(title)}
                </h1>
                ${subtitle ? `<p style="margin:10px 0 0; font-size:15px; line-height:1.6; color:#eaf6ff;">${escapeHtml(subtitle)}</p>` : ""}
              </td>
            </tr>

            <tr>
              <td style="padding:30px 32px;">
                ${badge ? `
                <div style="margin-bottom:22px;">
                  <span style="display:inline-block; background:#eaf4ff; color:#0f4c81; border:1px solid #cfe8ff; border-radius:999px; padding:9px 15px; font-size:13px; font-weight:800;">
                    ${escapeHtml(badge)}
                  </span>
                </div>
                ` : ""}

                ${content}
              </td>
            </tr>

            <tr>
              <td style="background:#f8fafc; border-top:1px solid #e5e7eb; padding:22px 32px;">
                <p style="margin:0; font-size:13px; line-height:1.7; color:#64748b;">
                  <strong style="color:#334155;">${escapeHtml(footer)}</strong><br>
                  Esta é uma mensagem automática do sistema. Por favor, não responda diretamente este e-mail.
                </p>
              </td>
            </tr>
          </table>

          <p style="max-width:650px; margin:16px auto 0; font-size:12px; line-height:1.6; color:#94a3b8; text-align:center;">
            Mensagem enviada automaticamente pelo Sistema de Ouvidoria Escolar.
          </p>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function infoRow(label, value, strong = false) {
  return `
    <tr>
      <td style="padding:12px 14px; background:#f8fafc; border:1px solid #e5e7eb; font-size:14px; color:#475569; width:38%;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:12px 14px; border:1px solid #e5e7eb; font-size:14px; color:#0f172a; ${strong ? "font-weight:700;" : ""}">
        ${escapeHtml(value || "Não informado")}
      </td>
    </tr>`;
}

function messageBox(title, message, options = {}) {
  const background = options.background || "#f8fafc";
  const border = options.border || "#e5e7eb";
  const titleColor = options.titleColor || "#64748b";
  return `
    <div style="background:${background}; border:1px solid ${border}; border-radius:16px; padding:20px; margin:0 0 22px;">
      <div style="font-size:12px; color:${titleColor}; font-weight:800; text-transform:uppercase; letter-spacing:.7px; margin-bottom:9px;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size:15px; line-height:1.75; color:#0f172a;">
        ${nl2br(message)}
      </div>
    </div>`;
}

async function sendBrevoEmail(env, { toEmail, toName = "", subject, htmlContent, textContent }) {
  if (!env.BREVO_API_KEY || !toEmail) return { skipped: true };
  const senderEmail = env.MAIL_FROM_EMAIL || env.OUVIDORIA_EMAIL;
  const senderName = env.MAIL_FROM_NAME || "Ouvidoria Escolar";
  if (!senderEmail) return { skipped: true };
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: toName || undefined }],
      subject,
      htmlContent,
      textContent
    })
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("Erro Brevo:", response.status, body.slice(0, 300));
    return { ok: false, status: response.status };
  }
  return { ok: true };
}

async function notifyNewManifestation(env, data) {
  if (!env.OUVIDORIA_EMAIL) return;

  const html = emailLayout({
    title: "Nova manifestação recebida",
    subtitle: "Uma nova solicitação foi registrada no sistema da Ouvidoria Escolar.",
    badge: `Protocolo: ${data.protocolo}`,
    content: `
      <h2 style="margin:0 0 16px; font-size:20px; line-height:1.4; color:#0f172a;">
        Detalhes da manifestação
      </h2>

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse; margin:0 0 22px;">
        ${infoRow("Protocolo", data.protocolo, true)}
        ${infoRow("Tipo", data.tipo, true)}
        ${infoRow("Assunto", data.assunto, true)}
        ${infoRow("Série/Vínculo", data.turma || "Não informado")}
        ${infoRow("Nome", data.nome || "Manifestação anônima")}
        ${infoRow("E-mail", data.email || "Não informado")}
        ${infoRow("Prioridade", data.prioridade)}
      </table>

      ${messageBox("Mensagem do aluno", data.descricao)}

      <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:14px; padding:16px;">
        <p style="margin:0; font-size:14px; line-height:1.7; color:#9a3412;">
          <strong>Ação recomendada:</strong> acesse o painel administrativo da Ouvidoria para analisar, acompanhar e responder esta manifestação.
        </p>
      </div>
    `
  });

  await sendBrevoEmail(env, {
    toEmail: env.OUVIDORIA_EMAIL,
    subject: `Nova manifestação - ${data.protocolo}`,
    htmlContent: html,
    textContent: `Nova manifestação recebida\nProtocolo: ${data.protocolo}\nTipo: ${data.tipo}\nAssunto: ${data.assunto}\nSérie/Vínculo: ${data.turma || "Não informado"}\nNome: ${data.nome || "Manifestação anônima"}\nE-mail: ${data.email || "Não informado"}\nPrioridade: ${data.prioridade}\nMensagem: ${data.descricao}`
  });
}

async function notifyStudentAnswer(env, data) {
  if (!data.email || !data.resposta) return;

  const html = emailLayout({
    title: "Resposta da Ouvidoria Escolar",
    subtitle: "Sua manifestação recebeu uma nova resposta da equipe responsável.",
    badge: `Protocolo: ${data.protocolo}`,
    content: `
      <p style="margin:0 0 18px; font-size:15px; line-height:1.75; color:#334155;">
        Olá${data.nome ? `, ${escapeHtml(data.nome)}` : ""}. A Ouvidoria Escolar analisou sua manifestação e registrou uma resposta no sistema.
      </p>

      ${messageBox("Resposta da Ouvidoria", data.resposta, {
        background: "#f0fdf4",
        border: "#bbf7d0",
        titleColor: "#15803d"
      })}

      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px; padding:16px;">
        <p style="margin:0; font-size:14px; line-height:1.7; color:#1e3a8a;">
          Guarde seu protocolo para acompanhar o andamento da manifestação pelo site da Ouvidoria.
        </p>
      </div>
    `
  });

  await sendBrevoEmail(env, {
    toEmail: data.email,
    toName: data.nome || "",
    subject: `Resposta da Ouvidoria - ${data.protocolo}`,
    htmlContent: html,
    textContent: `Sua manifestação ${data.protocolo} recebeu uma resposta:\n\n${data.resposta}`
  });
}

function confirmationEmailHtml({ protocolo, nome }) {
  return emailLayout({
    title: "Manifestação recebida com sucesso",
    subtitle: "Sua manifestação foi registrada no sistema da Ouvidoria Escolar.",
    badge: `Protocolo: ${protocolo}`,
    content: `
      <p style="margin:0 0 18px; font-size:15px; line-height:1.75; color:#334155;">
        Olá${nome ? `, ${escapeHtml(nome)}` : ""}. Recebemos sua manifestação e ela será analisada pela equipe responsável.
      </p>

      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:16px; padding:20px; margin:0 0 22px;">
        <div style="font-size:12px; color:#1d4ed8; font-weight:800; text-transform:uppercase; letter-spacing:.7px; margin-bottom:8px;">
          Seu protocolo de acompanhamento
        </div>
        <div style="font-size:26px; line-height:1.3; color:#0f172a; font-weight:900; letter-spacing:.4px;">
          ${escapeHtml(protocolo)}
        </div>
      </div>

      <p style="margin:0 0 18px; font-size:14px; line-height:1.75; color:#475569;">
        Guarde este código. Com ele, você poderá acompanhar sua manifestação e visualizar as respostas pelo site da Ouvidoria.
      </p>

      <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:16px;">
        <p style="margin:0; font-size:14px; line-height:1.7; color:#475569;">
          A equipe da Ouvidoria Escolar agradece seu contato. Sua participação ajuda a melhorar o ambiente escolar.
        </p>
      </div>
    `
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return text("ok");
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") return json({ ok: true, service: "ouvidoria-ceti-cloudflare", time: nowISO() });

      if (path === "/api/admin/login" && request.method === "POST") {
        const body = await readJson(request);
        const email = sanitizeText(body.email, 200).toLowerCase();
        const password = String(body.password || "");
        if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return json({ message: "ADMIN_EMAIL e ADMIN_PASSWORD ainda não foram configurados no Worker." }, 500);
        if (email !== String(env.ADMIN_EMAIL).toLowerCase() || password !== String(env.ADMIN_PASSWORD)) {
          return json({ message: "E-mail ou senha incorretos." }, 401);
        }
        const token = await createToken(email, env);
        return json({ token });
      }

      if (path === "/api/manifestacoes" && request.method === "POST") {
        const body = await readJson(request);
        const identificado = Boolean(body.identificado);
        const nome = identificado ? sanitizeText(body.nome, 180) : "";
        const turma = identificado ? sanitizeText(body.turma, 80) : "";
        const email = sanitizeText(body.email, 180).toLowerCase();
        const tipo = sanitizeText(body.tipo, 60);
        const assunto = sanitizeText(body.assunto, 180);
        const descricao = sanitizeText(body.descricao, 2000);
        const prioridade = sanitizeText(body.prioridade, 40);
        if (!email) return json({ message: "Informe o e-mail para receber o protocolo e a resposta." }, 400);
        if (!isEmail(email)) return json({ message: "E-mail inválido." }, 400);
        if (identificado && !nome) return json({ message: "Informe o nome." }, 400);
        if (identificado && !turma) return json({ message: "Informe a série ou o vínculo." }, 400);
        if (!tipo || !assunto || !descricao || !prioridade) return json({ message: "Preencha todos os campos obrigatórios." }, 400);
        let protocolo = generateProtocol();
        for (let i = 0; i < 3; i++) {
          const exists = await env.DB.prepare("SELECT protocolo FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
          if (!exists) break;
          protocolo = generateProtocol();
        }
        const data = { protocolo, identificado, nome, turma, email, tipo, assunto, descricao, prioridade, status: "Recebida" };
        await env.DB.prepare(`
          INSERT INTO manifestacoes
          (protocolo, identificado, nome, turma, email, tipo, assunto, descricao, prioridade, status, resposta, observacao_interna, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recebida', '', '', ?, ?)
        `).bind(protocolo, identificado ? 1 : 0, nome, turma, email, tipo, assunto, descricao, prioridade, nowISO(), nowISO()).run();
        await notifyNewManifestation(env, data);
        if (email) {
          await sendBrevoEmail(env, {
            toEmail: email,
            toName: nome,
            subject: `Manifestação recebida - ${protocolo}`,
            htmlContent: confirmationEmailHtml({ protocolo, nome }),
            textContent: `Manifestação recebida. Seu protocolo é ${protocolo}. Guarde este código para acompanhar sua manifestação.`
          });
        }
        return json({ ok: true, protocolo }, 201);
      }

      const publicManifestationMatch = path.match(/^\/api\/manifestacoes\/([^/]+)$/);
      if (publicManifestationMatch && request.method === "GET") {
        const protocolo = normalizeProtocol(decodeURIComponent(publicManifestationMatch[1]));
        const row = await env.DB.prepare("SELECT * FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!row) return json({ message: "Protocolo não encontrado." }, 404);
        const { results: mensagens } = await env.DB.prepare("SELECT id, autor, mensagem, criado_em FROM mensagens WHERE protocolo = ? ORDER BY criado_em ASC").bind(protocolo).all();
        return json({ manifestacao: publicManifestation(row), mensagens: mensagens || [] });
      }

      const messageMatch = path.match(/^\/api\/manifestacoes\/([^/]+)\/mensagens$/);
      if (messageMatch && request.method === "POST") {
        const protocolo = normalizeProtocol(decodeURIComponent(messageMatch[1]));
        const row = await env.DB.prepare("SELECT protocolo FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!row) return json({ message: "Protocolo não encontrado." }, 404);
        const body = await readJson(request);
        const mensagem = sanitizeText(body.mensagem, 1000);
        if (!mensagem) return json({ message: "Digite uma mensagem." }, 400);
        const t = nowISO();
        await env.DB.prepare("INSERT INTO mensagens (protocolo, autor, mensagem, criado_em) VALUES (?, 'aluno', ?, ?)").bind(protocolo, mensagem, t).run();
        await env.DB.prepare("UPDATE manifestacoes SET atualizado_em = ? WHERE protocolo = ?").bind(t, protocolo).run();
        return json({ ok: true }, 201);
      }

      if (path === "/api/admin/manifestacoes" && request.method === "GET") {
        const authError = await requireAdmin(request, env); if (authError) return authError;
        const { results } = await env.DB.prepare("SELECT * FROM manifestacoes ORDER BY criado_em DESC").all();
        return json({ manifestacoes: (results || []).map(adminManifestation) });
      }

      const adminOneMatch = path.match(/^\/api\/admin\/manifestacoes\/([^/]+)$/);
      if (adminOneMatch && request.method === "GET") {
        const authError = await requireAdmin(request, env); if (authError) return authError;
        const protocolo = normalizeProtocol(decodeURIComponent(adminOneMatch[1]));
        const row = await env.DB.prepare("SELECT * FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!row) return json({ message: "Manifestação não encontrada." }, 404);
        const { results: mensagens } = await env.DB.prepare("SELECT id, autor, mensagem, criado_em FROM mensagens WHERE protocolo = ? ORDER BY criado_em ASC").bind(protocolo).all();
        return json({ manifestacao: adminManifestation(row), mensagens: mensagens || [] });
      }
      if (adminOneMatch && request.method === "PUT") {
        const authError = await requireAdmin(request, env); if (authError) return authError;
        const protocolo = normalizeProtocol(decodeURIComponent(adminOneMatch[1]));
        const current = await env.DB.prepare("SELECT * FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!current) return json({ message: "Manifestação não encontrada." }, 404);
        const body = await readJson(request);
        const status = sanitizeText(body.status || current.status || "Recebida", 60);
        const resposta = sanitizeText(body.resposta, 1000);
        const observacaoInterna = sanitizeText(body.observacaoInterna, 500);
        const t = nowISO();
        const respostaMudou = resposta && resposta !== (current.resposta || "");
        await env.DB.prepare(`
          UPDATE manifestacoes
          SET status = ?, resposta = ?, observacao_interna = ?, atualizado_em = ?, respondido_em = CASE WHEN ? != '' THEN ? ELSE respondido_em END
          WHERE protocolo = ?
        `).bind(status, resposta, observacaoInterna, t, resposta, t, protocolo).run();
        if (respostaMudou) {
          await env.DB.prepare("INSERT INTO mensagens (protocolo, autor, mensagem, criado_em) VALUES (?, 'admin', ?, ?)").bind(protocolo, resposta, t).run();
          await notifyStudentAnswer(env, { ...current, protocolo, status, resposta });
        }
        return json({ ok: true });
      }

      return json({ message: "Rota não encontrada." }, 404);
    } catch (error) {
      console.error("Erro interno:", error);
      return json({ message: "Erro interno no servidor." }, 500);
    }
  }
};