#!/bin/sh
# ========================================
# Lyrebird Dashboard Docker Entrypoint
# ========================================
# Optional runtime API URL substitution via VITE_API_URL env var
# Default /api works with nginx proxy (no substitution needed)

set -e

# Only perform substitution if VITE_API_URL is set and not the default
if [ -n "$VITE_API_URL" ] && [ "$VITE_API_URL" != "/api" ]; then
    # Validate VITE_API_URL contains only safe characters to prevent command injection
    # Allowed: alphanumeric, forward slash, colon, period, hyphen, underscore
    if ! echo "$VITE_API_URL" | grep -qE '^[a-zA-Z0-9:/._-]+$'; then
        echo "Error: VITE_API_URL contains invalid characters. Allowed: a-z, A-Z, 0-9, :, /, ., _, -"
        exit 1
    fi

    echo "Replacing API URL with: $VITE_API_URL"
    # Find and replace in all JS files (match /api followed by / or " to avoid partial matches)
    find /usr/share/nginx/html/assets -name '*.js' -exec sed -i "s|/api/|$VITE_API_URL/|g; s|/api\"|$VITE_API_URL\"|g" {} \;
fi

# Start nginx
exec nginx -g 'daemon off;'
