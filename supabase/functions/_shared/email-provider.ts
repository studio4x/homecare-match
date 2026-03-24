// supabase/functions/_shared/email-provider.ts
import nodemailer from "npm:nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  provider?: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, text, provider, replyTo }: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Configurações unificadas do provedor
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpPort = Deno.env.get("SMTP_PORT");
  
  let activeProvider = provider || Deno.env.get("EMAIL_PROVIDER");
  
  // Se nenhum provider explícito e temos SMTP configurado, usa SMTP como padrão
  if (!activeProvider && smtpHost && smtpUser) {
    activeProvider = "smtp";
  }
  
  activeProvider = activeProvider || "mock";

  const fromEmail = Deno.env.get("EMAIL_FROM") || smtpUser || "noreply@homecarematch.com.br";
  const fromName = Deno.env.get("EMAIL_FROM_NAME") || "HomeCare Match";
  const apiKey = Deno.env.get("EMAIL_PROVIDER_API_KEY");
  const defaultReplyTo = Deno.env.get("EMAIL_REPLY_TO");
  
  const finalReplyTo = replyTo || defaultReplyTo;

  // Falback para Mock se não houver configs suficientes
  if (activeProvider === "mock" || (!apiKey && (activeProvider === "brevo" || activeProvider === "resend"))) {
    console.log(`[EmailProvider:Mock] Mocking send to ${to} (Provider: ${activeProvider})`);
    console.log(`[EmailProvider:Mock] Subject: ${subject}`);
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  try {
    // Adapter para SMTP (Nodemailer)
    if (activeProvider === "smtp") {
      if (!smtpHost || !smtpUser || !smtpPass || !smtpPort) {
         return { success: false, error: "Configurações SMTP incompletas (HOST, USER, PASS, PORT)." };
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number.parseInt(smtpPort, 10),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        text: text || "Ative HTML para ler esta mensagem.",
        replyTo: finalReplyTo,
      });

      return { success: true, messageId: info.messageId };
    }

    // Adapter para Brevo (Sendinblue)
    if (activeProvider === "brevo" && apiKey) {
      const payload: any = {
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text || "Ative HTML para ler esta mensagem.",
      };

      if (finalReplyTo) {
        payload.replyTo = { email: finalReplyTo };
      }

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        return { success: false, error: `Brevo HTTP ${response.status}: ${errorData}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.messageId };
    }

    // Adapter para Resend
    if (activeProvider === "resend" && apiKey) {
      const payload: any = {
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        html,
        text: text || "Ative HTML para ler esta mensagem.",
      };

      if (finalReplyTo) {
        payload.reply_to = finalReplyTo;
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        return { success: false, error: `Resend HTTP ${response.status}: ${errorData}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.id };
    }

    return { success: false, error: `Unknown or unconfigured provider requested: ${activeProvider}` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
