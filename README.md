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
- **Agent Evaluation** *(v2.4.0)* — Pre/post tool-call risk assessment, prompt injection detection, plan evaluation, tool risk registry, stateful agent sessions, and agent policy enforcement

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

## Agent Evaluation (v2.4.0)

Wrap agentic AI tool calls with RAIL risk assessment at every stage of execution. All agent methods are accessed via `client.agent.*`.

### Evaluate a Tool Call (before execution)

`POST /railscore/v1/agent/tool-call`

```typescript
import { RailScore, AgentBlockedError } from '@responsible-ai-labs/rail-score';

const client = new RailScore({ apiKey: process.env.RAIL_API_KEY! });

const decision = await client.agent.evaluateToolCall({
  toolName: 'credit_scoring_api',
  toolParams: { zipCode: '90210', loanAmount: 50000 },
  domain: 'finance',
  mode: 'basic',
  agentContext: {
    goal: 'Assess loan eligibility',
    agentId: 'loan-agent-1',
    stepIndex: 2,
    rationale: 'Need credit score before approval',
    priorToolCalls: ['web_search', 'get_applicant_profile'],
  },
  complianceFrameworks: ['eu_ai_act', 'gdpr'],
  customThresholds: { blockBelow: 5.0, flagBelow: 7.0 },
});

console.log(decision.decision);           // "ALLOW" | "FLAG" | "BLOCK"
console.log(decision.decisionReason);     // human-readable explanation
console.log(decision.railScore.score);    // 0–10
console.log(decision.contextSignals.proxyVariablesDetected); // ["zip_code"]
console.log(decision.suggestedParams);    // revised params if available

if (decision.decision !== 'BLOCK') {
  await callCreditApi(decision.suggestedParams ?? decision.toolParams);
}
```

> **Note:** The API returns HTTP 403 for BLOCK decisions. The SDK intercepts this and returns it as a normal `AgentDecision` with `decision === "BLOCK"` — no exception is thrown.

---

### Evaluate a Tool Result (after execution)

`POST /railscore/v1/agent/tool-result`

```typescript
const evaluation = await client.agent.evaluateToolResult({
  toolName: 'database_query',
  toolResult: {
    data: { rows: [{ name: 'Jane Doe', ssn: '123-45-6789', balance: 42000 }] },
    format: 'json',
  },
  checks: ['pii', 'prompt_injection', 'rail_score'],
  agentContext: { goal: 'Generate customer report' },
});

console.log(evaluation.riskLevel);            // "low" | "medium" | "high" | "critical"
console.log(evaluation.recommendedAction);    // "PASS" | "FLAG" | "REDACT_AND_PASS" | "REDACT_AND_FLAG" | "BLOCK"
console.log(evaluation.piiDetected.found);    // true
console.log(evaluation.piiDetected.entities); // [{ type: "SSN", value: "123-45-6789", shouldRedact: true }]

if (evaluation.redactedAvailable) {
  // use the pre-redacted version instead of raw output
  const safeOutput = evaluation.piiDetected.redactedResult;
}
```

---

### Check for Prompt Injection

`POST /railscore/v1/agent/prompt-injection` — 0.5 credits per call

```typescript
const check = await client.agent.checkInjection({
  content: userProvidedInput,
  contentSource: 'user_input',   // 'user_input' | 'web_search_result' | 'api_response' | 'tool_output'
});

console.log(check.injectionDetected);    // true | false
console.log(check.confidence);           // 0.0–1.0
console.log(check.attackType);           // "direct_instruction_override" | "role_hijack" | "jailbreak" | ...
console.log(check.severity);             // "none" | "low" | "medium" | "high" | "critical"
console.log(check.recommendedAction);    // "PASS" | "FLAG" | "BLOCK"

if (check.injectionDetected) {
  throw new Error(`Injection detected (${check.attackType}): ${check.payloadPreview}`);
}
```

---

### Evaluate a Plan (pre-flight, all steps)

Client-side orchestration — calls the tool-call endpoint once per step with a reduced-cost batch header, then computes the overall verdict locally.

```typescript
import { PlanBlockedError } from '@responsible-ai-labs/rail-score';

const evaluation = await client.agent.evaluatePlan({
  plan: [
    {
      stepIndex: 0,
      toolName: 'web_search',
      toolParams: { query: 'current mortgage rates' },
      rationale: 'Gather rate data before recommendation',
    },
    {
      stepIndex: 1,
      toolName: 'send_email',
      toolParams: { to: 'user@example.com', body: '...' },
      rationale: 'Send personalised rate summary',
    },
  ],
  goal: 'Send daily mortgage rate summary to premium users',
  agentId: 'rate-advisor',
  domain: 'finance',
  complianceFrameworks: ['eu_ai_act'],
});

console.log(evaluation.overallDecision);  // "ALLOW_ALL" | "PARTIAL_BLOCK" | "BLOCK_ALL"
console.log(evaluation.overallRisk);      // "low" | "medium" | "high" | "critical"
console.log(evaluation.planSummary);      // "1 of 2 steps can proceed. Blocked steps: [1]."

for (const step of evaluation.stepResults) {
  if (step.decision === 'ALLOW') {
    await executeStep(step);
  }
}
```

