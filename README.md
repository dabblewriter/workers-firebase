# Firebase REST API for Cloudflare Workers

The Auth module uses Google's Identity Platform REST API found here:

* https://cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts
* https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts

Many methods can be called with an idToken from the user and only require an API key. The API key can be found in your
Firebase project settings *General* page under a web project. Other methods require a Google OAuth 2.0 token for
"admin access". This is created automatically if you provide a service account. You can get your service account JSON
in your Firebase project settings *Service accounts* page by clicking [Generate new private key].

The Firestore module uses Google's Firestore REST APIs found here:

* https://firebase.google.com/docs/firestore/use-rest-api
* https://firebase.google.com/docs/firestore/reference/rest/

## Getting Started

Install the package.

```bash
npm install workers-firebase
```

Import and initialize. You need your Firebase API key from the project settings.

```typescript
import { App, Auth, Firestore } from 'workers-firebase';

// With service account (for admin operations)
const app = new App(serviceAccount, 'your-api-key');

const auth = app.auth();
const firestore = app.firestore();
```

Or create services directly without the App wrapper.

```typescript
import { Auth, Firestore } from 'workers-firebase';

const auth = new Auth({ projectId: 'your-project-id' }, 'your-api-key');
const firestore = new Firestore({ projectId: 'your-project-id' }, 'your-api-key');
```

User operations work with just the API key. Admin operations need the service account.

```typescript
// User operation - just needs API key
const { user, tokens } = await auth.signInWithEmailAndPassword('user@example.com', 'password');

// Admin operation - requires service account
await auth.setCustomUserClaims(user.uid, { role: 'admin' });
```

## Auth

### verify
Check if a JWT token is valid. Returns the token payload with user info.

```typescript
const payload = await auth.verify(idToken);
console.log(payload.uid); // User ID
```

### signInWithEmailAndPassword
Sign in a user. Returns user data and tokens.

```typescript
const { user, tokens } = await auth.signInWithEmailAndPassword('user@example.com', 'password');
```

### signInWithIdp
Sign in with OAuth providers like Google or Facebook. Pass the credentials and request URI.

```typescript
const { user, tokens, isNewUser } = await auth.signInWithIdp(credentials, requestUri);
```

### signInWithCustomToken
Sign in using a custom token you created. Useful for server-side authentication.

```typescript
const { user, tokens } = await auth.signInWithCustomToken(customToken);
```

### refreshToken
Get a new ID token when the current one expires.

```typescript
const tokens = await auth.refreshToken(refreshToken);
```

### signUp
Create a new user account.

```typescript
const { user, tokens } = await auth.signUp('user@example.com', 'password', 'Display Name');
```

### getUser
Get user information by ID token or UID.

```typescript
const user = await auth.getUser(idToken); // or UID
```

### getUsers
Get multiple users at once by UIDs or emails.

```typescript
const users = await auth.getUsers({ uids: ['uid1', 'uid2'] });
// or
const users = await auth.getUsers({ emails: ['user1@example.com', 'user2@example.com'] });
```

### updateUser
Update user profile information.

```typescript
const tokens = await auth.updateUser(idToken, {
  name: 'New Name',
  email: 'new@example.com',
  photoUrl: 'https://example.com/photo.jpg'
});
```

### updatePassword
Change a user's password.

```typescript
const tokens = await auth.updatePassword(idToken, 'newPassword');
```

### deleteUser
Remove a user account.

```typescript
await auth.deleteUser(idToken); // or UID
```

### sendVerification
Send an email verification link to the user.

```typescript
await auth.sendVerification(idToken);
```

### verifyAccount
Confirm email verification using the code from the email.

```typescript
const tokens = await auth.verifyAccount(oobCode);
```

### requestPasswordReset
Send a password reset email.

```typescript
await auth.requestPasswordReset('user@example.com');
```

### resetPassword
Reset password using the code from the reset email.

```typescript
await auth.resetPassword(oobCode, 'newPassword');
```

### queryAccounts (Admin)
Search for users. Requires service account.

```typescript
const { count, users } = await auth.queryAccounts({ limit: 100 });
```

### setCustomUserClaims (Admin)
Add custom data to a user's token. Requires service account.

```typescript
await auth.setCustomUserClaims(uid, { role: 'admin', tier: 'premium' });
```

### createCustomToken (Admin)
Generate a custom token for a user. Requires service account.

