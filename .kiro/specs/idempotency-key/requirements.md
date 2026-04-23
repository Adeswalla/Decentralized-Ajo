# Requirements Document

## Introduction

This feature adds idempotency key support to backend mutation endpoints (`POST /api/circles/[id]/contribute` and `POST /api/circles/[id]/join`). Clients supply a UUID `Idempotency-Key` header on write requests; the server persists the key alongside the response and replays the cached response on duplicate requests within a configurable TTL window. This prevents double-applied contributions or duplicate join records caused by network retries, and simplifies off-chain reconciliation.

## Glossary

- **Idempotency_Key**: A client-supplied UUID (v4) sent in the `Idempotency-Key` HTTP request header to uniquely identify a mutation attempt.
- **Idempotency_Record**: A persisted database row storing the key, the originating user ID, the target resource, the serialized response body, the HTTP status code, a hash of the original request payload, and the expiry timestamp.
- **TTL**: Time-to-live window (default 24 hours) during which a duplicate key returns the cached response.
- **Mutation_Endpoint**: Any POST route that writes state — specifically `POST /api/circles/[id]/contribute` and `POST /api/circles/[id]/join`.
- **Payload_Hash**: A SHA-256 digest of the canonical JSON request body, used to detect conflicting payloads submitted under the same key.
- **Idempotency_Middleware**: The shared Next.js route-handler utility that intercepts requests, checks for an existing Idempotency_Record, and either replays or stores the response.
- **Replay_Response**: The HTTP response reconstructed from a stored Idempotency_Record and returned to the client without re-executing the mutation.

---

## Requirements

### Requirement 1: Accept and Validate the Idempotency-Key Header

**User Story:** As a client developer, I want to supply an `Idempotency-Key` header on mutation requests, so that the server can identify and deduplicate retries.

#### Acceptance Criteria

1. WHEN a POST request is received by a Mutation_Endpoint, THE Idempotency_Middleware SHALL accept an `Idempotency-Key` header value that is a valid UUID v4.
2. WHEN a POST request is received without an `Idempotency-Key` header, THE Idempotency_Middleware SHALL process the request normally without idempotency guarantees.
3. WHEN a POST request is received with an `Idempotency-Key` header value that is not a valid UUID v4, THE Idempotency_Middleware SHALL return a 400 response with an error message indicating the key format is invalid.
4. THE Idempotency_Middleware SHALL treat the Idempotency_Key as scoped to the authenticated user — keys from different users SHALL NOT conflict with each other.

---

### Requirement 2: Replay Cached Response for Duplicate Keys

**User Story:** As a client developer, I want duplicate requests with the same key to return the original response, so that network retries do not produce duplicate side effects.

#### Acceptance Criteria

1. WHEN a POST request is received with an Idempotency_Key that matches an existing non-expired Idempotency_Record for the same user and endpoint, THE Idempotency_Middleware SHALL return the stored HTTP status code and response body without re-executing the mutation.
2. WHEN a Replay_Response is returned, THE Idempotency_Middleware SHALL include an `Idempotency-Replayed: true` response header.
3. WHILE an Idempotency_Record exists and has not expired, THE Idempotency_Middleware SHALL return the Replay_Response for every subsequent duplicate request within the TTL window.
4. THE Idempotency_Middleware SHALL return the Replay_Response within the same latency budget as a cache hit — no additional database writes SHALL occur during replay.

---

### Requirement 3: Detect and Reject Conflicting Payloads

**User Story:** As a system operator, I want the server to reject requests that reuse an idempotency key with a different payload, so that clients cannot accidentally mutate state under a previously used key.

#### Acceptance Criteria

1. WHEN a POST request is received with an Idempotency_Key that matches an existing Idempotency_Record for the same user and endpoint, AND the Payload_Hash of the new request differs from the stored Payload_Hash, THE Idempotency_Middleware SHALL return a 409 response with an error body indicating a payload conflict.
2. THE Idempotency_Middleware SHALL compute the Payload_Hash over the canonical JSON body before any mutation is executed.
3. WHEN a 409 conflict response is returned, THE Idempotency_Middleware SHALL NOT modify the existing Idempotency_Record.

---

### Requirement 4: Persist Idempotency Records

**User Story:** As a system operator, I want idempotency state stored durably, so that replay works correctly across server restarts and horizontal scale-out.

#### Acceptance Criteria

1. WHEN a Mutation_Endpoint successfully processes a request that carries an Idempotency_Key, THE Idempotency_Middleware SHALL persist an Idempotency_Record containing: the key, the user ID, the endpoint path, the Payload_Hash, the serialized response body, the HTTP status code, and an expiry timestamp equal to the current time plus the TTL.
2. WHEN a Mutation_Endpoint returns a 5xx response, THE Idempotency_Middleware SHALL NOT persist an Idempotency_Record, so that the client may safely retry.
3. WHEN a Mutation_Endpoint returns a 4xx response (excluding 409 conflict), THE Idempotency_Middleware SHALL persist the Idempotency_Record so that the same error is replayed on retry.
4. THE Idempotency_Record SHALL be stored in the same PostgreSQL database used by the application via a dedicated `IdempotencyRecord` Prisma model.

---

### Requirement 5: Enforce TTL Expiry

**User Story:** As a system operator, I want idempotency records to expire after a defined window, so that the database does not grow unboundedly and stale keys cannot be replayed indefinitely.

#### Acceptance Criteria

1. THE Idempotency_Middleware SHALL use a default TTL of 24 hours for all Idempotency_Records.
2. WHEN a POST request is received with an Idempotency_Key that matches an Idempotency_Record whose expiry timestamp is in the past, THE Idempotency_Middleware SHALL treat the key as new and process the request normally.
3. WHERE a configurable TTL is enabled, THE Idempotency_Middleware SHALL read the TTL value from the `IDEMPOTENCY_TTL_SECONDS` environment variable and apply it to all new Idempotency_Records.
4. THE Idempotency_Record table SHALL include a database index on the expiry timestamp column to support efficient cleanup queries.

---

### Requirement 6: Apply Idempotency to Contribute and Join Endpoints

**User Story:** As a circle member, I want my contribution and join requests to be idempotent, so that retrying after a network failure does not create duplicate records or charge me twice.

#### Acceptance Criteria

1. WHEN a POST request with a valid Idempotency_Key is received by `POST /api/circles/[id]/contribute`, THE Idempotency_Middleware SHALL enforce idempotency before the contribution logic executes.
2. WHEN a POST request with a valid Idempotency_Key is received by `POST /api/circles/[id]/join`, THE Idempotency_Middleware SHALL enforce idempotency before the join logic executes.
3. WHEN a duplicate contribute request is replayed, THE Contribution record in the database SHALL remain unchanged — no additional `Contribution` row SHALL be created.
4. WHEN a duplicate join request is replayed, THE CircleMember record in the database SHALL remain unchanged — no additional `CircleMember` row SHALL be created.

---

### Requirement 7: Document the Idempotency Contract in OpenAPI

**User Story:** As a client developer, I want the idempotency contract documented in the OpenAPI spec, so that I can integrate correctly without reading source code.

#### Acceptance Criteria

1. THE API_Documentation SHALL describe the `Idempotency-Key` request header as an optional UUID v4 parameter on all Mutation_Endpoint operations.
2. THE API_Documentation SHALL specify the 24-hour TTL for idempotency keys.
3. THE API_Documentation SHALL document the 409 conflict response that occurs when the same key is reused with a different payload.
4. THE API_Documentation SHALL document the `Idempotency-Replayed: true` response header returned on replay responses.