Maximum 20 steps per plan — a `ValidationError` is raised client-side if exceeded.

---

### Tool Risk Registry

Manage custom tool risk profiles that override system defaults across all evaluations in your organisation.

```typescript
// List registered tools
const { tools, pagination } = await client.agent.registry.listTools({
  source: 'org_custom',
  riskLevel: 'high',
  limit: 20,
});

// Register a custom profile
const profile = await client.agent.registry.registerTool({
  toolName: 'credit_scoring_api',
  riskLevel: 'high',
  evaluationDepth: 'deep',
  thresholds: { blockBelow: 6.0, flagBelow: 8.0, dimensionMinimums: { fairness: 7.0, privacy: 7.0 } },
  complianceFrameworks: ['eu_ai_act', 'gdpr'],
  proxyVariableWatch: ['zip_code', 'neighborhood', 'school_district'],
  piiFieldsWatch: ['ssn', 'dob', 'full_name'],
  description: 'Third-party credit scoring API',
});

// Delete a profile (falls back to system default)
const deleted = await client.agent.registry.deleteTool('credit_scoring_api');
console.log(deleted.fallback);  // "generic"
```

---

### AgentSession — Stateful Multi-Call Tracking

`AgentSession` is a pure client-side object. It wraps the agent evaluation methods, accumulates results locally, runs cross-call pattern detection, and optionally enforces a policy on every call.

```typescript
import { AgentSession } from '@responsible-ai-labs/rail-score';

const session = new AgentSession(
  client.agent,
  'loan-agent-1',              // agentId
  ['eu_ai_act', 'gdpr'],       // complianceFrameworks applied to all calls
  {
    deepEveryN: 5,             // use deep mode every 5 calls
    escalateAfterFlags: 3,     // switch to deep mode after 3 consecutive flags
    autoBlockAfterCritical: true,
    maxToolCalls: 100,
    sessionTtlMinutes: 720,    // 12 hours
    trackToolResults: true,
  }
);

// Evaluate tool calls
const decision = await session.evaluateToolCall({
  toolName: 'web_search',
  toolParams: { query: 'applicant credit history' },
});

// Evaluate tool results
const resultEval = await session.evaluateToolResult({
  toolName: 'web_search',
  toolResult: { raw: 'Search results...', format: 'text' },
});

// Check injection
const injectionCheck = await session.checkInjection({
  content: webSearchResult,
  contentSource: 'web_search_result',
});

// Get accumulated risk summary (no API call)
const summary = session.riskSummary();
console.log(summary.totalToolCalls);        // 7
console.log(summary.allowed);               // 5
console.log(summary.flagged);               // 1
console.log(summary.blocked);               // 1
console.log(summary.currentRiskScore);      // 6.2
console.log(summary.riskTrend);             // "stable" | "improving" | "escalating" | "critical"
console.log(summary.patternsDetected);      // [{ pattern: "repeated_pii_access", severity: "high" }]
console.log(summary.dimensionAverages);     // { fairness: 5.1, safety: 8.3, privacy: 4.7, ... }
console.log(summary.complianceExposure);    // { gdpr: { violations: 2, warnings: 1, riskTier: "high" } }

// Close and get final summary
const final = session.close();
```

**Patterns detected automatically:**

| Pattern | Triggers when |
|---------|--------------|
| `repeated_pii_access` | PII detected in ≥ 3 tool calls |
| `escalating_risk_scores` | RAIL score drops in 3+ consecutive calls |
| `blocked_retry` | Same tool is blocked and called again |
| `compliance_accumulation` | > 3 distinct compliance violations across the session |
| `dimension_degradation` | Average score for any dimension drops ≥ 2.0 points |

---

### AgentPolicyEngine — Local Threshold Enforcement

Applies threshold rules on top of the engine's ALLOW/FLAG/BLOCK signal.

```typescript
import { AgentPolicyEngine, AgentBlockedError } from '@responsible-ai-labs/rail-score';

const policy = new AgentPolicyEngine({
  mode: 'block',          // 'block' | 'suggest_fix' | 'log_only' | 'auto_fix'
  defaultThresholds: {
    blockBelow: 3.0,
    flagBelow: 6.0,
    dimensionMinimums: { fairness: 5.0, privacy: 5.0 },
  },
  perToolThresholds: {
    credit_scoring_api: { blockBelow: 8.0, flagBelow: 9.0 },
  },
  onBlock: (result) => console.warn('Blocked:', result.reason),
  onFlag:  (result) => console.log('Flagged:', result.reason),
});

const decision = await client.agent.evaluateToolCall({
  toolName: 'credit_scoring_api',
  toolParams: params,
});

try {
  const policyResult = policy.check(decision, 'credit_scoring_api');
  console.log(policyResult.blocked);            // false
  console.log(policyResult.flagged);            // true
  console.log(policyResult.violatedDimensions); // ["fairness"]
} catch (e) {
  if (e instanceof AgentBlockedError) {
    console.log(e.railScore);             // score that caused the block
    console.log(e.decisionReason);        // explanation
    console.log(e.violatedDimensions);    // dimensions below minimum
    console.log(e.suggestedParams);       // revised params if available
    console.log(e.complianceViolations);  // violation objects
    console.log(e.eventId);              // audit reference

    // Optionally retry with suggested params
    if (e.suggestedParams) {
      const retry = await client.agent.evaluateToolCall({
        toolName: 'credit_scoring_api',
        toolParams: e.suggestedParams,
      });
    }
  }
}
```

