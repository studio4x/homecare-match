"use client";

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface SafeHTMLProps {
  content: string;
  className?: string;
}

/**
 * Componente que renderiza HTML de forma segura.
 * Remove scripts maliciosos e atributos perigosos antes da exibição.
 */
const SafeHTML = ({ content, className }: SafeHTMLProps) => {
  const sanitizedContent = useMemo(() => {
    if (!content) return "";
    
    // Configuração básica para permitir tags de formatação e links seguros
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
        'ul', 'ol', 'li', 'span', 'div', 'blockquote', 'a', 'iframe'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'allowfullscreen', 'frameborder'],
      ADD_ATTR: ['target']
    });
  }, [content]);

  if (!content) return null;

  return (
    <div 
      className={cn("prose prose-slate max-w-none break-words", className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

export default SafeHTML;