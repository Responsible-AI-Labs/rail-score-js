/**
 * Safe Regenerate example for RAIL Score JavaScript SDK v2.2.1
 *
 * This example demonstrates:
 * - Server-side safe regeneration (RAIL_Safe_LLM mode)
 * - External mode safe regeneration
 * - Continuing an external session
 */

const { RailScore, formatScore } = require('@responsible-ai-labs/rail-score');

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-api-key-here',
    timeout: 120000, // Recommended 120s for safe-regenerate
  });

  console.log('RAIL Score SDK - Safe Regenerate Example\n');

  try {
    // 1. Basic evaluation first
    console.log('1. Evaluating content...\n');

    const evalResult = await client.eval({
      content: 'Our AI system collects user data. We use it for stuff.',
      mode: 'basic',
    });

    console.log(`   RAIL Score: ${formatScore(evalResult.rail_score.score)}/10`);
    console.log(`   Summary: ${evalResult.rail_score.summary}\n`);

    // 2. Server-side safe regeneration
    console.log('2. Safe regeneration (RAIL_Safe_LLM mode)...\n');

    const result = await client.safeRegenerate({
      content: 'Our AI system collects user data. We use it for stuff.',
      mode: 'basic',
      maxRegenerations: 2,
      regenerationModel: 'RAIL_Safe_LLM',
      thresholds: { overall: { score: 8.0, confidence: 0.5 } },
    });

    console.log(`   Status: ${result.status}`);
    console.log(`   Credits consumed: ${result.credits_consumed}`);

    if (result.best_content) {
      console.log(`   Best content: ${result.best_content}`);
    }

    if (result.best_scores) {
      const rail = result.best_scores.rail_score;
      console.log(`   Best RAIL score: ${rail.score}/10`);
    }

    if (result.iteration_history) {
      console.log('\n   Iteration History:');
      for (const rec of result.iteration_history) {
        const scores = rec.scores || {};
        const rail = scores.rail_score || {};
        console.log(`     Iteration ${rec.iteration}: score=${rail.score || 'N/A'}, improvement=${rec.improvement_from_previous}`);
      }
    }

    if (result.credits_breakdown) {
      const cb = result.credits_breakdown;
      console.log(`\n   Credits: ${cb.evaluations} eval + ${cb.regenerations} regen = ${cb.total} total`);
    }

    // 3. External mode
    console.log('\n3. Safe regeneration (external mode)...\n');

    const extResult = await client.safeRegenerate({
      content: 'Our AI system collects user data. We use it for stuff.',
      mode: 'basic',
      maxRegenerations: 1,
      regenerationModel: 'external',
    });

    console.log(`   Status: ${extResult.status}`);
    console.log(`   Session ID: ${extResult.session_id}`);
    console.log(`   Iterations remaining: ${extResult.iterations_remaining}`);

    if (extResult.rail_prompt) {
      console.log(`   System prompt: ${extResult.rail_prompt.system_prompt.slice(0, 80)}...`);
      console.log(`   User prompt: ${extResult.rail_prompt.user_prompt.slice(0, 80)}...`);
    }

    console.log('\nSafe regenerate example completed successfully!\n');
  } catch (error) {
    console.error('\nError occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

main();
