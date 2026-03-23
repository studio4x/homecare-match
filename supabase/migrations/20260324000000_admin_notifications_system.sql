-- Habilita RLS nas tabelas de suporte caso não estejam
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para support_tickets
DROP POLICY IF EXISTS "Usuários podem ver seus próprios tickets" ON public.support_tickets;
CREATE POLICY "Usuários podem ver seus próprios tickets"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))));

DROP POLICY IF EXISTS "Usuários podem criar seus próprios tickets" ON public.support_tickets;
CREATE POLICY "Usuários podem criar seus próprios tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Políticas para support_messages
DROP POLICY IF EXISTS "Usuários podem ver mensagens de seus tickets" ON public.support_messages;
CREATE POLICY "Usuários podem ver mensagens de seus tickets"
ON public.support_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = support_messages.ticket_id 
    AND (user_id = auth.uid() OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))))
  )
);

DROP POLICY IF EXISTS "Usuários podem enviar mensagens em seus tickets" ON public.support_messages;
CREATE POLICY "Usuários podem enviar mensagens em seus tickets"
ON public.support_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = support_messages.ticket_id 
    AND (user_id = auth.uid() OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))))
  )
);

-- NOTA: O disparo de WhatsApp e E-mail é feito via Edge Function 'notify-support' 
-- chamada diretamente pelo frontend no momento do envio da mensagem, 
-- garantindo o uso de templates e logs centralizados.
