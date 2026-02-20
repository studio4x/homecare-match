// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Não autorizado');

    const { code } = await req.json();
    const cleanCode = code.trim().toUpperCase();

    // 1. Buscar cupom
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', cleanCode)
      .eq('is_active', true)
      .single();

    if (couponError || !coupon) throw new Error('Cupom inválido ou expirado.');

    // 2. Verificar limites
    if (coupon.current_uses >= coupon.max_uses) {
      throw new Error('Este cupom já atingiu o limite máximo de utilizações.');
    }

    // 3. Verificar se o usuário já usou este cupom
    const { data: existingUsage } = await supabaseAdmin
      .from('coupon_usages')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingUsage) throw new Error('Você já utilizou este cupom.');

    // 4. Aplicar benefício (Estender assinatura mensal)
    const freeDays = coupon.free_days;
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + freeDays);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: 'monthly',
        subscription_end_at: newEndDate.toISOString(),
        cancel_at_period_end: true, // Não renova automaticamente após os dias grátis
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // 5. Registrar uso
    await supabaseAdmin.from('coupon_usages').insert({
      coupon_id: coupon.id,
      user_id: user.id
    });

    // 6. Incrementar contador do cupom
    await supabaseAdmin.rpc('increment_coupon_uses', { coupon_id: coupon.id });

    // Notificação para o usuário
    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      title: "🎁 Cupom Aplicado!",
      content: `Parabéns! Você ganhou ${freeDays} dias de acesso ao Plano Mensal. Aproveite!`,
      type: 'success'
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Cupom aplicado! Você ganhou ${freeDays} dias de acesso.`,
      freeDays 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});