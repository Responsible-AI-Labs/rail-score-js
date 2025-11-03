# Changelog

All notable changes to the RAIL Score JavaScript/TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- [ ] Performance optimizations
- [ ] Additional compliance frameworks
- [ ] Request retry logic with exponential backoff
- [ ] Response caching
- [ ] Batch request optimization

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
