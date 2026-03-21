# Changelog

All notable changes to the RAIL Score JavaScript/TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-03-21

### Added

#### Telemetry Module (new `src/telemetry/`)
- New `RAILTelemetry` class — optional OpenTelemetry integration with graceful degradation when OTEL packages are not installed. Supports `console`, `otlp`, and `none` exporters. Configurable service name, org/project/environment attributes, and OTLP endpoint with headers.
- New `RAILInstrumentor` class — monkey-patches a `RailScore` client's `request()` method to automatically wrap every API call in an OTEL span and record `rail.requests`, `rail.request.duration`, `rail.errors`, and `rail.score.distribution` metrics.
- New `ComplianceLogger` class — logs compliance results at the appropriate severity level (INFO/WARN/ERROR based on issue severity) with optional OTEL span recording.
- New `IncidentLogger` class — creates and logs structured incident JSON records with optional OTEL span recording.
- New `HumanReviewQueue` class — maintains an in-memory queue of content items flagged for human review when dimension scores fall below a configurable threshold. Supports `checkAndEnqueue()`, `pending()`, `drain()`, `size()`, and `sizeByDimension()`.
- New `TelemetryConstants` namespace — semantic attribute name constants for spans/events and metric names, matching the Python SDK constant definitions.
- `ReviewItem` interface — structured record for items in the human review queue.
- `TelemetryConfig` interface — configuration type for `RAILTelemetry`.

#### Client (`src/client.ts`)
- Request-level in-memory caching with a 5-minute TTL, enabled via `config.cache: true`. Cache applies to `/railscore/v1/eval` and `/health` endpoints. Cache key is built from the endpoint path and sorted JSON body for stability.
- Automatic retry with exponential backoff (1 s → 2 s → 4 s → 8 s, up to 3 retries) on HTTP 429/500/502/503 responses, enabled via `config.retry: true`.

#### Session (`src/session.ts`)
- New `evaluateInput(content, dimensions?)` method — evaluates input content without recording it in session history. Use for quick safety checks of user input before adding a turn.
- New `scoresSummary()` method — returns a `ScoresSummary` with `turns`, `averageScore`, `lowestScore`, `belowThresholdCount`, and `regenerationCount`.

#### Middleware (`src/middleware.ts`)
- `preHook` — optional async hook called before the wrapped function executes, receives the raw input string.
- `postHook` — optional async hook called after output evaluation, receives the output string and `EvalResult`.
- `upgradeOnLowConfidence` — when set to `true`, automatically re-evaluates output with `mode: 'deep'` if the initial eval's confidence falls below `lowConfidenceThreshold` (default: 0.6).

#### Providers
- **All providers** (`RAILOpenAI`, `RAILAnthropic`, `RAILGemini`): support per-call `railMode` override to use a specific eval mode for that call only, and `railSkip` flag to bypass RAIL evaluation entirely.
- **All providers**: richer response type with `wasRegenerated` (boolean), `originalContent` (string | undefined), and `usage` (token counts). These fields are pre-wired for future auto-regeneration support.
- `RAILOpenAI.chat()` — extracts `usage` from `response.usage` as `{ prompt_tokens, completion_tokens, total_tokens }`.
- `RAILAnthropic.message()` — supports `system` parameter pass-through; extracts `usage` as `{ input_tokens, output_tokens, total_tokens }`.
- `RAILGemini.generate()` — extracts token counts from `usageMetadata`; `RAILGeminiConfig` gains `useVertexAI` metadata flag.

#### Observability (`src/observability/langfuse.ts`)
- New `evaluateAndLog(content, traceId, options?)` method — combines `eval()` + `scoreTrace()` into a single call.
- Enhanced `scoreTrace()` — now accepts optional `observationId`, `sessionId`, `comment`, and `thresholdMet` parameters. Emits `rail_confidence` and `rail_threshold_met` scores in addition to the existing `rail_score` and per-dimension scores.

#### Types (`src/types.ts`)
- `RailScoreConfig.cache` — enable request-level caching (boolean, default false).
- `RailScoreConfig.retry` — enable exponential backoff retry (boolean, default false).
- `ScoresSummary` interface — summary of RAIL scores across session turns.
- `MiddlewareConfig.preHook` — async hook called before the wrapped function.
- `MiddlewareConfig.postHook` — async hook called after output evaluation.
- `MiddlewareConfig.upgradeOnLowConfidence` — auto-upgrade to deep eval mode flag.
- `MiddlewareConfig.lowConfidenceThreshold` — confidence threshold for mode upgrade.

### Changed
- `SDK_VERSION` bumped to `2.3.0` (affects `User-Agent` header).
- `RAILOpenAI.chat()`, `RAILAnthropic.message()`, and `RAILGemini.generate()` now return their respective richer response types (`RAILOpenAIResponse`, `RAILAnthropicResponse`, `RAILGeminiResponse`) instead of the previous inline object type. Existing field names (`response`, `content`, `railScore`, `evaluation`) are unchanged.

