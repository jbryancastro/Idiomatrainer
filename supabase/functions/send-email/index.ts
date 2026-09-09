// Supabase Auth "Send Email" hook, ejecutado como Edge Function.
// Reemplaza el envío de correos por defecto de Supabase y usa Resend para
// entregar el código OTP de recuperación de contraseña (y otros eventos).
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string).replace(
  'v1,whsec_',
  ''
);

// Asunto y cuerpo por tipo de evento que Supabase puede solicitar enviar.
const subjectByType: Record<string, string> = {
  signup: 'Confirma tu correo',
  recovery: 'Tu código para restablecer la contraseña',
  invite: 'Has sido invitado',
  magiclink: 'Tu código de acceso',
  email_change: 'Confirma tu nuevo correo',
  reauthentication: 'Tu código de verificación',
};

const buildHtml = (token: string, subject: string) => `
  <h2>${subject}</h2>
  <p>Usa este código en la aplicación IdiomaTrainer:</p>
  <h1 style="letter-spacing:4px;">${token}</h1>
  <p>El código caduca pronto y solo puede usarse una vez.</p>
`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: { token: string; email_action_type: string };
    };

    const subject = subjectByType[email_data.email_action_type] ?? 'Notificación';

    const { error } = await resend.emails.send({
      from: 'IdiomaTrainer <onboarding@resend.dev>',
      to: [user.email],
      subject,
      html: buildHtml(email_data.token, subject),
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: (error as Error).message } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
