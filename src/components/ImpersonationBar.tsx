"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { ShieldAlert } from "lucide-react";

const ImpersonationBar: React.FC = () => {
  const { signOut, user } = useAuth();
  const [show, setShow] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const flag = localStorage.getItem("impersonatingAdmin");
      const email = localStorage.getItem("impersonatorEmail");
      setShow(flag === "true");
      setAdminEmail(email);
    } catch {
      setShow(false);
      setAdminEmail(null);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          <span>
            Você está navegando como <strong>{user?.email || "usuário"}</strong>. 
            {adminEmail ? ` Admin: ${adminEmail}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                localStorage.removeItem("impersonatingAdmin");
                localStorage.removeItem("impersonatorEmail");
              } catch {}
              await signOut();
              window.location.href = "/admin";
            }}
          >
            Voltar ao Admin
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImpersonationBar;