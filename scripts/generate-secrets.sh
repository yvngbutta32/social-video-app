#!/bin/bash
# Generate all secrets for the social-video-app stack
# Run this once before first deployment

set -euo pipefail

SECRETS_DIR="$(dirname "$0")/../secrets"
mkdir -p "$SECRETS_DIR"

# Function to generate a secure random string
gen_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

gen_password() {
    openssl rand -base64 24 | tr -d '\n' | tr -d '/' | tr -d '+'
}

gen_hex() {
    openssl rand -hex 32 | tr -d '\n'
}

echo "Generating secrets in $SECRETS_DIR..."

# PostgreSQL
gen_password > "$SECRETS_DIR/postgres_password.txt"

# Gitea
gen_password > "$SECRETS_DIR/gitea_db_password.txt"

# Drone
gen_hex > "$SECRETS_DIR/drone_gitea_client_id.txt"
gen_hex > "$SECRETS_DIR/drone_gitea_client_secret.txt"
gen_hex > "$SECRETS_DIR/drone_rpc_secret.txt"

# MinIO
echo "minioadmin" > "$SECRETS_DIR/minio_user.txt"
gen_password > "$SECRETS_DIR/minio_password.txt"

# NextAuth
gen_hex > "$SECRETS_DIR/nextauth_secret.txt"

# JWT
gen_hex > "$SECRETS_DIR/jwt_secret.txt"

# PostHog
gen_hex > "$SECRETS_DIR/posthog_secret.txt"

# Grafana
gen_password > "$SECRETS_DIR/grafana_password.txt"

# Postal
gen_password > "$SECRETS_DIR/postal_db_password.txt"
gen_password > "$SECRETS_DIR/postal_rabbitmq_password.txt"

# RabbitMQ
gen_password > "$SECRETS_DIR/rabbitmq_password.txt"

# Authelia (additional)
gen_hex > "$SECRETS_DIR/authelia_jwt_secret.txt"
gen_hex > "$SECRETS_DIR/authelia_session_secret.txt"
gen_hex > "$SECRETS_DIR/authelia_storage_encryption_key.txt"

# Redis
gen_password > "$SECRETS_DIR/redis_password.txt"

# Stripe (placeholder - replace with real keys)
echo "sk_test_REPLACE_WITH_REAL_STRIPE_SECRET" > "$SECRETS_DIR/stripe_secret_key.txt"
echo "pk_test_REPLACE_WITH_REAL_STRIPE_PUBLISHABLE" > "$SECRETS_DIR/stripe_publishable_key.txt"
echo "whsec_REPLACE_WITH_REAL_STRIPE_WEBHOOK_SECRET" > "$SECRETS_DIR/stripe_webhook_secret.txt"

# Platform OAuth (placeholders)
echo "REPLACE_WITH_TIKTOK_CLIENT_KEY" > "$SECRETS_DIR/tiktok_client_key.txt"
echo "REPLACE_WITH_TIKTOK_CLIENT_SECRET" > "$SECRETS_DIR/tiktok_client_secret.txt"
echo "REPLACE_WITH_INSTAGRAM_CLIENT_ID" > "$SECRETS_DIR/instagram_client_id.txt"
echo "REPLACE_WITH_INSTAGRAM_CLIENT_SECRET" > "$SECRETS_DIR/instagram_client_secret.txt"
echo "REPLACE_WITH_YOUTUBE_CLIENT_ID" > "$SECRETS_DIR/youtube_client_id.txt"
echo "REPLACE_WITH_YOUTUBE_CLIENT_SECRET" > "$SECRETS_DIR/youtube_client_secret.txt"
echo "REPLACE_WITH_FACEBOOK_APP_ID" > "$SECRETS_DIR/facebook_app_id.txt"
echo "REPLACE_WITH_FACEBOOK_APP_SECRET" > "$SECRETS_DIR/facebook_app_secret.txt"
echo "REPLACE_WITH_X_CLIENT_ID" > "$SECRETS_DIR/x_client_id.txt"
echo "REPLACE_WITH_X_CLIENT_SECRET" > "$SECRETS_DIR/x_client_secret.txt"
echo "REPLACE_WITH_LINKEDIN_CLIENT_ID" > "$SECRETS_DIR/linkedin_client_id.txt"
echo "REPLACE_WITH_LINKEDIN_CLIENT_SECRET" > "$SECRETS_DIR/linkedin_client_secret.txt"

# OpenAI (placeholder)
echo "sk-REPLACE_WITH_REAL_OPENAI_KEY" > "$SECRETS_DIR/openai_api_key.txt"

# Set restrictive permissions
chmod 600 "$SECRETS_DIR"/*.txt

echo "✅ All secrets generated in $SECRETS_DIR"
echo ""
echo "⚠️  IMPORTANT: Replace placeholder values for:"
echo "   - Stripe keys"
echo "   - Platform OAuth credentials (TikTok, Instagram, YouTube, Facebook, X, LinkedIn)"
echo "   - OpenAI API key"
echo ""
echo "🔐 Secrets are stored with 600 permissions (owner read/write only)"