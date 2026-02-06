import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AppVersion from "./AppVersion";
import FaviconUpdater from "./FaviconUpdater";
import ScrollToTop from "../ScrollToTop";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <FaviconUpdater />
      <ScrollToTop />
      <Navbar />
      <main className="flex-1 py-8 md:py-12">{children}</main>
      <Footer />
      <AppVersion />
    </div>
  );
};

export default Layout;