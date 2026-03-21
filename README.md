# RAIL Score JavaScript/TypeScript SDK

[![npm version](https://badge.fury.io/js/%40responsible-ai-labs%2Frail-score.svg)](https://www.npmjs.com/package/@responsible-ai-labs/rail-score)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-green.svg)](https://nodejs.org/)

Official JavaScript/TypeScript SDK for the [RAIL Score API](https://responsibleailabs.ai) — evaluate and generate responsible AI content with comprehensive scoring across 8 dimensions: safety, privacy, fairness, transparency, accountability, reliability, inclusivity, and user impact.

## Features

- **Type-Safe** — Full TypeScript support with comprehensive type definitions
- **Complete API Coverage** — Eval, safe-regenerate (server + external mode), compliance, health
- **Dual Module Support** — CommonJS and ESM builds
- **Caching & Retry** — Optional 5-minute request cache and exponential backoff retry
- **LLM Provider Wrappers** — Built-in support for OpenAI, Anthropic, and Google Generative AI
- **Observability** — Langfuse integration, guardrail support, and full OpenTelemetry stack
- **Telemetry** — OTEL traces, metrics, compliance logging, and human review queue
- **Policy Engine** — Configurable content enforcement (log, block, regenerate, custom)
- **Middleware** — Wrap any async function with pre/post RAIL evaluation and hooks
- **Session Tracking** — Multi-turn conversation quality monitoring

## Installation

```bash
npm install @responsible-ai-labs/rail-score
```

## Quick Start

```typescript
import { RailScore } from '@responsible-ai-labs/rail-score';

const client = new RailScore({
  apiKey: process.env.RAIL_API_KEY!,
});

const result = await client.eval({
  content: 'Our AI system prioritizes user privacy and data security.',
});

console.log(`RAIL Score: ${result.rail_score.score}/10`);
console.log(`Summary: ${result.rail_score.summary}`);

for (const [name, dim] of Object.entries(result.dimension_scores)) {
  console.log(`  ${name}: ${dim.score}/10 (confidence: ${dim.confidence})`);
}
```

## API Reference

### Initialization

```typescript
const client = new RailScore({
  apiKey: 'your-rail-api-key',                      // Required
  baseUrl: 'https://api.responsibleailabs.ai',      // Optional
  timeout: 30000,                                   // Optional (ms), default 30s
  cache: true,                                      // Optional: 5-min in-memory cache
  retry: true,                                      // Optional: exponential backoff on 429/5xx
});
```

**`cache: true`** — caches `POST /eval` responses for 5 minutes using endpoint + payload as the key. Identical requests within the window skip the network call.

**`retry: true`** — automatically retries on HTTP 429, 500, 502, and 503 with delays of 1s → 2s → 4s → 8s (up to 3 retries).

---

### Evaluate Content

`POST /railscore/v1/eval`

```typescript
// Basic eval
const result = await client.eval({
  content: 'AI should prioritize human welfare and safety.',
  mode: 'basic',
});

console.log(`RAIL Score: ${result.rail_score.score}/10`);

// Deep eval with options
const deep = await client.eval({
  content: 'Take 500mg of ibuprofen every 4 hours for pain relief.',
  mode: 'deep',
  domain: 'healthcare',
  dimensions: ['safety', 'reliability'],
  includeSuggestions: true,
});

for (const [name, dim] of Object.entries(deep.dimension_scores)) {
  console.log(`${name}: ${dim.score}/10`);
  if (dim.explanation) console.log(`  ${dim.explanation}`);
}

// Custom weights (must sum to 100)
const weighted = await client.eval({
  content: 'Our hiring algorithm selects candidates based on qualifications.',
  weights: { fairness: 30, safety: 10, reliability: 15, transparency: 10,
             privacy: 10, accountability: 10, inclusivity: 10, user_impact: 5 },
});
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `content` | string | — | Text to evaluate (10–10,000 chars) |
| `mode` | string | `"basic"` | `"basic"` (fast) or `"deep"` (detailed) |
| `dimensions` | string[] | all 8 | Subset of dimensions to evaluate |
| `weights` | object | equal | Custom weights per dimension (must sum to 100) |
| `context` | string | — | Additional context for evaluation |
| `domain` | string | `"general"` | `general`, `healthcare`, `finance`, `legal`, `education`, `code` |
| `usecase` | string | `"general"` | `general`, `chatbot`, `content_generation`, `summarization`, `translation`, `code_generation` |
| `includeExplanations` | bool | mode-dependent | Include per-dimension explanations |
| `includeIssues` | bool | mode-dependent | Include per-dimension issue lists |
| `includeSuggestions` | bool | `false` | Include improvement suggestions |

---

### Safe Regenerate

`POST /railscore/v1/safe-regenerate`

#### Server-Side Mode

```typescript
const result = await client.safeRegenerate({
  content: 'Our AI system collects user data. We use it for stuff.',
  maxRegenerations: 2,
  regenerationModel: 'RAIL_Safe_LLM',
  thresholds: { overall: { score: 8.0, confidence: 0.5 } },
});

console.log(result.status);         // "passed" | "max_iterations_reached"
console.log(result.best_content);
console.log(result.best_scores?.rail_score.score);
```

#### External Mode (Client-Orchestrated)

```typescript
// Step 1: Start session
const ext = await client.safeRegenerate({
  content: 'Content to improve',
  regenerationModel: 'external',
  maxRegenerations: 1,
});
// ext.status === "awaiting_regeneration"

// Step 2: Regenerate with your own LLM, then continue
const improved = await myLLM(ext.rail_prompt);
const continued = await client.safeRegenerateContinue({
  sessionId: ext.session_id!,
  regeneratedContent: improved,
});
console.log(continued.status);
```

---

### Compliance Check

`POST /railscore/v1/compliance/check`

```typescript
// Single framework
const result = await client.complianceCheck({
  content: 'Our AI model processes user browsing history...',
  framework: 'gdpr',
  context: { domain: 'e-commerce', data_types: ['browsing_history'] },
});
console.log(`${result.compliance_score.score}/10 (${result.compliance_score.label})`);
console.log(`${result.requirements_passed}/${result.requirements_checked} passed`);

// Multi-framework (max 5)
const multi = await client.complianceCheck({
  content: 'We use cookies to track user behavior.',
  frameworks: ['gdpr', 'ccpa'],
});
console.log(multi.cross_framework_summary.average_score);
console.log(multi.cross_framework_summary.weakest_framework);
```

| ID | Framework | Aliases |
|----|-----------|---------|
| `gdpr` | EU General Data Protection Regulation | — |
| `ccpa` | California Consumer Privacy Act | — |
| `hipaa` | Health Insurance Portability and Accountability Act | — |
| `eu_ai_act` | EU AI Act | `ai_act`, `euaia` |
| `india_dpdp` | India Digital Personal Data Protection | `dpdp` |
| `india_ai_gov` | India AI Governance | `ai_governance`, `india_ai` |

---

### Health Check

```typescript
const health = await client.health();
console.log(health.status);   // "healthy"
console.log(health.service);  // "rail-score-engine"
```

---

## Session Tracking

Track RAIL scores across multi-turn conversations:

```typescript
import { RAILSession } from '@responsible-ai-labs/rail-score';

const session = new RAILSession(client, {
  deepEvalFrequency: 5,    // use deep mode every 5th turn
  qualityThreshold: 7.0,   // triggers deep mode when score dips below this
  contextWindow: 10,
});

// Evaluate and record a turn
const result = await session.addTurn('AI response content');
console.log(result.rail_score.score);

// Quick safety check on user input without recording a turn
const inputCheck = await session.evaluateInput('User message', ['safety', 'fairness']);
if (inputCheck.rail_score.score < 5) {
  console.log('Potentially unsafe input');
}

// Detailed session summary
const summary = session.scoresSummary();
console.log(`Turns: ${summary.turns}`);
console.log(`Average: ${summary.averageScore}`);
console.log(`Lowest: ${summary.lowestScore}`);
console.log(`Below threshold: ${summary.belowThresholdCount}`);

// Standard metrics
const metrics = session.getMetrics();
console.log(`Passing rate: ${metrics.passingRate}%`);

session.reset();
```

---

## Policy Engine

```typescript
import { PolicyEngine, RAILBlockedError } from '@responsible-ai-labs/rail-score';

const policy = new PolicyEngine(client, {
  mode: 'BLOCK',   // LOG_ONLY | BLOCK | REGENERATE | CUSTOM
  thresholds: { safety: 7.0, privacy: 7.0 },
});

try {
  const result = await policy.enforce('Content to check');
  console.log(result.passed, result.evaluation.rail_score.score);
} catch (error) {
  if (error instanceof RAILBlockedError) {
    console.log('Blocked:', error.message);
  }
}

// Runtime configuration
policy.setMode('REGENERATE');
policy.setThresholds({ safety: 8.0 });
policy.setCustomCallback(async (content, result) => {
  return await myLLM.fix(content);
});
```

---

## Middleware

Wrap any async function with pre/post RAIL evaluation:

```typescript
import { RAILMiddleware } from '@responsible-ai-labs/rail-score';

const middleware = new RAILMiddleware(client, {
  inputThresholds: { safety: 5.0 },
  outputThresholds: { safety: 7.0, privacy: 7.0 },
  onInputEval: (result) => console.log('Input score:', result.rail_score.score),
  onOutputEval: (result) => console.log('Output score:', result.rail_score.score),

  // Async hooks (new in v2.3.0)
  preHook: async (input) => {
    console.log('Before LLM call:', input.slice(0, 50));
  },
  postHook: async (output, evalResult) => {
    await myLogger.log({ output, score: evalResult.rail_score.score });
  },

  // Auto-upgrade to deep mode when output confidence is low (new in v2.3.0)
  upgradeOnLowConfidence: true,
  lowConfidenceThreshold: 0.6,
});

const safeLLMCall = middleware.wrap(async (input) => {
  return await myLLM.generate(input);
});

const output = await safeLLMCall('User message');
```

---

## LLM Provider Wrappers

All providers support per-call `railMode` and `railSkip` overrides, and return `wasRegenerated`, `originalContent`, and `usage` token counts.

### OpenAI

```typescript
import { RAILOpenAI } from '@responsible-ai-labs/rail-score';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const railOpenAI = new RAILOpenAI(client, openai, { thresholds: { safety: 7.0 } });

const result = await railOpenAI.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  railMode: 'deep',   // override eval mode for this call
  // railSkip: true,  // skip RAIL eval entirely
});

console.log(result.content);
console.log(result.railScore.score);
console.log(result.usage);    // { prompt_tokens, completion_tokens, total_tokens }
```

### Anthropic

```typescript
import { RAILAnthropic } from '@responsible-ai-labs/rail-score';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
const railAnthropic = new RAILAnthropic(client, anthropic, { thresholds: { safety: 7.0 } });

const result = await railAnthropic.message({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: 'You are a helpful assistant.',   // system prompt passthrough
  messages: [{ role: 'user', content: 'Hello' }],
  railMode: 'deep',
});

console.log(result.content);
console.log(result.usage);    // { input_tokens, output_tokens, total_tokens }
```

### Google Generative AI (Gemini)

```typescript
import { RAILGemini } from '@responsible-ai-labs/rail-score';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
const railGemini = new RAILGemini(client, model, { thresholds: { safety: 7.0 } });

const result = await railGemini.generate({
  contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
  railMode: 'deep',
});

console.log(result.content);
console.log(result.railScore.score);
```

---

## Observability

### Langfuse Integration

```typescript
import { RAILLangfuse } from '@responsible-ai-labs/rail-score';

const railLangfuse = new RAILLangfuse(client, langfuse);

// Evaluate and log in one call (new in v2.3.0)
const result = await railLangfuse.evaluateAndLog('Content to evaluate', 'trace-id', {
  mode: 'deep',
  observationId: 'obs-123',
  sessionId: 'session-456',
  thresholdMet: result.rail_score.score >= 7.0,
  comment: 'Production eval',
});

// Or separately: trace an existing result
await railLangfuse.scoreTrace('trace-id', existingResult, {
  observationId: 'obs-123',
  sessionId: 'session-456',
  thresholdMet: true,
});
// Emits: rail_score, rail_confidence, rail_threshold_met, rail_<dimension> × 8
```

### Guardrail Handler

```typescript
import { RAILGuardrail } from '@responsible-ai-labs/rail-score';

const guardrail = new RAILGuardrail(client, {
  inputThresholds: { safety: 7.0 },
  outputThresholds: { safety: 7.0, fairness: 7.0 },
});

const pre = await guardrail.preCall('User message');
if (!pre.allowed) console.log('Blocked:', pre.failedDimensions);

const post = await guardrail.postCall('LLM response');
if (!post.allowed) console.log('Output blocked:', post.failedDimensions);
```

---

## Telemetry (OpenTelemetry)

Full OTEL integration — traces, metrics, compliance logging, and human review queue. OTEL packages are optional; the SDK degrades gracefully when they are not installed.

### Setup

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-grpc
```

### RAILTelemetry

```typescript
import { RAILTelemetry, RAILInstrumentor } from '@responsible-ai-labs/rail-score';

const telemetry = new RAILTelemetry({
  serviceName: 'my-ai-service',
  orgId: 'org-123',
  projectId: 'project-abc',
  environment: 'production',
  exporter: 'otlp',                            // 'console' | 'otlp' | 'none'
  otlpEndpoint: 'http://collector:4317',
  protocol: 'grpc',
});

// Auto-instrument client — wraps every request in a span, records metrics
const instrumentor = new RAILInstrumentor();
instrumentor.instrumentClient(client, telemetry);

// Spans record: endpoint, mode, score, confidence, credits_consumed, from_cache
// Metrics: rail.requests, rail.request.duration, rail.errors, rail.score.distribution
```

### ComplianceLogger

```typescript
import { ComplianceLogger, IncidentLogger } from '@responsible-ai-labs/rail-score';

const logger = new ComplianceLogger(telemetry);

// Logs INFO summary, WARNING for medium issues, ERROR for high severity issues
logger.logComplianceResult(complianceResult, 'content preview...');
logger.logMultiComplianceResult(multiResult);

const incidentLogger = new IncidentLogger(telemetry);
incidentLogger.createIncident({
  id: 'INC-001',
  type: 'compliance_violation',
  severity: 'high',
  title: 'GDPR article 13 breach detected',
  affectedDimensions: ['privacy', 'transparency'],
  threshold: 7.0,
});
```

### HumanReviewQueue

```typescript
import { HumanReviewQueue } from '@responsible-ai-labs/rail-score';

const queue = new HumanReviewQueue({
  threshold: 4.0,           // flag dimensions scoring below this
  orgId: 'org-123',
  projectId: 'project-abc',
  environment: 'production',
  telemetry,
});

// After eval — auto-flags any dimension below threshold
const flagged = queue.checkAndEnqueue(evalResult, content.slice(0, 200));
console.log(`Flagged ${flagged.length} dimensions for review`);

// Inspect and drain
console.log(queue.sizeByDimension());
const items = queue.drain();  // returns all items and clears queue
```

### TelemetryConstants

```typescript
import { TelemetryConstants } from '@responsible-ai-labs/rail-score';

// OTEL attribute name constants
console.log(TelemetryConstants.ATTR_SCORE);              // 'rail.score'
console.log(TelemetryConstants.METRIC_REQUESTS);         // 'rail.requests'
console.log(TelemetryConstants.ATTR_COMPLIANCE_FRAMEWORK); // 'rail.compliance_framework'
```

---

## Error Handling

```typescript
import {
  RailScoreError,
  AuthenticationError,
  InsufficientCreditsError,
  ContentTooHarmfulError,
  SessionExpiredError,
  RateLimitError,
  EvaluationFailedError,
  ServiceUnavailableError,
  InsufficientTierError,
  NotImplementedByServerError,
} from '@responsible-ai-labs/rail-score';

try {
  const result = await client.eval({ content: 'test' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof InsufficientCreditsError) {
    console.log(`Need ${error.required} credits, have ${error.balance}`);
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited, retry after ${error.retryAfter}s`);
  } else if (error instanceof RailScoreError) {
    console.log(`API error ${error.statusCode}: ${error.message}`);
  }
}
```

| Status | Exception | Notes |
|--------|-----------|-------|
| 400 | `ValidationError` | Invalid parameters |
| 401 | `AuthenticationError` | Invalid or missing API key |
| 402 | `InsufficientCreditsError` | Has `.balance` and `.required` |
| 403 | `InsufficientTierError` | Has `.requiredTier` and `.currentTier` |
| 410 | `SessionExpiredError` | External-mode sessions expire after 15 min |
| 422 | `ContentTooHarmfulError` | Avg score < 3.0, cannot regenerate |
| 429 | `RateLimitError` | Has `.retryAfter` |
| 500 | `EvaluationFailedError` | Has `.reqId` |
| 501 | `NotImplementedByServerError` | Feature not yet available |
| 503 | `ServiceUnavailableError` | Has `.retryAfter` |

---

## Utility Functions

```typescript
import {
  formatScore, getScoreColor, getScoreGrade, getScoreLabel,
  validateWeights, normalizeWeightsTo100, resolveFrameworkAlias,
  getDimensionsBelowThreshold, aggregateScores, isPassing,
  confidenceWeightedScore,
} from '@responsible-ai-labs/rail-score';

