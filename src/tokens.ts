import { sign } from '@tsndr/cloudflare-worker-jwt';
import type { ServiceAccount, TokenGetter } from './types';

const exp = 3600;
const aud = {
  oauth: 'https://oauth2.googleapis.com/token',
  auth: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
  firestore: 'https://firestore.googleapis.com/google.firestore.v1.Firestore',
  storage: 'https://www.googleapis.com/auth/devstorage.read_only',
};

export type Aud = Omit<typeof aud, 'oauth'>;

export function getTokenGetter(settings: ServiceAccount, service: keyof Aud): TokenGetter {
  let token: string;
  let tokenExp: number;

  const getOauthToken = getOauthTokenGetter(settings);

  return async function getToken(claims?: Record<string, any>) {
    if (claims) {
      return await (claims.scope ? getOauthToken(claims.scope) : createToken(settings, service, claims));
    }

    if (!tokenExp || now() > tokenExp - 60) {
      token = await createToken(settings, service);
      tokenExp = now() + exp;
    }
    return token;
  };
}

export function getOauthTokenGetter(settings: ServiceAccount) {
  const tokens = new Map<string, string>();
  const tokenExps = new Map<string, number>();

  return async function getOauthToken(scope: string) {
    let token = tokens.get(scope);
    const tokenExp = tokenExps.get(scope);

    if (!tokenExp || now() > tokenExp - 60) {
      const oauthToken = await createToken(settings, 'oauth', { scope });
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=&assertion=${oauthToken}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
      tokens.set(scope, (token = access_token));
      tokenExps.set(scope, now() + (expires_in || 0));
    }

    return token;
  };
}

// Create firebase service account JWT to use in API calls
export async function createToken(
  serviceAccount: ServiceAccount,
  service: keyof typeof aud,
  claims?: object
): Promise<string> {
  const iat = now();
  return await sign(
    {
      aud: aud[service],
      iss: serviceAccount.clientEmail,
      sub: serviceAccount.clientEmail,
      iat,
      exp: iat + exp,
      ...claims,
    },
    serviceAccount.privateKey,
    {
      algorithm: 'RS256',
      header: {
        typ: 'JWT',
        alg: 'RS256',
        kid: serviceAccount.privateKeyId,
      },
    }
  );
}

function now() {
  return Math.floor(Date.now() / 1000);
}