---

## [2.1.1] - 2026-02-25

### Added

#### Evaluation Modes
- `evaluation.basic()` now accepts an optional `options` parameter with `mode`, `domain`, and `usecase` fields
- **Deep evaluation mode** — set `mode: 'deep'` for more thorough analysis with domain-specific scoring
- **Protected evaluation** — `evaluation.protectedEvaluate()` evaluates content against a threshold and returns pass/fail with failed dimensions
- **Protected regeneration** — `evaluation.protectedRegenerate()` rewrites content to fix specific issues

#### Multi-Turn Session Tracking
- New `RAILSession` class for tracking RAIL scores across conversation turns
- Automatic deep evaluation every N turns (configurable via `deepEvalFrequency`)
- Quality dip detection — triggers deep eval when scores drop below threshold
- Session metrics: average score, min/max, dimension averages, passing rate

#### Policy Engine
- New `PolicyEngine` class with four enforcement modes:
  - `LOG_ONLY` — evaluate and return results without blocking
  - `BLOCK` — throw `RAILBlockedError` when dimensions fall below thresholds
  - `REGENERATE` — automatically rewrite content that fails thresholds
  - `CUSTOM` — invoke a user-defined async callback for custom handling
- Runtime-configurable mode, thresholds, and callbacks via `setMode()`, `setThresholds()`, `setCustomCallback()`

#### Middleware
- New `RAILMiddleware` class — wraps any async function with pre/post RAIL evaluation
- Input evaluation against configurable `inputThresholds`
- Output evaluation against configurable `outputThresholds`
- Lifecycle hooks: `onInputEval`, `onOutputEval` for logging or custom logic
- Built-in policy enforcement on output

#### LLM Provider Wrappers
- `RAILOpenAI` — wraps OpenAI `chat.completions.create` with automatic RAIL scoring
- `RAILAnthropic` — wraps Anthropic `messages.create` with automatic RAIL scoring
- `RAILGemini` — wraps Google Generative AI `generateContent` with automatic RAIL scoring
- All providers support optional threshold enforcement via `RAILBlockedError`

#### Observability Integrations
- `RAILLangfuse` — push RAIL scores to Langfuse traces (`traceEvaluation`, `scoreTrace`)
- `RAILGuardrail` — pre/post call guardrails with configurable thresholds for LiteLLM integration

#### New Error Classes
- `InsufficientTierError` — 403 responses indicating tier upgrade required
- `ContentTooHarmfulError` — content rejected as too harmful to process
- `EvaluationFailedError` — evaluation failed server-side
- `ServiceUnavailableError` — 503 responses with optional `retryAfter`
- `RAILBlockedError` — content blocked by policy engine or provider thresholds

#### New Utility Functions
- `getScoreLabel(score)` — returns human-readable label: Excellent, Good, Needs improvement, Poor, Critical
- `normalizeWeightsTo100(weights)` — converts sum-to-1.0 weights to sum-to-100 format
- `normalizeDimensionName(dim)` — maps deprecated dimension names to current names

#### New Compliance Frameworks
- `eu_ai_act` — EU Artificial Intelligence Act
- `india_dpdp` — India Digital Personal Data Protection Act
- `india_ai_governance` — India AI Governance Framework

#### Compliance Options
- `compliance.check()` and `compliance.checkMultiple()` now accept optional `ComplianceCheckOptions` with `context` and `strict_mode` fields

#### API Version
- New `client.version()` method — returns API version information via `GET /v1/version`

#### Score Labels
- `DimensionScore` now includes an optional `label` field with human-readable score classification

### Changed
- **Node.js minimum version**: 14 → 16
- **User-Agent header**: Updated to `rail-score-js/2.1.1`
- **HTTP 403 errors**: Now throw `InsufficientTierError` instead of generic `ServerError`
- **HTTP 503 errors**: Now throw `ServiceUnavailableError` instead of generic `ServerError`
- `validateWeights()` now accepts weights that sum to either 1.0 or 100
- `evaluation.dimension()`, `evaluation.custom()`, and `evaluation.batch()` now accept `DimensionInput` which includes the deprecated `legal_compliance` name

### Deprecated
- **`legal_compliance` dimension** — renamed to `inclusivity`. Using `legal_compliance` still works but logs a deprecation warning and auto-maps to `inclusivity`
- **Weights summing to 100** — the SDK auto-converts but logs a deprecation warning. Use weights summing to 1.0 instead

### Migration Guide

**Dimension rename:**
```typescript
// Before (v1.0.0)
client.evaluation.dimension(content, 'legal_compliance');

// After (v2.1.1) — old name still works with deprecation warning
client.evaluation.dimension(content, 'inclusivity');
```

**Evaluation modes:**
```typescript
// Basic mode (default, same as v1)
const result = await client.evaluation.basic(content);

// Deep mode (new)
const result = await client.evaluation.basic(content, undefined, {
  mode: 'deep',
  domain: 'healthcare',
});
```

