"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import UsersTab from "@/components/admin/UsersTab";
import { Loader2 } from "lucide-react";

const UsersPage = () => {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, plansRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role, subscription_tier, subscription_end_at, coupon_days, is_verified, trial_started_at, updated_at, avatar_url, ans_registration") // Fetch ans_registration
          .order('updated_at', { ascending: false }),
        supabase.from("plans").select("*").order('price', { ascending: true }),
      ]);
      
      setAllUsers(usersRes.data || []);
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