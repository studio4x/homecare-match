"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import {
  CohortsTab,
  CheckoutTab,
  CommercialTab,
  CoursesFunnelTab,
  CoursesPerformanceTab,
  EngagementTab,
  PaymentsTab,
  SalesTab,
  SegmentsTab,
  SubscriptionsTab,
  SupportImpactTab,
  SupportTab,
} from "@/components/admin/tabs/metrics";

const PAID = new Set(["paid", "succeeded"]);
const CANCELED = new Set(["canceled", "cancelled", "void"]);
const REFUND = new Set(["refunded", "refund_pending"]);
const DEFAULT_RAW = new Set(["OVERDUE", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "REFUND_REQUESTED"]);
const CHECKOUT_PAID = new Set(["CONFIRMED", "RECEIVED", "PAID", "SUCCEEDED"]);
const PERIOD_FILTER_VALUES = ["7d", "30d", "90d", "all", "custom"] as const;
type PeriodFilterValue = (typeof PERIOD_FILTER_VALUES)[number];

const PERIOD_FILTER_LABELS: Record<PeriodFilterValue, string> = {
  "7d": "Ultimos 7 dias",
  "30d": "Ultimos 30 dias",
  "90d": "Ultimos 90 dias",
  all: "Todo periodo",
  custom: "Personalizado",
};

const EMPTY_STATS: any = {
  profileViews: [],
  contactAdditions: [],
  whatsappClicks: [],
  ticketsByUrgency: [],
  ticketsByUserType: [],
  courseSales: { paidRevenue: 0, totalTransactions: 0, paidTransactions: 0, averageTicket: 0, statusBreakdown: [], topByRevenue: [], topByCount: [] },
  planSales: { paidRevenue: 0, totalTransactions: 0, paidTransactions: 0, averageTicket: 0, statusBreakdown: [], topByRevenue: [], topByCount: [] },
  checkoutRows: [],
  checkoutCourse: { started: 0, paid: 0, abandoned: 0, conversionRate: 0 },
  checkoutPlan: { started: 0, paid: 0, abandoned: 0, conversionRate: 0 },
  methodApproval: [],
  installmentDist: [],
  refundDefaultRows: [],
  subscriptionSeries: [],
  cohortRows: [],
  courseFunnelOverall: { purchased: 0, started: 0, completed: 0, certified: 0 },
  courseFunnelRows: [],
  coursePerformanceRows: [],
  commercialFunnel: [],
  commercialRates: [],
  segmentRoles: [],
  segmentCities: [],
  segmentStates: [],
  segmentTiers: [],
  supportVolumeImpact: [],
  supportSlaImpact: [],
};

const isPaid = (status?: string | null) => PAID.has(String(status || "").toLowerCase().trim());
const isCanceled = (status?: string | null) => CANCELED.has(String(status || "").toLowerCase().trim());
const isRefund = (status?: string | null) => REFUND.has(String(status || "").toLowerCase().trim());
const isDefault = (rawStatus?: string | null) => DEFAULT_RAW.has(String(rawStatus || "").toUpperCase().trim());

const isCheckoutPaid = (paymentStatus?: string | null, status?: string | null) => {
  const p = String(paymentStatus || "").toUpperCase().trim();
  const s = String(status || "").toUpperCase().trim();
  return CHECKOUT_PAID.has(p) || CHECKOUT_PAID.has(s);
};

const monthKey = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d);
};

const monthsBack = (count: number) => {
  const now = new Date();
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};

const addMonthsToKey = (key: string, offset: number) => {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const parseDateInput = (value: string, endOfDay = false) => {
  const [year, month, day] = String(value || "")
    .split("-")
    .map((part) => Number(part));
  if (!year || !month || !day) return null;
  if (endOfDay) return new Date(year, month - 1, day, 23, 59, 59, 999);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const resolveFilterRange = (preset: PeriodFilterValue, customFrom: string, customTo: string) => {
  if (preset === "all") {
    return {
      from: null as Date | null,
      to: null as Date | null,
      label: PERIOD_FILTER_LABELS.all,
    };
  }

  if (preset === "custom") {
    const from = parseDateInput(customFrom, false);
    const to = parseDateInput(customTo, true);
    if (from && to && from.getTime() > to.getTime()) {
      return {
        from: to,
        to: from,
        label: `${PERIOD_FILTER_LABELS.custom}: ${customTo} ate ${customFrom}`,
      };
    }
    return {
      from,
      to,
      label: `${PERIOD_FILTER_LABELS.custom}: ${customFrom || "..."} ate ${customTo || "..."}`,
    };
  }

  const daysMap: Record<Exclude<PeriodFilterValue, "all" | "custom">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const days = daysMap[preset];
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  return {
    from,
    to: now,
    label: PERIOD_FILTER_LABELS[preset],
  };
};

const withinRange = (value: string | null | undefined, from: Date | null, to: Date | null) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date.getTime() < from.getTime()) return false;
  if (to && date.getTime() > to.getTime()) return false;
  return true;
};

const methodLabel = (value?: string | null) => {
  const m = String(value || "").toLowerCase();
  if (m === "credit_card") return "Cartao";
  if (m === "pix") return "PIX";
  if (m === "boleto") return "Boleto";
  return "Nao informado";
};

