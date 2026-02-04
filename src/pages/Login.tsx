"use client";

import { useAuth } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import AuthForm from '@/components/auth/AuthForm';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import logo from "@/assets/logo.png";

const Login = () => {
  const { session, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const initialMode = location.hash === '#auth-sign-up' ? 'register' : 'login';

  useEffect(() => {
    if (session && !authLoading && !isRedirecting) {
      const checkRoleAndRedirect = async () => {
        setIsRedirecting(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (error) {
            console.error("[Login] Erro ao verificar papel:", error);
            navigate('/dashboard', { replace: true });
            return;
          }

          if (data?.is_admin || data?.role === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } catch (error) {
          console.error("[Login] Erro fatal no redirecionamento:", error);
          navigate('/dashboard', { replace: true });
        } finally {
          // Timeout de segurança para garantir que o loader suma caso o navigate demore
          setTimeout(() => setIsRedirecting(false), 2000);
        }
      };

      checkRoleAndRedirect();
    }
  }, [session, authLoading, navigate]);

  if (authLoading || (session && isRedirecting)) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">Autenticando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="text-center">
            <img src={logo} alt="HomeCareMatch" className="mx-auto h-24" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              Portal de Acesso
            </h2>
          </div>
          <AuthForm mode={initialMode} />
        </div>
      </div>
    </Layout>
  );
};

export default Login;