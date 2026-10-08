# Meta WhatsApp webhook reference

**Source reviewed:** [Meta — WhatsApp webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview), updated June 26, 2026.

Meta documents that the `messages` webhook returns both incoming user messages and statuses of outbound business messages. It requires an application endpoint, subscription to the `messages` field in the Meta App Dashboard, and the `whatsapp_business_messaging` permission. Meta retries callbacks that do not return HTTP 200 for up to seven days, so the EVGreen handler must be idempotent.

EVGreen reservation notices use a Utility template outside the 24-hour conversation window. Delivery status is not inferred from a successful send API response: the platform records provider acceptance as `sent` and updates to `delivered`, `read`, or `failed` only when the authenticated webhook reports the corresponding `wamid` status.
