// supabase/functions/_shared/onboarding-helpers.ts

export const SITE_URL = Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";

export function replacePlaceholders(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    // For first_name, we might want to ensure it has a space before it if it's not empty and following 'Olá'
    // But the user wants it simple. Let's stick to simple replacement.
    result = result.replace(placeholder, value || "");
  }
  return result;
}

export function wrapLayout(content: string, siteUrl: string, ctaLabel?: string, ctaUrl?: string): string {
  // Check if content already looks like full HTML
  if (content.includes("<!DOCTYPE html>") || content.includes("<html")) return content;

  let bodyContent = content;

  // Convert double newlines to paragraphs if not HTML
  if (!bodyContent.includes("<p>") && !bodyContent.includes("<div")) {
    bodyContent = bodyContent.split(/\n\s*\n/).map(p => {
        const trimmed = p.trim();
        if (!trimmed) return "";
        return `<p style="margin-bottom: 16px;">${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).filter(p => p !== "").join("");
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: #2563eb; padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; }
    .content { padding: 40px; font-size: 16px; }
    .footer { background-color: #f9fafb; padding: 32px 20px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .button-container { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f3f4f6; }
    .button { display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s; }
    a { color: #2563eb; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HomeCare Match</h1>
    </div>
    <div class="content">
      ${bodyContent}
      ${ctaLabel && ctaUrl ? `
      <div class="button-container">
        <a href="${ctaUrl}" class="button">${ctaLabel}</a>
      </div>` : ''}
    </div>
    <div class="footer">
      <strong>Equipe HomeCare Match</strong><br>
      A plataforma que conecta quem cuida com quem precisa.<br><br>
      <a href="${siteUrl}" style="color: #6b7280;">${siteUrl.replace('https://', '')}</a>
    </div>
  </div>
</body>
</html>
`;
}
