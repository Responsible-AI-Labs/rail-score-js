/**
 * Basic usage example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - Client initialization
 * - Basic content evaluation
 * - Dimension-specific evaluation
 * - Custom evaluation with weights
 * - Error handling
 * - Utility functions
 */

const { RailScore, formatScore, getScoreGrade, getScoreLabel, formatDimensionName } = require('@responsibleailabs/rail-score');

async function main() {
  // Initialize the client with your API key
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-rail-api-key',
  });

  console.log('🚀 RAIL Score SDK - Basic Usage Example\n');

  try {
    // 1. Check API health
    console.log('1️⃣  Checking API health...');
    const health = await client.healthCheck();
    console.log(`   ✓ API Status: ${health.ok ? 'OK' : 'Down'}`);
    console.log(`   ✓ Version: ${health.version}\n`);

    // 2. Check credit balance
    console.log('2️⃣  Checking credit balance...');
    const credits = await client.getCredits();
    console.log(`   ✓ Balance: ${credits.balance} credits`);
    console.log(`   ✓ Tier: ${credits.tier}\n`);

    // 3. Basic evaluation
    console.log('3️⃣  Performing basic evaluation...');
    const content = `
      Our AI-powered system prioritizes user privacy and data security.
      We collect only essential information with explicit user consent,
      and all data is encrypted both in transit and at rest.
      Users have full control over their data and can request deletion at any time.
    `;

    const result = await client.evaluation.basic(content.trim());

    console.log(`   ✓ Overall RAIL Score: ${formatScore(result.railScore.score)}/10 (${getScoreGrade(result.railScore.score)})`);
    console.log(`   ✓ Confidence: ${(result.railScore.confidence * 100).toFixed(1)}%`);
    console.log(`   ✓ Processing Time: ${result.metadata.processingTimeMs}ms`);
    console.log(`   ✓ Credits Used: ${result.metadata.creditsConsumed}\n`);

    // 4. Display dimension scores
    console.log('4️⃣  Individual Dimension Scores:');
    for (const [dimension, score] of Object.entries(result.scores)) {
      const formattedName = formatDimensionName(dimension);
      const formattedScore = formatScore(score.score);
      const grade = getScoreGrade(score.score);

      console.log(`   • ${formattedName}: ${formattedScore}/10 (${grade})`);
      if (score.issues && score.issues.length > 0) {
        console.log(`     Issues: ${score.issues.join(', ')}`);
      }
    }
    console.log();

    // 5. Evaluate a specific dimension
    console.log('5️⃣  Evaluating specific dimension (privacy)...');
    const privacyScore = await client.evaluation.dimension(content.trim(), 'privacy');
    console.log(`   ✓ Privacy Score: ${formatScore(privacyScore.score)}/10`);
    console.log(`   ✓ Explanation: ${privacyScore.explanation}`);
    if (privacyScore.issues && privacyScore.issues.length > 0) {
      console.log(`   ⚠ Issues found: ${privacyScore.issues.length}`);
      privacyScore.issues.forEach((issue, i) => {
        console.log(`     ${i + 1}. ${issue}`);
      });
    }
    console.log();

    // 6. Custom evaluation with specific dimensions and weights
    console.log('6️⃣  Custom evaluation with weights...');
    const customResult = await client.evaluation.custom(
      content.trim(),
      ['safety', 'privacy', 'transparency'],
      {
        safety: 0.4,
        privacy: 0.4,
        transparency: 0.2,
      }
    );

    console.log(`   ✓ Custom RAIL Score: ${formatScore(customResult.railScore.score)}/10`);
    console.log('   ✓ Evaluated dimensions:');
    for (const [dimension, score] of Object.entries(customResult.scores)) {
      console.log(`     • ${formatDimensionName(dimension)}: ${formatScore(score.score)}/10`);
    }
    console.log();

    // 7. Get usage statistics
    console.log('7️⃣  Fetching usage statistics...');
    const usage = await client.getUsage(10);
    console.log(`   ✓ Total requests: ${usage.summary.totalRequests}`);
    console.log(`   ✓ Total credits used: ${usage.summary.totalCredits}`);
    console.log(`   ✓ Success rate: ${(usage.summary.successRate * 100).toFixed(1)}%\n`);

    // 8. Score labels (new in v2.1.1)
    console.log('8️⃣  Score labels:');
    for (const [dimension, score] of Object.entries(result.scores)) {
      const label = getScoreLabel(score.score);
      console.log(`   • ${formatDimensionName(dimension)}: ${label}`);
    }
    console.log();

    // 9. Deep evaluation mode (new in v2.1.1)
    console.log('9️⃣  Deep evaluation mode...');
    const deepResult = await client.evaluation.basic(content.trim(), undefined, {
      mode: 'deep',
      domain: 'privacy-policy',
    });
    console.log(`   ✓ Deep RAIL Score: ${formatScore(deepResult.railScore.score)}/10\n`);

    // 10. API version info (new in v2.1.1)
    console.log('🔟 API version...');
    const version = await client.version();
    console.log(`   ✓ API Version: ${version.version}\n`);

    console.log('✅ Example completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error occurred:');

    if (error.name === 'AuthenticationError') {
      console.error('   Authentication failed. Please check your API key.');
    } else if (error.name === 'InsufficientCreditsError') {
      console.error(`   Insufficient credits. Balance: ${error.balance}, Required: ${error.required}`);
    } else if (error.name === 'RateLimitError') {
      console.error(`   Rate limit exceeded. Retry after ${error.retryAfter} seconds.`);
    } else if (error.name === 'ValidationError') {
      console.error(`   Validation error: ${error.message}`);
    } else {
      console.error(`   ${error.message}`);
    }

    process.exit(1);
  }
}

// Run the example
main();
