// supabase/functions/_shared/email-provider.ts
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  provider?: string;
}

export async function sendEmail({ to, subject, html, text, provider }: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // We decouple the provider. We check ENV vars.
  const activeProvider = provider || Deno.env.get("EMAIL_PROVIDER") || "resend";
  const fromEmail = Deno.env.get("EMAIL_FROM") || "noreply@homecarematch.com.br";
  const fromName = Deno.env.get("EMAIL_FROM_NAME") || "HomeCare Match";
  const apiKey = Deno.env.get("EMAIL_PROVIDER_API_KEY");

  // Mock logging for Phase 1 if no API key is provided
  if (!apiKey || activeProvider === "mock") {
    console.log(`[EmailProvider:Mock] Mocking send to ${to}`);
    console.log(`[EmailProvider:Mock] Subject: ${subject}`);
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  try {
    if (activeProvider === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to,
          subject,
          html,
          text: text || "Ative HTML para ler esta mensagem.",
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        return { success: false, error: `Resend HTTP ${response.status}: ${errorData}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.id };
    }

    // fallback unknown
    return { success: false, error: "Unknown provider or not implemented yet." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
