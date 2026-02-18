"use client";

import React from 'react';

const AppVersion = () => {
  const version = "4.6.3";
  const lastUpdate = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="bg-secondary/50 py-2 border-t border-border/50">
      <div className="container mx-auto px-4 flex justify-center items-center gap-4 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
        <span>HomeCare Match © {new Date().getFullYear()}</span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>Build v{version}</span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>Última atualização: {lastUpdate}</span>
      </div>
    </div>
  );
};

export default AppVersion;