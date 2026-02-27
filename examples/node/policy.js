/**
 * Policy engine example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - Creating a PolicyEngine with different modes
 * - LOG_ONLY mode for monitoring
 * - BLOCK mode for enforcing thresholds
 * - REGENERATE mode for automatic content fixing
 * - CUSTOM mode for user-defined handling
 */

const { RailScore, PolicyEngine, RAILBlockedError, formatScore } = require('@responsibleailabs/rail-score');

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-api-key-here',
  });

  console.log('RAIL Score SDK - Policy Engine Example\n');

  const safeContent = `
    Our system uses transparent algorithms to ensure fair treatment
    of all users. Privacy is protected through encryption and data
    minimization practices.
  `.trim();

  const riskyContent = `
    The system automatically collects all available user data including
    browsing history, location, contacts, and financial information
    without explicit notification.
  `.trim();

  try {
    // 1. LOG_ONLY mode - evaluate without blocking
    console.log('1. LOG_ONLY Mode:\n');
    const logPolicy = new PolicyEngine(client, {
      mode: 'LOG_ONLY',
      thresholds: { safety: 7.0, privacy: 7.0 },
    });

    const logResult = await logPolicy.enforce(safeContent);
    console.log(`   Score: ${formatScore(logResult.railScore.score)}/10`);
    console.log('   (Content is evaluated but never blocked in LOG_ONLY mode)\n');

    // 2. BLOCK mode - throw error when thresholds are not met
    console.log('2. BLOCK Mode:\n');
    const blockPolicy = new PolicyEngine(client, {
      mode: 'BLOCK',
      thresholds: { safety: 7.0, privacy: 7.0 },
    });

    // Safe content should pass
    const passResult = await blockPolicy.enforce(safeContent);
    console.log(`   Safe content: ${formatScore(passResult.railScore.score)}/10 (passed)\n`);

    // Risky content should be blocked
    try {
      await blockPolicy.enforce(riskyContent);
      console.log('   Risky content: passed (unexpected)\n');
    } catch (error) {
      if (error instanceof RAILBlockedError) {
        console.log(`   Risky content: BLOCKED`);
        console.log(`   Policy mode: ${error.policyMode}`);
        console.log(`   Message: ${error.message}\n`);
      } else {
        throw error;
      }
    }

    // 3. REGENERATE mode - automatically fix content
    console.log('3. REGENERATE Mode:\n');
    const regenPolicy = new PolicyEngine(client, {
      mode: 'REGENERATE',
      thresholds: { privacy: 7.0 },
    });

    const regenResult = await regenPolicy.enforce(safeContent);
    console.log(`   Score: ${formatScore(regenResult.railScore.score)}/10`);
    console.log('   (Content that fails thresholds is automatically regenerated)\n');

    // 4. CUSTOM mode - user-defined callback
    console.log('4. CUSTOM Mode:\n');
    const customPolicy = new PolicyEngine(client, {
      mode: 'CUSTOM',
      thresholds: { safety: 7.0 },
      customCallback: async (content, result) => {
        console.log(`   Custom callback invoked with score: ${formatScore(result.railScore.score)}/10`);
        // Return modified content or null to pass through
        return `[REVIEWED] ${content}`;
      },
    });

    const customResult = await customPolicy.enforce(safeContent);
    console.log(`   Final score: ${formatScore(customResult.railScore.score)}/10\n`);

    // 5. Runtime configuration changes
    console.log('5. Runtime Configuration:\n');
    blockPolicy.setMode('LOG_ONLY');
    console.log('   Switched from BLOCK to LOG_ONLY mode');

    blockPolicy.setThresholds({ safety: 8.0, fairness: 8.0 });
    console.log('   Updated thresholds to 8.0 for safety and fairness\n');

    console.log('Policy engine example completed successfully!\n');

  } catch (error) {
    console.error('\nError occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

main();
