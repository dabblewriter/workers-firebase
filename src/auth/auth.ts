import { decode } from '@tsndr/cloudflare-worker-jwt';
import { FirebaseService } from '../service';
import type { ServiceAccountUnderscored, Settings } from '../types';
import type {
  AccountQuery,
  AccountQueryResult,
  FirebaseUserInfo,
  SignInFirebaseResponse,
  SignInResponse,
  TokenPayload,
  TokenResponse,
  Tokens,
  User,
} from './types';

const returnSecureToken = true; // used for adding boolean in requests
const uidLength = 28;
const oauthScope = 'https://www.googleapis.com/auth/identitytoolkit';
const importAlgorithm = { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } };
const textToBytes = (s: string) => new Uint8Array(Array.prototype.map.call(s, (c: string) => c.charCodeAt(0)));
const base64ToBytes = (s: string) => textToBytes(atob(s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')));

export type GetUsersOptions = {
  uids?: string[];
  emails?: string[];
};

export class Auth extends FirebaseService {
  getToken: (claims?: object) => Promise<string>;

  constructor(settings: Settings | ServiceAccountUnderscored, apiKey: string) {
    super('auth', 'https://identitytoolkit.googleapis.com/v1', settings, apiKey);
  }

  async setCustomUserClaims(uid: string, claims: Record<string, any>) {
    await this.request('POST', 'accounts:update', {
      customAttributes: JSON.stringify(claims),
      localId: uid,
    }, oauthScope);
  }

  async verify(token: string) {
    // implement ourselves to avoid double decode calls
    if (typeof token !== 'string') throw new Error('JWT token must be a string');
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) throw new Error('JWT token must consist of 3 parts');
    const {
      header: { alg, kid },
      payload,
    } = decode(token) as { header: any; payload: TokenPayload };
    if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) throw 'JWT token not yet valid';
    if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) throw 'JWT token expired';
    const jsonWebKey = await getPublicKey(kid);
    if (alg !== 'RS256' || !jsonWebKey || payload.iss !== `https://securetoken.google.com/${this.settings.projectId}`)
      throw new Error('JWT invalid');
    const key = await crypto.subtle.importKey('jwk', jsonWebKey, importAlgorithm, false, ['verify']);
    const verified = await crypto.subtle.verify(
      importAlgorithm,
      key,
      base64ToBytes(tokenParts[2]),
      textToBytes(`${tokenParts[0]}.${tokenParts[1]}`)
    );
    if (!verified) throw new Error('JWT invalid');
    return payload;
  }

  async signInWithEmailAndPassword(email: string, password: string): Promise<SignInResponse> {
    email = email && email.toLowerCase();
    const data = { email, password, returnSecureToken };
    const result: SignInFirebaseResponse = await this.userRequest('POST', 'accounts:signInWithPassword', data);
    const tokens = convertSignInResponse(result);
    const user = await this.getUser(tokens.idToken);
    return { user, tokens };
  }

  // 0auth signing
  async signInWithIdp(credentials: string, requestUri: string, returnIdpCredential = false): Promise<SignInResponse> {
    const data = {
      postBody: credentials,
      requestUri,
      returnSecureToken,
      returnIdpCredential,
    };
    const result: SignInFirebaseResponse = await this.userRequest('POST', 'accounts:signInWithIdp', data);
    const tokens = convertSignInResponse(result);

    const user = await this.getUser(tokens.idToken);
    return { user, tokens, isNewUser: result?.isNewUser };
  }

  async signInWithCustomToken(token: string): Promise<SignInResponse> {
    const data = { token, returnSecureToken };
    const result: SignInFirebaseResponse = await this.userRequest('POST', 'accounts:signInWithCustomToken', data);
    const tokens = convertSignInResponse(result);
    const user = await this.getUser(tokens.idToken);
    return { user, tokens };
  }

  async refreshToken(refreshToken: string) {
    const data = { grant_type: 'refresh_token', refresh_token: refreshToken };
    const result: TokenResponse = await POST(`https://securetoken.googleapis.com/v1/token?key=${this.apiKey}`, data);
    const tokens: Tokens = {
      idToken: result.id_token,
      refreshToken: result.refresh_token,
    };
    return tokens;
  }

  async signUp(email: string, password: string, name?: string) {
    const data = { email, password, returnSecureToken };
    const result: any = await this.userRequest('POST', 'accounts:signUp', data);
    await this.userRequest('POST', 'accounts:update', {
      displayName: name,
      idToken: result.idToken,
    });
    const tokens = convertSignInResponse(result);

    const user = await this.getUser(tokens.idToken);
    user.name = name;
    return { user, tokens };
  }

  async getUser(idTokenOrUID: string) {
    let response: { users: FirebaseUserInfo[] };
    if (idTokenOrUID.length === uidLength) {
      response = await this.request('POST', 'accounts:lookup', { localId: [idTokenOrUID] }, oauthScope);
    } else {
      response = await this.userRequest('POST', 'accounts:lookup', { idToken: idTokenOrUID });
    }
    if (response.users?.length) {
      return convertUserData(response.users[0]);
    } else {
      return null;
    }
  }

  async getUsers(options: GetUsersOptions) {
    const { uids, emails } = options;
    const response: any = await this.request(
      'POST',
      'accounts:lookup',
      {
        localId: uids,
        email: emails,
      },
      oauthScope
    );
    // may not be returned in the same order, we will sort it
    const map = new Map<string, User>();
    (response.users || []).forEach((data: any) => map.set(uids ? data.localId : data.email, convertUserData(data)));
    return (uids || emails).map(lookup => map.get(lookup) || null);
  }

  async updateUser(idTokenOrUID: string, updates: any) {
    if (
      !idTokenOrUID ||
      typeof idTokenOrUID !== 'string' ||
      !updates ||
      typeof updates !== 'object' ||
      Array.isArray(updates)
    ) {
      throw new Error('INVALID_DATA');
    }
    if (idTokenOrUID.length === uidLength) idTokenOrUID = await this.getUserToken(idTokenOrUID);
    const { name, email, photoUrl } = updates;
    updates = {
      displayName: name,
      email,
      photoUrl,
      idToken: idTokenOrUID,
      returnSecureToken: true,
    };
    const result = (await this.userRequest('POST', 'accounts:update', updates)) as SignInFirebaseResponse;
    return convertSignInResponse(result);
  }

  async updatePassword(idTokenOrUID: string, password: string) {
    if (!idTokenOrUID || typeof idTokenOrUID !== 'string' || !password || typeof password !== 'string') {
      throw new Error('INVALID_DATA');
    }
    let result: SignInFirebaseResponse;
    if (idTokenOrUID.length === uidLength) {
      result = await this.request<SignInFirebaseResponse>(
        'POST',
        'accounts:update',
        {
          password,
          localId: idTokenOrUID,
          returnSecureToken,
        },
        oauthScope
      );
    } else {
      result = await this.userRequest<SignInFirebaseResponse>('POST', 'accounts:update', {
        password,
        idToken: idTokenOrUID,
        returnSecureToken,
      });
    }
    return convertSignInResponse(result);
  }

  async deleteUser(idTokenOrUID: string) {
    if (idTokenOrUID.length === uidLength) {
      await this.request('POST', 'accounts:delete', { localId: idTokenOrUID }, oauthScope);
    } else {
      await this.userRequest('POST', 'accounts:delete', { idToken: idTokenOrUID });
    }
  }

  async sendVerification(idTokenOrUID: string) {
    if (idTokenOrUID.length === uidLength) idTokenOrUID = await this.getUserToken(idTokenOrUID);
    const data = { requestType: 'VERIFY_EMAIL', idToken: idTokenOrUID };
    await this.userRequest('POST', 'accounts:sendOobCode', data);
  }

  async verifyAccount(oobCode: string) {
    const result = (await this.userRequest('POST', 'accounts:update', {
      oobCode,
    })) as SignInFirebaseResponse;
    return convertSignInResponse(result);
  }

  async requestPasswordReset(email: string) {
    const data = { requestType: 'PASSWORD_RESET', email };
    await this.userRequest('POST', 'accounts:sendOobCode', data);
  }

  async resetPassword(oobCode: string, newPassword: string) {
    const data = { oobCode, newPassword };
    await this.userRequest('POST', 'accounts:resetPassword', data);
  }

  async queryAccounts(options: AccountQuery): Promise<AccountQueryResult> {
    if ('limit' in options) {
      (options as any).limit = options.limit?.toString();
    }
    if ('offset' in options) {
      (options as any).offset = options.offset?.toString();
    }
    const result: any = await this.request(
      'POST',
      `projects/${this.settings.projectId}/accounts:query`,
      options,
      oauthScope
    );
    return {
      count: parseInt(result.recordsCount),
      users: result.userInfo?.map(convertUserData),
    };
  }

  async createCustomToken(uid: string) {
    const token = await this.getToken({ uid });
    return token;
  }

  async getUserToken(uid: string) {
    return (await this.signInWithCustomToken(await this.createCustomToken(uid))).tokens.idToken;
  }
}

