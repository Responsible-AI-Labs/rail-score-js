/**
 * Batch evaluation example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - Batch evaluation of multiple items
 * - RAG (Retrieval-Augmented Generation) evaluation
 * - Aggregating results
 * - Identifying low-scoring items
 */

const {
  RailScore,
  aggregateScores,
  getDimensionsBelowThreshold,
  formatScore,
  formatDimensionName,
} = require('@responsibleailabs/rail-score');

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-api-key-here',
  });

  console.log('🚀 RAIL Score SDK - Batch Evaluation Example\n');

  try {
    // 1. Batch evaluation with multiple content items
    console.log('1️⃣  Batch evaluation of multiple items...\n');

    const contentItems = [
      {
        id: 'policy-1',
        content: 'We collect user data for analytics purposes. Data may be shared with third parties.',
      },
      {
        id: 'policy-2',
        content: 'Your privacy is our priority. We collect only essential data with your explicit consent and never share it without permission.',
      },
      {
        id: 'policy-3',
        content: 'Our AI system uses machine learning algorithms to process information.',
      },
      {
        id: 'policy-4',
        content: 'We implement industry-standard encryption and security measures to protect your data. You have full control and can request deletion at any time.',
      },
    ];

    const batchResult = await client.evaluation.batch(
      contentItems,
      ['safety', 'privacy', 'transparency'],
      'balanced'
    );

    console.log(`   ✓ Total items processed: ${batchResult.totalItems}`);
    console.log(`   ✓ Successful: ${batchResult.successful}`);
    console.log(`   ✓ Failed: ${batchResult.failed}\n`);

    // 2. Display results for each item
    console.log('2️⃣  Individual Results:\n');
    batchResult.results.forEach((result, index) => {
      const item = contentItems[index];
      console.log(`   📄 Item ${index + 1} (${item.id}):`);
      console.log(`      Score: ${formatScore(result.railScore.score)}/10`);
      console.log(`      Confidence: ${(result.railScore.confidence * 100).toFixed(1)}%`);

      // Show dimensions below threshold
      const belowThreshold = getDimensionsBelowThreshold(result, 7.0);
      if (belowThreshold.length > 0) {
        console.log('      ⚠ Needs improvement:');
        belowThreshold.forEach(({ dimension, score }) => {
          console.log(`        • ${formatDimensionName(dimension)}: ${formatScore(score.score)}/10`);
        });
      } else {
        console.log('      ✓ All dimensions above threshold');
      }
      console.log();
    });

    // 3. Aggregate statistics
    console.log('3️⃣  Aggregate Statistics:\n');
    const stats = aggregateScores(batchResult.results);

    console.log(`   📊 Overall Statistics:`);
    console.log(`      Average Score: ${formatScore(stats.averageScore)}/10`);
    console.log(`      Minimum Score: ${formatScore(stats.minScore)}/10`);
    console.log(`      Maximum Score: ${formatScore(stats.maxScore)}/10`);
    console.log(`      Total Evaluations: ${stats.totalEvaluations}\n`);

    console.log('   📊 Average Dimension Scores:');
    for (const [dimension, avgScore] of Object.entries(stats.averageDimensionScores)) {
      console.log(`      • ${formatDimensionName(dimension)}: ${formatScore(avgScore)}/10`);
    }
    console.log();

    // 4. RAG Evaluation Example
    console.log('4️⃣  RAG (Retrieval-Augmented Generation) Evaluation:\n');

    const ragResult = await client.evaluation.ragEvaluate(
      'What is GDPR and how does it protect user privacy?',
      'GDPR is the General Data Protection Regulation, a comprehensive EU law that protects user privacy by requiring explicit consent for data collection, ensuring data portability, and granting users the right to be forgotten.',
      [
        {
          content: 'GDPR stands for General Data Protection Regulation. It is a regulation in EU law on data protection and privacy.',
          source: 'gdpr-overview.pdf',
          relevance: 0.95,
        },
        {
          content: 'The regulation was implemented in May 2018 and applies to all organizations processing EU citizens\' data.',
          source: 'gdpr-implementation.pdf',
          relevance: 0.85,
        },
        {
          content: 'Key GDPR principles include consent, data minimization, and the right to erasure (right to be forgotten).',
          source: 'gdpr-principles.pdf',
          relevance: 0.92,
        },
      ]
    );

    console.log(`   ✓ RAG Quality Score: ${formatScore(ragResult.ragScore.score)}/10`);
    console.log(`   ✓ Confidence: ${(ragResult.ragScore.confidence * 100).toFixed(1)}%\n`);

    console.log('   📊 RAG Metrics:');
    console.log(`      • Context Relevance: ${formatScore(ragResult.metrics.contextRelevance.score)}/10`);
    console.log(`      • Faithfulness: ${formatScore(ragResult.metrics.faithfulness.score)}/10`);
    console.log(`      • Answer Relevance: ${formatScore(ragResult.metrics.answerRelevance.score)}/10\n`);

    if (ragResult.analysis.issues.length > 0) {
      console.log('   ⚠ Issues Identified:');
      ragResult.analysis.issues.forEach((issue, i) => {
        console.log(`      ${i + 1}. ${issue}`);
      });
      console.log();
    }

    if (ragResult.analysis.suggestions.length > 0) {
      console.log('   💡 Suggestions:');
      ragResult.analysis.suggestions.forEach((suggestion, i) => {
        console.log(`      ${i + 1}. ${suggestion}`);
      });
      console.log();
    }

    // 5. Find best and worst performing items
    console.log('5️⃣  Performance Analysis:\n');

    const sortedResults = [...batchResult.results].sort(
      (a, b) => b.railScore.score - a.railScore.score
    );

    console.log('   🏆 Best Performing:');
    const best = sortedResults[0];
    const bestIndex = batchResult.results.indexOf(best);
    console.log(`      Item: ${contentItems[bestIndex].id}`);
    console.log(`      Score: ${formatScore(best.railScore.score)}/10`);
    console.log(`      Content: "${contentItems[bestIndex].content.substring(0, 60)}..."\n`);

    console.log('   ⚠ Needs Most Improvement:');
    const worst = sortedResults[sortedResults.length - 1];
    const worstIndex = batchResult.results.indexOf(worst);
    console.log(`      Item: ${contentItems[worstIndex].id}`);
    console.log(`      Score: ${formatScore(worst.railScore.score)}/10`);
    console.log(`      Content: "${contentItems[worstIndex].content.substring(0, 60)}..."`);

    const needsWork = getDimensionsBelowThreshold(worst, 7.0);
    if (needsWork.length > 0) {
      console.log('      Focus areas:');
      needsWork.forEach(({ dimension, score }) => {
        console.log(`        • ${formatDimensionName(dimension)}: ${formatScore(score.score)}/10`);
      });
    }
    console.log();

    console.log('✅ Batch example completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the example
main();