const productLabel = (type?: string | null) => {
  if (type === "course") return "Curso";
  if (type === "plan") return "Plano";
  return "Outros";
};

const cleanName = (value: string, fallback: string) =>
  String(value || "")
    .replace(/parcela\s+\d+\s+de\s*\d+\.?/gi, "")
    .replace(/parcelamento\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*[-:]*\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || fallback;

const statusBucket = (status: string) => {
  const s = String(status || "").toLowerCase().trim();
  if (s === "paid" || s === "succeeded") return "Pago";
  if (s === "open") return "Pendente";
  if (s === "refund_pending") return "Estorno pendente";
  if (s === "refunded") return "Estornado";
  if (s === "canceled" || s === "cancelled" || s === "void") return "Cancelado";
  return "Outros";
};

const buildSales = (payments: any[], type: "course" | "plan", fallbackName: string) => {
  const scoped = payments.filter((p) => p.transaction_type === type);
  if (!scoped.length) return { paidRevenue: 0, totalTransactions: 0, paidTransactions: 0, averageTicket: 0, statusBreakdown: [], topByRevenue: [], topByCount: [] };

  const revenueByItem = new Map<string, number>();
  const countByItem = new Map<string, number>();
  const statusMap = new Map<string, number>();
  let paidRevenue = 0;
  let paidTransactions = 0;

  scoped.forEach((p) => {
    const bucket = statusBucket(p.status);
    statusMap.set(bucket, (statusMap.get(bucket) || 0) + 1);
    if (!isPaid(p.status)) return;

    const name = cleanName(p.item_name, fallbackName);
    const amount = Number(p.amount || 0);
    paidRevenue += amount;
    paidTransactions += 1;
    revenueByItem.set(name, (revenueByItem.get(name) || 0) + amount);
    countByItem.set(name, (countByItem.get(name) || 0) + 1);
  });

  return {
    paidRevenue: Number(paidRevenue.toFixed(2)),
    totalTransactions: scoped.length,
    paidTransactions,
    averageTicket: paidTransactions ? Number((paidRevenue / paidTransactions).toFixed(2)) : 0,
    statusBreakdown: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    topByRevenue: Array.from(revenueByItem.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10),
    topByCount: Array.from(countByItem.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
  };
};

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(EMPTY_STATS);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>("30d");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [analyticsSource, setAnalyticsSource] = useState<{
    payments: any[];
    checkouts: any[];
    progress: any[];
    certs: any[];
    modules: any[];
    lessons: any[];
    courses: any[];
  }>({
    payments: [],
    checkouts: [],
    progress: [],
    certs: [],
    modules: [],
    lessons: [],
    courses: [],
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [
          viewsRes,
          interactionsRes,
          clicksRes,
          ticketsRes,
          messagesRes,
          enrollRes,
          progressRes,
          modulesRes,
          lessonsRes,
          certsRes,
          coursesRes,
          adminRes,
        ] = await Promise.all([
          supabase.from("profile_views").select("profile:profiles(full_name),created_at").limit(10000),
          supabase.from("interactions").select("professional:profiles!interactions_professional_id_fkey(full_name),status,created_at").limit(10000),
          supabase.from("whatsapp_clicks").select("clicker_role,created_at").limit(10000),
          supabase.from("support_tickets").select("id,user_id,status,priority,created_at,updated_at").limit(10000),
          supabase.from("support_messages").select("ticket_id,sender_id,created_at").limit(20000),
          supabase.from("academy_enrollments").select("user_id,course_slug,created_at").limit(20000),
          supabase.from("academy_progress").select("user_id,course_slug,lesson_id,status,updated_at").limit(40000),
          supabase.from("academy_modules").select("id,course_slug").limit(10000),
          supabase.from("academy_lessons").select("id,module_id").limit(30000),
          supabase.from("certificates").select("user_id,course_slug,issued_at").limit(20000),
          supabase.from("academy_courses").select("slug,title").limit(3000),
          supabase.functions.invoke("get-admin-payment-history", {
            body: { max_rows: 50000 },
          }),
        ]);

        const views = viewsRes.data || [];
        const interactions = interactionsRes.data || [];
        const clicks = clicksRes.data || [];
        const tickets = ticketsRes.data || [];
        const messages = messagesRes.data || [];
        const enrollments = enrollRes.data || [];
        const progress = progressRes.data || [];
        const modules = modulesRes.data || [];
        const lessons = lessonsRes.data || [];
        const certs = certsRes.data || [];
        const courses = coursesRes.data || [];
        const payments = Array.isArray((adminRes.data as any)?.payments) ? (adminRes.data as any).payments : [];
        const checkouts = Array.isArray((adminRes.data as any)?.checkouts) ? (adminRes.data as any).checkouts : [];

        setAnalyticsSource({
          payments,
          checkouts,
          progress,
          certs,
          modules,
          lessons,
          courses,
        });

        const courseSales = buildSales(payments, "course", "Curso");
        const planSales = buildSales(payments, "plan", "Plano");

        const viewsMap = new Map<string, number>();
        views.forEach((v: any) => {
          const n = v.profile?.full_name || "Desconhecido";
          viewsMap.set(n, (viewsMap.get(n) || 0) + 1);
        });
        const profileViews = Array.from(viewsMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

        const intMap = new Map<string, number>();
        interactions.forEach((i: any) => {
          const n = i.professional?.full_name || "Desconhecido";
          intMap.set(n, (intMap.get(n) || 0) + 1);
        });
        const contactAdditions = Array.from(intMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

        const clickMap = new Map<string, number>();
        clicks.forEach((c: any) => {
          const role = c.clicker_role === "company" ? "Empresa" : c.clicker_role === "family" ? "Familia" : "Profissional";
          clickMap.set(role, (clickMap.get(role) || 0) + 1);
        });
        const whatsappClicks = Array.from(clickMap.entries()).map(([name, value]) => ({ name, value }));

        const urgencyMap = new Map<string, number>();
        const typeMap = new Map<string, number>();
        const userRoleById = new Map<string, string>();
        payments.forEach((p: any) => { if (p.user_id && p.user_role) userRoleById.set(p.user_id, p.user_role); });
        tickets.forEach((t: any) => {
          const pr = t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "medium" ? "Media" : "Baixa";
          urgencyMap.set(pr, (urgencyMap.get(pr) || 0) + 1);
          const r = userRoleById.get(t.user_id) || "professional";
          const rl = r === "company" ? "Empresa" : r === "family" ? "Familia" : "Profissional";
          typeMap.set(rl, (typeMap.get(rl) || 0) + 1);
        });
        const ticketsByUrgency = Array.from(urgencyMap.entries()).map(([name, value]) => ({ name, value }));
        const ticketsByUserType = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));

        const checkoutSummary: any = {
          course: { started: 0, paid: 0, abandoned: 0, conversionRate: 0 },
          plan: { started: 0, paid: 0, abandoned: 0, conversionRate: 0 },
        };

        checkouts.forEach((c: any) => {
          if (c.transaction_type !== "course" && c.transaction_type !== "plan") return;
          const k = c.transaction_type;
          checkoutSummary[k].started += 1;
          if (isCheckoutPaid(c.payment_status, c.status)) checkoutSummary[k].paid += 1;
        });

        ["course", "plan"].forEach((k) => {
          checkoutSummary[k].abandoned = Math.max(checkoutSummary[k].started - checkoutSummary[k].paid, 0);
          checkoutSummary[k].conversionRate = checkoutSummary[k].started > 0 ? Number(((checkoutSummary[k].paid / checkoutSummary[k].started) * 100).toFixed(2)) : 0;
        });

        const checkoutRows = [
          { name: "Cursos", started: checkoutSummary.course.started, paid: checkoutSummary.course.paid, abandoned: checkoutSummary.course.abandoned },
          { name: "Planos", started: checkoutSummary.plan.started, paid: checkoutSummary.plan.paid, abandoned: checkoutSummary.plan.abandoned },
        ];

        const methodMap = new Map<string, { total: number; paid: number }>();
        const installmentMap = new Map<string, number>();
        const refundMap = new Map<string, { total: number; refunds: number; defaults: number }>();

        payments.forEach((p: any) => {
          const method = methodLabel(p.payment_method);
          const m = methodMap.get(method) || { total: 0, paid: 0 };
          m.total += 1;
          if (isPaid(p.status)) m.paid += 1;
          methodMap.set(method, m);

          if (method === "Cartao" && isPaid(p.status)) {
            const n = Number(p.installment_total || 1);
            const label = n > 1 ? `${n}x` : "1x";
            installmentMap.set(label, (installmentMap.get(label) || 0) + 1);
          }

          const segment = `${productLabel(p.transaction_type)} / ${method}`;
          const r = refundMap.get(segment) || { total: 0, refunds: 0, defaults: 0 };
          r.total += 1;
          if (isRefund(p.status)) r.refunds += 1;
          if (isDefault(p.raw_status)) r.defaults += 1;
          refundMap.set(segment, r);
        });

        const methodApproval = Array.from(methodMap.entries())
          .map(([method, v]) => ({ method, total: v.total, paid: v.paid, approvalRate: v.total > 0 ? Number(((v.paid / v.total) * 100).toFixed(2)) : 0 }))
          .sort((a, b) => b.total - a.total);

        const installmentDist = Array.from(installmentMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => Number(a.name.replace("x", "")) - Number(b.name.replace("x", "")));

        const refundDefaultRows = Array.from(refundMap.entries())
          .map(([segment, v]) => ({
            segment,
            total: v.total,
            refunds: v.refunds,
            defaults: v.defaults,
            refundRate: v.total > 0 ? Number(((v.refunds / v.total) * 100).toFixed(2)) : 0,
            defaultRate: v.total > 0 ? Number(((v.defaults / v.total) * 100).toFixed(2)) : 0,
          }))
          .sort((a, b) => b.total - a.total);

        const months = monthsBack(12);
        const planTx = payments.filter((p: any) => p.transaction_type === "plan");
        const paidPlanTx = planTx.filter((p: any) => isPaid(p.status));

        const revByMonth = new Map<string, number>();
        const paidUsersByMonth = new Map<string, Set<string>>();
        const canceledUsersByMonth = new Map<string, Set<string>>();
        const userMonthRevenue = new Map<string, number>();
        const firstPaidMonth = new Map<string, string>();

        paidPlanTx.forEach((p: any) => {
          if (!p.user_id) return;
          const mk = monthKey(p.date);
          if (!mk || !months.includes(mk)) return;
          revByMonth.set(mk, (revByMonth.get(mk) || 0) + Number(p.amount || 0));
          const users = paidUsersByMonth.get(mk) || new Set<string>();
          users.add(p.user_id);
          paidUsersByMonth.set(mk, users);
          const um = `${p.user_id}::${mk}`;
          userMonthRevenue.set(um, (userMonthRevenue.get(um) || 0) + Number(p.amount || 0));
          const first = firstPaidMonth.get(p.user_id);
          if (!first || mk < first) firstPaidMonth.set(p.user_id, mk);
        });

        planTx.forEach((p: any) => {
          if (!p.user_id || !isCanceled(p.status)) return;
          const mk = monthKey(p.date);
          if (!mk || !months.includes(mk)) return;
          const users = canceledUsersByMonth.get(mk) || new Set<string>();
          users.add(p.user_id);
          canceledUsersByMonth.set(mk, users);
        });

        const subscriptionSeries = months.map((mk, idx) => {
          let newRevenue = 0;
          paidPlanTx.forEach((p: any) => {
            if (!p.user_id) return;
            if (monthKey(p.date) !== mk) return;
            if (firstPaidMonth.get(p.user_id) === mk) newRevenue += Number(p.amount || 0);
          });

          let expansionRevenue = 0;
          if (idx > 0) {
            const prev = months[idx - 1];
            const users = paidUsersByMonth.get(mk) || new Set<string>();
            users.forEach((u) => {
              const cur = userMonthRevenue.get(`${u}::${mk}`) || 0;
              const prv = userMonthRevenue.get(`${u}::${prev}`) || 0;
              if (cur > prv && prv > 0) expansionRevenue += cur - prv;
            });
          }

          const canceledUsers = canceledUsersByMonth.get(mk) || new Set<string>();
          const prevUsers = idx > 0 ? paidUsersByMonth.get(months[idx - 1]) || new Set<string>() : new Set<string>();
          const churnRate = prevUsers.size > 0 ? Number(((canceledUsers.size / prevUsers.size) * 100).toFixed(2)) : 0;

          return {
            month: monthLabel(mk),
            mrr: Number((revByMonth.get(mk) || 0).toFixed(2)),
            newRevenue: Number(newRevenue.toFixed(2)),
            expansionRevenue: Number(expansionRevenue.toFixed(2)),
            canceledUsers: canceledUsers.size,
            churnRate,
          };
        });

        const paidMonthsByUser = new Map<string, Set<string>>();
        paidPlanTx.forEach((p: any) => {
          if (!p.user_id) return;
          const mk = monthKey(p.date);
          if (!mk) return;
          const set = paidMonthsByUser.get(p.user_id) || new Set<string>();
          set.add(mk);
          paidMonthsByUser.set(p.user_id, set);
        });

        const cohortUsers = new Map<string, string[]>();
        firstPaidMonth.forEach((mk, userId) => {
          const users = cohortUsers.get(mk) || [];
          users.push(userId);
          cohortUsers.set(mk, users);
        });

        const cohortRows = Array.from(cohortUsers.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 8)
          .map(([cohort, users]) => {
            const size = users.length || 1;
            const r = (offset: number) => {
              const target = addMonthsToKey(cohort, offset);
              const retained = users.filter((u) => paidMonthsByUser.get(u)?.has(target)).length;
              return Number(((retained / size) * 100).toFixed(2));
            };
            return { cohort: monthLabel(cohort), size: users.length, m0: r(0), m1: r(1), m2: r(2), m3: r(3), m4: r(4), m5: r(5) };
          });

        const moduleToCourse = new Map<string, string>();
        modules.forEach((m: any) => moduleToCourse.set(m.id, m.course_slug));
        const lessonsByCourse = new Map<string, number>();
        lessons.forEach((l: any) => {
          const courseSlug = moduleToCourse.get(l.module_id);
          if (!courseSlug) return;
          lessonsByCourse.set(courseSlug, (lessonsByCourse.get(courseSlug) || 0) + 1);
        });

        const purchasedPairs = new Set<string>();
        payments.forEach((p: any) => {
          if (p.transaction_type !== "course" || !isPaid(p.status) || !p.user_id || !p.course_slug) return;
          purchasedPairs.add(`${p.user_id}::${p.course_slug}`);
        });

        const progressByPair = new Map<string, { started: boolean; completedLessons: Set<string> }>();
        progress.forEach((pr: any) => {
          const key = `${pr.user_id}::${pr.course_slug}`;
          const row = progressByPair.get(key) || { started: false, completedLessons: new Set<string>() };
          if (pr.status === "in-progress" || pr.status === "completed") row.started = true;
          if (pr.status === "completed" && pr.lesson_id) row.completedLessons.add(pr.lesson_id);
          progressByPair.set(key, row);
        });

        const certifiedPairs = new Set<string>();
        certs.forEach((c: any) => certifiedPairs.add(`${c.user_id}::${c.course_slug}`));

        const titleBySlug: Record<string, string> = {};
        courses.forEach((c: any) => { titleBySlug[c.slug] = c.title || c.slug; });

        const courseFunnelMap = new Map<string, { purchased: number; started: number; completed: number; certified: number }>();
        let purchased = 0;
        let started = 0;
        let completed = 0;
        let certified = 0;

        purchasedPairs.forEach((key) => {
          const [, courseSlug] = key.split("::");
          const p = progressByPair.get(key);
          const totalLessons = lessonsByCourse.get(courseSlug) || 0;
          const completedLessons = p?.completedLessons.size || 0;
          const startedFlag = Boolean(p?.started);
          const completedFlag = totalLessons > 0 ? completedLessons >= totalLessons : false;
          const certifiedFlag = certifiedPairs.has(key);

          purchased += 1;
          if (startedFlag) started += 1;
          if (completedFlag) completed += 1;
          if (certifiedFlag) certified += 1;

          const row = courseFunnelMap.get(courseSlug) || { purchased: 0, started: 0, completed: 0, certified: 0 };
          row.purchased += 1;
          if (startedFlag) row.started += 1;
          if (completedFlag) row.completed += 1;
          if (certifiedFlag) row.certified += 1;
          courseFunnelMap.set(courseSlug, row);
        });

        const courseFunnelRows = Array.from(courseFunnelMap.entries())
          .map(([slug, v]) => ({ course: titleBySlug[slug] || slug, purchased: v.purchased, started: v.started, completed: v.completed, certified: v.certified }))
          .sort((a, b) => b.purchased - a.purchased)
          .slice(0, 12);

        const enrollByCourse = new Map<string, number>();
        const firstEnrollDate = new Map<string, string>();
        enrollments.forEach((e: any) => {
          enrollByCourse.set(e.course_slug, (enrollByCourse.get(e.course_slug) || 0) + 1);
          const key = `${e.user_id}::${e.course_slug}`;
          const cur = firstEnrollDate.get(key);
          if (!cur || e.created_at < cur) firstEnrollDate.set(key, e.created_at);
        });

        const certByCourse = new Map<string, number>();
        const certDaysByCourse = new Map<string, { total: number; count: number }>();
        certs.forEach((c: any) => {
          certByCourse.set(c.course_slug, (certByCourse.get(c.course_slug) || 0) + 1);
          const issued = c.issued_at ? new Date(c.issued_at) : null;
          const enrolledAtRaw = firstEnrollDate.get(`${c.user_id}::${c.course_slug}`);
          const enrolledAt = enrolledAtRaw ? new Date(enrolledAtRaw) : null;
          if (!issued || !enrolledAt || Number.isNaN(issued.getTime()) || Number.isNaN(enrolledAt.getTime())) return;
          const diff = Math.max((issued.getTime() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24), 0);
          const ag = certDaysByCourse.get(c.course_slug) || { total: 0, count: 0 };
          ag.total += diff;
          ag.count += 1;
          certDaysByCourse.set(c.course_slug, ag);
        });

        const coursePerformanceRows = Array.from(enrollByCourse.entries())
          .map(([slug, enrolled]) => {
            const certCount = certByCourse.get(slug) || 0;
            const d = certDaysByCourse.get(slug);
            return {
              course: titleBySlug[slug] || slug,
              enrolled,
              completed: certCount,
              completionRate: enrolled > 0 ? Number(((certCount / enrolled) * 100).toFixed(2)) : 0,
              avgDaysToCertificate: d && d.count > 0 ? Number((d.total / d.count).toFixed(2)) : 0,
            };
          })
          .sort((a, b) => b.enrolled - a.enrolled)
          .slice(0, 20);

        const confirmedInteractions = interactions.filter((i: any) => String(i.status || "").toLowerCase() === "completed").length;
        const commercialFunnel = [
          { step: "Visualizacoes de perfil", value: views.length },
          { step: "Contatos iniciados", value: interactions.length },
          { step: "Cliques no WhatsApp", value: clicks.length },
          { step: "Atendimentos confirmados", value: confirmedInteractions },
        ];
        const commercialRates = [
          { step: "Visualizacao -> Contato", rate: views.length > 0 ? Number(((interactions.length / views.length) * 100).toFixed(2)) : 0 },
          { step: "Contato -> WhatsApp", rate: interactions.length > 0 ? Number(((clicks.length / interactions.length) * 100).toFixed(2)) : 0 },
          { step: "WhatsApp -> Confirmado", rate: clicks.length > 0 ? Number(((confirmedInteractions / clicks.length) * 100).toFixed(2)) : 0 },
        ];

        const paidPayments = payments.filter((p: any) => isPaid(p.status));
        const roleMap = new Map<string, number>();
        const cityMap = new Map<string, number>();
        const stateMap = new Map<string, number>();
        const tierMap = new Map<string, number>();
        paidPayments.forEach((p: any) => {
          const amount = Number(p.amount || 0);
          const role = p.user_role || "nao_informado";
          const city = p.user_city || "Nao informado";
          const state = p.user_state || "Nao informado";
          const tier = p.user_subscription_tier || "Nao informado";
          roleMap.set(role, (roleMap.get(role) || 0) + amount);
          cityMap.set(city, (cityMap.get(city) || 0) + amount);
          stateMap.set(state, (stateMap.get(state) || 0) + amount);
          tierMap.set(tier, (tierMap.get(tier) || 0) + amount);
        });

        const segmentRoles = Array.from(roleMap.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value);
        const segmentCities = Array.from(cityMap.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
        const segmentStates = Array.from(stateMap.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
        const segmentTiers = Array.from(tierMap.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value);

        const senderIds = Array.from(new Set(messages.map((m: any) => m.sender_id).filter(Boolean)));
        const senderRoleById = new Map<string, { role: string | null; is_admin: boolean }>();
        if (senderIds.length) {
          for (let i = 0; i < senderIds.length; i += 300) {
            const chunk = senderIds.slice(i, i + 300);
            const { data } = await supabase.from("profiles").select("id,role,is_admin").in("id", chunk);
            (data || []).forEach((p: any) => senderRoleById.set(p.id, { role: p.role || null, is_admin: Boolean(p.is_admin) }));
          }
        }

        const messagesByTicket = new Map<string, any[]>();
        messages.forEach((m: any) => {
          const arr = messagesByTicket.get(m.ticket_id) || [];
          arr.push(m);
          messagesByTicket.set(m.ticket_id, arr);
        });

        const firstResponseHoursByTicket = new Map<string, number>();
        tickets.forEach((t: any) => {
          const start = new Date(t.created_at);
          if (Number.isNaN(start.getTime())) return;
          const msgs = (messagesByTicket.get(t.id) || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
          const firstAdmin = msgs.find((m: any) => {
            const sender = senderRoleById.get(m.sender_id);
            return sender?.is_admin || sender?.role === "admin";
          });
          if (!firstAdmin) return;
          const end = new Date(firstAdmin.created_at);
          if (Number.isNaN(end.getTime())) return;
          firstResponseHoursByTicket.set(t.id, Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60), 0));
        });

        const ticketCountByUser = new Map<string, number>();
        const slaByUser = new Map<string, { total: number; count: number }>();
        tickets.forEach((t: any) => {
          ticketCountByUser.set(t.user_id, (ticketCountByUser.get(t.user_id) || 0) + 1);
          const sla = firstResponseHoursByTicket.get(t.id);
          if (sla === undefined) return;
          const agg = slaByUser.get(t.user_id) || { total: 0, count: 0 };
          agg.total += sla;
          agg.count += 1;
          slaByUser.set(t.user_id, agg);
        });

        const avgSlaByUser = new Map<string, number>();
        slaByUser.forEach((v, k) => { if (v.count > 0) avgSlaByUser.set(k, v.total / v.count); });

        const paidRevenueByUser = new Map<string, number>();
        const churnFlagByUser = new Map<string, boolean>();
        const defaultFlagByUser = new Map<string, boolean>();
        payments.forEach((p: any) => {
          if (!p.user_id) return;
          if (isPaid(p.status)) paidRevenueByUser.set(p.user_id, (paidRevenueByUser.get(p.user_id) || 0) + Number(p.amount || 0));
          if (p.transaction_type === "plan" && isCanceled(p.status)) churnFlagByUser.set(p.user_id, true);
          if (isDefault(p.raw_status)) defaultFlagByUser.set(p.user_id, true);
        });

        const payingUsers = Array.from(paidRevenueByUser.keys());
        const makeBucket = (bucket: string) => ({ bucket, users: 0, revenue: 0, churn: 0, defaulted: 0, slaTotal: 0, slaUsers: 0 });

        const vol0 = makeBucket("0 tickets");
        const volLow = makeBucket("1-2 tickets");
        const volHigh = makeBucket("3+ tickets");

        const slaFast = makeBucket("<= 24h");
        const slaMed = makeBucket("24-72h");
        const slaSlow = makeBucket("> 72h");
        const slaNone = makeBucket("Sem resposta");

        payingUsers.forEach((uid) => {
          const tCount = ticketCountByUser.get(uid) || 0;
          const revenue = paidRevenueByUser.get(uid) || 0;
          const churn = churnFlagByUser.get(uid) || false;
          const def = defaultFlagByUser.get(uid) || false;
          const sla = avgSlaByUser.get(uid);

          const vb = tCount === 0 ? vol0 : tCount <= 2 ? volLow : volHigh;
          vb.users += 1;
          vb.revenue += revenue;
          if (churn) vb.churn += 1;
          if (def) vb.defaulted += 1;
          if (sla !== undefined) {
            vb.slaUsers += 1;
            vb.slaTotal += sla;
          }

          if (tCount > 0) {
            const sb = sla === undefined ? slaNone : sla <= 24 ? slaFast : sla <= 72 ? slaMed : slaSlow;
            sb.users += 1;
            sb.revenue += revenue;
            if (churn) sb.churn += 1;
            if (def) sb.defaulted += 1;
            if (sla !== undefined) {
              sb.slaUsers += 1;
              sb.slaTotal += sla;
            }
          }
        });

        const toImpact = (arr: any[]) => arr.map((b) => ({
          bucket: b.bucket,
          users: b.users,
          avgRevenue: b.users > 0 ? Number((b.revenue / b.users).toFixed(2)) : 0,
          churnRate: b.users > 0 ? Number(((b.churn / b.users) * 100).toFixed(2)) : 0,
          defaultRate: b.users > 0 ? Number(((b.defaulted / b.users) * 100).toFixed(2)) : 0,
          avgSlaHours: b.slaUsers > 0 ? Number((b.slaTotal / b.slaUsers).toFixed(2)) : 0,
        }));

        setStats({
          profileViews,
          contactAdditions,
          whatsappClicks,
          ticketsByUrgency,
          ticketsByUserType,
          courseSales,
          planSales,
          checkoutRows,
          checkoutCourse: checkoutSummary.course,
          checkoutPlan: checkoutSummary.plan,
          methodApproval,
          installmentDist,
          refundDefaultRows,
          subscriptionSeries,
          cohortRows,
          courseFunnelOverall: { purchased, started, completed, certified },
          courseFunnelRows,
          coursePerformanceRows,
          commercialFunnel,
          commercialRates,
          segmentRoles,
          segmentCities,
          segmentStates,
          segmentTiers,
          supportVolumeImpact: toImpact([vol0, volLow, volHigh]),
          supportSlaImpact: toImpact([slaFast, slaMed, slaSlow, slaNone]),
        });
      } catch (error) {
        console.error("[AnalyticsPage] erro:", error);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const selectedRange = useMemo(
    () => resolveFilterRange(periodFilter, customDateFrom, customDateTo),
    [periodFilter, customDateFrom, customDateTo],
  );

  const filteredCheckoutAndCoursesFunnel = useMemo(() => {
    const payments = analyticsSource.payments || [];
    const checkouts = analyticsSource.checkouts || [];
    const progress = analyticsSource.progress || [];
    const certs = analyticsSource.certs || [];
    const modules = analyticsSource.modules || [];
    const lessons = analyticsSource.lessons || [];
    const courses = analyticsSource.courses || [];

    const filterBySelectedRange = (value: string | null | undefined) =>
      withinRange(value, selectedRange.from, selectedRange.to);

    const checkoutsInRange = checkouts.filter((checkout: any) =>
      filterBySelectedRange(checkout.created_at || checkout.updated_at || checkout.paid_at),
    );

    const checkoutSummary: any = {
      course: { started: 0, paid: 0, abandoned: 0, conversionRate: 0 },
      plan: { started: 0, paid: 0, abandoned: 0, conversionRate: 0 },
    };

    checkoutsInRange.forEach((checkout: any) => {
      if (checkout.transaction_type !== "course" && checkout.transaction_type !== "plan") return;
      const type = checkout.transaction_type;
      checkoutSummary[type].started += 1;
      if (isCheckoutPaid(checkout.payment_status, checkout.status)) checkoutSummary[type].paid += 1;
    });

    ["course", "plan"].forEach((type) => {
      checkoutSummary[type].abandoned = Math.max(checkoutSummary[type].started - checkoutSummary[type].paid, 0);
      checkoutSummary[type].conversionRate =
        checkoutSummary[type].started > 0
          ? Number(((checkoutSummary[type].paid / checkoutSummary[type].started) * 100).toFixed(2))
          : 0;
    });

    const checkoutRows = [
      {
        name: "Cursos",
        started: checkoutSummary.course.started,
        paid: checkoutSummary.course.paid,
        abandoned: checkoutSummary.course.abandoned,
      },
      {
        name: "Planos",
        started: checkoutSummary.plan.started,
        paid: checkoutSummary.plan.paid,
        abandoned: checkoutSummary.plan.abandoned,
      },
    ];

    const moduleToCourse = new Map<string, string>();
    modules.forEach((module: any) => moduleToCourse.set(module.id, module.course_slug));

    const lessonsByCourse = new Map<string, number>();
    lessons.forEach((lesson: any) => {
      const courseSlug = moduleToCourse.get(lesson.module_id);
      if (!courseSlug) return;
      lessonsByCourse.set(courseSlug, (lessonsByCourse.get(courseSlug) || 0) + 1);
    });

    const paidCoursePaymentsInRange = payments.filter((payment: any) => {
      const dateRef = payment.date || payment.confirmed_at || payment.created_at;
      return payment.transaction_type === "course" && isPaid(payment.status) && filterBySelectedRange(dateRef);
    });

    const purchasedPairs = new Set<string>();
    paidCoursePaymentsInRange.forEach((payment: any) => {
      if (!payment.user_id || !payment.course_slug) return;
      purchasedPairs.add(`${payment.user_id}::${payment.course_slug}`);
    });

    const progressByPair = new Map<string, { started: boolean; completedLessons: Set<string> }>();
    progress
      .filter((row: any) => filterBySelectedRange(row.updated_at))
      .forEach((row: any) => {
        const key = `${row.user_id}::${row.course_slug}`;
        const data = progressByPair.get(key) || { started: false, completedLessons: new Set<string>() };
        if (row.status === "in-progress" || row.status === "completed") data.started = true;
        if (row.status === "completed" && row.lesson_id) data.completedLessons.add(row.lesson_id);
        progressByPair.set(key, data);
      });

    const certifiedPairs = new Set<string>();
    certs
      .filter((certificate: any) => filterBySelectedRange(certificate.issued_at))
      .forEach((certificate: any) => {
        certifiedPairs.add(`${certificate.user_id}::${certificate.course_slug}`);
      });

    const titleBySlug: Record<string, string> = {};
    courses.forEach((course: any) => {
      titleBySlug[course.slug] = course.title || course.slug;
    });

    const courseFunnelMap = new Map<string, { purchased: number; started: number; completed: number; certified: number }>();
    let purchased = 0;
    let started = 0;
    let completed = 0;
    let certified = 0;

    purchasedPairs.forEach((pairKey) => {
      const [, courseSlug] = pairKey.split("::");
      const progressData = progressByPair.get(pairKey);
      const totalLessons = lessonsByCourse.get(courseSlug) || 0;
      const completedLessons = progressData?.completedLessons.size || 0;
      const startedFlag = Boolean(progressData?.started);
      const completedFlag = totalLessons > 0 ? completedLessons >= totalLessons : false;
      const certifiedFlag = certifiedPairs.has(pairKey);

      purchased += 1;
      if (startedFlag) started += 1;
      if (completedFlag) completed += 1;
      if (certifiedFlag) certified += 1;

      const current = courseFunnelMap.get(courseSlug) || { purchased: 0, started: 0, completed: 0, certified: 0 };
      current.purchased += 1;
      if (startedFlag) current.started += 1;
      if (completedFlag) current.completed += 1;
      if (certifiedFlag) current.certified += 1;
      courseFunnelMap.set(courseSlug, current);
    });

    const courseFunnelRows = Array.from(courseFunnelMap.entries())
      .map(([slug, values]) => ({
        course: titleBySlug[slug] || slug,
        purchased: values.purchased,
        started: values.started,
        completed: values.completed,
        certified: values.certified,
      }))
      .sort((a, b) => b.purchased - a.purchased)
      .slice(0, 12);

    return {
      checkoutRows,
      checkoutCourse: checkoutSummary.course,
      checkoutPlan: checkoutSummary.plan,
      courseFunnelOverall: { purchased, started, completed, certified },
      courseFunnelRows,
    };
  }, [analyticsSource, selectedRange]);

  const statsForScopedTabs = useMemo(
    () => ({
      ...stats,
      ...filteredCheckoutAndCoursesFunnel,
      metricsPeriodLabel: selectedRange.label,
    }),
    [stats, filteredCheckoutAndCoursesFunnel, selectedRange.label],
  );

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Metricas e Analises</h1>
        <p className="text-muted-foreground">Painel completo de vendas, funis, coortes e impacto operacional.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtro de Periodo (Checkout e Funil Cursos)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Periodo</Label>
              <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as PeriodFilterValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Ultimos 7 dias</SelectItem>
                  <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                  <SelectItem value="90d">Ultimos 90 dias</SelectItem>
                  <SelectItem value="all">Todo periodo</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={customDateFrom}
                onChange={(event) => setCustomDateFrom(event.target.value)}
                disabled={periodFilter !== "custom"}
              />
            </div>
            <div className="space-y-1">
              <Label>Data final</Label>
              <Input
                type="date"
                value={customDateTo}
                onChange={(event) => setCustomDateTo(event.target.value)}
                disabled={periodFilter !== "custom"}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Aplicado somente nas abas Checkout e Funil Cursos. Periodo ativo: <strong>{selectedRange.label}</strong>.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="support">Suporte</TabsTrigger>
          <TabsTrigger value="sales-course">Vendas Cursos</TabsTrigger>
          <TabsTrigger value="sales-plan">Vendas Planos</TabsTrigger>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="cohorts">Coortes</TabsTrigger>
          <TabsTrigger value="courses-funnel">Funil Cursos</TabsTrigger>
          <TabsTrigger value="courses-performance">Cursos KPI</TabsTrigger>
          <TabsTrigger value="commercial">Funil Comercial</TabsTrigger>
          <TabsTrigger value="segments">Segmentacao</TabsTrigger>
          <TabsTrigger value="support-impact">Suporte x Receita</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-4">
          <EngagementTab stats={stats} />
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <SupportTab stats={stats} />
        </TabsContent>

        <TabsContent value="sales-course">
          <SalesTab
            title="Top Cursos por Faturamento"
            subtitle="Baseado em pagamentos confirmados."
            stats={stats.courseSales}
          />
        </TabsContent>
        <TabsContent value="sales-plan">
          <SalesTab
            title="Top Planos por Faturamento"
            subtitle="Baseado em pagamentos confirmados."
            stats={stats.planSales}
          />
        </TabsContent>

        <TabsContent value="checkout" className="space-y-4">
          <CheckoutTab stats={statsForScopedTabs} />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentsTab stats={stats} />
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <SubscriptionsTab stats={stats} />
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-4">
          <CohortsTab stats={stats} />
        </TabsContent>

        <TabsContent value="courses-funnel" className="space-y-4">
          <CoursesFunnelTab stats={statsForScopedTabs} />
        </TabsContent>

        <TabsContent value="courses-performance" className="space-y-4">
          <CoursesPerformanceTab stats={stats} />
        </TabsContent>

        <TabsContent value="commercial" className="space-y-4">
          <CommercialTab stats={stats} />
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <SegmentsTab stats={stats} />
        </TabsContent>

        <TabsContent value="support-impact" className="space-y-4">
          <SupportImpactTab stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
