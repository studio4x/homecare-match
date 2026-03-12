// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"
import { enqueueUserWhatsappNotification } from "../_shared/whatsapp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    
    const authHeader = req.headers.get('Authorization')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(token)

    const { status, reason, userName, userEmail, userId } = await req.json()

    // Notificação no painel do usuário
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: status === 'approved' ? "✅ Documentos Aprovados!" : "⚠️ Documentos Rejeitados",
      content: status === 'approved' 
        ? "Parabéns! Seus documentos foram validados e você agora possui o selo de verificado." 
        : `Infelizmente sua verificação não foi aprovada. Motivo: ${reason}. Por favor, reenvie seus dados.`,
      link: "/dashboard/perfil",
      type: status === 'approved' ? 'success' : 'error'
    });

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.id,
      action_type: status === 'approved' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      target_id: userId,
      details: status === 'approved' 
        ? `Aprovou os documentos de: ${userName} (${userEmail})` 
        : `Reprovou os documentos de: ${userName} (${userEmail}). Motivo: ${reason}`
    })

    try {
      await enqueueUserWhatsappNotification({
        supabaseAdmin,
        userId,
        eventType: status === "approved" ? "verification_approved_user" : "verification_rejected_user",
        templateParams:
          status === "approved"
            ? [
                String(userName || "Usuario"),
                "sua verificacao foi aprovada",
                "/dashboard/perfil",
              ]
            : [
                String(userName || "Usuario"),
                "sua verificacao foi reprovada",
                String(reason || "Consulte o painel para detalhes"),
              ],
        payload: {
          status,
          reason: reason || null,
          userEmail: userEmail || null,
        },
      });
    } catch (waError) {
      console.warn("[verification-result] falha ao enfileirar WhatsApp:", waError?.message || waError);
    }

    // Envio de e-mail para o profissional
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpPort = Deno.env.get('SMTP_PORT');

    if (smtpHost && smtpUser && smtpPass && smtpPort) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465", // true for 465, false for other ports
        auth: { user: smtpUser, pass: smtpPass },
      });

      let emailSubject = "";
      let emailHtml = "";

      if (status === 'approved') {
        emailSubject = "✅ Sua Verificação de Perfil Foi Aprovada!";
        emailHtml = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #28a745;">Parabéns, ${userName}!</h2>
            <p>Temos uma ótima notícia! Seus documentos foram validados com sucesso pela nossa equipe.</p>
            <p>Seu perfil agora possui o <strong>Selo de Verificado</strong>, o que aumenta sua credibilidade e visibilidade na plataforma HomeCare Match.</p>
            <p>Você já pode acessar seu painel para conferir:</p>
            <p><a href="${Deno.env.get('SITE_URL')}/dashboard/perfil" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Ir para Meu Perfil</a></p>
            <p>Agradecemos a sua paciência e confiança!</p>
            <p>Atenciosamente,<br>Equipe HomeCare Match</p>
          </div>
        `;
      } else { // status === 'rejected'
        emailSubject = "⚠️ Sua Verificação de Perfil Foi Rejeitada";
        emailHtml = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #dc3545;">Olá, ${userName}!</h2>
            <p>Informamos que sua solicitação de verificação de perfil foi rejeitada.</p>
            <p><strong>Motivo da rejeição:</strong> ${reason || 'Não especificado.'}</p>
            <p>Para que possamos aprovar seu perfil, por favor, acesse a seção "Meus Dados" no seu painel, corrija as informações ou reenvie os documentos necessários.</p>
            <p><a href="${Deno.env.get('SITE_URL')}/dashboard/perfil" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Acessar Meu Perfil</a></p>
            <p>Se precisar de ajuda, entre em contato com nosso suporte.</p>
            <p>Atenciosamente,<br>Equipe HomeCare Match</p>
          </div>
        `;
      }

      await transporter.sendMail({
        from: `"HomeCare Match" <${smtpUser}>`,
        to: userEmail,
        subject: emailSubject,
        html: emailHtml,
      });
    } else {
      console.warn("[verification-result] Variáveis SMTP não configuradas. E-mail para o profissional não enviado.");
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error("[verification-result] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
