// supabase/functions/_shared/email-provider.ts
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
  const activeProvider = provider || Deno.env.get("EMAIL_PROVIDER") || "mock";
  const fromEmail = Deno.env.get("EMAIL_FROM") || "noreply@homecarematch.com.br";
  const fromName = Deno.env.get("EMAIL_FROM_NAME") || "HomeCare Match";
  const apiKey = Deno.env.get("EMAIL_PROVIDER_API_KEY");
  const defaultReplyTo = Deno.env.get("EMAIL_REPLY_TO");
  
  const finalReplyTo = replyTo || defaultReplyTo;

  if (!apiKey && activeProvider !== "mock") {
    console.warn(`[EmailProvider] Chave API ausente para o provider '${activeProvider}'. Usando mock local como fallback.`);
  }

  // Falback para Mock
  if (!apiKey || activeProvider === "mock") {
    console.log(`[EmailProvider:Mock] Mocking send to ${to}`);
    console.log(`[EmailProvider:Mock] Subject: ${subject}`);
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  try {
    // Adapter para Brevo (Sendinblue)
    if (activeProvider === "brevo") {
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
    if (activeProvider === "resend") {
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

    return { success: false, error: "Unknown provider requested." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
