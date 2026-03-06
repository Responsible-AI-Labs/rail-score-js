/**
 * LLM provider wrappers example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - RAILOpenAI wrapper for OpenAI
 * - RAILAnthropic wrapper for Anthropic
 * - RAILGemini wrapper for Google Generative AI
 * - Threshold enforcement with provider wrappers
 *
 * Prerequisites:
 *   npm install openai @anthropic-ai/sdk @google/generative-ai
 */

const { RailScore, RAILOpenAI, RAILAnthropic, RAILGemini, RAILBlockedError, formatScore } = require('@responsibleailabs/rail-score');

async function openaiExample(client) {
  console.log('1. OpenAI Provider Wrapper:\n');

  // In real usage:
  // const OpenAI = require('openai');
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // For this example, we use a mock
  const mockOpenAI = {
    chat: {
      completions: {
        create: async (params) => ({
          choices: [{ message: { content: 'OpenAI response about responsible AI practices.' } }],
          model: params.model,
          usage: { total_tokens: 42 },
        }),
      },
    },
  };

  const railOpenAI = new RAILOpenAI(client, mockOpenAI, {
    thresholds: { safety: 7.0 },
  });

  const result = await railOpenAI.chat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Explain responsible AI principles' }],
  });

  console.log(`   Content: "${result.content.substring(0, 50)}..."`);
  console.log(`   RAIL Score: ${formatScore(result.railScore.score)}/10`);
  console.log(`   Confidence: ${(result.railScore.confidence * 100).toFixed(1)}%\n`);
}

async function anthropicExample(client) {
  console.log('2. Anthropic Provider Wrapper:\n');

  // In real usage:
  // const Anthropic = require('@anthropic-ai/sdk');
  // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const mockAnthropic = {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text: 'Anthropic response about AI safety and transparency.' }],
        model: 'claude-sonnet-4-6',
      }),
    },
  };

  const railAnthropic = new RAILAnthropic(client, mockAnthropic, {
    thresholds: { safety: 7.0, privacy: 7.0 },
  });

  const result = await railAnthropic.message({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'What are AI safety best practices?' }],
  });

  console.log(`   Content: "${result.content.substring(0, 50)}..."`);
  console.log(`   RAIL Score: ${formatScore(result.railScore.score)}/10\n`);
}

async function geminiExample(client) {
  console.log('3. Gemini Provider Wrapper:\n');

  // In real usage:
  // const { GoogleGenerativeAI } = require('@google/generative-ai');
  // const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  // const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const mockModel = {
    generateContent: async () => ({
      response: {
        text: () => 'Gemini response about building fair and inclusive AI systems.',
      },
    }),
  };

  const railGemini = new RAILGemini(client, mockModel);

  const result = await railGemini.generate('How to build fair AI systems?');

  console.log(`   Content: "${result.content.substring(0, 50)}..."`);
  console.log(`   RAIL Score: ${formatScore(result.railScore.score)}/10\n`);
}

async function thresholdExample(client) {
  console.log('4. Threshold Enforcement:\n');

  const mockOpenAI = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: 'A response that may not meet all safety thresholds.' } }],
        }),
      },
    },
  };

  const strictRail = new RAILOpenAI(client, mockOpenAI, {
    thresholds: { safety: 9.0, privacy: 9.0, fairness: 9.0 },
  });

  try {
    await strictRail.chat({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test content' }],
    });
    console.log('   Content passed strict thresholds.\n');
  } catch (error) {
    if (error instanceof RAILBlockedError) {
      console.log(`   Content BLOCKED by policy: ${error.policyMode}`);
      console.log(`   Reason: ${error.message}\n`);
    } else {
      throw error;
    }
  }
}

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-rail-api-key',
  });

  console.log('RAIL Score SDK - LLM Provider Wrappers Example\n');

  try {
    await openaiExample(client);
    await anthropicExample(client);
    await geminiExample(client);
    await thresholdExample(client);

    console.log('Provider wrappers example completed successfully!\n');

  } catch (error) {
    console.error('\nError occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

main();
