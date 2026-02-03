// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validar se quem chama é ADMIN
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !caller) return new Response('Invalid session', { status: 401, headers: corsHeaders })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role')
      .eq('id', caller.id)
      .single()

    if (!profile?.is_admin && profile?.role !== 'admin') {
      return new Response('Forbidden: Admin access required', { status: 403, headers: corsHeaders })
    }

    const { status, reason, userName, userEmail } = await req.json()
    
    const isApproved = status === 'approved'
    const subject = isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️"
    
    const htmlContent = isApproved 
      ? `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #16a34a;">Boas notícias, ${userName}!</h2>
          <p>Seu perfil foi verificado com sucesso pela nossa equipe.</p>
          <p>Agora você já possui o selo de confiança e seu perfil aparecerá com destaque nas buscas das empresas.</p>
          <div style="margin-top: 25px;">
            <a href="https://rkjvtnadqkbwomgzyswr.supabase.co/dashboard" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Ir para meu Painel
            </a>
          </div>
        </div>
      `
      : `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #dc2626;">Olá, ${userName}</h2>
          <p>Sua solicitação de verificação não foi aprovada neste momento.</p>
          <div style="margin: 20px 0; padding: 15px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
            <p><strong>Motivo:</strong> ${reason || "Não especificado."}</p>
          </div>
          <p>Por favor, revise seus dados e envie os documentos novamente através do seu painel.</p>
          <div style="margin-top: 25px;">
            <a href="https://rkjvtnadqkbwomgzyswr.supabase.co/dashboard" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Acessar Painel
            </a>
          </div>
        </div>
      `;

    // Configurar cliente SMTP
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST') || "",
        port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
        tls: true,
        auth: {
          user: Deno.env.get('SMTP_USER') || "",
          pass: Deno.env.get('SMTP_PASS') || "",
        },
      },
    });

    // Enviar e-mail para o profissional
    await client.send({
      from: Deno.env.get('SMTP_USER') || "notificacoes@homecarematch.com.br",
      to: userEmail,
      subject: subject,
      content: "text/html",
      html: htmlContent,
    });

    await client.close();
    console.log(`[verification-result] E-mail de ${status} enviado para ${userEmail}`);

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[verification-result] Erro:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})