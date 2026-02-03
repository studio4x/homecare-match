// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createTransport } from "npm:nodemailer@6.9.13"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // CONFIGURAÇÃO DO DOMÍNIO
    const SITE_URL = Deno.env.get('SITE_URL') || "https://homecarematch.lovable.app";

    // Verificar configurações SMTP
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[verification-result] Erro: Secrets do SMTP não configuradas!");
      throw new Error("SMTP configuration missing");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !caller) return new Response('Invalid session', { status: 401, headers: corsHeaders })

    const { status, reason, userName, userEmail } = await req.json()
    console.log(`[verification-result] Enviando resultado para: ${userEmail} (${status})`);

    // Configurar Nodemailer
    const transporter = createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || "587"),
      secure: parseInt(smtpPort || "587") === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const isApproved = status === 'approved';
    const subject = isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️";
    
    const actionButton = `
      <div style="margin-top: 25px;">
        <a href="${SITE_URL}/dashboard" style="display:inline-block; padding:12px 24px; background:${isApproved ? '#16a34a' : '#2563eb'}; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">
          Acessar Meu Painel
        </a>
      </div>
    `;
    
    const htmlContent = isApproved 
      ? `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
           <div style="text-align: center; margin-bottom: 20px;">
             <h2 style="color: #10b981;">Parabéns!</h2>
           </div>
           <p>Olá <strong>${userName}</strong>,</p>
           <p>Temos ótimas notícias! Seus documentos foram analisados e aprovados pela nossa equipe.</p>
           <p>Seu perfil agora exibe o selo de <strong>Verificado</strong>, o que transmite muito mais confiança para quem busca seus serviços.</p>
           <div style="margin: 20px 0; padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534;">
             ✅ Perfil Verificado com Sucesso
           </div>
           <p>Continue mantendo seu perfil atualizado!</p>
           ${actionButton}
         </div>` 
      : `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
           <div style="text-align: center; margin-bottom: 20px;">
             <h2 style="color: #ef4444;">Atenção Necessária</h2>
           </div>
           <p>Olá <strong>${userName}</strong>,</p>
           <p>Infelizmente, não pudemos concluir a verificação do seu perfil neste momento.</p>
           <div style="margin: 20px 0; padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
             <p style="margin: 0; font-weight: bold; color: #991b1b;">Motivo da reprovação:</p>
             <p style="margin: 5px 0 0 0; color: #7f1d1d;">${reason}</p>
           </div>
           <p>Não se preocupe! Você pode acessar seu painel, corrigir o problema e enviar os documentos novamente para análise.</p>
           ${actionButton}
         </div>`;

    await transporter.sendMail({
      from: `"HomeCareMatch" <${smtpUser}>`,
      to: userEmail,
      subject: subject,
      html: htmlContent,
    });

    console.log("[verification-result] E-mail enviado com sucesso!");

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[verification-result] Erro fatal:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})