| Mode | Behaviour on block |
|------|--------------------|
| `"block"` | Throws `AgentBlockedError` |
| `"suggest_fix"` | Returns result with `suggestedParams`, does not throw |
| `"log_only"` | Calls `onBlock` callback, returns result, does not throw |
| `"auto_fix"` | Swaps in `suggestedParams` automatically, does not throw |

---

### AgentMiddleware — Automatic Tool Wrapping

`guard()` wraps any tool function with automatic pre-call evaluation and optional post-call result scanning.

```typescript
import { AgentMiddleware, AgentBlockedError } from '@responsible-ai-labs/rail-score';

const middleware = new AgentMiddleware(client.agent, {
  policy: 'block',
  defaultDomain: 'finance',
  complianceFrameworks: ['eu_ai_act'],
  defaultThresholds: { blockBelow: 5.0, flagBelow: 7.0 },
});

// Wrap the tool function — returns an identical-signature async function
const guardedCreditApi = middleware.guard(
  'credit_scoring_api',
  callCreditApi,
  {
    domain: 'finance',
    checkResult: true,                              // scan output for PII / injection
    resultChecks: ['pii', 'prompt_injection'],
  }
);

try {
  const result = await guardedCreditApi({
    applicantId: 'u-1234',
    zipCode: '90210',
    loanAmount: 50000,
  });
  console.log(result);
} catch (e) {
  if (e instanceof AgentBlockedError && e.suggestedParams) {
    // Retry with the API's suggested safer parameters
    const result = await guardedCreditApi(e.suggestedParams);
  }
}
```

---

### Agent Error Classes

```typescript
import {
  AgentBlockedError,   // thrown by AgentPolicyEngine in 'block' mode
  PlanBlockedError,    // thrown when evaluatePlan() returns BLOCK_ALL (optional)
  SessionClosedError,  // thrown when calling methods on a closed AgentSession
} from '@responsible-ai-labs/rail-score';
```

| Class | When raised |
|-------|------------|
| `AgentBlockedError` | `AgentPolicyEngine.check()` in `"block"` mode; has `railScore`, `decisionReason`, `violatedDimensions`, `suggestedParams`, `complianceViolations`, `eventId` |
| `PlanBlockedError` | Optionally check `evaluation.overallDecision === "BLOCK_ALL"` and throw manually; has `blockedSteps`, `planSummary` |
| `SessionClosedError` | Any method called on a closed `AgentSession` |

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
  // Agent types (v2.4.0)
  AgentDomain, AgentContext, AgentThresholds,
  EvaluateToolCallParams, AgentDecision,
  EvaluateToolResultParams, ToolResultEvaluation, PiiEntity,
  CheckInjectionParams, InjectionCheckResult,
  EvaluatePlanParams, PlanStep, PlanStepResult, PlanEvaluation,
  ToolRiskProfile, RegisterToolParams, ListToolsParams, ListToolsResponse,
  AgentSessionConfig, SessionRiskSummary, SessionPattern,
  AgentPolicyMode, PolicyCheckResult,
  ComplianceViolation, ContextSignals,
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

## Migration from v2.3.x

All v2.3.x APIs are unchanged. v2.4.0 adds the `agent` namespace as a new property on the existing `RailScore` client — no breaking changes.

```typescript
// No changes needed to existing code
const client = new RailScore({ apiKey: '...' });

// New: agent evaluation namespace (v2.4.0)
const decision = await client.agent.evaluateToolCall({ toolName: 'my_tool', toolParams: {} });
const resultEval = await client.agent.evaluateToolResult({ toolName: 'my_tool', toolResult: { raw: '...' } });
const injCheck = await client.agent.checkInjection({ content: userInput });
const planEval = await client.agent.evaluatePlan({ plan: [...] });

// New: AgentSession for stateful cross-call tracking
const session = new AgentSession(client.agent, 'my-agent');

// New: AgentPolicyEngine for local threshold enforcement
const policy = new AgentPolicyEngine({ mode: 'block', defaultThresholds: { blockBelow: 3.0 } });

// New: AgentMiddleware for automatic tool wrapping
const middleware = new AgentMiddleware(client.agent, { policy: 'block' });
const guarded = middleware.guard('my_tool', myToolFn);

// New error classes
// AgentBlockedError, PlanBlockedError, SessionClosedError
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
