"use client";

import { useState, useEffect } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import UsersTab from "@/components/admin/UsersTab";
import { Loader2 } from "lucide-react";

const UsersPage = () => {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getSortTimestamp = (user: any) => {
    const signupTimestamp = Date.parse(String(user?.signup_created_at || ""));
    if (Number.isFinite(signupTimestamp)) return signupTimestamp;

    const updatedTimestamp = Date.parse(String(user?.updated_at || ""));
    if (Number.isFinite(updatedTimestamp)) return updatedTimestamp;

    return 0;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, plansRes, onboardingRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .order('updated_at', { ascending: false }),
        supabase.from("plans").select("*").order('price', { ascending: true }),
        supabase.from("user_onboarding_flows").select("user_id, status")
      ]);
      
      const onboardingMap = (onboardingRes.data || []).reduce((acc: any, curr: any) => {
        if (!acc[curr.user_id]) acc[curr.user_id] = [];
        acc[curr.user_id].push(curr);
        return acc;
      }, {});

      const usersWithOnboarding = (usersRes.data || []).map(u => ({
        ...u,
        user_onboarding_flows: onboardingMap[u.id] || []
      }));

      let usersWithSignupDate = usersWithOnboarding;

      try {
        const { data: currentSession } = await supabase.auth.getSession();
        const { data: refreshedSession } = await supabase.auth.refreshSession();
        const accessToken = refreshedSession?.session?.access_token || currentSession?.session?.access_token || "";

        if (accessToken && usersWithOnboarding.length > 0) {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-signup-dates`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              access_token: accessToken,
              user_ids: usersWithOnboarding.map((user) => user.id),
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.error || `Falha ao carregar datas de cadastro (HTTP ${response.status})`);
          }

          const signupDates = payload?.signup_dates && typeof payload.signup_dates === "object"
            ? payload.signup_dates
            : {};

          usersWithSignupDate = usersWithOnboarding.map((user) => ({
            ...user,
            signup_created_at: signupDates[user.id] || null,
          }));
        }
      } catch (error) {
        console.warn("[UsersPage] Nao foi possivel carregar datas de cadastro do auth.users:", error);
      }

      const sortedUsers = [...usersWithSignupDate].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));

      setAllUsers(sortedUsers);
      setPlans(plansRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground">Gerencie todos os usuários cadastrados na plataforma.</p>
      </div>
      <UsersTab allUsers={allUsers} plans={plans} refetchData={fetchData} />
    </div>
  );
};

export default UsersPage;
