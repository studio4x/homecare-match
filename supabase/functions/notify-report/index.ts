// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br";
const DEFAULT_SITE_URL = "https://www.homecarematch.com.br";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { reportId } = await req.json();
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados da denúncia
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select(`
        *,
        reporter:profiles!reports_reporter_id_fkey(full_name, email),
        reported:profiles!reports_reported_id_fkey(full_name, email)
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !report) throw new Error("Denúncia não encontrada");

    // Configurar SMTP
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpPort = Deno.env.get('SMTP_PORT') || "587";

    if (!smtpHost || !smtpUser || !smtpPass) throw new Error("SMTP configuration missing");

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpPort === "465",
      auth: { user: smtpUser, pass: smtpPass },
    });

    const adminLink = `${SITE_URL}/admin/denuncias`;

    await transporter.sendMail({
      from: `"Segurança HomeCare Match" <${smtpUser}>`,
      to: MASTER_ADMIN_EMAIL,
      subject: `🚨 Nova Denúncia de Perfil: ${report.reported.full_name}`,
      html: `
        <div style="font-family: sans-serif; color: #1e293b; padding: 20px;">
          <h2 style="color: #ef4444;">Nova denúncia recebida</h2>
          <p><strong>Perfil Denunciado:</strong> ${report.reported.full_name} (${report.reported.email})</p>
          <p><strong>Motivo:</strong> ${report.reason}</p>
          <p><strong>Descrição:</strong> ${report.description || 'Sem detalhes adicionais.'}</p>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #e2e8f0;" />
          <p><strong>Denunciante:</strong> ${report.reporter?.full_name || 'Anônimo'} (${report.reporter?.email || 'N/A'})</p>
          <div style="margin-top: 30px;">
            <a href="${adminLink}" style="display:inline-block; padding:12px 24px; background:#ef4444; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Analisar no Painel Admin</a>
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error("[notify-report] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})