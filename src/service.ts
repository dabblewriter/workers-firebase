import { StatusError } from './status-error';
import { Aud, getTokenGetter } from './tokens';
import type { HTTPMethod, ServiceAccount, ServiceAccountUnderscored, Settings, TokenGetter, UserAccount } from './types';

export class FirebaseService {
  getToken: TokenGetter;
  protected readonly settings: Settings;

  constructor(
    service: keyof Aud,
    protected readonly apiUrl: string,
    settings: Settings | ServiceAccountUnderscored,
    protected readonly apiKey: string
  ) {
    if ((settings as ServiceAccountUnderscored).private_key) {
      settings = {
        projectId: (settings as ServiceAccountUnderscored).project_id,
        databaseId: (settings as ServiceAccountUnderscored).database_id,
        privateKeyId: (settings as ServiceAccountUnderscored).private_key_id,
        privateKey: (settings as ServiceAccountUnderscored).private_key,
        clientEmail: (settings as ServiceAccountUnderscored).client_email,
        clientId: (settings as ServiceAccountUnderscored).client_id,
      };
    }
    this.settings = settings as Settings;
    this.getToken = (settings as UserAccount).getToken || getTokenGetter(settings as ServiceAccount, service);
  }

  request<T>(
    method: HTTPMethod,
    path: string,
    search?: URLSearchParams,
    body?: object,
    authorized?: boolean | string
  ): Promise<T>;
  request<T>(method: HTTPMethod, path: string, body?: object, authorized?: string): Promise<T>;
  async request<T>(
    method: HTTPMethod,
    path?: string,
    searchOrBody?: URLSearchParams | object,
    body?: object | string,
    authorized?: string
  ): Promise<T> {
    if (typeof body === 'boolean' || typeof body === 'string') {
      authorized = body;
      body = undefined;
    }
    const searchParams = searchOrBody instanceof URLSearchParams ? searchOrBody : new URLSearchParams();
    searchParams.set('key', this.apiKey);
    if (!body && searchOrBody && !(searchOrBody instanceof URLSearchParams)) body = searchOrBody;
    if (path && path[0] !== ':' && path[0] !== '/') path = '/' + path;
    let Authorization: string | undefined;
    if (typeof authorized === 'string') {
      Authorization = `Bearer ${await this.getToken({ scope: authorized })}`;
    } else if (authorized !== false) {
      Authorization = `Bearer ${await this.getToken()}`;
    }
    const response = await fetch(`${this.apiUrl}${path}?${searchParams}`, {
      method,
      body: JSON.stringify(body),
      headers: {
        Authorization,
        'Content-Type': 'application/json',
      },
    });
    const data = (await response.json()) as any;
    if (data.error) {
      throw new StatusError(data.error.code, data.error.message);
    }
    return data;
  }

  userRequest<T>(method: HTTPMethod, path: string, search?: URLSearchParams, body?: object): Promise<T>;
  userRequest<T>(method: HTTPMethod, path: string, body?: object): Promise<T>;
  async userRequest<T>(
    method: HTTPMethod,
    path?: string,
    searchOrBody?: URLSearchParams | object,
    body?: object
  ): Promise<T> {
    return this.request(method, path, searchOrBody as any, body, false);
  }
}
