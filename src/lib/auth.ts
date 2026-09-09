type AuthResponse = {
  access_token?: string;
  user?: {
    id: string;
    email?: string;
    identities?: Array<unknown>;
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

  return result;
};

export const signInWithEmail = (email: string, password: string) =>
  requestAuth('token?grant_type=password', {
    email: email.trim().toLowerCase(),
    password,
  });

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
