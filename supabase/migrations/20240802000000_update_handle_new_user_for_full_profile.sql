-- This migration updates the handle_new_user function to populate more profile fields
-- from user metadata during signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
      DECLARE
        admin_count INTEGER;
        user_role TEXT;
        meta_coupon TEXT;
        coupon_id_found UUID;
        coupon_days_found INTEGER;
        final_tier TEXT;
        final_end_at TIMESTAMP WITH TIME ZONE;
        final_coupon_days INTEGER;
      BEGIN
        -- Captura metadados
        user_role := new.raw_user_meta_data ->> 'role';
        meta_coupon := new.raw_user_meta_data ->> 'coupon_code';

        -- Verifica se já existe algum admin
        SELECT count(*) INTO admin_count FROM public.profiles WHERE is_admin = true;

        -- Determina o papel final do usuário
        IF admin_count = 0 THEN
          user_role := 'admin';
        ELSE
          IF user_role IS NULL OR user_role NOT IN ('company', 'family', 'professional') THEN
            user_role := 'professional';
          END IF;
        END IF;

        -- Valores padrão
        final_tier := CASE WHEN user_role = 'professional' THEN 'free_trial' ELSE NULL END;
        final_end_at := NULL;
        final_coupon_days := NULL;

        -- 1. BUSCA O CUPOM (Se fornecido e for profissional)
        IF meta_coupon IS NOT NULL AND user_role = 'professional' THEN
          SELECT id, free_days INTO coupon_id_found, coupon_days_found 
          FROM public.coupons 
          WHERE upper(code) = upper(meta_coupon) 
            AND is_active = true 
            AND current_uses < max_uses 
          LIMIT 1;
          
          IF coupon_id_found IS NOT NULL THEN
            final_tier := 'monthly';
            final_end_at := NOW() + (coupon_days_found || ' days')::interval;
            final_coupon_days := coupon_days_found;
          END IF;
        END IF;

        -- 2. INSERÇÃO DO PERFIL (Sempre primeiro para garantir integridade)
        INSERT INTO public.profiles (
          id, 
          full_name, 
          email, 
          is_admin, 
          role, 
          subscription_tier, 
          subscription_end_at,
          trial_started_at,
          coupon_days,
          cancel_at_period_end,
          -- Novos campos a serem preenchidos a partir de raw_user_meta_data
          registration,
          specialty,
          city,
          state,
          neighborhood,
          experience,
          professional_experiences,
          bio,
          avatar_url,
          phone,
          hourly_rate,
          id_document_url,
          prof_registration_url,
          company_name,
          cnpj,
          availability,
          patient_profiles,
          address_zip,
          address_street,
          address_number,
          address_complement,
          lat,
          lng,
          is_verified, -- Pode ser definido pelo admin na criação
          verification_sent, -- Pode ser definido pelo admin na criação
          has_seen_onboarding, -- Pode ser definido pelo admin na criação
          notifications_enabled -- Pode ser definido pelo admin na criação
        )
        VALUES (
          new.id, 
          new.raw_user_meta_data ->> 'full_name',
          new.email,
          (user_role = 'admin'),
          user_role,
          final_tier,
          final_end_at,
          CASE WHEN user_role = 'professional' AND final_coupon_days IS NULL THEN NOW() ELSE NULL END,
          final_coupon_days,
          (final_coupon_days IS NOT NULL),
          -- Valores para os novos campos
          new.raw_user_meta_data ->> 'registration',
          new.raw_user_meta_data ->> 'specialty',
          new.raw_user_meta_data ->> 'city',
          new.raw_user_meta_data ->> 'state',
          new.raw_user_meta_data ->> 'neighborhood',
          new.raw_user_meta_data ->> 'experience',
          new.raw_user_meta_data ->> 'professional_experiences',
          new.raw_user_meta_data ->> 'bio',
          new.raw_user_meta_data ->> 'avatar_url',
          new.raw_user_meta_data ->> 'phone',
          (new.raw_user_meta_data ->> 'hourly_rate')::NUMERIC,
          new.raw_user_meta_data ->> 'id_document_url',
          new.raw_user_meta_data ->> 'prof_registration_url',
          new.raw_user_meta_data ->> 'company_name',
          new.raw_user_meta_data ->> 'cnpj',
          (SELECT ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data -> 'availability'))),
          (SELECT ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data -> 'patient_profiles'))),
          new.raw_user_meta_data ->> 'address_zip',
          new.raw_user_meta_data ->> 'address_street',
          new.raw_user_meta_data ->> 'address_number',
          new.raw_user_meta_data ->> 'address_complement',
          (new.raw_user_meta_data ->> 'lat')::NUMERIC,
          (new.raw_user_meta_data ->> 'lng')::NUMERIC,
          (new.raw_user_meta_data ->> 'is_verified')::BOOLEAN,
          (new.raw_user_meta_data ->> 'verification_sent')::BOOLEAN,
          (new.raw_user_meta_data ->> 'has_seen_onboarding')::BOOLEAN,
          (new.raw_user_meta_data ->> 'notifications_enabled')::BOOLEAN
        );

        -- 3. REGISTRA O USO DO CUPOM (Após o perfil existir)
        IF coupon_id_found IS NOT NULL THEN
          -- Registra o uso
          INSERT INTO public.coupon_usages (coupon_id, user_id) 
          VALUES (coupon_id_found, new.id)
          ON CONFLICT DO NOTHING;
          
          -- Incrementa o contador
          UPDATE public.coupons 
          SET current_uses = current_uses + 1 
          WHERE id = coupon_id_found;
        END IF;

        RETURN new;
      END;
      $$;

-- Notifica o PostgREST para recarregar o esquema
NOTIFY pgrst, 'reload schema';