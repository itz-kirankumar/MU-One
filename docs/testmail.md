# Testmail integration

MU One includes a server-only Testmail bridge for testing email delivery and the same deadline extraction used by the Gmail dashboard. It does not replace Gmail for real users and the API key is never included in the frontend bundle.

The callable supports:

- `address`: generates `{namespace}.{tag}@inbox.testmail.app` for a safe test tag.
- `list`: retrieves a bounded page of messages, optionally by tag or tag prefix.
- Parsed output: subject, safe plain text, sender, recipient, attachment metadata, received time and inferred due date.

Access requires a verified `@mastersunion.org` Firebase account whose email is present in `TESTMAIL_ADMIN_EMAILS`. Direct provider errors are converted to callable errors and the API key is never returned or logged.

## Configuration

The local API key is stored in ignored `functions/.secret.local`. To deploy:

```text
firebase functions:secrets:set TESTMAIL_API_KEY
```

Production parameters for project `mu-one-508502` are stored in `functions/.env.mu-one-508502`. The Testmail namespace is `kl2ai`, and access is allowlisted to `kiran.kumar2028@mastersunion.org`. Testmail requires the namespace for every inbox query; an API key alone is insufficient.

Testmail receives mail at `{namespace}.{tag}@inbox.testmail.app`; tags can be created on demand.

Firebase CLI discovery for this codebase can exceed its default 10-second window because the shared Functions entry point loads the Google SDK integrations. On PowerShell, deploy with:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
firebase deploy --only functions:testmailPortal --project mu-one-508502
```
