"use client";

import { useAuth } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import AuthForm from '@/components/auth/AuthForm';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Login = () => {
  const { session, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const initialMode = location.hash === '#auth-sign-up' ? 'register' : 'login';

  useEffect(() => {
    if (session && !authLoading) {
      const checkRoleAndRedirect = async () => {
        setIsRedirecting(true);
        try {
          const { data } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', session.user.id)
            .single();

          if (data?.is_admin || data?.role === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } catch (error) {
          navigate('/dashboard', { replace: true });
        }
      };

      checkRoleAndRedirect();
    }
  }, [session, authLoading, navigate]);

  // Se estiver carregando auth inicial ou redirecionando, mostra o loader
  if (authLoading || (session && isRedirecting)) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Heart className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              Portal HomeCareMatch
            </h2>
          </div>
          <AuthForm mode={initialMode} />
        </div>
      </div>
    </Layout>
  );
};

export default Login;