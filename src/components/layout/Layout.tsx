import { ReactNode } from "react";
import Navbar from "./Navbar";
import ImpersonationBar from "../ImpersonationBar";
import Footer from "./Footer";
import AppVersion from "./AppVersion";
import FaviconUpdater from "./FaviconUpdater";
import ScrollToTop from "../ScrollToTop";
import MarketingScripts from "../MarketingScripts";
import SuggestionDrawer from "../SuggestionDrawer";
import CookieConsent from "../CookieConsent";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <FaviconUpdater />
      <ScrollToTop />
      <Navbar />
      <ImpersonationBar />
      <MarketingScripts />
      <SuggestionDrawer />
      <CookieConsent />
      <main className="flex-1 py-8 md:py-12">{children}</main>
      <Footer />
      <AppVersion />
    </div>
  );
};

export default Layout;