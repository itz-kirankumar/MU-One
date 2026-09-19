# JEV mail classification

MU One uses Experiential Labs model `jev-latest` as a lower-priority mail classifier through `POST https://api.experientiallabs.ai/v1/systemone`.

Deterministic keyword and date parsing remains authoritative. JEV only examines up to 12 recent messages that the deterministic parser did not classify as deadlines, with three requests at a time. Results are cached on each mail signal, and provider failures do not fail or downgrade Gmail sync.

Only the sender, subject, and a snippet capped at 2,500 characters are sent for classification. Full message bodies and attachments are not sent. A JEV deadline requires at least 0.70 classification confidence and is ordered after deterministic deadline signals.

`EXPLABS_API_KEY` is a Firebase Secret Manager secret. `JEV_MODEL=jev-latest` is a non-secret Functions parameter.
