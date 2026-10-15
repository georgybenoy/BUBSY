# Bubsy — Code Style & Engineering Conventions

**Version:** 1.0  
**Purpose:** Keep the frontend, backend, AI pipeline, and database code readable, testable, and consistent.

## 1. General principles

- Prefer simple, explicit code over clever abstractions.
- Keep UI components, API handlers, business rules, database access, and AI inference separate.
- Use meaningful names that reflect the product domain.
- Validate input at system boundaries.
- Handle errors explicitly; never silently convert recognition failure into success.
- Keep functions focused and reasonably small.
- Add comments to explain non-obvious decisions, not to narrate every line.
- Do not commit real student data, secrets, database files, or model weights unless repository policy explicitly permits a suitably licensed artifact.

## 2. Repository conventions

Use the structure described in `TECH_STACK.md`. Keep:
- React UI in `frontend/src`.
- API and application services in `backend/app`.
- Automated tests in `frontend` and `backend/tests`.
- Project documentation in `docs`.
- Model files outside source code; document how to obtain the approved model.
- Local runtime data outside version control.

## 3. TypeScript and React

### Naming
- Components: `PascalCase`, e.g. `StudentTable.tsx`.
- Hooks: `useCamelCase`, e.g. `useSessionStatus.ts`.
- Functions and variables: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for true module-level constants.
- Types and interfaces: `PascalCase`.
- Folders: lowercase kebab-case or the established feature name convention; do not mix conventions within a feature.

### Component rules
- Use function components and hooks.
- Keep components focused on one responsibility.
- Move API access into service modules rather than calling `fetch` throughout UI components.
- Use explicit TypeScript types for API responses, props, and domain models.
- Avoid `any`; use `unknown` plus validation for untrusted data.
- Avoid duplicating scoring or session qualification logic in the frontend.
- Treat the backend as the source of truth for points, badges, and leaderboard totals.
- Keep kiosk and teacher layouts separate while reusing shared primitives.
- Include loading, empty, success, and error states for data-dependent screens.
- Ensure keyboard accessibility in the teacher portal and large touch targets in the kiosk.

### Formatting and linting
- Use Prettier for formatting and ESLint for linting.
- Keep imports grouped consistently: external packages, internal aliases, relative imports.
- Remove unused imports and variables.
- Do not suppress lint rules without a short explanation.

## 4. Python

### Naming
- Modules and packages: `snake_case`.
- Functions and variables: `snake_case`.
- Classes: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE`.
- Private helpers: leading underscore when appropriate.

### Rules
- Follow PEP 8 and use type hints on public functions.
- Use Pydantic models for API input/output validation.
- Use `pathlib` for file paths.
- Use the standard `logging` module; do not use `print` for production diagnostics.
- Keep route handlers thin; delegate business rules to service modules.
- Keep database access behind a clear data-access layer.
- Use transactions for session qualification and reward issuance.
- Use parameterized SQL queries.
- Do not store camera frames, photos, or videos.
- Keep OpenCV capture and YOLO inference isolated from scoring and database logic.
- Release camera resources reliably, including on exceptions or shutdown.
- Handle missing camera, model load failure, and inference errors explicitly.
- Do not use a broad `except Exception` to hide failures. If a broad catch is necessary at a process boundary, log sanitized context and return a safe error state.

### Python tools
- Ruff for linting and import checks.
- Black or Ruff formatter, choosing one formatting authority.
- Pytest for automated tests.
- Pin dependencies in a tested requirements/lock file.

## 5. API conventions

- Use resource-oriented REST endpoints and consistent plural nouns.
- Use JSON request and response bodies.
- Use appropriate HTTP status codes.
- Version the API if compatibility changes are expected, e.g. `/api/v1`.
- Use ISO 8601 timestamps and document timezone assumptions.
- Return stable error codes with human-readable messages.
- Never return stack traces, credentials, raw frames, or internal secrets.
- Require authorization for all teacher and administration endpoints.
- Validate pagination, filters, and input sizes.

Suggested response shape:

```json
{
  "data": {},
  "error": null,
  "request_id": "opaque-request-id"
}
```

For an error:

```json
{
  "data": null,
  "error": {
    "code": "CREDENTIAL_NOT_FOUND",
    "message": "This student code could not be verified."
  },
  "request_id": "opaque-request-id"
}
```

Use the same envelope consistently if adopted. Do not expose sensitive diagnostic details in `message`.

## 6. Domain naming

Use consistent terms:
- `student_id`: internal student identity.
- `credential_id`: credential record identity.
- `session_id`: one handwashing attempt.
- `step_code`: protocol movement identifier.
- `qualifies_for_points`: server-validated eligibility.
- `reward_transaction`: immutable points award or correction.
- `model_version`: identifier for the AI model used.
- `protocol_version`: identifier for the configured handwashing protocol.

Use the brand terms `Bubsy Points`, `Bubsy Badges`, and `Bubsy Champion` in user-facing copy. Avoid using product branding as a substitute for precise internal domain names.

## 7. Errors and logging

- Define stable error codes.
- Show student-friendly retry messages in the kiosk.
- Show actionable, sanitized error details to teachers/operators.
- Log component, timestamp, error code, and relevant opaque IDs.
- Never log passwords, auth tokens, full credentials, camera frames, or videos.
- Do not treat low model confidence as a software crash; represent it as an explicit uncertain recognition result.

## 8. Configuration and environment variables

- Keep configuration out of source code.
- Use a documented `.env.example` containing placeholders only.
- Never commit `.env` files containing real secrets.
- Validate required configuration at startup.
- Separate development and production configuration.
- Avoid placing secrets in Vite variables: frontend-exposed variables are public to users.

## 9. Git conventions

Suggested branch names:
- `feature/kiosk-guidance`
- `feature/student-management`
- `fix/duplicate-reward`
- `docs/security-policy`

Suggested commit format:
- `feat: add QR credential resolution`
- `fix: prevent duplicate reward transactions`
- `test: cover monthly leaderboard boundaries`
- `docs: define local data retention`

Keep changes focused and reviewable. Do not commit generated build output, local databases, cache folders, camera captures, secrets, or unlicensed model artifacts.

## 10. Definition of code complete

A change is complete when:
- Types and validation are correct.
- Relevant tests pass.
- Lint and formatting checks pass.
- Loading/error/empty states are handled where relevant.
- Security and privacy implications have been reviewed.
- Documentation is updated when APIs, settings, or workflows change.
