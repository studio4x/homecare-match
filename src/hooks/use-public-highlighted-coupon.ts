import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicHighlightedCoupon {
  id: string;
  code: string;
  free_days: number;
  target_tier: string;
  show_publicly: boolean;
  highlight_on_monthly_plan: boolean;
  public_label: string | null;
  public_title: string | null;
  public_description: string | null;
  display_priority: number;
  eligible_audience: string | null;
  campaign_badge: string | null;
  current_uses: number;
  max_uses: number;
}

/**
 * Returns the single public highlighted coupon that is currently active and eligible.
 *
 * Selection rules (in order):
 *  1. show_publicly = true
 *  2. is_active = true
 *  3. current_uses < max_uses  (filtered client-side after a small batch)
 *  4. eligible_audience IS NULL OR eligible_audience matches the given audience
 *  5. Ordered by display_priority DESC → created_at DESC → id ASC (stable)
 *  6. Only the first result is returned
 */
export function usePublicHighlightedCoupon(audience?: string) {
  return useQuery<PublicHighlightedCoupon | null>({
    queryKey: ["public-highlighted-coupon", audience ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("coupons")
        .select(
          [
            "id",
            "code",
            "free_days",
            "target_tier",
            "show_publicly",
            "highlight_on_monthly_plan",
            "public_label",
            "public_title",
            "public_description",
            "display_priority",
            "eligible_audience",
            "campaign_badge",
            "current_uses",
            "max_uses",
          ].join(", ")
        )
        .eq("show_publicly", true)
        .eq("is_active", true)
        .order("display_priority", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(20); // small batch; filter uses client-side

      if (audience) {
        // Accept coupons with no audience restriction OR matching the given audience
        query = query.or(
          `eligible_audience.is.null,eligible_audience.eq.,eligible_audience.eq.${audience}`
        );
      } else {
        // No audience argument: accept coupons with no restriction (null or empty)
        query = query.or(
          `eligible_audience.is.null,eligible_audience.eq.`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      // Final client-side filter: current_uses < max_uses
      const eligible = (data || []).find(
        (c: any) => (c.current_uses ?? 0) < (c.max_uses ?? Infinity)
      ) as PublicHighlightedCoupon | undefined;

      return eligible ?? null;
    },
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
  });
}
