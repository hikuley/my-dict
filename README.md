# My Dictionary

An AI-powered dictionary app that generates detailed word definitions using Claude AI. Words are processed asynchronously via Kafka, with real-time progress updates over WebSocket.

## Tech Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Kotlin | 1.9.25 | Language |
| Spring Boot | 3.4.5 | Web framework |
| Spring Data JPA | 3.4.5 | ORM / PostgreSQL with JSONB |
| Spring Security | 3.4.5 | Authentication & authorization |
| Spring Kafka | 3.4.5 | Async message processing |
| Spring Mail | 3.4.5 | Email verification |
| Flyway | 10.10.0 | Database migrations |
| JJWT | 0.12.6 | JWT token generation & validation |
| Google API Client | 2.7.0 | Google OAuth token verification |
| OkHttp | 4.12.0 | Claude API HTTP client |
| Gradle (Kotlin DSL) | 9.0.0 | Build system |
| JDK | 17 | Runtime |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| Ant Design | 5.20+ | Component library |
| Redux Toolkit | 2.x | State management |
| Vite | 5 | Build tool / dev server |
| Google Identity Services | — | Google OAuth sign-in |
| DOMPurify | 3.x | HTML sanitization (XSS prevention) |
| Playwright | latest | E2E & security testing |

### Infrastructure

| Technology | Purpose |
|---|---|
| PostgreSQL 16 | Database (JSONB sections, full-text search with GIN index) |
| Apache Kafka 3.9 | Async word generation pipeline (KRaft mode, no Zookeeper) |
| nginx | Reverse proxy + static file serving |
| Docker Compose | Container orchestration |

### Cloud (AWS eu-west-1)

| Resource | Spec |
|---|---|
| EC2 | t3.micro (1 GB RAM + 1 GB swap) |
| EBS | 30 GB gp3 (root) + 10 GB gp3 (PostgreSQL data) |
| Elastic IP | Static public IP |
| CloudWatch | Container log aggregation (14-day retention) |
| Terraform | Infrastructure as Code |
| GitHub Actions | CI/CD (tests on all branches, deploy on `main`) |

## Architecture

```
User Browser
    │
    ▼ HTTP :3000
┌─────────────────────────────────────────┐
│  EC2 (Docker Compose)                   │
│                                         │
│  nginx ──▶ Spring Boot API ──▶ Claude   │
│  :3000     :3001        │      (AI)     │
│              │          │               │
│              ▼          ▼               │
│          PostgreSQL   Kafka             │
│          :5432        :9092             │
└─────────────────────────────────────────┘
```

**Request flow:**
1. nginx serves the React SPA and proxies `/api/*` and `/ws` to the backend
2. Users authenticate via email/password (with email verification) or Google OAuth; JWT tokens gate API access
3. `POST /api/words/generate` publishes a message to Kafka topic `word-generate`
4. Kafka consumer calls Claude API to generate the word definition
5. Result is saved to PostgreSQL and broadcast via WebSocket (`word-ready`)

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Register with email/password (sends verification code) |
| `POST` | `/api/auth/login` | Public | Login with email/password (returns JWT) |
| `POST` | `/api/auth/verify` | Public | Verify email with 6-digit code |
| `POST` | `/api/auth/resend-verification` | Public | Resend verification code |
| `POST` | `/api/auth/google` | Public | Sign in with Google OAuth ID token |
| `GET` | `/api/auth/me` | Bearer | Get current user info |

