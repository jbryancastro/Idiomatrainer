import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
    identities?: Array<unknown>;
    user_metadata?: { full_name?: string; name?: string; level?: string };
  };
  msg?: string;
  error_description?: string;
  message?: string;
  error_code?: string;
};

export class AuthRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const getConfigError = () =>
  'Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env.local.';

const requestAuth = async (
  endpoint: string,
  body: Record<string, unknown>
): Promise<AuthResponse> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(getConfigError());
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as AuthResponse;

  if (!response.ok) {
    throw new AuthRequestError(
      result.error_description ??
        result.msg ??
        result.message ??
        result.error_code ??
        'No se pudo completar la solicitud.',
      response.status
    );
  }

  return result;
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const result = await requestAuth('signup', {
    email: email.trim().toLowerCase(),
    password,
    data: { full_name: name.trim() },
  });

  // Con la confirmación de correo activa, Supabase puede ocultar el duplicado
  // devolviendo un usuario sin identidades para no revelar cuentas existentes.
  if (result.user && result.user.identities?.length === 0) {
    throw new AuthRequestError('Este correo ya está registrado.', 422);
  }

  // Si el registro inicia sesión de inmediato, se guarda el nombre escrito.
  if (result.access_token && result.user) {
    await saveSessionUser({
      id: result.user.id,
      email: result.user.email ?? email.trim().toLowerCase(),
      name: name.trim() || result.user.email?.split('@')[0] || '',
      ...tokensFrom(result),
    });
  }

  return result;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

const SESSION_KEY = 'idiomatrainer.session-user';

const tokensFrom = (result: AuthResponse) => ({
  accessToken: result.access_token,
  refreshToken: result.refresh_token,
  expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
});

const saveSessionUser = (user: SessionUser) =>
  AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));

export const getSessionUser = async (): Promise<SessionUser | null> => {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
};

export const clearSessionUser = () => AsyncStorage.removeItem(SESSION_KEY);

// Devuelve un token vigente, renovándolo con el refresh token si ya venció.
export const getAccessToken = async (): Promise<string | null> => {
  const user = await getSessionUser();
  if (!user?.accessToken) return null;
  if ((user.expiresAt ?? 0) - 60_000 > Date.now()) return user.accessToken;
  if (!user.refreshToken) return null;

  try {
    const result = await requestAuth('token?grant_type=refresh_token', {
      refresh_token: user.refreshToken,
    });
    await saveSessionUser({ ...user, ...tokensFrom(result) });
    return result.access_token ?? null;
  } catch {
    return null;
  }
};

const userRequest = async (method: 'GET' | 'PUT', body?: Record<string, unknown>) => {
  const token = await getAccessToken();
  if (!supabaseUrl || !supabaseAnonKey || !token) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.ok ? ((await response.json()) as NonNullable<AuthResponse['user']>) : null;
};

// Lee el nivel guardado en la cuenta (user_metadata). null si no hay sesión o falla.
export const fetchAccountLevel = async (): Promise<string | null | undefined> => {
  const user = await userRequest('GET');
  return user ? (user.user_metadata?.level ?? null) : undefined;
};

export const saveAccountLevel = async (level: string) => {
  await userRequest('PUT', { data: { level } });
};

export const signInWithEmail = async (email: string, password: string) => {
  const result = await requestAuth('token?grant_type=password', {
    email: email.trim().toLowerCase(),
    password,
  });

  if (result.user) {
    const userEmail = result.user.email ?? email.trim().toLowerCase();
    const metadata = result.user.user_metadata;
    await saveSessionUser({
      id: result.user.id,
      email: userEmail,
      name: metadata?.full_name ?? metadata?.name ?? userEmail.split('@')[0],
      ...tokensFrom(result),
    });
  }

  return result;
};

// Devuelve si el correo tiene cuenta; undefined si no se pudo comprobar.
export const emailHasAccount = async (email: string): Promise<boolean | undefined> => {
  if (!supabaseUrl || !supabaseAnonKey) return undefined;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/check-email`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (!response.ok) return undefined;
    return Boolean((await response.json()).exists);
  } catch {
    return undefined;
  }
};

export const sendPasswordReset = (email: string) =>
  requestAuth('otp', {
    email: email.trim().toLowerCase(),
    create_user: false,
  });

export const verifyPasswordResetCode = (email: string, token: string) =>
  requestAuth('verify', {
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'recovery',
  });

export const updatePassword = async (accessToken: string, password: string) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(getConfigError());
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const result = (await response.json()) as AuthResponse;
    throw new Error(result.message ?? 'No se pudo actualizar la contraseña.');
  }
};
