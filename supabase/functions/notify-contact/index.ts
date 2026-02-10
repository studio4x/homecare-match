// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createTransport } from "https://esm.sh/nodemailer@6.9.13"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_SITE_URL = "https://homecarematch.com.br";

serve(async (req) => {
  console.log("[notify-contact] Função iniciada.");

  if (req.method === 'OPTIONS') {
    console.log("[notify-contact] Recebida requisição OPTIONS.");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;
    console.log(`[notify-contact] URL do site configurada para: ${SITE_URL}`);

    // Validar SMTP
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[notify-contact] Erro crítico: Secrets do SMTP não configuradas!");
      throw new Error("SMTP configuration missing");
    }
    console.log("[notify-contact] Configurações SMTP encontradas.");

    // Validar o chamador da função
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[notify-contact] Erro de autenticação: Cabeçalho de autorização ausente.");
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !caller) {
      console.error("[notify-contact] Erro de autenticação: Token inválido.", authError);
      return new Response('Invalid token', { status: 401, headers: corsHeaders });
    }
    console.log(`[notify-contact] Chamador validado: ${caller.id}`);

    const { professional_id, sender_id } = await req.json();
    if (!professional_id || !sender_id) {
      console.error("[notify-contact] Erro de payload: IDs ausentes.", { professional_id, sender_id });
      return new Response('IDs do profissional e do remetente são obrigatórios', { status: 400, headers: corsHeaders });
    }
    console.log(`[notify-contact] IDs recebidos: professional=${professional_id}, sender=${sender_id}`);

    // Buscar dados do profissional (destinatário)
    const { data: professional, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', professional_id)
      .single();
    if (profError || !professional) {
      console.error(`[notify-contact] Erro ao buscar profissional ${professional_id}:`, profError);
      throw new Error(`Profissional não encontrado: ${professional_id}`);
    }
    console.log(`[notify-contact] Destinatário encontrado: ${professional.full_name} (${professional.email})`);

    // Buscar dados do remetente (empresa/família)
    const { data: sender, error: senderError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role, city, state, bio')
      .eq('id', sender_id)
      .single();
    if (senderError || !sender) {
      console.error(`[notify-contact] Erro ao buscar remetente ${sender_id}:`, senderError);
      throw new Error(`Remetente não encontrado: ${sender_id}`);
    }
    console.log(`[notify-contact] Remetente encontrado: ${sender.full_name}`);

    const transporter = createTransport({
      host: smtpHost,
      port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
      secure: parseInt(Deno.env.get('SMTP_PORT') || "587") === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    console.log("[notify-contact] Transportador de e-mail configurado.");

    const senderRoleText = sender.role === 'company' ? 'a empresa' : 'a família';
    const senderProfileLink = `${SITE_URL}/recruiter/${sender_id}`;

    const mailOptions = {
      from: `"HomeCare Match" <${smtpUser}>`,
      to: professional.email,
      subject: `🎉 Boa notícia! Você recebeu um novo contato!`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb;">Olá, ${professional.full_name}!</h2>
          <p>Temos uma ótima notícia: ${senderRoleText} <strong>${sender.full_name}</strong> demonstrou interesse no seu perfil e adicionou você à lista de contatos.</p>
          <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
            <p><strong>Localização:</strong> ${sender.city || 'Não informado'} - ${sender.state || 'Não informado'}</p>
            <p><strong>Sobre:</strong> ${sender.bio || 'Nenhuma descrição fornecida.'}</p>
          </div>
          <p>Acesse o perfil para ver mais detalhes e se preparar para um possível contato.</p>
          <div style="margin-top: 20px;">
            <a href="${senderProfileLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">
              Ver Perfil do Recrutador
            </a>
          </div>
        </div>
      `,
    };

    console.log(`[notify-contact] Tentando enviar e-mail para ${professional.email}...`);
    await transporter.sendMail(mailOptions);
    console.log("[notify-contact] E-mail enviado com sucesso!");

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error("[notify-contact] Erro crítico na execução da função:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})