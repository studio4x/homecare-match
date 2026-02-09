"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PlansTab from "@/components/admin/PlansTab";
import { Loader2 } from "lucide-react";

const PlansPage = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("plans").select("*").order('price', { ascending: true });
      setPlans(data || []);
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
        <h1 className="text-3xl font-bold tracking-tight">Planos de Assinatura</h1>
        <p className="text-muted-foreground">Configure os preços e benefícios dos planos.</p>
      </div>
      <PlansTab plans={plans} refetchData={fetchData} />
    </div>
  );
};

export default PlansPage;