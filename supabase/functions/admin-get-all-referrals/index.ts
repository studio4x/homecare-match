// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sanitizeStoragePath } from "../_shared/storage-path.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const isUuid = (value: unknown) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

    // 1. Listar pastas dentro de referrals/ (cada pasta é um referrerId)
    const { data: folders, error: folderError } = await supabase.storage.from("uploads").list("referrals", { limit: 100 });
    if (folderError) throw folderError;

    const allLinkReferrals = [];
    const userIdsToFetch = new Set();

    // 2. Percorrer pastas (ignorando arquivos e pastas especiais)
    for (const folder of folders) {
      if (folder.name === ".emptyFolderPlaceholder" || folder.name === "tiers.json" || folder.name === "overrides") continue;

      const referrerId = folder.name;
      if (!isUuid(referrerId)) continue;
      userIdsToFetch.add(referrerId);

      const safeFolderPath = sanitizeStoragePath(`referrals/${referrerId}`, { bucket: "uploads" });
      const { data: files } = await supabase.storage.from("uploads").list(safeFolderPath, { limit: 100 });
      
      if (files) {
        for (const file of files) {
          if (file.name.endsWith(".json")) {
            const newUserId = file.name.replace(".json", "");
            userIdsToFetch.add(newUserId);
            allLinkReferrals.push({
              referrerId,
              newUserId,
              created_at: file.created_at,
              type: 'link'
            });
          }
        }
      }
    }

    // 3. Buscar nomes dos perfis envolvidos
    let profilesMap = {};
    if (userIdsToFetch.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", Array.from(userIdsToFetch));
      
      profiles?.forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    // 4. Formatar resultado final
    const formatted = allLinkReferrals.map(r => ({
      id: `link-${r.newUserId}`,
      referrer_id: r.referrerId,
      referred_name: profilesMap[r.newUserId]?.full_name || "Usuário em conclusão",
      referred_email: profilesMap[r.newUserId]?.email || "N/A",
      // Se for link, assumimos professional se o perfil ainda não existir ou não tiver role
      referred_role: profilesMap[r.newUserId]?.role || "professional", 
      status: 'registered',
      created_at: r.created_at,
      type: 'link',
      referrer: profilesMap[r.referrerId] || { full_name: 'Desconhecido', email: 'N/A' }
    }));

    return new Response(JSON.stringify({ referrals: formatted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
