export interface TokenPayload {
  // Custom data
  user_id: string;
  name: string;
  email: string;
  email_verified: boolean;

  iss: string; // Issuer
  aud: string; // Audience
  auth_time: string; // Time when auth occurred
  sub: string; // Subject (uid)
  iat: number; // Issued At
  exp: number; // Expiration
  nbf: number; // Not before
}

export interface TokenResponse {
  user_id: string;
  id_token: string;
  refresh_token: string;
}

export interface SignInFirebaseResponse {
  idToken: string; // A Firebase Auth ID token for the authenticated user.
  email: string; // The email for the authenticated user.
  refreshToken: string; // A Firebase Auth refresh token for the authenticated user.
  expiresIn: string; // The number of seconds in which the ID token expires.
  localId: string; // The uid of the authenticated user.
  isNewUser?: boolean; // Is the firebase user new (used for google onetap)
}

export interface FirebaseProviderUserInfo {
  providerId: string;
  displayName: string;
  photoUrl: string;
  federatedId: string;
  email: string;
  rawId: string;
  screenName: string;
  phoneNumber: string;
}

export interface FirebaseEmailInfo {
  emailAddress: string;
}

export interface FirebaseMfaEnrollment {
  mfaEnrollmentId: string;
  displayName: string;
  enrolledAt: string;

  // Union field mfa_value can be only one of the following:
  phoneInfo: string;
  totpInfo: {};
  emailInfo: FirebaseEmailInfo;
  // End of list of possible types for union field mfa_value.

  // Union field unobfuscated_mfa_value can be only one of the following:
  unobfuscatedPhoneInfo: string;
  // End of list of possible types for union field unobfuscated_mfa_value.
}

export interface FirebaseUserInfo {
  localId: string;
  email: string;
  displayName: string;
  language: string;
  photoUrl: string;
  timeZone: string;
  dateOfBirth: string;
  passwordHash: string;
  salt: string;
  version: number;
  emailVerified: boolean;
  passwordUpdatedAt: number;
  providerUserInfo: FirebaseProviderUserInfo[];
  validSince: string;
  disabled: boolean;
  lastLoginAt: string;
  createdAt: string;
  screenName: string;
  customAuth: boolean;
  rawPassword: string;
  phoneNumber: string;
  customAttributes: string;
  emailLinkSignin: boolean;
  tenantId: string;
  mfaInfo: FirebaseMfaEnrollment[];
  initialEmail: string;
  lastRefreshAt: string;
}

export interface Tokens {
  idToken: string; // A Firebase Auth ID token for the authenticated user.
  refreshToken: string; // A Firebase Auth refresh token for the authenticated user.
  customToken?: string; // Signin by token token.
}

export interface SignInResponse {
  user: User;
  tokens: Tokens;
  isNewUser?: boolean;
}

export interface RequestCode {
  requestType: string;
  email?: string;
  idToken?: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  photoUrl: string;
  passwordUpdatedAt: number;
  validSince: number;
  claims: Record<string, any>;
  disabled: boolean;
  lastLoginAt: number;
  createdAt: number;
}

export type AccountQuerySort =
  | 'SORT_BY_FIELD_UNSPECIFIED'
  | 'USER_ID'
  | 'NAME'
  | 'CREATED_AT'
  | 'LAST_LOGIN_AT'
  | 'USER_EMAIL';
export type AccountQueryOrder = 'ORDER_UNSPECIFIED' | 'ASC' | 'DESC';
export type AccountQueryExpression = { email: string } | { userId: string } | { phoneNumber: string };

export interface AccountQuery {
  returnUserInfo?: boolean; // default true, if false the count will be returned
  limit?: string; // default 500
  offset?: string;
  sortBy?: AccountQuerySort; // default USER_ID
  order?: AccountQueryOrder; // default ASC
  tenantId?: string;
  expression: [AccountQueryExpression];
}

export interface AccountQueryResult {
  count: number;
  users: User[];
}
