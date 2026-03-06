/**
 * Multi-turn session tracking example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - Creating a RAILSession for conversation tracking
 * - Adding turns and monitoring scores over time
 * - Automatic deep evaluation on quality dips
 * - Session metrics and history
 */

const { RailScore, RAILSession, formatScore, getScoreLabel } = require('@responsibleailabs/rail-score');

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-rail-api-key',
  });

  console.log('RAIL Score SDK - Session Tracking Example\n');

  try {
    // 1. Create a session with custom configuration
    console.log('1. Creating session with custom config...');
    const session = new RAILSession(client, {
      deepEvalFrequency: 3,     // Deep eval every 3 turns
      contextWindow: 5,          // Track last 5 turns for context
      qualityThreshold: 6.0,     // Trigger deep eval if score drops below 6.0
    });

    console.log('   Session created.\n');

    // 2. Simulate a multi-turn conversation
    const turns = [
      'Our system uses encryption to protect all user data in transit and at rest.',
      'We collect user browsing history to personalize recommendations.',
      'All AI decisions can be appealed through our transparent review process.',
      'User data is shared with third-party advertisers for targeted marketing.',
      'We provide clear explanations for every automated decision made by our system.',
    ];

    console.log('2. Processing conversation turns...\n');

    for (let i = 0; i < turns.length; i++) {
      const result = await session.addTurn(turns[i]);
      const label = getScoreLabel(result.railScore.score);

      console.log(`   Turn ${i + 1}: ${formatScore(result.railScore.score)}/10 (${label})`);
      console.log(`   Content: "${turns[i].substring(0, 60)}..."`);
      console.log();
    }

    // 3. View session metrics
    console.log('3. Session Metrics:\n');
    const metrics = session.getMetrics();

    console.log(`   Total Turns: ${metrics.turnCount}`);
    console.log(`   Average Score: ${formatScore(metrics.averageScore)}/10`);
    console.log(`   Min Score: ${formatScore(metrics.minScore)}/10`);
    console.log(`   Max Score: ${formatScore(metrics.maxScore)}/10`);
    console.log(`   Passing Rate: ${(metrics.passingRate * 100).toFixed(1)}%\n`);

    if (metrics.dimensionAverages) {
      console.log('   Dimension Averages:');
      for (const [dim, avg] of Object.entries(metrics.dimensionAverages)) {
        console.log(`     ${dim}: ${formatScore(avg)}/10`);
      }
      console.log();
    }

    // 4. View session history
    console.log('4. Session History:\n');
    const history = session.getHistory();
    console.log(`   Total turns recorded: ${history.length}`);
    console.log(`   Turn count: ${session.getTurnCount()}\n`);

    // 5. Reset session
    console.log('5. Resetting session...');
    session.reset();
    console.log(`   Turns after reset: ${session.getTurnCount()}\n`);

    console.log('Session example completed successfully!\n');

  } catch (error) {
    console.error('\nError occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

main();
