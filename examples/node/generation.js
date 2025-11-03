/**
 * Content generation example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - Generating responsible AI content
 * - Improving existing content
 * - Rewriting content to fix issues
 * - Creating content variations
 */

const { RailScore, formatScore, getScoreGrade } = require('@responsibleailabs/rail-score');

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-api-key-here',
  });

  console.log('🚀 RAIL Score SDK - Content Generation Example\n');

  try {
    // 1. Generate new content
    console.log('1️⃣  Generating responsible AI content...\n');

    const generationPrompt = 'Write a privacy policy section for a mobile app that collects user location data';

    const generated = await client.generation.generate(generationPrompt, {
      targetScore: 9.0,
      dimensions: ['privacy', 'transparency', 'legal_compliance'],
      maxIterations: 3,
      temperature: 0.7,
    });

    console.log('   📝 Generated Content:');
    console.log('   ' + '─'.repeat(70));
    console.log(`   ${generated.content}`);
    console.log('   ' + '─'.repeat(70));
    console.log(`\n   ✓ RAIL Score: ${formatScore(generated.railScore.score)}/10 (${getScoreGrade(generated.railScore.score)})`);
    console.log(`   ✓ Confidence: ${(generated.railScore.confidence * 100).toFixed(1)}%`);
    console.log(`   ✓ Iterations: ${generated.iterations}`);
    console.log(`   ✓ Processing Time: ${generated.metadata.processingTimeMs}ms\n`);

    // 2. Improve existing content
    console.log('2️⃣  Improving existing content...\n');

    const originalContent = `
      Our app uses AI to analyze your photos. We collect your images and
      personal information. The data might be used for various purposes.
    `;

    console.log('   📄 Original Content:');
    console.log(`   "${originalContent.trim()}"\n`);

    const improved = await client.generation.improve(
      originalContent.trim(),
      ['privacy', 'transparency', 'user_impact'],
      8.5
    );

    console.log('   ✨ Improved Content:');
    console.log('   ' + '─'.repeat(70));
    console.log(`   ${improved.content}`);
    console.log('   ' + '─'.repeat(70));
    console.log(`\n   ✓ New RAIL Score: ${formatScore(improved.railScore.score)}/10 (${getScoreGrade(improved.railScore.score)})`);
    console.log(`   ✓ Target Score: 8.5/10`);
    console.log(`   ✓ Improvement: ${improved.railScore.score >= 8.5 ? '✓ Target met!' : '⚠ Close to target'}\n`);

    // 3. Rewrite content to fix specific issues
    console.log('3️⃣  Rewriting content to address issues...\n');

    const problematicContent = `
      We may share your data with partners for marketing purposes.
      By using our service, you agree to our data practices.
    `;

    const issues = [
      'Lacks transparency about which partners receive data',
      'No explicit user consent mechanism mentioned',
      'Vague about data retention and deletion rights',
      'Missing information about data security measures',
    ];

    console.log('   📄 Original Content:');
    console.log(`   "${problematicContent.trim()}"\n`);

    console.log('   ⚠ Identified Issues:');
    issues.forEach((issue, i) => {
      console.log(`      ${i + 1}. ${issue}`);
    });
    console.log();

    const rewritten = await client.generation.rewrite(
      problematicContent.trim(),
      issues,
      true // preserve tone
    );

    console.log('   ✏️  Rewritten Content:');
    console.log('   ' + '─'.repeat(70));
    console.log(`   ${rewritten.content}`);
    console.log('   ' + '─'.repeat(70));
    console.log(`\n   ✓ RAIL Score: ${formatScore(rewritten.railScore.score)}/10 (${getScoreGrade(rewritten.railScore.score)})`);
    console.log(`   ✓ Issues addressed: ${issues.length}\n`);

    // 4. Generate variations for different dimension focuses
    console.log('4️⃣  Generating content variations...\n');

    const variationPrompt = 'Describe our AI-powered content moderation system';

    const variations = await client.generation.variations(
      variationPrompt,
      [
        ['safety', 'transparency'],
        ['privacy', 'accountability'],
        ['fairness', 'user_impact'],
      ],
      1
    );

    console.log(`   ✓ Generated ${variations.length} variations:\n`);

    variations.forEach((variation, i) => {
      const focusDimensions = [
        ['Safety & Transparency'],
        ['Privacy & Accountability'],
        ['Fairness & User Impact'],
      ][i];

      console.log(`   📝 Variation ${i + 1} - Focus: ${focusDimensions}`);
      console.log('   ' + '─'.repeat(70));
      console.log(`   ${variation.content}`);
      console.log('   ' + '─'.repeat(70));
      console.log(`   Score: ${formatScore(variation.railScore.score)}/10 (${getScoreGrade(variation.railScore.score)})\n`);
    });

    // 5. Compare variations
    console.log('5️⃣  Variation Comparison:\n');

    console.log('   📊 Score Comparison:');
    variations.forEach((variation, i) => {
      const focusAreas = [
        'Safety & Transparency',
        'Privacy & Accountability',
        'Fairness & User Impact',
      ][i];

      console.log(`      Variation ${i + 1} (${focusAreas}): ${formatScore(variation.railScore.score)}/10`);
    });
    console.log();

    const bestVariation = variations.reduce((best, current) =>
      current.railScore.score > best.railScore.score ? current : best
    );
    const bestIndex = variations.indexOf(bestVariation);

    console.log(`   🏆 Highest Scoring: Variation ${bestIndex + 1}`);
    console.log(`      Score: ${formatScore(bestVariation.railScore.score)}/10`);
    console.log(`      Iterations: ${bestVariation.iterations}`);
    console.log();

    // 6. Show total credits consumed
    console.log('6️⃣  Resource Usage:\n');

    const totalCredits =
      generated.metadata.creditsConsumed +
      improved.metadata.creditsConsumed +
      rewritten.metadata.creditsConsumed +
      variations.reduce((sum, v) => sum + v.metadata.creditsConsumed, 0);

    console.log(`   💳 Total Credits Used: ${totalCredits}`);
    console.log(`      • Generation: ${generated.metadata.creditsConsumed} credits`);
    console.log(`      • Improvement: ${improved.metadata.creditsConsumed} credits`);
    console.log(`      • Rewrite: ${rewritten.metadata.creditsConsumed} credits`);
    console.log(`      • Variations: ${variations.reduce((sum, v) => sum + v.metadata.creditsConsumed, 0)} credits\n`);

    console.log('✅ Generation example completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the example
main();
