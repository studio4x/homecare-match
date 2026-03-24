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
        return `<div style="padding-bottom: 16px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #374151;">${trimmed.replace(/\n/g, '<br>')}</div>`;
    }).filter(p => p !== "").join("");
  }

  // Post-process HTML content to ensure Outlook compatibility for common tags
  // 1. Ensure links have the theme color and look professional
  // We use a regex that handles both <a> and <a href="..."> but avoids doubling up if a style already exists
  bodyContent = bodyContent.replace(/<a\s+(?![^>]*style=)/gi, '<a style="color: #2563eb; text-decoration: underline;" ');
  
  // 2. Fix paragraphs (Outlook ignores margins frequently, using padding/div is safer or forcing margin:0)
  const pStyle = 'margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #374151;';
  bodyContent = bodyContent.replace(/<p\s*>(?![^>]*style=)/gi, `<p style="${pStyle}">`);
  bodyContent = bodyContent.replace(/<p\s+(?![^>]*style=)/gi, `<p style="${pStyle}" `);

  // 3. Fix Lists for Outlook
  bodyContent = bodyContent.replace(/<ul\s*>(?![^>]*style=)/gi, '<ul style="margin: 0 0 16px 20px; padding: 0; list-style-type: disc;">');
  bodyContent = bodyContent.replace(/<ol\s*>(?![^>]*style=)/gi, '<ol style="margin: 0 0 16px 20px; padding: 0; list-style-type: decimal;">');
  bodyContent = bodyContent.replace(/<li\s*>(?![^>]*style=)/gi, '<li style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #374151;">');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    div[style*="margin: 16px 0;"] { margin: 0 !important; }
  </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; background-color: #f3f4f6;">
  <!--[if (gte mso 9)|(IE)]>
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
    <tr>
      <td align="center" valign="top" width="600">
  <![endif]-->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
    <tr>
      <td align="center" style="background-color: #f3f4f6; padding: 40px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; border-collapse: separate;">
          <!-- HEADER -->
          <tr>
            <td align="center" valign="top" style="background-color: #2563eb; padding: 40px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">HomeCare Match</h1>
            </td>
          </tr>
          <!-- CONTENT -->
          <tr>
            <td align="left" style="padding: 40px; background-color: #ffffff;">
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #374151;">
                ${bodyContent}
                
                ${ctaLabel && ctaUrl ? `
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f3f4f6; text-align: center;">
                  <!-- HIGH COMPATIBILITY CTA BUTTON -->
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" href="${ctaUrl}" style="height:54px;v-text-anchor:middle;width:260px;" arcsize="15%" stroke="f" fillcolor="#2563eb">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">
                  <![endif]-->
                      <a href="${ctaUrl}" target="_blank" style="background-color:#2563eb;border-radius:8px;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:54px;text-align:center;text-decoration:none;width:260px;-webkit-text-size-adjust:none;">
                        ${ctaLabel}
                      </a>
                  <!--[if mso]>
                    </center>
                  </v:roundrect>
                  <![endif]-->

                  <!-- FALLBACK FOR NON-MSO THAT DON'T SUPPORT THE ABOVE -->
                  <!--[if !mso]><!-->
                  <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: separate; mso-hide:all; display:none;">
                    <tr>
                      <td align="center" bgcolor="#2563eb" style="border-radius: 8px; mso-hide:all;">
                        <a href="${ctaUrl}" target="_blank" style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 32px; display: inline-block; border-radius: 8px; background-color: #2563eb; mso-hide:all;">
                          ${ctaLabel}
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!--<![endif]-->
                </div>` : ''}
              </div>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td align="center" style="background-color: #f9fafb; padding: 32px 20px; border-top: 1px solid #e5e7eb;">
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6b7280; line-height: 1.5;">
                <strong style="color: #374151;">Equipe HomeCare Match</strong><br>
                A plataforma que conecta quem cuida com quem precisa.<br><br>
                <a href="${siteUrl}" style="color: #6b7280; text-decoration: underline;">${siteUrl.replace('https://', '')}</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <!--[if (gte mso 9)|(IE)]>
      </td>
    </tr>
  </table>
  <![endif]-->
</body>
</html>`;
}
