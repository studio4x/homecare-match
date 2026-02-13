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

  console.log("[referral-stats] Iniciando busca de estatísticas...");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const referrerId = body?.referrerId;
  if (!referrerId) {
    return new Response(JSON.stringify({ error: "referrerId_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Lista arquivos de referrals/referrerId
  const { data: files, error: listError } = await supabaseAdmin.storage.from("uploads").list(`referrals/${referrerId}`, { limit: 1000 });
  
  if (listError) {
    console.error("[referral-stats] Erro ao listar storage:", listError);
    return new Response(JSON.stringify({ error: "list_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // Filtra apenas arquivos .json (ignora placeholders e pastas)
  const referralFiles = (files || []).filter(f => f.name.endsWith('.json'));
  const count = referralFiles.length;
  const referredIds = referralFiles.map(f => f.name.replace('.json', ''));

  console.log(`[referral-stats] Encontradas ${count} indicações para o usuário ${referrerId}`);

  // 2. Busca dados básicos dos usuários indicados que já possuem perfil
  let registeredUsers = [];
  if (referredIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, created_at, role')
      .in('id', referredIds)
      .order('created_at', { ascending: false });
    
    if (profilesError) {
      console.error("[referral-stats] Erro ao buscar perfis:", profilesError);
    } else {
      registeredUsers = profiles || [];
    }
  }

  // 3. Carrega tiers de configuração
  let tiers: any[] = [];
  const { data: tiersFile } = await supabaseAdmin.storage.from("uploads").download("referrals/tiers.json");
  if (tiersFile) {
    try {
      const text = await tiersFile.text();
      tiers = JSON.parse(text);
    } catch (e) {
      console.warn("[referral-stats] tiers.json inválido ou inexistente");
    }
  }

  // 4. Determina Tier Atual e Próximo
  let currentTier = null;
  let nextTier = null;

  // Checa override manual primeiro
  const { data: overrideFile } = await supabaseAdmin.storage.from("uploads").download(`referrals/overrides/${referrerId}.json`);
  if (overrideFile) {
    try {
      const overrideText = await overrideFile.text();
      const overrideTier = JSON.parse(overrideText);
      if (overrideTier && overrideTier.badge_label) {
        currentTier = overrideTier;
      }
    } catch {
      // ignore
    }
  }

  // Se não houver override, calcula baseado nos tiers globais
  if (!currentTier && tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    for (const t of sorted) {
      if (count >= t.threshold) {
        currentTier = t;
      } else if (!nextTier) {
        nextTier = t;
      }
    }
  }

  // Se ainda não definiu o próximo tier (ex: já está no último), tenta pegar o primeiro que o usuário ainda não atingiu
  if (!nextTier && tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    for (const t of sorted) {
      if (count < t.threshold) {
        nextTier = t;
        break;
      }
    }
  }

  return new Response(JSON.stringify({ 
    count, 
    currentTier, 
    nextTier, 
    registeredUsers 
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});