---

## [1.0.0] - 2024-01-15

### Added

#### Core Features
- 🎉 Initial release of RAIL Score JavaScript/TypeScript SDK
- ✅ Full TypeScript support with comprehensive type definitions
- ✅ Dual module support (CommonJS and ESM)

#### Evaluation API
- `evaluation.basic()` - Basic content evaluation across all dimensions
- `evaluation.dimension()` - Dimension-specific evaluation
- `evaluation.custom()` - Custom evaluation with specific dimensions and weights
- `evaluation.batch()` - Batch evaluation of multiple content items
- `evaluation.ragEvaluate()` - RAG (Retrieval-Augmented Generation) quality assessment

#### Generation API
- `generation.generate()` - Generate responsible AI content
- `generation.improve()` - Improve existing content to achieve higher scores
- `generation.rewrite()` - Rewrite content to fix specific issues
- `generation.variations()` - Generate content variations optimized for different dimensions

#### Compliance API
- `compliance.check()` - Check compliance against specific frameworks
- `compliance.checkMultiple()` - Multi-framework compliance checking
- `compliance.scan()` - Comprehensive compliance issue scanning
- `compliance.getRecommendations()` - Get actionable compliance recommendations
- `compliance.getRequirements()` - Get framework requirement details
- `compliance.listFrameworks()` - List all available compliance frameworks

#### Account Management
- `getCredits()` - Check credit balance
- `getUsage()` - Get usage statistics
- `healthCheck()` - API health check

#### Utility Functions
- `formatScore()` - Format scores for display
- `getScoreColor()` - Get color indicator based on score
- `getScoreGrade()` - Get letter grade for score
- `validateWeights()` - Validate dimension weights
- `normalizeWeights()` - Normalize weights to sum to 1.0
- `calculateWeightedScore()` - Calculate weighted average of scores
- `getLowestScoringDimension()` - Find lowest scoring dimension
- `getHighestScoringDimension()` - Find highest scoring dimension
- `getDimensionsBelowThreshold()` - Filter dimensions below threshold
- `formatDimensionName()` - Format dimension names for display
- `aggregateScores()` - Aggregate statistics from multiple results
- `isPassing()` - Check if score meets threshold
- `confidenceWeightedScore()` - Calculate confidence-weighted score

#### Error Handling
- `RailScoreError` - Base error class
- `AuthenticationError` - Invalid or missing API key
- `InsufficientCreditsError` - Insufficient credits for request
- `ValidationError` - Invalid request parameters
- `RateLimitError` - Rate limit exceeded
- `TimeoutError` - Request timeout
- `NetworkError` - Network connection failure
- `ServerError` - Server-side error
- `ContentTooLongError` - Content exceeds maximum length

#### Supported Dimensions
- Safety - Content safety and harm prevention
- Privacy - Data protection and user privacy
- Fairness - Bias detection and fairness
- Transparency - Explainability and clarity
- Accountability - Responsibility and oversight
- Reliability - Consistency and dependability
- Legal Compliance - Regulatory compliance
- User Impact - User experience and impact

#### Supported Compliance Frameworks
- GDPR - General Data Protection Regulation (EU)
- HIPAA - Health Insurance Portability and Accountability Act (US)
- CCPA - California Consumer Privacy Act (US)
- SOX - Sarbanes-Oxley Act (US)
- PCI DSS - Payment Card Industry Data Security Standard
- ISO 27001 - Information Security Management
- NIST - NIST Cybersecurity Framework (US)

#### Testing
- 130+ comprehensive tests with 80%+ coverage
- Unit tests for all API methods
- Error handling tests
- Edge case and validation tests
- Utility function tests

#### Examples
- Basic usage example (Node.js)
- Batch evaluation example (Node.js)
- Content generation example (Node.js)
- Compliance checking example (Node.js)
- Interactive browser example (HTML)

#### Documentation
- Comprehensive README with API documentation
- JSDoc comments for all public APIs
- TypeScript type definitions
- Usage examples for all features
- Error handling guide
- Performance tips

### Configuration
- Configurable API base URL
- Configurable request timeout (default: 60s)
- Support for custom HTTP headers

### Dependencies
- `node-fetch` ^3.3.2 - HTTP client for Node.js

### Development Dependencies
- TypeScript 5.2
- Jest 29.7 for testing
- TSup for building
- ESLint for linting
- Prettier for code formatting

---

## [Unreleased]

### Planned Features
- [ ] Streaming API support
- [ ] Webhook integration
- [ ] Custom dimension definitions
- [ ] Advanced caching strategies
- [ ] Request retry logic with exponential backoff

---

## Release Notes Format

### Version Number Format
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

### Change Categories
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security fixes

---

For more information, visit:
- [GitHub Repository](https://github.com/Responsible-AI-Labs/rail-score-js)
- [npm Package](https://www.npmjs.com/package/@responsibleailabs/rail-score)
- [Documentation](https://responsibleailabs.ai/docs)
