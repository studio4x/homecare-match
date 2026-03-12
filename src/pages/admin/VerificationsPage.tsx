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
        .select("id, full_name, email, id_document_url, prof_registration_url, patient_document_url, patient_address_proof_url, role")
        .eq("verification_sent", true)
        .eq("is_verified", false);
      
      if (!error) setPendingProfiles(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Realtime listener for profile updates
    const channel = supabase
      .channel('verifications-admin-updates')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: 'verification_sent=eq.true' // Only listen for profiles that have sent verification
        },
        (payload) => {
          // Check if the updated profile is relevant (pending verification)
          const updatedProfile = payload.new as any;
          if (updatedProfile.verification_sent && !updatedProfile.is_verified) {
            console.log("[VerificationsPage] Realtime update received, refetching data.");
            fetchData(); // Refetch all data to ensure consistency
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Empty dependency array to run once on mount and cleanup on unmount

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
