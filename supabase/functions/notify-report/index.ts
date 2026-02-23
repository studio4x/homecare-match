// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { reportId } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: report } = await supabaseAdmin
      .from('reports')
      .select(`*, reported:profiles!reports_reported_id_fkey(full_name, email)`)
      .eq('id', reportId)
      .single();

    // --- NOTIFICAÇÃO NO PAINEL ---
    await supabaseAdmin.from('admin_notifications').insert({
      title: "🚨 Nova Denúncia de Perfil",
      content: `O perfil de ${report.reported.full_name} foi denunciado por: ${report.reason}`,
      link: "/admin/denuncias",
      type: 'error'
    });

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 587,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"Segurança HomeCare Match" <${smtpUser}>`,
        to: "contato@homecarematch.com.br",
        subject: `🚨 Nova Denúncia: ${report.reported.full_name}`,
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2 style="color: #ef4444;">Nova denúncia</h2><p><strong>Perfil:</strong> ${report.reported.full_name}</p><p><strong>Motivo:</strong> ${report.reason}</p></div>`,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})