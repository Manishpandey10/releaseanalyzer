# ReleaseAnalyzer

## What It Does
ReleaseAnalyzer (internally referenced as ReleasePilot) is a specialized application that bridges the gap between raw engineering release notes and stakeholder communication. It ingests raw release items (features, bug fixes, limitations, QA evidence), rigorously validates their completeness, and uses AI (Google Gemini) to draft Internal Technical Summaries and Client/Stakeholder Summaries.

By calculating risks and enforcing strict human-in-the-loop review processes, the system prevents the common issue of LLM hallucinations. Engineering teams often write release notes that are either too technical for clients or omit critical limitations and QA evidence. ReleaseAnalyzer solves this by forcing deterministic structures (evidence hashes, validation checks) and using AI purely for semantic synthesis, followed by mandatory human approval before a release can be finalized.

## Live Links

- **Frontend:** https://releaseanalyzer-b8xe2ulli-manishpandey10s-projects.vercel.app
- **Backend API:** https://releaseanalyzer.onrender.com

## Core Workflow
1. **Drafting:** User creates a release and adds items (Features, Bugs, QA Evidence, Limitations, etc.).
2. **Validation:** System deterministically checks that the release contains all required components.
3. **AI Analysis:** Gemini processes the release, identifies risks, and drafts internal/client statements grounded purely in the provided evidence.
4. **Human Review:** A human editor reviews, modifies, approves, or rejects the AI-generated statements.
5. **Finalization:** The release is locked as FINAL. If original evidence changes during the review process, statements become "stale" and must be re-reviewed.

## Key Engineering Decisions
- **Deterministic validation:** Strict structure and rules enforced in code before AI consumes any tokens, preventing hallucinations of missing structural data.
- **Evidence-grounded AI:** AI statements are mathematically linked (`StatementEvidence`) to the source items they summarize.
- **Human approval:** State transitions and finalization rules are explicitly restricted. AI generates text, but cannot approve statements or finalize releases.
- **Stale detection:** If a source item is edited after AI analysis, its SHA-256 hash changes, and the system automatically marks dependent AI statements as "stale", blocking finalization.
- **Version comparison:** Dynamically calculates what was ADDED, REMOVED, CHANGED, or UNCHANGED between cloned version lineages using deterministic display IDs.

## Architecture
```text
Browser
 ↓ (HTTP/REST)
React/Vite (client)
 ↓ (fetch via api.ts)
Express backend (server/src/app.ts)
 ↓ (Controllers & Middleware)
Services (ai.service, release.service, statement.service)
 ├──> Google Gemini API (via @google/genai)
 ↓ 
Prisma ORM
 ↓
PostgreSQL Database
```
**Tech Stack:** React 19, Vite, Tailwind CSS 4, Node.js 22, Express, TypeScript, Zod, PostgreSQL, Prisma ORM, Google Gemini API.

## AI Workflow
1. **Trigger:** User clicks "Analyze" (`POST /api/releases/:id/analyze`).
2. **Orchestration:** `release.controller.ts` calls `ai.service.ts`.
3. **Pre-flight:** Validates release package and checks if an analysis is already running.
4. **Prompting:** Constructs a constrained prompt with strict rules against injection (`<untrusted_payload>`).
5. **Generation:** Calls Gemini API with exponential backoff (`generateWithRetry()`).
6. **Validation:** Response is strictly validated against `aiAnalysisResponseSchema` (Zod).
7. **Post-processing:** Enforces support statuses (downgrading unsupported QA claims) and computes coverage warnings deterministically.
8. **Persistence:** Saves statements, evidence links, and risks to PostgreSQL in a single atomic transaction.

## Human Review & Stale Detection
The strongest differentiator of ReleaseAnalyzer is the mathematical relationship between the generated AI statements and the source text. When a release item is saved, its content is hashed using SHA-256. When the AI generates a statement, it cites the source item, and a `StatementEvidence` record stores the `sourceHashAtGeneration`. 

If a human user edits the source item *after* analysis, its `contentHash` changes. The system detects this mismatch (`ev.sourceHashAtGeneration !== ev.releaseItem.contentHash`) and automatically flags the dependent AI statement as `isStale = true`. Finalization is immediately blocked until a human explicitly reviews the change, edits the statement if necessary, and resolves the stale flag.

## API / Database

### Key API Endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/releases` | Create a new draft release |
| GET | `/api/releases/:id` | Fetch full release and items |
| PATCH | `/api/releases/:id` | Update release or replace items |
| POST | `/api/releases/:id/validate` | Deterministically validate package readiness |
| POST | `/api/releases/:id/analyze` | Trigger Gemini AI analysis |
| GET | `/api/releases/:id/compare/:otherId` | Diff two versions |
| POST | `/api/releases/:id/finalize` | Lock release (fails if pending/stale) |
| POST | `/api/releases/:id/statements/:id/approve` | Human approval of an AI statement |

