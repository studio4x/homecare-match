import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Páginas Públicas / Usuário
import Index from "./pages/Index";
import Empresas from "./pages/Empresas";
import Familias from "./pages/Familias";
import Buscar from "./pages/Buscar";
import Login from "./pages/Login";
import Perfil from "./pages/Perfil";
import CadastroEmpresaFamilia from "./pages/CadastroEmpresaFamilia";
import RecruiterProfile from "./pages/RecruiterProfile";
import NotFound from "./pages/NotFound";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import ReferralLanding from "./pages/ReferralLanding";
import CertificateView from "./pages/CertificateView";
import ValidateCertificate from "./pages/ValidateCertificate";
import Support from "./pages/Support";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import Funcionalidades from "./pages/Funcionalidades";

// Dashboard Pages
import UserLayout from "./components/layout/UserLayout";
import OverviewPage from "./pages/dashboard/OverviewPage";
import ProfilePage from "./pages/dashboard/ProfilePage";
import InteractionsPage from "./pages/dashboard/InteractionsPage";
import AcademyPage from "./pages/dashboard/AcademyPage";
import ReferralsPage from "./pages/dashboard/ReferralsPage";
import SupportTicketsPage from "./pages/dashboard/SupportTicketsPage";
import TicketDetailPage from "./pages/dashboard/TicketDetailPage";
import PaymentsPage from "./pages/dashboard/PaymentsPage";
import NoticesPage from "./pages/dashboard/NoticesPage";

// Admin Layout & Pages
import AdminLayout from "./components/layout/AdminLayout";
import VerificationsPage from "./pages/admin/VerificationsPage";
import UsersPage from "./pages/admin/UsersPage";
import PlansPage from "./pages/admin/PlansPage";
import ReferralsAdminPage from "./pages/admin/ReferralsPage";
import CoursesAdminPage from "./pages/admin/CoursesPage";
import MarketingPage from "./pages/admin/MarketingPage";
import SettingsPage from "./pages/admin/SettingsPage";
import SuggestionsPage from "./pages/admin/SuggestionsPage";
import CouponsPage from "./pages/admin/CouponsPage";
import SupportAdminPage from "./pages/admin/SupportAdminPage";
import FaqAdminPage from "./pages/admin/FaqAdminPage";
import ReportsPage from "./pages/admin/ReportsPage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import VideosPage from "./pages/admin/VideosPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import PushNotificationsPage from "./pages/admin/PushNotificationsPage";
import FeatureVideosPage from "./pages/admin/FeatureVideosPage"; // New import

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="bottom-right" offset={40} />
          <SpeedInsights />
          <AppErrorBoundary>
            <Routes>
              {/* Rotas Públicas */}
              <Route path="/" element={<Index />} />
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/familias" element={<Familias />} />
              <Route path="/buscar" element={<Buscar />} />
              <Route path="/login" element={<Login />} />
              <Route path="/convite" element={<ReferralLanding />} />
              <Route path="/profissional/:id" element={<Perfil />} />
              <Route path="/cadastro-empresa" element={<CadastroEmpresaFamilia />} />
              <Route path="/recruiter/:id" element={<RecruiterProfile />} />
              <Route path="/cursos" element={<Courses />} />
              <Route path="/cursos/:slug" element={<CourseDetail />} />
              <Route path="/certificado/:id" element={<CertificateView />} />
              <Route path="/validar" element={<ValidateCertificate />} />
              <Route path="/suporte" element={<Support />} />
              <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
              <Route path="/politica-de-cookies" element={<CookiePolicy />} />
              <Route path="/funcionalidades" element={<Funcionalidades />} />

              {/* Novo Painel do Usuário (Aninhado) */}
              <Route path="/dashboard" element={<UserLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="contatos" element={<InteractionsPage />} />
                <Route path="cursos" element={<AcademyPage />} />
                <Route path="indicacoes" element={<ReferralsPage />} />
                <Route path="pagamentos" element={<PaymentsPage />} />
                <Route path="avisos" element={<NoticesPage />} />
                <Route path="suporte" element={<SupportTicketsPage />} />
                <Route path="suporte/:id" element={<TicketDetailPage />} />
              </Route>

              {/* Área Administrativa (Aninhada) */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="verificacoes" replace />} />
                <Route path="verificacoes" element={<VerificationsPage />} />
                <Route path="usuarios" element={<UsersPage />} />
                <Route path="planos" element={<PlansPage />} />
                <Route path="indicacoes" element={<ReferralsAdminPage />} />
                <Route path="cursos" element={<CoursesAdminPage />} />
                <Route path="videos" element={<VideosPage />} />
                <Route path="push" element={<PushNotificationsPage />} />
                <Route path="denuncias" element={<ReportsPage />} />
                <Route path="sugestoes" element={<SuggestionsPage />} />
                <Route path="cupons" element={<CouponsPage />} />
                <Route path="marketing" element={<MarketingPage />} />
                <Route path="configuracoes" element={<SettingsPage />} />
                <Route path="suporte" element={<SupportAdminPage />} />
                <Route path="suporte/:id" element={<TicketDetailPage />} />
                <Route path="faq" element={<FaqAdminPage />} />
                <Route path="metricas" element={<AnalyticsPage />} />
                <Route path="auditoria" element={<AuditLogsPage />} />
                <Route path="videos-funcionalidades" element={<FeatureVideosPage />} /> {/* New route */}
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;