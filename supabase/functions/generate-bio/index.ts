// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const name = body?.name || "";
    const specialty = body?.specialty || "";
    const experience = body?.experience || "";
    const professional_experiences = body?.professional_experiences || "";
    const city = body?.city || "";
    const state = body?.state || "";

    // Simples geração local (exemplo), substitua por chamada ao provedor de IA se necessário.
    const paragraphs: string[] = [];
    paragraphs.push(`${name} é ${specialty.replace(/-/g, ' ')} atuante${city ? ` em ${city}${state ? `, ${state}` : ""}` : ""}.`);
    if (experience) paragraphs.push(`Formações e qualificações: ${experience}.`);
    if (professional_experiences) paragraphs.push(`Experiências práticas: ${professional_experiences}.`);
    paragraphs.push(`Comprometido(a) com um atendimento humanizado e de alta qualidade.`);

    const bio = paragraphs.join(" ");

    return new Response(JSON.stringify({ bio }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to generate bio" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});