### Database Models
| Model | Description |
|---|---|
| `Release` | The core aggregate root. Tracks version, title, status, and lineage. |
| `ReleaseItem` | The raw evidence (Feature, Bug Fix). Contains `displayId` and `contentHash`. |
| `AiAnalysis` | Tracks the lifecycle, model used, and raw JSON result of a Gemini run. |
| `GeneratedStatement` | The AI-drafted summary. Contains `audience`, `impact`, `reviewStatus`, `isStale`. |
| `StatementEvidence` | The mathematical join table connecting a `GeneratedStatement` to a `ReleaseItem`. |

## Setup
```bash
# Clone the repository
# Copy .env.example to server/.env and client/.env and populate variables

# Install dependencies
cd server && npm install
cd ../client && npm install

# Setup database (requires PostgreSQL)
cd ../server
npx prisma migrate dev

# Run development servers
npm run dev # (in both client and server directories)
```



## Deployment Details
The application is deployed as separate frontend and backend services via an automated pipeline:
- **Frontend:** Vercel (React/Vite static build)
- **Backend:** Render (Node Web Service, binding to 0.0.0.0)
- **Database:** Supabase (PostgreSQL with IPv4 connection pooler on port 6543)
- **AI Integration:** Google Gemini API

## Completed and Excluded Scope
### Completed
* Full CRUD for Releases and Release Items.
* Deterministic Validation Engine.
* AI Orchestration (Prompt building, Gemini integration, Zod schema validation).
* AI Post-processing (QA Support Enforcement, Coverage Warnings).
* Complex Data Relationships (Evidence joining, Hash-based Stale Detection).
* Version Lineage and Comparison Diffing.
* Human Review State Machine.

### Excluded
The following items were intentionally excluded to prioritize the core release-readiness workflow:
* **Authentication / Authorization:** The application operates as a single-tenant workspace without user accounts or RBAC.
* **Real-time WebSockets:** AI analysis completion is handled through polling rather than WebSockets.
* **Git / repository integration:** Release data is entered manually rather than imported from GitHub/GitLab.
* **Deployment automation beyond hosting configuration:** Enterprise-grade CI/CD and observability are out of scope.
* **Structured Application Logging:** Standard server console logging is used instead of a dedicated JSON logging platform.

## Limitations
* The hosted deployment uses free-tier infrastructure, which may result in a noticeable cold-start delay after inactivity.
* AI analysis depends on the availability, latency, and quota limits of the external Google Gemini API.
* The application currently operates as a single-tenant workspace.

## Tests
Extensive testing is implemented using Vitest (`server/tests/`) with 65 passing unit and integration tests.
* **Test Areas:** API rules, validation logic, staleness edge cases, parallel analysis blocking, Mocked Gemini prompt parsing, support status enforcement, and idempotent demo data generation/cascade deletion.
* **Command:** `npm test` (inside the `server` directory).

## Assessment Requirement Mapping
| Assessment Requirement | Status |
|---|---|
| Usable frontend | IMPLEMENTED |
| Working backend | IMPLEMENTED |
| Basic data persistence | IMPLEMENTED |
| Functional AI/LLM workflow | IMPLEMENTED |
| Human review/approval for AI actions | IMPLEMENTED |
| Loading, Empty, Validation, Success, Failure states | IMPLEMENTED |
| Application & AI workflow logs | PARTIALLY IMPLEMENTED (Console logs + DB tracking) |
| Focused tests | IMPLEMENTED |
| Deployed application | IMPLEMENTED |
| Documentation (README, AGENT_USAGE, .env.example) | IMPLEMENTED |

## AI-Assisted Development
AI coding assistance (Google Gemini and Antigravity IDE) was used throughout the development lifecycle to accelerate implementation, testing, and deployment preparation. Architectural decisions, scope management, and final verification were strictly owned by the human developer. For more details on prompts, tools, and resolution of AI mistakes, see [AGENT_USAGE.md](AGENT_USAGE.md).

## Reviewer Note
Because the backend is hosted on Render's free tier, you may experience a **30-50 second cold start delay** on your first API request if the server has been idle. 

**Demo Flow:** To test the system immediately without manual data entry, run `npm run demo:seed` in the `server/` directory locally. This will populate the database with several `DEMO` releases in various states (Draft, Analyzed, Final) to demonstrate the UI states, comparison engine, and stale tracking immediately.