formatScore(8.567, 2);                        // "8.57"
getScoreColor(8.5);                           // "green"
getScoreGrade(8.5);                           // "A-"
getScoreLabel(8.5);                           // "Excellent"
resolveFrameworkAlias('ai_act');              // "eu_ai_act"
validateWeights({ safety: 50, privacy: 50 }); // true
isPassing(7.5);                               // true (default threshold 7.0)
confidenceWeightedScore(8.0, 0.9);            // 7.2
```

---

## TypeScript Types

```typescript
import type {
  RailScoreConfig, EvalParams, EvalResult, DimensionScore,
  SafeRegenerateParams, SafeRegenerateResult,
  ComplianceResult, MultiComplianceResult, ComplianceFramework, ComplianceContext,
  Dimension, EvaluationMode, HealthCheckResponse,
  SessionConfig, SessionMetrics, ScoresSummary,
  PolicyConfig, MiddlewareConfig,
  TelemetryConfig, ReviewItem,
} from '@responsible-ai-labs/rail-score';
```

---

## Peer Dependencies (Optional)

```bash
npm install openai                                        # RAILOpenAI
npm install @anthropic-ai/sdk                            # RAILAnthropic
npm install @google/generative-ai                        # RAILGemini
npm install langfuse                                     # RAILLangfuse
npm install @opentelemetry/api @opentelemetry/sdk-node   # RAILTelemetry
```

---

## Migration from v2.2.1

All v2.2.1 APIs are unchanged. v2.3.0 adds only new optional features:

```typescript
// Caching and retry — opt-in via config
const client = new RailScore({ apiKey: '...', cache: true, retry: true });

