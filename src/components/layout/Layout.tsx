import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AppVersion from "./AppVersion";
import DynamicHead from "./DynamicHead";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <DynamicHead />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <AppVersion />
    </div>
  );
};

export default Layout;