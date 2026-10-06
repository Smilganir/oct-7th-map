Photo suppression (not used yet; suppress.json is empty).
Add a photo hash (the file name in /photos without .jpg) to "photos", or "Name|age" to "entries", then deploy. New bundles then show a placeholder and do not fall back to the original URL.
To make the removal complete also delete the file from site/photos here AND from photos/ on main (github.io copy), and purge the Cloudflare cache (photos are cached 30 days).
