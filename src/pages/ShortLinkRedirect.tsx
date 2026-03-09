import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { persistShortLinkAttribution } from "@/lib/short-link-attribution";

type ResolveState = "loading" | "not_found" | "error";
const VISITOR_ID_KEY = "hcm_short_link_visitor_id";

const normalizeSlug = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const getOrCreateVisitorId = () => {
  if (typeof window === "undefined" || !window.localStorage) return "";
  try {
    const current = window.localStorage.getItem(VISITOR_ID_KEY);
    if (current) return current;
    const created =
      window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch (_err) {
    return "";
  }
};

const ShortLinkRedirect = () => {
  const { shortSlug = "" } = useParams();
  const [status, setStatus] = useState<ResolveState>("loading");

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const slug = normalizeSlug(shortSlug);
      if (!slug) {
        setStatus("not_found");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("marketing_short_links")
          .select("slug,target_url")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();

        if (error) throw error;
        const targetUrl = String(data?.target_url || "").trim();
        if (!targetUrl) {
          setStatus("not_found");
          return;
        }

        if (!cancelled) {
          persistShortLinkAttribution(slug, targetUrl);

          try {
            await supabase.rpc("track_marketing_short_link_click", {
              p_slug: slug,
              p_visitor_id: getOrCreateVisitorId() || null,
            });
          } catch (trackError) {
            console.warn("[ShortLinkRedirect] click tracking warning:", trackError);
          }

          window.location.replace(targetUrl);
        }
      } catch (error) {
        console.error("[ShortLinkRedirect] resolve error:", error);
        if (!cancelled) setStatus("error");
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [shortSlug]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecionando link curto...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <LinkIcon className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Link curto indisponivel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "error"
            ? "Nao foi possivel resolver este link agora."
            : "Este link nao existe ou foi desativado."}
        </p>
        <Link to="/" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
          Voltar para a Home
        </Link>
      </div>
    </div>
  );
};

export default ShortLinkRedirect;