// Session — new methods
const inputCheck = await session.evaluateInput('user message');  // no history
const summary = session.scoresSummary();  // { turns, averageScore, lowestScore, ... }

// Middleware — new hooks and auto-upgrade
const mw = new RAILMiddleware(client, {
  preHook: async (input) => { /* before LLM */ },
  postHook: async (output, result) => { /* after eval */ },
  upgradeOnLowConfidence: true,
});

// Providers — per-call overrides + richer response
const result = await railOpenAI.chat({ ..., railMode: 'deep', railSkip: false });
console.log(result.usage, result.wasRegenerated, result.originalContent);

// Langfuse — combined eval+log
await railLangfuse.evaluateAndLog(content, traceId, { observationId, sessionId });
```

## Migration from v2.1.1

```typescript
// Evaluation
const result = await client.eval({ content: 'text' });       // v2.2.1+
// was: client.evaluation.basic('text')

// Safe Regenerate
const result = await client.safeRegenerate({ content: 'text', thresholds: { overall: { score: 9.0 } } });
// was: client.generation.generate('text', { targetScore: 9.0 })

// Compliance
const result = await client.complianceCheck({ content: 'text', framework: 'gdpr' });
// was: client.compliance.check('text', 'gdpr')

// Weights — must sum to 100
weights: { safety: 50, privacy: 50 }
// was: { safety: 0.5, privacy: 0.5 }
```

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Links

- [Documentation](https://responsibleailabs.ai/docs)
- [GitHub Repository](https://github.com/Responsible-AI-Labs/rail-score-js)
- [npm Package](https://www.npmjs.com/package/@responsible-ai-labs/rail-score)
- **Support**: support@responsibleailabs.ai
