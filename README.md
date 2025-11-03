# RAIL Score JavaScript/TypeScript SDK

[![npm version](https://badge.fury.io/js/%40responsibleailabs%2Frail-score.svg)](https://www.npmjs.com/package/@responsibleailabs/rail-score)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)

Official JavaScript/TypeScript SDK for the [RAIL Score API](https://responsibleailabs.ai) - Evaluate and generate responsible AI content with comprehensive scoring across safety, privacy, fairness, transparency, accountability, reliability, legal compliance, and user impact dimensions.

## 🌟 Features

- 🔒 **Type-Safe** - Full TypeScript support with comprehensive type definitions
- 📊 **Complete API Coverage** - Evaluation, generation, and compliance checking
- ⚡ **Dual Module Support** - CommonJS and ESM builds
- 🧪 **Well Tested** - 130+ tests with 80%+ coverage
- 🌐 **Node.js & Browser** - Works in both environments
- 📝 **Detailed Documentation** - JSDoc comments for all public APIs
- 🛠️ **Utility Functions** - Helper functions for working with scores
- ⚠️ **Rich Error Handling** - Specific error types for all scenarios

## 📦 Installation

```bash
npm install @responsibleailabs/rail-score
```

Or with yarn:

```bash
yarn add @responsibleailabs/rail-score
```

## 🚀 Quick Start

```typescript
import { RailScore } from '@responsibleailabs/rail-score';

// Initialize the client
const client = new RailScore({
  apiKey: process.env.RAIL_API_KEY!
});

// Evaluate content
const result = await client.evaluation.basic(
  'Our AI system prioritizes user privacy and data security.'
);

console.log(`RAIL Score: ${result.railScore.score}/10`);
console.log(`Confidence: ${result.railScore.confidence}`);

// View dimension scores
for (const [dimension, score] of Object.entries(result.scores)) {
  console.log(`${dimension}: ${score.score}/10 - ${score.explanation}`);
}
```

## 📚 API Overview

### Initialization

```typescript
import { RailScore } from '@responsibleailabs/rail-score';

const client = new RailScore({
  apiKey: 'your-api-key',           // Required
  baseUrl: 'https://api.responsibleailabs.ai',  // Optional
  timeout: 60000                     // Optional (ms)
});
```

### Evaluation API

#### Basic Evaluation

Evaluate content across all dimensions:

```typescript
const result = await client.evaluation.basic(
  'Content to evaluate',
  { safety: 0.3, privacy: 0.3, fairness: 0.4 } // Optional weights
);
```

#### Dimension-Specific Evaluation

Evaluate a specific dimension:

```typescript
const privacyScore = await client.evaluation.dimension(
  'Content to evaluate',
  'privacy'
);

console.log(privacyScore.score);      // 8.5
console.log(privacyScore.explanation); // Detailed explanation
console.log(privacyScore.issues);      // Array of issues found
```

#### Custom Evaluation

Evaluate specific dimensions with custom weights:

```typescript
const result = await client.evaluation.custom(
  'Content to evaluate',
  ['safety', 'privacy', 'transparency'],
  { safety: 0.5, privacy: 0.3, transparency: 0.2 }
);
```

#### Batch Evaluation

Evaluate multiple items efficiently:

```typescript
const results = await client.evaluation.batch([
  { content: 'First item', id: 'item-1' },
  { content: 'Second item', id: 'item-2' },
  'Third item' // Can also pass plain strings
], ['safety', 'privacy'], 'balanced'); // Optional dimensions and tier

console.log(`Processed: ${results.successful}/${results.totalItems}`);
```

#### RAG Evaluation

Evaluate Retrieval-Augmented Generation responses:

```typescript
const ragResult = await client.evaluation.ragEvaluate(
  'What is GDPR?',                    // Query
  'GDPR is a regulation...',          // Generated response
  [                                    // Context chunks
    { content: 'GDPR stands for...', source: 'doc-1' },
    { content: 'Implemented in 2018...', source: 'doc-2' }
  ]
);

console.log(ragResult.metrics.contextRelevance.score);
console.log(ragResult.metrics.faithfulness.score);
console.log(ragResult.metrics.answerRelevance.score);
```

### Generation API

#### Generate Content

Generate responsible AI content:

```typescript
const result = await client.generation.generate(
  'Write a privacy policy for a mobile app',
  {
    targetScore: 9.0,
    dimensions: ['privacy', 'transparency', 'legal_compliance'],
    maxIterations: 3,
    temperature: 0.7
  }
);

console.log(result.content);
console.log(result.railScore.score);
```

#### Improve Content

Enhance existing content to achieve higher scores:

```typescript
const improved = await client.generation.improve(
  'Original content here',
  ['privacy', 'transparency'],  // Target dimensions
  8.5                           // Target score
);

console.log(`Improved from X to ${improved.railScore.score}`);
```

#### Rewrite Content

Fix specific issues in content:

```typescript
const rewritten = await client.generation.rewrite(
  'Content with issues',
  [
    'Lacks transparency about data sharing',
    'No user consent mentioned'
  ],
  true  // Preserve tone
);
```

#### Generate Variations

Create multiple versions optimized for different dimensions:

```typescript
const variations = await client.generation.variations(
  'Describe our AI moderation system',
  [
    ['safety', 'transparency'],
    ['privacy', 'accountability']
  ],
  2  // Number of variations per dimension set
);
```

### Compliance API

#### Check Compliance

Check content against a specific framework:

```typescript
const result = await client.compliance.check(
  'Content to check',
  'gdpr'  // Framework: gdpr, hipaa, ccpa, sox, pci_dss, iso27001, nist
);

console.log(result.compliant);        // true/false
console.log(result.score);            // 0-10
console.log(result.violations);       // Array of violations
console.log(result.recommendations);  // Improvement suggestions
```

#### Multi-Framework Check

Check against multiple frameworks:

```typescript
const results = await client.compliance.checkMultiple(
  'Healthcare content',
  ['gdpr', 'hipaa']
);

results.forEach(result => {
  console.log(`${result.framework}: ${result.compliant ? 'PASS' : 'FAIL'}`);
});
```

#### Compliance Scan

Scan for potential issues across all frameworks:

```typescript
const scan = await client.compliance.scan('Content to scan');

console.log(scan.summary.totalIssues);
console.log(scan.affectedFrameworks);
scan.issues.forEach(issue => {
  console.log(`${issue.severity}: ${issue.description}`);
});
```

#### Get Recommendations

Get actionable compliance recommendations:

```typescript
const recommendations = await client.compliance.getRecommendations(
  'Content to improve',
  'gdpr',
  ['Known violation 1', 'Known violation 2']  // Optional
);

recommendations.forEach(rec => {
  console.log(`${rec.priority}: ${rec.suggestion}`);
});
```

#### List Frameworks

Get all available compliance frameworks:

```typescript
const frameworks = await client.compliance.listFrameworks();

frameworks.forEach(fw => {
  console.log(`${fw.id}: ${fw.name} (${fw.version})`);
});
```

### Account Management

#### Get Credits

Check your credit balance:

```typescript
const credits = await client.getCredits();

console.log(`Balance: ${credits.balance}`);
console.log(`Tier: ${credits.tier}`);
console.log(`Renewal: ${credits.renewalDate}`);
```

#### Get Usage

View usage statistics:

```typescript
const usage = await client.getUsage(50, '2024-01-01');

console.log(`Total requests: ${usage.summary.totalRequests}`);
console.log(`Credits used: ${usage.summary.totalCredits}`);
console.log(`Success rate: ${usage.summary.successRate}`);
```

#### Health Check

Check API health:

```typescript
const health = await client.healthCheck();

console.log(`Status: ${health.ok ? 'OK' : 'Down'}`);
console.log(`Version: ${health.version}`);
```

## 🛠️ Utility Functions

The SDK includes helpful utility functions:

```typescript
import {
  formatScore,
  getScoreColor,
  getScoreGrade,
  validateWeights,
  normalizeWeights,
  calculateWeightedScore,
  getLowestScoringDimension,
  getHighestScoringDimension,
  getDimensionsBelowThreshold,
  formatDimensionName,
  aggregateScores,
  isPassing,
  confidenceWeightedScore
} from '@responsibleailabs/rail-score';

// Format score
formatScore(8.567, 2);  // "8.57"

// Get color indicator
getScoreColor(8.5);     // "green"

// Get letter grade
getScoreGrade(8.5);     // "A-"

// Find weak areas
const weakAreas = getDimensionsBelowThreshold(result, 7.0);

// Aggregate multiple results
const stats = aggregateScores([result1, result2, result3]);
```

## ⚠️ Error Handling

The SDK provides specific error types for better error handling:

```typescript
import {
  RailScore,
  AuthenticationError,
  InsufficientCreditsError,
  ValidationError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ServerError
} from '@responsibleailabs/rail-score';

try {
  const result = await client.evaluation.basic('Content');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof InsufficientCreditsError) {
    console.error(`Need ${error.required} credits, have ${error.balance}`);
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    console.error(`Validation error: ${error.message}`);
  } else if (error instanceof TimeoutError) {
    console.error('Request timeout');
  } else if (error instanceof NetworkError) {
    console.error('Network error');
  } else if (error instanceof ServerError) {
    console.error(`Server error: ${error.statusCode}`);
  }
}
```

## 📋 Available Dimensions

- `safety` - Content safety and harm prevention
- `privacy` - Data protection and user privacy
- `fairness` - Bias detection and fairness
- `transparency` - Explainability and clarity
- `accountability` - Responsibility and oversight
- `reliability` - Consistency and dependability
- `legal_compliance` - Regulatory compliance
- `user_impact` - User experience and impact

## 🔒 Available Compliance Frameworks

- `gdpr` - General Data Protection Regulation (EU)
- `hipaa` - Health Insurance Portability and Accountability Act (US)
- `ccpa` - California Consumer Privacy Act (US)
- `sox` - Sarbanes-Oxley Act (US)
- `pci_dss` - Payment Card Industry Data Security Standard
- `iso27001` - Information Security Management
- `nist` - NIST Cybersecurity Framework (US)

## 🌐 Browser Usage

**Important:** For security, never expose API keys in client-side code. Use a backend proxy in production.

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { RailScore } from 'https://unpkg.com/@responsibleailabs/rail-score';

    // WARNING: Don't do this in production!
    // Use a backend proxy instead
    const client = new RailScore({ apiKey: 'your-key' });

    const result = await client.evaluation.basic('Content here');
    console.log(result);
  </script>
</head>
<body>
  <!-- See examples/browser/index.html for full example -->
</body>
</html>
```

## 📖 Examples

Check the `examples/` directory for complete examples:

- **`examples/node/basic.js`** - Basic usage and evaluation
- **`examples/node/batch.js`** - Batch and RAG evaluation
- **`examples/node/generation.js`** - Content generation
- **`examples/node/compliance.js`** - Compliance checking
- **`examples/browser/index.html`** - Browser implementation

Run examples:

```bash
node examples/node/basic.js
node examples/node/batch.js
node examples/node/generation.js
node examples/node/compliance.js
```

## 🧪 Development

### Setup

```bash
# Clone the repository
git clone https://github.com/Responsible-AI-Labs/rail-score-js.git
cd rail-score-js

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint

# Format code
npm run format
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- client.test.ts
```

### Building

```bash
# Build for production
npm run build

# Build in watch mode
npm run dev
```

## 📝 TypeScript

The SDK is written in TypeScript and includes full type definitions:

```typescript
import type {
  RailScoreConfig,
  EvaluationResult,
  DimensionScore,
  GenerationResult,
  ComplianceResult,
  Dimension,
  ComplianceFramework
} from '@responsibleailabs/rail-score';
```

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](https://github.com/Responsible-AI-Labs/rail-score-js/blob/main/CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Documentation](https://responsibleailabs.ai/docs)
- [API Reference](https://responsibleailabs.ai/docs/api)
- [GitHub Repository](https://github.com/Responsible-AI-Labs/rail-score-js)
- [npm Package](https://www.npmjs.com/package/@responsibleailabs/rail-score)
- [Official Website](https://responsibleailabs.ai)
- [Support](https://responsibleailabs.ai/support)

## 💬 Support

- **Email**: support@responsibleailabs.ai
- **Issues**: [GitHub Issues](https://github.com/Responsible-AI-Labs/rail-score-js/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Responsible-AI-Labs/rail-score-js/discussions)

## 🎯 Roadmap

- [ ] Streaming API support
- [ ] Webhook integration
- [ ] Custom dimension definitions
- [ ] Advanced caching strategies
- [ ] Performance optimizations
- [ ] Additional compliance frameworks

## ⚡ Performance Tips

1. **Batch evaluations** - Use `batch()` for multiple items
2. **Choose the right tier** - Use 'fast' for development, 'balanced' for production
3. **Cache results** - Cache evaluation results when possible
4. **Reuse client** - Create one client instance and reuse it
5. **Use custom dimensions** - Evaluate only needed dimensions

## 🙏 Acknowledgments

Built with ❤️ by [Responsible AI Labs](https://responsibleailabs.ai)

---

**Note**: This SDK requires an API key from Responsible AI Labs. Sign up at [responsibleailabs.ai](https://responsibleailabs.ai) to get started.
