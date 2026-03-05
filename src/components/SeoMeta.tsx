"use client";

import { useEffect } from "react";

interface SeoMetaProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  imageUrl?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  appendSiteName?: boolean;
}

const SITE_NAME = "HomeCare Match";
const DEFAULT_DESCRIPTION =
  "Conectando profissionais de saúde às melhores oportunidades em Home Care.";

const ensureMeta = (name: string, attr: "name" | "property" = "name") => {
  const selector = `meta[${attr}="${name}"]`;
  const found = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (found) return found;

  const meta = document.createElement("meta");
  meta.setAttribute(attr, name);
  document.head.appendChild(meta);
  return meta;
};

const ensureCanonical = () => {
  const found = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (found) return found;

  const link = document.createElement("link");
  link.rel = "canonical";
  document.head.appendChild(link);
  return link;
};

const SeoMeta = ({
  title,
  description,
  canonicalUrl,
  imageUrl,
  robots,
  jsonLd,
  appendSiteName = true,
}: SeoMetaProps) => {
  useEffect(() => {
    const previousTitle = document.title;

    const finalTitle = title
      ? appendSiteName
        ? `${title} | ${SITE_NAME}`
        : title
      : SITE_NAME;
    const finalDescription = description || DEFAULT_DESCRIPTION;
    const finalRobots = robots || "index,follow";
    const finalCanonical =
      canonicalUrl || (typeof window !== "undefined" ? window.location.href : "");

    document.title = finalTitle;

    const descriptionMeta = ensureMeta("description");
    descriptionMeta.content = finalDescription;

    const robotsMeta = ensureMeta("robots");
    robotsMeta.content = finalRobots;

    const ogTitle = ensureMeta("og:title", "property");
    ogTitle.content = finalTitle;

    const ogDescription = ensureMeta("og:description", "property");
    ogDescription.content = finalDescription;

    const ogType = ensureMeta("og:type", "property");
    ogType.content = "website";

    const ogUrl = ensureMeta("og:url", "property");
    ogUrl.content = finalCanonical;

    const twitterCard = ensureMeta("twitter:card");
    twitterCard.content = imageUrl ? "summary_large_image" : "summary";

    const twitterTitle = ensureMeta("twitter:title");
    twitterTitle.content = finalTitle;

    const twitterDescription = ensureMeta("twitter:description");
    twitterDescription.content = finalDescription;

    if (imageUrl) {
      const ogImage = ensureMeta("og:image", "property");
      ogImage.content = imageUrl;

      const twitterImage = ensureMeta("twitter:image");
      twitterImage.content = imageUrl;
    }

    const canonical = ensureCanonical();
    canonical.href = finalCanonical;

    document
      .querySelectorAll('script[data-seo-jsonld="true"]')
      .forEach((node) => node.parentElement?.removeChild(node));

    const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
    schemas.forEach((schema) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-jsonld", "true");
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    return () => {
      document.title = previousTitle;
      document
        .querySelectorAll('script[data-seo-jsonld="true"]')
        .forEach((node) => node.parentElement?.removeChild(node));
    };
  }, [appendSiteName, canonicalUrl, description, imageUrl, jsonLd, robots, title]);

  return null;
};

export default SeoMeta;
