/**
 * Middleware example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - Wrapping async functions with RAIL evaluation
 * - Input and output threshold enforcement
 * - Lifecycle hooks for logging
 */

const { RailScore, RAILMiddleware, formatScore } = require('@responsibleailabs/rail-score');

// Simulated LLM call (replace with actual API call)
async function fakeLLMCall(input) {
  return `Based on your question about "${input.substring(0, 30)}...", ` +
    'here is a helpful and safe response that respects user privacy ' +
    'and provides transparent, unbiased information.';
}

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-api-key-here',
  });

  console.log('RAIL Score SDK - Middleware Example\n');

  try {
    // 1. Basic middleware wrapping
    console.log('1. Basic Middleware:\n');
    const middleware = new RAILMiddleware(client, {
      inputThresholds: { safety: 5.0 },
      outputThresholds: { safety: 7.0, privacy: 7.0 },
    });

    const wrappedLLM = middleware.wrap(fakeLLMCall);
    const result = await wrappedLLM('Tell me about data privacy best practices');

    console.log(`   Output: "${result.substring(0, 60)}..."\n`);

    // 2. Middleware with lifecycle hooks
    console.log('2. Middleware with Hooks:\n');
    const hookedMiddleware = new RAILMiddleware(client, {
      inputThresholds: { safety: 5.0 },
      outputThresholds: { safety: 7.0 },
      onInputEval: (evalResult) => {
        console.log(`   [Hook] Input score: ${formatScore(evalResult.railScore.score)}/10`);
      },
      onOutputEval: (evalResult) => {
        console.log(`   [Hook] Output score: ${formatScore(evalResult.railScore.score)}/10`);
      },
    });

    const hookedLLM = hookedMiddleware.wrap(fakeLLMCall);
    await hookedLLM('What are best practices for AI safety?');
    console.log();

    // 3. Middleware with policy enforcement
    console.log('3. Middleware with Policy:\n');
    const policyMiddleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
      policyMode: 'BLOCK',
      onOutputEval: (evalResult) => {
        console.log(`   Output evaluated: ${formatScore(evalResult.railScore.score)}/10`);
      },
    });

    const policyLLM = policyMiddleware.wrap(fakeLLMCall);

    try {
      const policyResult = await policyLLM('How can we build more transparent AI systems?');
      console.log(`   Result: "${policyResult.substring(0, 60)}..."\n`);
    } catch (error) {
      console.log(`   Blocked: ${error.message}\n`);
    }

    console.log('Middleware example completed successfully!\n');

  } catch (error) {
    console.error('\nError occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

main();
