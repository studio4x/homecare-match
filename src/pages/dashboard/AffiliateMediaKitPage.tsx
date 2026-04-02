"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Link as LinkIcon, Megaphone, MessageSquare } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSiteConfig } from "@/hooks/use-site-config";

type MediaKitPrompt = {
  title?: string;
  description?: string;
  copy_label?: string;
  content?: string;
};

type MediaKitImage = {
  url?: string;
  title?: string;
  caption?: string;
};

const AffiliateMediaKitPage = () => {
  const { user } = useAuth();
  const { data: siteConfig } = useSiteConfig();
  const { data: affiliateDashboardData } = useQuery({
    queryKey: ["affiliate-dashboard-media-kit", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("affiliate-dashboard-stats");
      if (error) throw error;
      return data as { links?: Array<{ short_url?: string | null }> };
    },
  });

  const affiliateLink = useMemo(() => {
    const officialLink = affiliateDashboardData?.links?.find((link) => link?.short_url)?.short_url;
    return officialLink || `${window.location.origin}/convite`;
  }, [affiliateDashboardData?.links]);
  const companyLandingPage = useMemo(() => `${window.location.origin}/empresas`, []);
  const mediaKitConfig = siteConfig?.affiliate_media_kit_config;

  const mediaKitItems = useMemo(() => {
    const promptIcons = [MessageSquare, Megaphone, LinkIcon];
    const prompts = Array.isArray(mediaKitConfig?.prompts) ? mediaKitConfig.prompts : [];

    const fallbackPrompts: MediaKitPrompt[] = [
      {
        title: "Mensagem para WhatsApp",
        description: "Texto pronto para compartilhar com contatos e grupos qualificados.",
        copy_label: "Copiar mensagem",
        content:
          "Estou divulgando a HomeCare Match, uma plataforma que aproxima profissionais e oportunidades no setor de cuidados. Se fizer sentido para voce, esse e meu link oficial: {{affiliate_link}}",
      },
      {
        title: "Pitch para empresas",
        description: "Convite rapido para empresas conhecerem a pagina institucional.",
        copy_label: "Copiar pitch",
        content:
          "Quero te apresentar a HomeCare Match. A plataforma ajuda empresas a encontrar profissionais com mais agilidade. Conheca a pagina para empresas: {{company_page_link}}",
      },
      {
        title: "Legenda para redes sociais",
        description: "CTA curto para post, story ou bio com link.",
        copy_label: "Copiar legenda",
        content:
          "Profissionais e empresas de Home Care em um so lugar. Conheca a HomeCare Match pelo meu link oficial: {{affiliate_link}}",
      },
    ];

    const source = prompts.length > 0 ? prompts : fallbackPrompts;

    return source.map((item, index) => ({
      title: item.title || `Prompt ${index + 1}`,
      description: item.description || "Texto configurado no painel admin.",
      copyLabel: item.copy_label || "Copiar texto",
      icon: promptIcons[index] || Megaphone,
      content: String(item.content || "")
        .replaceAll("{{affiliate_link}}", affiliateLink)
        .replaceAll("{{company_page_link}}", companyLandingPage),
    }));
  }, [affiliateLink, companyLandingPage, mediaKitConfig?.prompts]);

  const mediaKitImages = useMemo(() => {
    const images = Array.isArray(mediaKitConfig?.images) ? mediaKitConfig.images : [];
    return images.filter((item: MediaKitImage) => item?.url);
  }, [mediaKitConfig?.images]);

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Nao foi possivel copiar.");
    }
  };

  const handleDownloadImage = async (url: string, title: string, index: number) => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("download_failed");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const extension = blob.type.split("/")[1]?.split(";")[0] || "jpg";
      const sanitizedTitle =
        title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `arte-${index + 1}`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${sanitizedTitle}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      toast.success("Download da imagem iniciado.");
    } catch {
      toast.error("Nao foi possivel baixar a imagem.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{mediaKitConfig?.title || "Kit de midia"}</h1>
        <p className="text-muted-foreground">
          {mediaKitConfig?.description ||
            "Materiais prontos para divulgar seu link de afiliado e apresentar a plataforma para empresas."}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {mediaKitItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
                  <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm leading-6">
                    {item.content}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(item.content, `${item.title} copiado.`)}
                    className="mt-3 gap-1"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {item.copyLabel}
                  </Button>
                </div>
              );
            })}
          </div>

          {mediaKitImages.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Artes prontas</h3>
                <p className="text-xs text-muted-foreground">Use estas imagens como apoio nas suas divulgacoes.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {mediaKitImages.map((image: MediaKitImage, index: number) => (
                  <div key={`${image.url}-${index}`} className="overflow-hidden rounded-xl border bg-card">
                    <img
                      src={image.url}
                      alt={image.title || `Arte ${index + 1}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <div className="space-y-2 p-3">
                      <p className="text-sm font-medium">{image.title || `Arte ${index + 1}`}</p>
                      {image.caption ? <p className="text-xs text-muted-foreground">{image.caption}</p> : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleDownloadImage(
                            image.url || "",
                            image.title || `Arte ${index + 1}`,
                            index,
                          )
                        }
                        className="gap-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Baixar imagem
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateMediaKitPage;
