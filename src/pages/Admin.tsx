"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import AuthForm from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  Loader2,
  LogOut,
  Lock,
  Settings,
  Award
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import SiteConfigTab from "@/components/admin/SiteConfigTab";
import CoursesTab from "@/components/admin/CoursesTab";
import MarketingTab from "@/components/admin/MarketingTab";
import VerificationsTab from "@/components/admin/VerificationsTab";
import UsersTab from "@/components/admin/UsersTab";
import PlansTab from "@/components/admin/PlansTab";
import ReferralsTab from "@/components/admin/ReferralsTab";

const Admin = () => {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);

  useEffect(() => {
    const checkGlobalAdmin = async () => {
      try {
        const { data, error } = await supabase.rpc('any_admin_exists');
        if (!error) setAdminExists(data);
      } catch (e) {
        console.error("[Admin] Erro global:", e);
      }
    };
    checkGlobalAdmin();
  }, []);

  useEffect(() => {
    const verifyAdmin = async () => {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('check_is_admin');
        
        if (!error && data === true) {
          setIsAdmin(true);
          await fetchData();
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("[Admin] Erro verificação:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAdmin();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const [pendingRes, usersRes, plansRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, id_document_url, prof_registration_url").eq("verification_sent", true).eq("is_verified", false),
        supabase.from("profiles").select("id, full_name, email, role, subscription_tier, is_verified, trial_started_at, updated_at").order('updated_at', { ascending: false }),
        supabase.from("plans").select("*").order('price', { ascending: true }),
      ]);
      
      setPendingProfiles(pendingRes.data || []);
      setAllUsers(usersRes.data || []);
      setPlans(plansRes.data || []);
      
      // Tratamento de erro específico para a função RPC de referências
      let formattedReferrals = [];
      try {
        const { data: referralsData, error: referralsError } = await supabase.rpc('get_all_referrals_with_details');
        if (referralsError) throw referralsError;
        
        formattedReferrals = (referralsData || []).map((r: any) => ({
          id: r.id,
          referrer_id: r.referrer_id,
          referred_name: r.referred_name,
          referred_phone: r.referred_phone,
          status: r.status,
          created_at: r.created_at,
          referrer: {
            full_name: r.referrer_full_name,
            email: r.referrer_email
          }
        }));
      } catch (error) {
        console.error("[Admin] Falha ao carregar indicações (RPC):", error);
        toast.error("Falha ao carregar a lista de indicações. Verifique a função RPC no Supabase.");
        formattedReferrals = [];
      }
      
      setReferrals(formattedReferrals);

    } catch (error) {
      console.error("[Admin] Erro fetch:", error);
      toast.error("Falha ao carregar alguns dados do painel.");
    }
  };

  if (authLoading || loading) {
    return <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }
  
  if (!session) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
          <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-card text-center">
            <Lock className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-6">Painel de Gestão</h2>
            <AuthForm mode={adminExists ? "login" : "register"} allowRegister={!adminExists} />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center p-8 bg-card border rounded-2xl shadow-sm max-w-md">
            <ShieldCheck className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold">Acesso Negado</h2>
            <p className="text-muted-foreground mt-2">Sua conta não possui permissões administrativas.</p>
            <div className="mt-6">
              <Button onClick={signOut}>Sair da Conta</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /> Painel Admin</h1>
            <Button variant="ghost" onClick={signOut} className="gap-2 hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</Button>
          </div>

          <Tabs defaultValue="verifications" className="space-y-6">
            <TabsList className="bg-card border w-full justify-start md:w-auto overflow-x-auto">
              <TabsTrigger value="verifications">Verificações ({pendingProfiles.length})</TabsTrigger>
              <TabsTrigger value="users">Usuários ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="plans">Planos ({plans.length})</TabsTrigger>
              <TabsTrigger value="referrals" className="gap-2"><Award className="h-4 w-4" /> Indicações</TabsTrigger>
              <TabsTrigger value="courses">Cursos</TabsTrigger>
              <TabsTrigger value="marketing">Marketing</TabsTrigger>
              <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="verifications">
              <VerificationsTab pendingProfiles={pendingProfiles} refetchData={fetchData} />
            </TabsContent>
            
            <TabsContent value="users">
              <UsersTab allUsers={allUsers} plans={plans} refetchData={fetchData} />
            </TabsContent>

            <TabsContent value="plans">
              <PlansTab plans={plans} refetchData={fetchData} />
            </TabsContent>

            <TabsContent value="referrals">
              <ReferralsTab referrals={referrals} />
            </TabsContent>

            <TabsContent value="courses">
              <CoursesTab />
            </TabsContent>

            <TabsContent value="marketing">
              <MarketingTab />
            </TabsContent>

            <TabsContent value="settings">
              <SiteConfigTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;