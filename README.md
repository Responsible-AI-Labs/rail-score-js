# RAIL Score JavaScript/TypeScript SDK

[![npm version](https://badge.fury.io/js/%40responsibleailabs%2Frail-score.svg)](https://www.npmjs.com/package/@responsible-ai-labs/rail-score/v/2.2.1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-green.svg)](https://nodejs.org/)

Official JavaScript/TypeScript SDK for the [RAIL Score API](https://responsibleailabs.ai) - Evaluate and generate responsible AI content with comprehensive scoring across safety, privacy, fairness, transparency, accountability, reliability, inclusivity, and user impact dimensions.

## Features

- **Type-Safe** - Full TypeScript support with comprehensive type definitions
- **Complete API Coverage** - Eval, safe-regenerate (server + external mode), compliance, health
- **Dual Module Support** - CommonJS and ESM builds
- **LLM Provider Wrappers** - Built-in support for OpenAI, Anthropic, and Google Generative AI
- **Observability** - Langfuse integration and guardrail support
- **Policy Engine** - Configurable content enforcement (log, block, regenerate, custom)
- **Middleware** - Wrap any async function with pre/post RAIL evaluation
- **Session Tracking** - Multi-turn conversation quality monitoring

## Installation

```bash
npm install @responsible-ai-labs/rail-score
```

## Quick Start

```typescript
import { RailScore, getScoreLabel } from '@responsible-ai-labs/rail-score';

const client = new RailScore({
  apiKey: process.env.RAIL_API_KEY!,
});

// Basic evaluation
const result = await client.eval({
  content: 'Our AI system prioritizes user privacy and data security.',
});

console.log(`RAIL Score: ${result.rail_score.score}/10`);
console.log(`Confidence: ${result.rail_score.confidence}`);
console.log(`Summary: ${result.rail_score.summary}`);

for (const [name, dim] of Object.entries(result.dimension_scores)) {
  console.log(`  ${name}: ${dim.score}/10 (confidence: ${dim.confidence})`);
}
```

## API Reference

### Initialization

```typescript
const client = new RailScore({
  apiKey: 'your-rail-api-key',                         // Required
  baseUrl: 'https://api.responsibleailabs.ai',    // Optional
  timeout: 30000,                                  // Optional (ms), default 30s
});
```

### Evaluate Content

`POST /railscore/v1/eval`

```typescript
// Basic eval
const result = await client.eval({
  content: 'AI should prioritize human welfare and safety.',
  mode: 'basic',
});

console.log(`RAIL Score: ${result.rail_score.score}/10`);
console.log(`Summary: ${result.rail_score.summary}`);

// Deep eval with options
const deep = await client.eval({
  content: 'Take 500mg of ibuprofen every 4 hours for pain relief.',
  mode: 'deep',
  domain: 'healthcare',
  dimensions: ['safety', 'reliability'],
  includeSuggestions: true,
});

for (const [name, dim] of Object.entries(deep.dimension_scores)) {
  console.log(`\n${name}: ${dim.score}/10`);
  if (dim.explanation) console.log(`  Explanation: ${dim.explanation}`);
  if (dim.issues) console.log(`  Issues: ${dim.issues}`);
}

if (deep.improvement_suggestions) {
  for (const s of deep.improvement_suggestions) {
    console.log(`  Suggestion: ${s}`);
  }
}

// Custom weights (must sum to 100)
const weighted = await client.eval({
  content: 'Our hiring algorithm selects candidates based on qualifications.',
  mode: 'basic',
  weights: {
    fairness: 30,
    safety: 10,
    reliability: 15,
    transparency: 10,
    privacy: 10,
    accountability: 10,
    inclusivity: 10,
    user_impact: 5,
  },
});
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | Yes | - | Text to evaluate (10-10,000 chars) |
| `mode` | string | No | `"basic"` | `"basic"` (fast) or `"deep"` (detailed with explanations) |
| `dimensions` | string[] | No | all 8 | Subset of dimensions to evaluate |
| `weights` | object | No | equal | Custom weights per dimension (must sum to 100) |
| `context` | string | No | - | Additional context for evaluation |
| `domain` | string | No | `"general"` | `general`, `healthcare`, `finance`, `legal`, `education`, `code` |
| `usecase` | string | No | `"general"` | `general`, `chatbot`, `content_generation`, `summarization`, `translation`, `code_generation` |
| `includeExplanations` | bool | No | mode-dependent | Include per-dimension explanations |
| `includeIssues` | bool | No | mode-dependent | Include per-dimension issue lists |
| `includeSuggestions` | bool | No | `false` | Include improvement suggestions |

### Safe Regenerate

`POST /railscore/v1/safe-regenerate`

Evaluates content and iteratively regenerates it until quality thresholds are met.

#### Server-Side Mode (RAIL_Safe_LLM)

```typescript
const result = await client.safeRegenerate({
  content: 'Our AI system collects user data. We use it for stuff.',
  mode: 'basic',
  maxRegenerations: 2,
  regenerationModel: 'RAIL_Safe_LLM',
  thresholds: { overall: { score: 8.0, confidence: 0.5 } },
});

console.log(`Status: ${result.status}`);
console.log(`Best iteration: ${result.best_iteration}`);
console.log(`Credits consumed: ${result.credits_consumed}`);

if (result.best_content) {
  console.log(`Best content: ${result.best_content}`);
}

if (result.best_scores) {
  const rail = result.best_scores.rail_score;
  console.log(`Best RAIL score: ${rail.score}/10`);
}

if (result.iteration_history) {
  for (const rec of result.iteration_history) {
    const rail = rec.scores?.rail_score || {};
    console.log(`  Iteration ${rec.iteration}: score=${rail.score}, improvement=${rec.improvement_from_previous}`);
  }
}

if (result.credits_breakdown) {
  const cb = result.credits_breakdown;
  console.log(`Credits: ${cb.evaluations} eval + ${cb.regenerations} regen = ${cb.total} total`);
}
```

#### External Mode (Client-Orchestrated)

```typescript
// Step 1: Start external session
const ext = await client.safeRegenerate({
  content: 'Our AI system collects user data. We use it for stuff.',
  mode: 'basic',
  maxRegenerations: 1,
  regenerationModel: 'external',
});

console.log(`Status: ${ext.status}`);  // "awaiting_regeneration"
console.log(`Session ID: ${ext.session_id}`);
console.log(`Iterations remaining: ${ext.iterations_remaining}`);

if (ext.rail_prompt) {
  console.log(`System prompt: ${ext.rail_prompt.system_prompt.slice(0, 100)}...`);
  console.log(`User prompt: ${ext.rail_prompt.user_prompt.slice(0, 100)}...`);
}

// Step 2: Regenerate with your own LLM, then continue
if (ext.status === 'awaiting_regeneration' && ext.session_id) {
  const improvedContent = await myLLMCall(ext.rail_prompt);

  const continued = await client.safeRegenerateContinue({
    sessionId: ext.session_id,
    regeneratedContent: improvedContent,
  });

  console.log(`Status: ${continued.status}`);
  if (continued.best_scores) {
    console.log(`New score: ${continued.best_scores.rail_score.score}/10`);
  }
}
```

### Compliance Check

`POST /railscore/v1/compliance/check`

#### Single Framework

```typescript
const result = await client.complianceCheck({
  content: 'Our AI model processes user browsing history and purchase patterns...',
  framework: 'gdpr',
  context: {
    domain: 'e-commerce',
    data_types: ['browsing_history', 'purchase_data', 'ip_address'],
    processing_purpose: 'personalized_recommendations',
  },
});

console.log(`Score: ${result.compliance_score.score}/10 (${result.compliance_score.label})`);
console.log(`Summary: ${result.compliance_score.summary}`);
console.log(`Requirements: ${result.requirements_passed}/${result.requirements_checked} passed`);

if (result.issues) {
  for (const issue of result.issues.slice(0, 3)) {
    console.log(`  [${issue.severity.toUpperCase()}] ${issue.description}`);
    console.log(`    Article: ${issue.article} | Effort: ${issue.remediation_effort}`);
  }
}
```

#### Multi-Framework

```typescript
const multi = await client.complianceCheck({
  content: 'We use cookies to track user behavior and sell profiles to advertisers.',
  frameworks: ['gdpr', 'ccpa'],
  context: { domain: 'advertising' },
});

const summary = multi.cross_framework_summary;
console.log(`Average score: ${summary.average_score}/10`);
console.log(`Weakest: ${summary.weakest_framework} (${summary.weakest_score}/10)`);

for (const [fwName, fwResult] of Object.entries(multi.results)) {
  const cs = fwResult.compliance_score;
  console.log(`  ${fwName.toUpperCase()}: ${cs.score}/10 (${cs.label})`);
  console.log(`    ${fwResult.requirements_passed}/${fwResult.requirements_checked} passed`);
}
```

#### EU AI Act (Risk Classification)

```typescript
const result = await client.complianceCheck({
  content: 'Our facial recognition system is deployed in public spaces for surveillance.',
  framework: 'eu_ai_act',
  context: {
    domain: 'law_enforcement',
    system_type: 'biometric_identification',
    data_types: ['biometric_data', 'facial_images'],
    risk_indicators: ['real_time_surveillance', 'biometric_identification'],
  },
});

if (result.risk_classification_detail) {
  console.log(`Risk Tier: ${result.risk_classification_detail.tier}`);
  console.log(`Basis: ${result.risk_classification_detail.basis}`);
}
```

#### Strict Mode

```typescript
const result = await client.complianceCheck({
  content: 'Our AI chatbot uses anonymized data and identifies itself as AI.',
  framework: 'ccpa',
  strictMode: true,
  context: { domain: 'customer_service' },
});
```

**Supported Frameworks:**

| ID | Framework | Aliases |
|----|-----------|---------|
| `gdpr` | EU General Data Protection Regulation | - |
| `ccpa` | California Consumer Privacy Act | - |
| `hipaa` | Health Insurance Portability and Accountability Act | - |
| `eu_ai_act` | EU AI Act | `ai_act`, `euaia` |
| `india_dpdp` | India Digital Personal Data Protection | `dpdp` |
| `india_ai_gov` | India AI Governance | `ai_governance`, `india_ai` |

### Health Check

`GET /health` (no authentication required)

```typescript
const health = await client.health();
console.log(`Status: ${health.status}`);    // "healthy"
console.log(`Service: ${health.service}`);  // "rail-score-engine"
```

## Error Handling

```typescript
import {
  RailScoreError,
  AuthenticationError,
  InsufficientCreditsError,
  ContentTooHarmfulError,
  SessionExpiredError,
  ValidationError,
  RateLimitError,
  EvaluationFailedError,
  NotImplementedByServerError,
  ServiceUnavailableError,
  InsufficientTierError,
} from '@responsible-ai-labs/rail-score';

try {
  const result = await client.eval({ content: 'test', mode: 'basic' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof InsufficientCreditsError) {
    console.log(`Need ${error.required} credits, have ${error.balance}`);
  } else if (error instanceof ValidationError) {
    console.log(`Bad request: ${error.message}`);
  } else if (error instanceof RailScoreError) {
    console.log(`API error ${error.statusCode}: ${error.message}`);
  }
}

// Safe-regenerate specific errors
try {
  const result = await client.safeRegenerate({ content: 'harmful content', mode: 'basic' });
} catch (error) {
  if (error instanceof ContentTooHarmfulError) {
    console.log('Content too harmful to regenerate (avg score < 3.0)');
  }
}

try {
  const result = await client.safeRegenerateContinue({
    sessionId: 'sr_expired',
    regeneratedContent: '...',
  });
} catch (error) {
  if (error instanceof SessionExpiredError) {
    console.log('Session expired - external sessions last 15 minutes');
  }
}
```

All exceptions inherit from `RailScoreError` which has:
- `message: string`
- `statusCode: number`
- `response: object` (raw error body)

| Status | Exception | Description |
|--------|-----------|-------------|
| 400 | `ValidationError` | Invalid parameters |
| 401 | `AuthenticationError` | Invalid or missing API key |
| 402 | `InsufficientCreditsError` | Not enough credits (has `.balance` and `.required`) |
| 403 | `InsufficientTierError` | Feature requires higher plan tier |
| 410 | `SessionExpiredError` | External-mode session expired (15 min TTL) |
| 422 | `ContentTooHarmfulError` | Content avg score < 3.0, cannot regenerate |
| 429 | `RateLimitError` | Rate limit exceeded |
| 500 | `EvaluationFailedError` | Internal server error (safe to retry) |
| 501 | `NotImplementedByServerError` | Feature not yet implemented |
| 503 | `ServiceUnavailableError` | Temporarily unavailable |

## Available Dimensions

`fairness`, `safety`, `reliability`, `transparency`, `privacy`, `accountability`, `inclusivity`, `user_impact`

Each dimension returns a `score` (0-10) and `confidence` (0-1). Deep mode also returns `explanation` (string) and `issues` (string array).

## Session Tracking

Track RAIL scores across multi-turn conversations:

```typescript
import { RAILSession } from '@responsible-ai-labs/rail-score';

const session = new RAILSession(client, {
  deepEvalFrequency: 5,
  qualityThreshold: 7.0,
});

const result = await session.addTurn('AI response content');
console.log(result.rail_score.score);

const metrics = session.getMetrics();
console.log(`Average: ${metrics.averageScore}`);
console.log(`Passing rate: ${metrics.passingRate}%`);

session.reset();
```

## Policy Engine

Enforce content quality policies:

```typescript
import { PolicyEngine, RAILBlockedError } from '@responsible-ai-labs/rail-score';

const policy = new PolicyEngine(client, {
  mode: 'BLOCK',
  thresholds: { safety: 7.0, privacy: 7.0 },
});

try {
  const result = await policy.enforce('Content to check');
  console.log(result.evaluation.rail_score.score);
} catch (error) {
  if (error instanceof RAILBlockedError) {
    console.log(`Blocked: ${error.message}`);
  }
}
```

## Middleware

Wrap any async function with pre/post RAIL evaluation:

```typescript
import { RAILMiddleware } from '@responsible-ai-labs/rail-score';

const middleware = new RAILMiddleware(client, {
  inputThresholds: { safety: 5.0 },
  outputThresholds: { safety: 7.0, privacy: 7.0 },
  onOutputEval: (result) => console.log(`Output score: ${result.rail_score.score}`),
});

const safeLLMCall = middleware.wrap(async (input) => {
  return await myLLM.generate(input);
});

const output = await safeLLMCall('User message');
```

## LLM Provider Wrappers

### OpenAI

```typescript
import { RAILOpenAI } from '@responsible-ai-labs/rail-score';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const railOpenAI = new RAILOpenAI(client, openai, { thresholds: { safety: 7.0 } });

const result = await railOpenAI.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});

console.log(result.content);
console.log(result.railScore.score);
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
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Google Generative AI (Gemini)

```typescript
import { RAILGemini } from '@responsible-ai-labs/rail-score';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
const railGemini = new RAILGemini(client, model);

const result = await railGemini.generate('Tell me about AI safety');
console.log(result.railScore.score);
```

## Observability

### Langfuse Integration

```typescript
import { RAILLangfuse } from '@responsible-ai-labs/rail-score';

const railLangfuse = new RAILLangfuse(client, langfuse);
const result = await railLangfuse.traceEvaluation('trace-id', 'Content to evaluate');
await railLangfuse.scoreTrace('trace-id', existingResult);
```

### Guardrail Handler

```typescript
import { RAILGuardrail } from '@responsible-ai-labs/rail-score';

const guardrail = new RAILGuardrail(client, {
  inputThresholds: { safety: 7.0 },
  outputThresholds: { safety: 7.0, fairness: 7.0 },
});

const preResult = await guardrail.preCall('User message');
if (!preResult.allowed) {
  console.log('Input blocked:', preResult.failedDimensions);
}
```

## Utility Functions

```typescript
import {
  formatScore,
  getScoreColor,
  getScoreGrade,
  getScoreLabel,
  validateWeights,
  normalizeWeightsTo100,
  resolveFrameworkAlias,
  getDimensionsBelowThreshold,
  aggregateScores,
} from '@responsible-ai-labs/rail-score';

formatScore(8.567, 2);                    // "8.57"
getScoreColor(8.5);                       // "green"
getScoreGrade(8.5);                       // "A-"
getScoreLabel(8.5);                       // "Excellent"
resolveFrameworkAlias('ai_act');           // "eu_ai_act"
resolveFrameworkAlias('dpdp');             // "india_dpdp"
validateWeights({ safety: 50, privacy: 50 }); // true (sums to 100)
```

## Peer Dependencies (Optional)

```bash
npm install openai                    # For RAILOpenAI
npm install @anthropic-ai/sdk         # For RAILAnthropic
npm install @google/generative-ai     # For RAILGemini
npm install langfuse                  # For RAILLangfuse
```

## TypeScript

```typescript
import type {
  RailScoreConfig,
  EvalParams,
  EvalResult,
  DimensionScore,
  SafeRegenerateParams,
  SafeRegenerateResult,
  ComplianceResult,
  MultiComplianceResult,
  ComplianceFramework,
  ComplianceContext,
  Dimension,
  EvaluationMode,
  HealthCheckResponse,
  SessionConfig,
  PolicyConfig,
  MiddlewareConfig,
} from '@responsible-ai-labs/rail-score';
```

## Migration from v2.1.1

### Breaking Changes

**Evaluation:**
```typescript
// Before (v2.1.1)
const result = await client.evaluation.basic('content');
console.log(result.railScore.score);
console.log(result.scores.safety.score);

// After (v2.2.1)
const result = await client.eval({ content: 'content' });
console.log(result.rail_score.score);
console.log(result.dimension_scores.safety.score);
```

**Generation -> Safe Regenerate:**
```typescript
// Before (v2.1.1)
const result = await client.generation.generate('prompt', { targetScore: 9.0 });

// After (v2.2.1)
const result = await client.safeRegenerate({
  content: 'content to improve',
  thresholds: { overall: { score: 9.0 } },
});
```

**Compliance:**
```typescript
// Before (v2.1.1)
const result = await client.compliance.check('content', 'gdpr');
console.log(result.compliant);

// After (v2.2.1)
const result = await client.complianceCheck({ content: 'content', framework: 'gdpr' });
console.log(result.compliance_score.label);

// Multi-framework
const multi = await client.complianceCheck({
  content: 'content',
  frameworks: ['gdpr', 'ccpa'],
});
console.log(multi.cross_framework_summary.average_score);
```

**Health Check:**
```typescript
// Before (v2.1.1)
const health = await client.healthCheck();
console.log(health.ok);

// After (v2.2.1)
const health = await client.health();
console.log(health.status);   // "healthy"
console.log(health.service);  // "rail-score-engine"
```

**Weights:**
```typescript
// Before (v2.1.1) - sum to 1.0
weights: { safety: 0.5, privacy: 0.5 }

// After (v2.2.1) - must sum to 100
weights: { safety: 50, privacy: 50 }
```

**New Error Types:**
- `SessionExpiredError` (410) - external-mode sessions expire after 15 minutes
- `NotImplementedByServerError` (501) - feature not yet available
- All errors now have `statusCode` and `response` properties

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [Documentation](https://responsibleailabs.ai/docs)
- [API Reference](https://responsibleailabs.ai/docs/api)
- [GitHub Repository](https://github.com/Responsible-AI-Labs/rail-score-js)
- [npm Package](https://www.npmjs.com/package/@responsible-ai-labs/rail-score)

## Support

- **Email**: support@responsibleailabs.ai
- **Issues**: [GitHub Issues](https://github.com/Responsible-AI-Labs/rail-score-js/issues)