```typescript
const customToken = await auth.createCustomToken(uid);
```

### getUserToken (Admin)
Get an ID token for any user. Requires service account.

```typescript
const idToken = await auth.getUserToken(uid);
```

## Firestore

### collection
Get a reference to a collection.

```typescript
const users = firestore.collection('users');
```

### doc
Get a reference to a document.

```typescript
const userDoc = firestore.doc('users/user123');
```

### runTransaction
Run multiple operations atomically. Either all succeed or all fail.

```typescript
await firestore.runTransaction(async () => {
  const doc = await firestore.doc('counters/visitors').get();
  const count = doc.data().count + 1;
  await firestore.doc('counters/visitors').update({ count });
});
```

### batch
Group multiple writes together. More efficient than individual writes.

```typescript
const batch = firestore.batch();
batch.create(firestore.doc('users/user1'), { name: 'Alice' });
batch.update(firestore.doc('users/user2'), { status: 'active' });
batch.delete(firestore.doc('users/user3'));
await batch.commit();
```

### autoId
Generate a unique document ID.

```typescript
const id = firestore.autoId();
```

### batchGet
Read multiple documents in one request.

```typescript
const docs = await firestore.batchGet([
  firestore.doc('users/user1'),
  firestore.doc('users/user2')
]);
```

## Document Operations

### get
Read a document.

```typescript
const doc = await firestore.doc('users/user123').get();
if (doc.exists) {
  console.log(doc.data());
}
```

### create
Create a new document. Fails if it already exists.

```typescript
await firestore.doc('users/user123').create({ name: 'Alice', email: 'alice@example.com' });
```

### set
Write a document. Overwrites if it exists.

```typescript
await firestore.doc('users/user123').set({ name: 'Alice', age: 30 });
```

Use merge to update specific fields without overwriting the whole document.

```typescript
await firestore.doc('users/user123').set({ age: 31 }, { merge: true });
```

### update
Update specific fields. Document must exist.

```typescript
await firestore.doc('users/user123').update({ age: 31, 'address.city': 'New York' });
```

### delete
Remove a document.

```typescript
await firestore.doc('users/user123').delete();
```

### listCollections
Get all subcollections under a document.

```typescript
const collections = await firestore.doc('users/user123').listCollections();
```

## Collection Operations

### doc
Get or create a document reference. Auto-generates ID if not provided.

```typescript
const ref = firestore.collection('users').doc(); // auto ID
const ref2 = firestore.collection('users').doc('user123');
```

### add
Create a new document with an auto-generated ID.

```typescript
const ref = await firestore.collection('users').add({ name: 'Alice' });
console.log(ref.id);
```

### listDocuments
Get all document references in a collection.

```typescript
const refs = await firestore.collection('users').listDocuments();
```

## Queries

### where
Filter results.

```typescript
const query = firestore.collection('users')
  .where('age', '>', 25)
  .where('status', '==', 'active');
```

Supported operators: `<`, `<=`, `==`, `!=`, `>`, `>=`, `array-contains`, `in`, `not-in`, `array-contains-any`

### orderBy
Sort results.

```typescript
const query = firestore.collection('users').orderBy('age', 'desc');
```

### limit
Limit number of results.

```typescript
const query = firestore.collection('users').limit(10);
```

### limitToLast
Get the last N results. Requires orderBy.

```typescript
const query = firestore.collection('users').orderBy('createdAt').limitToLast(10);
```

### offset
Skip the first N results.

```typescript
const query = firestore.collection('users').offset(20);
```

### Pagination
Use cursors to paginate through results.

```typescript
// Start at a value
const query = firestore.collection('users').orderBy('name').startAt('Alice');

// Start after a value
const query = firestore.collection('users').orderBy('name').startAfter('Alice');

// End at a value
const query = firestore.collection('users').orderBy('name').endAt('Zoe');

// End before a value
const query = firestore.collection('users').orderBy('name').endBefore('Zoe');

// Or use a document snapshot
const lastDoc = await firestore.doc('users/user123').get();
const query = firestore.collection('users').orderBy('name').startAfter(lastDoc);
```

### get
Execute the query and get results.

```typescript
const snapshot = await firestore.collection('users').where('age', '>', 25).get();
console.log(snapshot.size);
snapshot.forEach(doc => console.log(doc.data()));
```
