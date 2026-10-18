import { getAccessToken, getSessionUser } from '@/lib/auth';

export type Plan = {
  code: 'basic' | 'premium';
  name: string;
  tagline: string;
  description: string;
  features: string[];
};

export type Subscription = {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  billingInterval: 'monthly' | 'yearly';
  startedAt: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  plan: Plan;
};

export type SubscriptionResult =
  | { state: 'subscribed'; subscription: Subscription }
  | { state: 'none'; basicPlan: Plan | null };

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

type PlanRow = {
  code: Plan['code'];
  name: string;
  tagline: string;
  description: string;
  features: string[];
};

type SubscriptionRow = {
  status: Subscription['status'];
  billing_interval: Subscription['billingInterval'];
  started_at: string;
  current_period_end: string | null;
  canceled_at: string | null;
  plans: PlanRow | null;
};

const rest = async <T>(path: string, token: string): Promise<T> => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: supabaseAnonKey!, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('No se pudo consultar tu suscripción.');
  return (await response.json()) as T;
};

export const fetchSubscription = async (): Promise<SubscriptionResult> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env.local.');
  }
  const [user, token] = await Promise.all([getSessionUser(), getAccessToken()]);
  if (!user || !token) throw new Error('Inicia sesión con tu correo para ver tu suscripción.');

  const rows = await rest<SubscriptionRow[]>(
    `subscriptions?select=status,billing_interval,started_at,current_period_end,canceled_at,plans(code,name,tagline,description,features)&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    token
  );
  const row = rows[0];
  if (row?.plans) {
    return {
      state: 'subscribed',
      subscription: {
        status: row.status,
        billingInterval: row.billing_interval,
        startedAt: row.started_at,
        currentPeriodEnd: row.current_period_end,
        canceledAt: row.canceled_at,
        plan: row.plans,
      },
    };
  }

  const basic = await rest<PlanRow[]>(
    'plans?select=code,name,tagline,description,features&code=eq.basic&limit=1',
    token
  );
  return { state: 'none', basicPlan: basic[0] ?? null };
};
