export * from './auth/types';
export * from './firestore/types';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type TokenGetter = (claims?: Record<string, any>) => Promise<string>;

export interface ServiceAccount {
  projectId: string;
  databaseId?: string;
  privateKeyId: string;
  privateKey: string;
  clientEmail: string;
  clientId: string;
}
export interface ServiceAccountUnderscored {
  project_id: string;
  database_id?: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
}

export interface UserAccount {
  getToken: TokenGetter;
  projectId: string;
  databaseId?: string;
}

export type Settings = ServiceAccount | UserAccount;
