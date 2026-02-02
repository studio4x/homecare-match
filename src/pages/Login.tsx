"use client";

import { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate, useLocation } from 'react-router-dom';
import { Heart, Info } from 'lucide-react';

const Login = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in');

  useEffect(() => {
    if (location.hash === '#auth-sign-up') {
      setView('sign_up');
    } else {
      setView('sign_in');
    }
  }, [location.hash]);

  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-secondary/20">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Heart className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              {view === 'sign_up' ? 'Crie sua conta' : 'Acesse sua conta'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {view === 'sign_up' 
                ? 'Comece agora sua jornada no HomeCareMatch.' 
                : 'Faça login para gerenciar seu perfil.'}
            </p>
          </div>
          
          <Auth
            supabaseClient={supabase}
            view={view}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary))',
                  }
                }
              }
            }}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Endereço de e-mail',
                  password_label: 'Senha',
                  button_label: 'Entrar',
                  loading_button_label: 'Entrando...',
                  social_provider_text: 'Entrar com {{provider}}',
                  link_text: 'Já possui uma conta? Entre',
                },
                sign_up: {
                  email_label: 'Endereço de e-mail',
                  password_label: 'Senha',
                  button_label: 'Criar conta gratuita',
                  loading_button_label: 'Criando conta...',
                  social_provider_text: 'Cadastrar com {{provider}}',
                  link_text: 'Não possui uma conta? Cadastre-se',
                  confirmation_text: 'Verifique seu e-mail para confirmar o cadastro.',
                },
              },
            }}
            providers={[]}
            theme="light"
          />

          <div className="mt-6 flex items-start gap-3 rounded-lg bg-primary/5 p-4 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <p>
              Ao se cadastrar, você receberá um e-mail de confirmação. A validação é necessária para garantir a segurança da plataforma e dos profissionais.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;