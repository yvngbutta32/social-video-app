# Generate all secrets for the social-video-app stack
# Run this once before first deployment

$ErrorActionPreference = "Stop"

$SECRETS_DIR = "$PSScriptRoot\..\secrets"
New-Item -ItemType Directory -Force -Path $SECRETS_DIR | Out-Null

# Function to generate a secure random string (base64, 32 bytes)
function Gen-Secret {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')
}

# Function to generate a password (base64, 24 bytes, no / or +)
function Gen-Password {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).Replace('/','').Replace('+','').TrimEnd('=')
}

# Function to generate a hex string (32 bytes)
function Gen-Hex {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

Write-Host "Generating secrets in $SECRETS_DIR..."

# PostgreSQL
Set-Content -Path "$SECRETS_DIR\postgres_password.txt" -Value (Gen-Password) -NoNewline

# Gitea
Set-Content -Path "$SECRETS_DIR\gitea_db_password.txt" -Value (Gen-Password) -NoNewline

# Drone
Set-Content -Path "$SECRETS_DIR\drone_gitea_client_id.txt" -Value (Gen-Hex) -NoNewline
Set-Content -Path "$SECRETS_DIR\drone_gitea_client_secret.txt" -Value (Gen-Hex) -NoNewline
Set-Content -Path "$SECRETS_DIR\drone_rpc_secret.txt" -Value (Gen-Hex) -NoNewline

# MinIO
Set-Content -Path "$SECRETS_DIR\minio_user.txt" -Value "minioadmin" -NoNewline
Set-Content -Path "$SECRETS_DIR\minio_password.txt" -Value (Gen-Password) -NoNewline

# NextAuth
Set-Content -Path "$SECRETS_DIR\nextauth_secret.txt" -Value (Gen-Hex) -NoNewline

# JWT
Set-Content -Path "$SECRETS_DIR\jwt_secret.txt" -Value (Gen-Hex) -NoNewline

# PostHog
Set-Content -Path "$SECRETS_DIR\posthog_secret.txt" -Value (Gen-Hex) -NoNewline

# Grafana
Set-Content -Path "$SECRETS_DIR\grafana_password.txt" -Value (Gen-Password) -NoNewline

# Postal
Set-Content -Path "$SECRETS_DIR\postal_db_password.txt" -Value (Gen-Password) -NoNewline
Set-Content -Path "$SECRETS_DIR\postal_rabbitmq_password.txt" -Value (Gen-Password) -NoNewline

# RabbitMQ
Set-Content -Path "$SECRETS_DIR\rabbitmq_password.txt" -Value (Gen-Password) -NoNewline

# Authelia (additional)
Set-Content -Path "$SECRETS_DIR\authelia_jwt_secret.txt" -Value (Gen-Hex) -NoNewline
Set-Content -Path "$SECRETS_DIR\authelia_session_secret.txt" -Value (Gen-Hex) -NoNewline
Set-Content -Path "$SECRETS_DIR\authelia_storage_encryption_key.txt" -Value (Gen-Hex) -NoNewline

# Redis
Set-Content -Path "$SECRETS_DIR\redis_password.txt" -Value (Gen-Password) -NoNewline

# Stripe (placeholder - replace with real keys)
Set-Content -Path "$SECRETS_DIR\stripe_secret_key.txt" -Value "sk_test_REPLACE_WITH_REAL_STRIPE_SECRET" -NoNewline
Set-Content -Path "$SECRETS_DIR\stripe_publishable_key.txt" -Value "pk_test_REPLACE_WITH_REAL_STRIPE_PUBLISHABLE" -NoNewline
Set-Content -Path "$SECRETS_DIR\stripe_webhook_secret.txt" -Value "whsec_REPLACE_WITH_REAL_STRIPE_WEBHOOK_SECRET" -NoNewline

# Platform OAuth (placeholders)
Set-Content -Path "$SECRETS_DIR\tiktok_client_key.txt" -Value "REPLACE_WITH_TIKTOK_CLIENT_KEY" -NoNewline
Set-Content -Path "$SECRETS_DIR\tiktok_client_secret.txt" -Value "REPLACE_WITH_TIKTOK_CLIENT_SECRET" -NoNewline
Set-Content -Path "$SECRETS_DIR\instagram_client_id.txt" -Value "REPLACE_WITH_INSTAGRAM_CLIENT_ID" -NoNewline
Set-Content -Path "$SECRETS_DIR\instagram_client_secret.txt" -Value "REPLACE_WITH_INSTAGRAM_CLIENT_SECRET" -NoNewline
Set-Content -Path "$SECRETS_DIR\youtube_client_id.txt" -Value "REPLACE_WITH_YOUTUBE_CLIENT_ID" -NoNewline
Set-Content -Path "$SECRETS_DIR\youtube_client_secret.txt" -Value "REPLACE_WITH_YOUTUBE_CLIENT_SECRET" -NoNewline
Set-Content -Path "$SECRETS_DIR\facebook_app_id.txt" -Value "REPLACE_WITH_FACEBOOK_APP_ID" -NoNewline
Set-Content -Path "$SECRETS_DIR\facebook_app_secret.txt" -Value "REPLACE_WITH_FACEBOOK_APP_SECRET" -NoNewline
Set-Content -Path "$SECRETS_DIR\x_client_id.txt" -Value "REPLACE_WITH_X_CLIENT_ID" -NoNewline
Set-Content -Path "$SECRETS_DIR\x_client_secret.txt" -Value "REPLACE_WITH_X_CLIENT_SECRET" -NoNewline
Set-Content -Path "$SECRETS_DIR\linkedin_client_id.txt" -Value "REPLACE_WITH_LINKEDIN_CLIENT_ID" -NoNewline
Set-Content -Path "$SECRETS_DIR\linkedin_client_secret.txt" -Value "REPLACE_WITH_LINKEDIN_CLIENT_SECRET" -NoNewline

# OpenAI (placeholder)
Set-Content -Path "$SECRETS_DIR\openai_api_key.txt" -Value "sk-REPLACE_WITH_REAL_OPENAI_KEY" -NoNewline

# Create .env file from secrets for local development
$envFile = "$PSScriptRoot\..\.env"
$envContent = @"
# Auto-generated from secrets - do not edit manually
# Run scripts/generate-secrets.ps1 to regenerate

POSTGRES_PASSWORD=$(Get-Content "$SECRETS_DIR\postgres_password.txt" -Raw)
GITEA_DB_PASSWORD=$(Get-Content "$SECRETS_DIR\gitea_db_password.txt" -Raw)
DRONE_GITEA_CLIENT_ID=$(Get-Content "$SECRETS_DIR\drone_gitea_client_id.txt" -Raw)
DRONE_GITEA_CLIENT_SECRET=$(Get-Content "$SECRETS_DIR\drone_gitea_client_secret.txt" -Raw)
DRONE_RPC_SECRET=$(Get-Content "$SECRETS_DIR\drone_rpc_secret.txt" -Raw)
MINIO_USER=$(Get-Content "$SECRETS_DIR\minio_user.txt" -Raw)
MINIO_PASSWORD=$(Get-Content "$SECRETS_DIR\minio_password.txt" -Raw)
NEXTAUTH_SECRET=$(Get-Content "$SECRETS_DIR\nextauth_secret.txt" -Raw)
JWT_SECRET=$(Get-Content "$SECRETS_DIR\jwt_secret.txt" -Raw)
POSTHOG_SECRET=$(Get-Content "$SECRETS_DIR\posthog_secret.txt" -Raw)
GRAFANA_PASSWORD=$(Get-Content "$SECRETS_DIR\grafana_password.txt" -Raw)
POSTAL_DB_PASSWORD=$(Get-Content "$SECRETS_DIR\postal_db_password.txt" -Raw)
POSTAL_RABBITMQ_PASSWORD=$(Get-Content "$SECRETS_DIR\postal_rabbitmq_password.txt" -Raw)
RABBITMQ_PASSWORD=$(Get-Content "$SECRETS_DIR\rabbitmq_password.txt" -Raw)
REDIS_PASSWORD=$(Get-Content "$SECRETS_DIR\redis_password.txt" -Raw)
AUTHELIA_JWT_SECRET=$(Get-Content "$SECRETS_DIR\authelia_jwt_secret.txt" -Raw)
AUTHELIA_SESSION_SECRET=$(Get-Content "$SECRETS_DIR\authelia_session_secret.txt" -Raw)
AUTHELIA_STORAGE_ENCRYPTION_KEY=$(Get-Content "$SECRETS_DIR\authelia_storage_encryption_key.txt" -Raw)

# Stripe - REPLACE WITH REAL KEYS
STRIPE_SECRET_KEY=$(Get-Content "$SECRETS_DIR\stripe_secret_key.txt" -Raw)
STRIPE_PUBLISHABLE_KEY=$(Get-Content "$SECRETS_DIR\stripe_publishable_key.txt" -Raw)
STRIPE_WEBHOOK_SECRET=$(Get-Content "$SECRETS_DIR\stripe_webhook_secret.txt" -Raw)

# Platform OAuth - REPLACE WITH REAL CREDENTIALS
TIKTOK_CLIENT_KEY=$(Get-Content "$SECRETS_DIR\tiktok_client_key.txt" -Raw)
TIKTOK_CLIENT_SECRET=$(Get-Content "$SECRETS_DIR\tiktok_client_secret.txt" -Raw)
INSTAGRAM_CLIENT_ID=$(Get-Content "$SECRETS_DIR\instagram_client_id.txt" -Raw)
INSTAGRAM_CLIENT_SECRET=$(Get-Content "$SECRETS_DIR\instagram_client_secret.txt" -Raw)
YOUTUBE_CLIENT_ID=$(Get-Content "$SECRETS_DIR\youtube_client_id.txt" -Raw)
YOUTUBE_CLIENT_SECRET=$(Get-Content "$SECRETS_DIR\youtube_client_secret.txt" -Raw)
FACEBOOK_APP_ID=$(Get-Content "$SECRETS_DIR\facebook_app_id.txt" -Raw)
FACEBOOK_APP_SECRET=$(Get-Content "$SECRETS_DIR\facebook_app_secret.txt" -Raw)
X_CLIENT_ID=$(Get-Content "$SECRETS_DIR\x_client_id.txt" -Raw)
X_CLIENT_SECRET=$(Get-Content "$SECRETS_DIR\x_client_secret.txt" -Raw)
LINKEDIN_CLIENT_ID=$(Get-Content "$SECRETS_DIR\linkedin_client_id.txt" -Raw)
LINKEDIN_CLIENT_SECRET=$(Get-Content "$SECRETS_DIR\linkedin_client_secret.txt" -Raw)

# OpenAI - REPLACE WITH REAL KEY
OPENAI_API_KEY=$(Get-Content "$SECRETS_DIR\openai_api_key.txt" -Raw)
"@
Set-Content -Path $envFile -Value $envContent

Write-Host "✅ All secrets generated in $SECRETS_DIR"
Write-Host ""
Write-Host "⚠️  IMPORTANT: Replace placeholder values for:"
Write-Host "   - Stripe keys"
Write-Host "   - Platform OAuth credentials (TikTok, Instagram, YouTube, Facebook, X, LinkedIn)"
Write-Host "   - OpenAI API key"
Write-Host ""
Write-Host "📝 .env file created at $envFile"
Write-Host "🔐 Secrets are stored in $SECRETS_DIR"