### Dictionary

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/words?page=&limit=` | Bearer | Paginated word list |
| `GET` | `/api/words/search?q=` | Bearer | Full-text search (min 2 chars) |
| `GET` | `/api/words/:slug` | Bearer | Word detail with sections |
| `POST` | `/api/words/generate` | Bearer | Generate word via Claude AI (async, returns 202) |
| `POST` | `/api/words` | Bearer | Create word manually |
| `DELETE` | `/api/words/:slug` | Bearer | Delete a word |

### System

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Health check |
| `WS` | `/ws` | Public | WebSocket (word-processing, word-ready, word-error) |

## Project Structure

```
my-dict/
├── backend/                  # Kotlin + Spring Boot API
│   ├── src/main/kotlin/com/mydict/
│   │   ├── config/           # Startup logger
│   │   ├── controller/       # REST endpoints (Word, Auth)
│   │   ├── dto/              # Request/response DTOs (Word, Auth)
│   │   ├── entity/           # JPA entities (Word, User)
│   │   ├── kafka/            # Producer + consumer
│   │   ├── repository/       # Spring Data JPA (Word, User)
│   │   ├── security/         # JWT filter, token provider, SecurityConfig
│   │   ├── service/          # Business logic, Claude, Auth, Google OAuth, Email
│   │   ├── util/             # JSON parser for Claude responses
│   │   └── websocket/        # WebSocket handler + config
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── db/migration/     # Flyway SQL migrations (V1–V4)
│   │   └── prompts/          # Claude prompt template
│   ├── build.gradle.kts
│   └── Dockerfile
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── components/       # AuthPage, VerifyEmailPage, WordList, AddWordModal, WordDetailModal
│   │   ├── hooks/            # useWebSocket, useProgressBars
│   │   ├── store/            # Redux (authSlice, wordsSlice)
│   │   └── styles/
│   ├── e2e/
│   │   ├── e2e/              # Functional E2E tests (auth, words, search, full journey)
│   │   ├── fixtures/         # API helpers, test payloads
│   │   └── security/         # Security tests (XSS, CSRF, injection, etc.)
│   ├── package.json
│   └── Dockerfile            # Multi-stage: Node build → nginx
├── infra/                    # Terraform (AWS)
│   ├── ec2.tf
│   ├── cloudwatch.tf
│   ├── route53.tf
│   ├── github.tf
│   └── architecture.mmd
├── docker-compose.local.yml      # Local development (json-file logging, named volumes, localhost Kafka)
├── docker-compose.dev.yml        # Dev EC2 (json-file logging, EBS volumes)
├── docker-compose.prod.yml       # Prod EC2 (awslogs driver, EBS volumes)
├── docker.sh                     # Helper script (run/dev/stop/logs)
└── .github/workflows/
    ├── test.yml                  # Reusable test workflow (5 parallel jobs)
    ├── deploy-dev.yml            # Auto-deploy to dev EC2 on push to main
    └── deploy-prod.yml           # Manual deploy to prod EC2 with versioning
```

## Local Development

```bash
# Start DB and Kafka
./docker.sh dev

# Run backend (IntelliJ or CLI)
cd backend && ./gradlew bootRun

# Run frontend
cd frontend && npm install && npm run dev
```

**Local ports:**
- Frontend: http://localhost:5173 (Vite dev server, proxies API to :3001)
- Backend: http://localhost:3001
- PostgreSQL: localhost:5433
- Kafka: localhost:9092

## Testing

The CI pipeline (`test.yml`) runs 5 parallel jobs on every push:

| Job | What it does |
|---|---|
| **BE: Unit Tests** | `./gradlew unitTest` — fast, no external deps |
| **BE: Integration Tests** | `./gradlew integrationTest` — PostgreSQL + Kafka service containers |
| **FE: Playwright Security Tests** | XSS, CSRF, injection, clickjacking, security headers, auth |
| **BE: Performance Tests** | JMeter load test (100 threads, 120s) with error rate & P95 thresholds |
| **FE: E2E Tests** | Full user journey — auth, add, search, detail, delete |

All jobs that need backend use `MockClaudeService` (Spring profile `mock-claude`) to avoid real API calls.

```bash
# Run locally
cd backend && ./gradlew unitTest          # Unit tests
cd backend && ./gradlew integrationTest   # Integration tests (needs Docker)
cd frontend && npx playwright test        # E2E + security tests (needs running backend)
```

## CI/CD

**`test.yml`** — Reusable workflow, runs on every push to any branch and on PRs to `main`.

**`deploy-dev.yml`** — Triggered on push to `main`. Calls `test.yml` as a reusable workflow, then deploys to dev EC2:
1. All 5 test jobs must pass
2. Creates a tar package (frontend + backend source)
3. Uploads to dev EC2 via SCP
4. Runs `docker compose -f docker-compose.dev.yml up -d --build --force-recreate`

**`deploy-prod.yml`** — Manual trigger via `workflow_dispatch`. Runs all tests, creates a date-based version tag (e.g. `v2026.04.23.1`), generates release notes, and deploys to prod EC2.

Docker builds happen on EC2:
- **Frontend**: multi-stage (Node 20 build → nginx:alpine)
- **Backend**: multi-stage (Gradle 9.0.0 + JDK 17 build → JRE 17 Alpine)
