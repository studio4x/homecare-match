"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import VerificationsTab from "@/components/admin/VerificationsTab";
import { Loader2 } from "lucide-react";

const VerificationsPage = () => {
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, id_document_url, prof_registration_url")
        .eq("verification_sent", true)
        .eq("is_verified", false);
      
      if (!error) setPendingProfiles(data || []);
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
        <h1 className="text-3xl font-bold tracking-tight">Verificações Pendentes</h1>
        <p className="text-muted-foreground">Gerencie as solicitações de verificação de documentos.</p>
      </div>
      <VerificationsTab pendingProfiles={pendingProfiles} refetchData={fetchData} />
    </div>
  );
};

export default VerificationsPage;