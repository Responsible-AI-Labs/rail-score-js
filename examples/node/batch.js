/**
 * Evaluation examples for RAIL Score JavaScript SDK v2.2.1
 *
 * This example demonstrates:
 * - Basic and deep evaluation
 * - Custom weights and dimensions
 * - Compliance checks (single and multi-framework)
 * - Health check
 */

const {
  RailScore,
  formatScore,
  getScoreLabel,
  getDimensionsBelowThreshold,
  formatDimensionName,
} = require('@responsible-ai-labs/rail-score');

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-api-key-here',
  });

  console.log('RAIL Score SDK - Evaluation & Compliance Example\n');

  try {
    // 1. Health check
    console.log('1. Health check...\n');
    const health = await client.health();
    console.log(`   Status: ${health.status}`);
    console.log(`   Service: ${health.service}\n`);

    // 2. Basic evaluation
    console.log('2. Basic evaluation...\n');

    const basicResult = await client.eval({
      content: 'We implement industry-standard encryption and security measures to protect your data. You have full control and can request deletion at any time.',
    });

    console.log(`   RAIL Score: ${formatScore(basicResult.rail_score.score)}/10 (${getScoreLabel(basicResult.rail_score.score)})`);
    console.log(`   Summary: ${basicResult.rail_score.summary}`);
    console.log(`   Cached: ${basicResult.from_cache}\n`);

    for (const [name, dim] of Object.entries(basicResult.dimension_scores)) {
      console.log(`   ${formatDimensionName(name)}: ${formatScore(dim.score)}/10 (confidence: ${dim.confidence})`);
    }

    // 3. Deep evaluation with domain
    console.log('\n3. Deep evaluation (healthcare)...\n');

    const deepResult = await client.eval({
      content: 'Take 500mg of ibuprofen every 4 hours for pain relief.',
      mode: 'deep',
      domain: 'healthcare',
      dimensions: ['safety', 'reliability'],
      includeSuggestions: true,
    });

    console.log(`   RAIL Score: ${formatScore(deepResult.rail_score.score)}/10`);

    for (const [name, dim] of Object.entries(deepResult.dimension_scores)) {
      console.log(`\n   ${formatDimensionName(name)}: ${formatScore(dim.score)}/10`);
      if (dim.explanation) console.log(`     Explanation: ${dim.explanation}`);
      if (dim.issues && dim.issues.length > 0) console.log(`     Issues: ${dim.issues.join(', ')}`);
    }

    if (deepResult.improvement_suggestions) {
      console.log('\n   Suggestions:');
      for (const s of deepResult.improvement_suggestions) {
        console.log(`     - ${s}`);
      }
    }

    // 4. Dimensions below threshold
    console.log('\n4. Dimensions below threshold...\n');

    const belowThreshold = getDimensionsBelowThreshold(basicResult, 8.0);
    if (belowThreshold.length > 0) {
      console.log('   Dimensions below 8.0:');
      for (const { dimension, score } of belowThreshold) {
        console.log(`     ${formatDimensionName(dimension)}: ${formatScore(score.score)}/10`);
      }
    } else {
      console.log('   All dimensions above 8.0');
    }

    // 5. Compliance check (single framework)
    console.log('\n5. Compliance check (GDPR)...\n');

    const complianceResult = await client.complianceCheck({
      content: 'Our AI model processes user browsing history and purchase patterns to generate personalized product recommendations. We collect IP addresses and cross-site tracking data without explicit consent.',
      framework: 'gdpr',
      context: {
        domain: 'e-commerce',
        data_types: ['browsing_history', 'purchase_data', 'ip_address'],
        processing_purpose: 'personalized_recommendations',
      },
    });

    console.log(`   Score: ${formatScore(complianceResult.compliance_score.score)}/10 (${complianceResult.compliance_score.label})`);
    console.log(`   Summary: ${complianceResult.compliance_score.summary}`);
    console.log(`   Requirements: ${complianceResult.requirements_passed}/${complianceResult.requirements_checked} passed`);

    if (complianceResult.issues.length > 0) {
      console.log('\n   Top issues:');
      for (const issue of complianceResult.issues.slice(0, 3)) {
        console.log(`     [${issue.severity.toUpperCase()}] ${issue.description}`);
        console.log(`       Article: ${issue.article} | Effort: ${issue.remediation_effort}`);
      }
    }

    // 6. Multi-framework compliance
    console.log('\n6. Multi-framework compliance...\n');

    const multiResult = await client.complianceCheck({
      content: 'We use cookies to track user behavior and sell profiles to advertisers.',
      frameworks: ['gdpr', 'ccpa'],
      context: { domain: 'advertising' },
    });

    const summary = multiResult.cross_framework_summary;
    console.log(`   Average score: ${formatScore(summary.average_score)}/10`);
    console.log(`   Weakest: ${summary.weakest_framework} (${formatScore(summary.weakest_score)}/10)`);

    for (const [fwName, fwResult] of Object.entries(multiResult.results)) {
      const cs = fwResult.compliance_score;
      console.log(`\n   ${fwName.toUpperCase()}: ${formatScore(cs.score)}/10 (${cs.label})`);
      console.log(`     ${fwResult.requirements_passed}/${fwResult.requirements_checked} passed`);
    }

    console.log('\nExample completed successfully!\n');
  } catch (error) {
    console.error('\nError occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

main();
