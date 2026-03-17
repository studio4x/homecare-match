import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import PwaMetaManager from "@/components/layout/PwaMetaManager";

// Lazy pages/layouts to reduce initial JS on public routes.
const Index = lazy(() => import("./pages/Index"));
const Empresas = lazy(() => import("./pages/Empresas"));
const Familias = lazy(() => import("./pages/Familias"));
const Buscar = lazy(() => import("./pages/Buscar"));
const Login = lazy(() => import("./pages/Login"));
const Perfil = lazy(() => import("./pages/Perfil"));
const CadastroEmpresaFamilia = lazy(() => import("./pages/CadastroEmpresaFamilia"));
const RecruiterProfile = lazy(() => import("./pages/RecruiterProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const ReferralLanding = lazy(() => import("./pages/ReferralLanding"));
const CertificateView = lazy(() => import("./pages/CertificateView"));
const ValidateCertificate = lazy(() => import("./pages/ValidateCertificate"));
const Support = lazy(() => import("./pages/Support"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const Funcionalidades = lazy(() => import("./pages/Funcionalidades"));
const ConversionCourse = lazy(() => import("./pages/ConversionCourse"));
const ConversionSubscription = lazy(() => import("./pages/ConversionSubscription"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const BlogPage = lazy(() => import("./pages/Blog"));
const BlogArticlePage = lazy(() => import("./pages/BlogArticle"));
const BlogCategoriesPage = lazy(() => import("./pages/BlogCategories"));
const BlogTagsPage = lazy(() => import("./pages/BlogTags"));
const BlogSearchPage = lazy(() => import("./pages/BlogSearch"));
const ShortLinkRedirect = lazy(() => import("./pages/ShortLinkRedirect"));
const EmailConfirmed = lazy(() => import("./pages/EmailConfirmed"));

const UserLayout = lazy(() => import("./components/layout/UserLayout"));
const OverviewPage = lazy(() => import("./pages/dashboard/OverviewPage"));
const ProfilePage = lazy(() => import("./pages/dashboard/ProfilePage"));
const InteractionsPage = lazy(() => import("./pages/dashboard/InteractionsPage"));
const AcademyPage = lazy(() => import("./pages/dashboard/AcademyPage"));
const ReferralsPage = lazy(() => import("./pages/dashboard/ReferralsPage"));
const SupportTicketsPage = lazy(() => import("./pages/dashboard/SupportTicketsPage"));
const TicketDetailPage = lazy(() => import("./pages/dashboard/TicketDetailPage"));
const PaymentsPage = lazy(() => import("./pages/dashboard/PaymentsPage"));
const NoticesPage = lazy(() => import("./pages/dashboard/NoticesPage"));
const CompanyPatientsPage = lazy(() => import("./pages/dashboard/CompanyPatientsPage"));

const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const VerificationsPage = lazy(() => import("./pages/admin/VerificationsPage"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const CreateUserPage = lazy(() => import("./pages/admin/CreateUserPage"));
const PlansPage = lazy(() => import("./pages/admin/PlansPage"));
const ReferralsAdminPage = lazy(() => import("./pages/admin/ReferralsPage"));
const CoursesAdminPage = lazy(() => import("./pages/admin/CoursesPage"));
const MarketingPage = lazy(() => import("./pages/admin/MarketingPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const SuggestionsPage = lazy(() => import("./pages/admin/SuggestionsPage"));
const CouponsPage = lazy(() => import("./pages/admin/CouponsPage"));
const SupportAdminPage = lazy(() => import("./pages/admin/SupportAdminPage"));
const FaqAdminPage = lazy(() => import("./pages/admin/FaqAdminPage"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));
const VideosPage = lazy(() => import("./pages/admin/VideosPage"));
const AuditLogsPage = lazy(() => import("./pages/admin/AuditLogsPage"));
const PushNotificationsPage = lazy(() => import("./pages/admin/PushNotificationsPage"));
const FeatureVideosPage = lazy(() => import("./pages/admin/FeatureVideosPage"));
const EmailConfirmationVideosPage = lazy(() => import("./pages/admin/EmailConfirmationVideosPage"));
const ConciergeRequestsPage = lazy(() => import("./pages/admin/ConciergeRequestsPage"));
const PaymentsAdminPage = lazy(() => import("./pages/admin/PaymentsAdminPage"));
const PwaSettingsPage = lazy(() => import("./pages/admin/PwaSettingsPage"));
const BlogAdminPage = lazy(() => import("./pages/admin/BlogPage"));
const ChatbotConversationsPage = lazy(() => import("./pages/admin/ChatbotConversationsPage"));
const NotificationDeliveriesPage = lazy(() => import("./pages/admin/NotificationDeliveriesPage"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Carregando...</div>
);

const App = () => {
  const [SpeedInsightsComponent, setSpeedInsightsComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let cancelled = false;
    let handle: number | null = null;

    const loadSpeedInsights = async () => {
      const module = await import("@vercel/speed-insights/react");
      if (!cancelled) {
        setSpeedInsightsComponent(() => module.SpeedInsights);
      }
    };

    if ("requestIdleCallback" in window) {
      const win = window as Window & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      };
      handle = win.requestIdleCallback?.(() => {
        void loadSpeedInsights();
      }, { timeout: 2500 }) ?? null;
    } else {
      handle = window.setTimeout(() => {
        void loadSpeedInsights();
      }, 1500);
    }

    return () => {
      cancelled = true;
      if (handle === null) return;

      if ("cancelIdleCallback" in window) {
        const win = window as Window & { cancelIdleCallback?: (id: number) => void };
        win.cancelIdleCallback?.(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="bottom-right" offset={40} />
            {SpeedInsightsComponent ? <SpeedInsightsComponent /> : null}
            <AppErrorBoundary>
              <PwaMetaManager />
              <Suspense fallback={<RouteFallback />}>
                <Routes>
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
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/artigo/:slug" element={<BlogArticlePage />} />
                  <Route path="/blog/categorias" element={<BlogCategoriesPage />} />
                  <Route path="/blog/tags" element={<BlogTagsPage />} />
                  <Route path="/blog/busca" element={<BlogSearchPage />} />
                  <Route path="/redefinir-senha" element={<ResetPassword />} />
                  <Route path="/email-confirmado" element={<EmailConfirmed />} />
                  <Route path="/conversion/course" element={<ConversionCourse />} />
                  <Route path="/conversion/subscription" element={<ConversionSubscription />} />
                  <Route path="/:shortSlug" element={<ShortLinkRedirect />} />

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
                    <Route path="pacientes" element={<CompanyPatientsPage />} />
                  </Route>

                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="verificacoes" replace />} />
                    <Route path="verificacoes" element={<VerificationsPage />} />
                    <Route path="usuarios" element={<UsersPage />} />
                    <Route path="criar-usuario" element={<CreateUserPage />} />
                    <Route path="planos" element={<PlansPage />} />
                    <Route path="pagamentos" element={<PaymentsAdminPage />} />
                    <Route path="indicacoes" element={<ReferralsAdminPage />} />
                    <Route path="cursos" element={<CoursesAdminPage />} />
                    <Route path="videos" element={<VideosPage />} />
                    <Route path="push" element={<PushNotificationsPage />} />
                    <Route path="notificacoes" element={<NotificationDeliveriesPage />} />
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
                    <Route path="videos-funcionalidades" element={<FeatureVideosPage />} />
                    <Route path="videos-email-confirmado" element={<EmailConfirmationVideosPage />} />
                    <Route path="concierge" element={<ConciergeRequestsPage />} />
                    <Route path="pwa" element={<PwaSettingsPage />} />
                    <Route path="blog" element={<BlogAdminPage />} />
                    <Route path="chatbot" element={<ChatbotConversationsPage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
