"use client";

import { useAuth } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import AuthForm from '@/components/auth/AuthForm';
import { Navigate, useLocation } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';

const Login = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  
  const initialMode = location.hash === '#auth-sign-up' ? 'register' : 'login';

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
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
            <p className="mt-2 text-sm text-muted-foreground">
              Acesse sua conta para gerenciar seu perfil profissional.
            </p>
          </div>
          
          <AuthForm mode={initialMode} />
        </div>
      </div>
    </Layout>
  );
};

export default Login;