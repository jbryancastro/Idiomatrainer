// Edge Function: indica si un correo tiene cuenta. Se usa solo tras un inicio de
// sesión fallido para distinguir "sin cuenta" de "contraseña incorrecta".
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1 });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || !email.includes('@')) {
    return json({ error: 'Correo inválido.' }, 400);
  }

  try {
    const rows = await sql`
      select 1 from auth.users where lower(email) = ${email.trim().toLowerCase()} limit 1
    `;
    return json({ exists: rows.length > 0 });
  } catch (error) {
    console.error('check-email failed', error);
    return json({ error: 'No se pudo verificar el correo.' }, 500);
  }
});