async function POST<T>(url: string, body: any) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  const error = (data as any)?.error as { code: number; message: string };
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

function convertUserData(user: FirebaseUserInfo): User {
  let claims: Record<string, any> = {};

  if (user.customAttributes) {
    try {
      claims = JSON.parse(user.customAttributes);
      // tslint:disable-next-line:no-empty
    } catch (err) {}
  }

  return {
    uid: user.localId,
    name: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    photoUrl: user.photoUrl,
    passwordUpdatedAt: user.passwordUpdatedAt,
    claims,
    validSince: parseInt(user.validSince, 10),
    disabled: user.disabled,
    lastLoginAt: parseInt(user.lastLoginAt, 10),
    createdAt: parseInt(user.createdAt, 10),
  };
}

function convertSignInResponse(response: SignInFirebaseResponse): Tokens {
  const { idToken, refreshToken } = response;
  return { idToken, refreshToken };
}

let publicKeys: Record<string, JsonWebKeyWithKid>;
async function getPublicKey(kid: string) {
  if (!publicKeys) {
    // Found this resource here https://stackoverflow.com/a/71988314/835542 since the documented one provides x509 certs, not directly useful
    const response = await fetch(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    );
    const age = parseInt(response.headers.get('Cache-Control').replace(/^.*max-age=(\d+).*$/, '$1'));
    setTimeout(() => (publicKeys = undefined), age * 1000);
    publicKeys = ((await response.json()) as GoogleKeysResponse).keys.reduce(
      (map, key) => (map[key.kid] = key) && map,
      {}
    );
  }
  return publicKeys[kid];
}

type GoogleKeysResponse = {
  keys: JsonWebKeyWithKid[];
};
