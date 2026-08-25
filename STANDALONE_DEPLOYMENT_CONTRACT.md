# ViralBoost Standalone Deployment Contract

ViralBoost is designed to operate as a **self-owned application stack**. Its creator workspaces, private source assets, experiment planning, analytics records, publishing workflow state, access controls, audit records, and developer oversight data remain inside infrastructure operated by the platform owner.

## Self-owned runtime components

| Capability | Self-owned component | Persistent data location | Operational responsibility |
|---|---|---|---|
| Application interface | `web` container | Application image and private configuration | Platform owner |
| API and authorization | `api` container | PostgreSQL and deployment secrets | Platform owner |
| Creator and performance data | PostgreSQL / TimescaleDB | `./postgres` volume | Platform owner |
| Queue and transient workflow state | Redis and RabbitMQ | `./redis` and `./rabbitmq` volumes | Platform owner |
| Private media assets | MinIO | `./minio` volume | Platform owner |
| Video transformation | FFmpeg worker | Private media and job state | Platform owner |
| Growth intelligence | Intelligence worker and Ollama | `./ollama` model volume and platform data | Platform owner |
| Monitoring and logs | Prometheus, Grafana, Loki, Tempo | Local persistent volumes | Platform owner |
| Internal source control and CI | Gitea and Drone | Local persistent volumes | Platform owner |
| Invitations and system notices | Postal | PostgreSQL, RabbitMQ, and local configuration | Platform owner |

## Local intelligence requirement

The intelligence worker uses the **Ollama OpenAI-compatible local endpoint** at `http://ollama:11434/v1`. It does not require an external model-provider API key at runtime. The deployment operator must preload the selected open model into the persisted `./ollama` volume before enabling creator workloads. That model artifact should be treated as a versioned deployment asset and recorded in the release configuration.

## Creator-authorized external boundary

ViralBoost does not depend on another growth application, agency, or scheduler. It does require creator-authorized connections to the social platforms where a creator elects to publish. Those connections are limited to each platform’s available official account and publishing capabilities. Platform ranking and audience feed placement remain external systems outside ViralBoost’s control.

## Data and control guarantees

Every source asset, derived experiment, campaign state, and outcome should be workspace-scoped and traceable back to the original creator source. The developer control plane has read-only portfolio oversight and access-governance controls; it does not operate a creator’s content workflow. Creators approve the experiments that may be prepared for a publishing window.

## Deployment safeguards

Production deployment must use deployment secrets or an external secrets manager under the owner’s control. No credentials, platform client secrets, model-provider keys, or user tokens may be committed to source control. The checked-in configuration files provide non-sensitive defaults only.

## Release gate

Before a self-hosted deployment is considered ready, the owner must validate the compose file on the target host, confirm a local model is present in Ollama, apply Prisma migrations, run API and worker contract tests, confirm MinIO bucket readiness, and verify that all required platform account credentials are supplied through deployment secrets.
