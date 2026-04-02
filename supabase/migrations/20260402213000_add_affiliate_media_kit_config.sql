ALTER TABLE public.site_config
ADD COLUMN IF NOT EXISTS affiliate_media_kit_config jsonb NOT NULL DEFAULT jsonb_build_object(
  'title', 'Kit de midia',
  'description', 'Materiais prontos para divulgar seu link de afiliado e apresentar a plataforma para empresas.',
  'prompts', jsonb_build_array(
    jsonb_build_object(
      'title', 'Mensagem para WhatsApp',
      'description', 'Texto pronto para compartilhar com contatos e grupos qualificados.',
      'copy_label', 'Copiar mensagem',
      'content', 'Estou divulgando a HomeCare Match, uma plataforma que aproxima profissionais e oportunidades no setor de cuidados. Se fizer sentido para voce, esse e meu link oficial: {{affiliate_link}}'
    ),
    jsonb_build_object(
      'title', 'Pitch para empresas',
      'description', 'Convite rapido para empresas conhecerem a pagina institucional.',
      'copy_label', 'Copiar pitch',
      'content', 'Quero te apresentar a HomeCare Match. A plataforma ajuda empresas a encontrar profissionais com mais agilidade. Conheca a pagina para empresas: {{company_page_link}}'
    ),
    jsonb_build_object(
      'title', 'Legenda para redes sociais',
      'description', 'CTA curto para post, story ou bio com link.',
      'copy_label', 'Copiar legenda',
      'content', 'Profissionais e empresas de Home Care em um so lugar. Conheca a HomeCare Match pelo meu link oficial: {{affiliate_link}}'
    )
  ),
  'images', jsonb_build_array()
);

UPDATE public.site_config
SET affiliate_media_kit_config = COALESCE(
  affiliate_media_kit_config,
  jsonb_build_object(
    'title', 'Kit de midia',
    'description', 'Materiais prontos para divulgar seu link de afiliado e apresentar a plataforma para empresas.',
    'prompts', jsonb_build_array(),
    'images', jsonb_build_array()
  )
)
WHERE id = 1;
