# Firbase Rest API for Cloudflare workers

This uses Google Identity Platform's REST API found here:

* https://cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts
* https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts

Many methods can be called with an idToken from the user and only require an API key. The API key can be found in your
Firebase project settings *General* page under a web project. Other methods require a Google OAuth 2.0 token for
"admin access". This is created automatically if you provide a service account. You can get your service account JSON
in your Firebase project settings *Service accounts* page by clicking [Generate new private key].
