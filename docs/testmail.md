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

Configure `TESTMAIL_NAMESPACE` with the namespace shown in the Testmail console, and `TESTMAIL_ADMIN_EMAILS` as a comma-separated allowlist of MU accounts. Testmail requires the namespace for every inbox query; an API key alone is insufficient.

Deploy with the normal Functions workflow after those values are configured. Testmail receives mail at `{namespace}.{tag}@inbox.testmail.app`; tags can be created on demand.
