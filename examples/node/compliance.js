/**
 * Compliance checking example for RAIL Score JavaScript SDK
 *
 * This example demonstrates:
 * - Checking compliance against specific frameworks
 * - Multi-framework compliance checking
 * - Scanning for potential issues
 * - Getting compliance recommendations
 * - Listing available frameworks
 */

const { RailScore, formatScore } = require('@responsibleailabs/rail-score');

async function main() {
  const client = new RailScore({
    apiKey: process.env.RAIL_API_KEY || 'your-api-key-here',
  });

  console.log('🚀 RAIL Score SDK - Compliance Checking Example\n');

  try {
    // 1. List available compliance frameworks
    console.log('1️⃣  Available Compliance Frameworks:\n');

    const frameworks = await client.compliance.listFrameworks();

    frameworks.forEach((framework) => {
      console.log(`   • ${framework.id.toUpperCase()}`);
      console.log(`     Name: ${framework.name}`);
      console.log(`     Version: ${framework.version}`);
      console.log(`     Region: ${framework.region || 'Global'}`);
      console.log();
    });

    // 2. Check GDPR compliance
    console.log('2️⃣  Checking GDPR Compliance:\n');

    const gdprContent = `
      Our application collects user email addresses, names, and location data.
      We use this information to provide personalized services and may share
      anonymized analytics with third-party partners. Users can contact us
      via email to request data deletion.
    `;

    const gdprResult = await client.compliance.check(gdprContent.trim(), 'gdpr');

    console.log(`   📋 Framework: ${gdprResult.framework.toUpperCase()}`);
    console.log(`   ${gdprResult.compliant ? '✓' : '✗'} Compliant: ${gdprResult.compliant}`);
    console.log(`   📊 Score: ${formatScore(gdprResult.score)}/10\n`);

    if (gdprResult.requirements.length > 0) {
      console.log('   📝 Requirements Assessment:');
      gdprResult.requirements.forEach((req) => {
        const statusIcon = {
          compliant: '✓',
          non_compliant: '✗',
          partial: '⚠',
          not_applicable: '○',
        }[req.status];

        console.log(`      ${statusIcon} ${req.name}: ${req.status}`);
        console.log(`        Score: ${formatScore(req.score)}/10`);
      });
      console.log();
    }

    if (gdprResult.violations.length > 0) {
      console.log('   ⚠ Violations Found:\n');
      gdprResult.violations.forEach((violation, i) => {
        const severityEmoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[violation.severity];

        console.log(`      ${i + 1}. ${severityEmoji} ${violation.severity.toUpperCase()}`);
        console.log(`         Requirement: ${violation.requirement}`);
        console.log(`         Issue: ${violation.description}`);
        if (violation.location) {
          console.log(`         Location: ${violation.location}`);
        }
        console.log(`         Fix: ${violation.remediation}`);
        console.log();
      });
    }

    if (gdprResult.recommendations.length > 0) {
      console.log('   💡 Recommendations:');
      gdprResult.recommendations.forEach((rec, i) => {
        console.log(`      ${i + 1}. ${rec}`);
      });
      console.log();
    }

    // 3. Multi-framework compliance check
    console.log('3️⃣  Multi-Framework Compliance Check:\n');

    const healthcareContent = `
      Our healthcare application stores patient medical records including
      diagnoses, treatment plans, and prescription information. We use
      encryption to protect this data and require authentication for access.
      Data is retained for 7 years as required by law.
    `;

    const multiResults = await client.compliance.checkMultiple(
      healthcareContent.trim(),
      ['gdpr', 'hipaa']
    );

    console.log(`   ✓ Checked ${multiResults.length} frameworks:\n`);

    multiResults.forEach((result) => {
      const icon = result.compliant ? '✓' : '✗';
      console.log(`   ${icon} ${result.framework.toUpperCase()}`);
      console.log(`      Compliant: ${result.compliant}`);
      console.log(`      Score: ${formatScore(result.score)}/10`);
      console.log(`      Violations: ${result.violations.length}`);
      console.log();
    });

    // 4. Compliance scan across all frameworks
    console.log('4️⃣  Comprehensive Compliance Scan:\n');

    const scanContent = `
      We process credit card payments and store customer financial information.
      User data may be analyzed using AI algorithms for fraud detection.
      International users from EU and California are also supported.
    `;

    const scanResult = await client.compliance.scan(scanContent.trim());

    console.log(`   📊 Scan Summary:`);
    console.log(`      Total Issues: ${scanResult.summary.totalIssues}`);
    console.log(`      Critical: ${scanResult.summary.criticalIssues}`);
    console.log(`      High: ${scanResult.summary.highIssues}`);
    console.log(`      Medium: ${scanResult.summary.mediumIssues}`);
    console.log(`      Low: ${scanResult.summary.lowIssues}`);
    console.log(`      Affected Frameworks: ${scanResult.affectedFrameworks.join(', ')}\n`);

    if (scanResult.issues.length > 0) {
      console.log('   ⚠ Issues Identified:\n');
      scanResult.issues.forEach((issue, i) => {
        const severityEmoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[issue.severity];

        console.log(`      ${i + 1}. ${severityEmoji} ${issue.severity.toUpperCase()}`);
        console.log(`         Frameworks: ${issue.frameworks.join(', ')}`);
        console.log(`         Issue: ${issue.description}`);
        console.log(`         Recommendation: ${issue.recommendation}`);
        console.log();
      });
    }

    // 5. Get detailed recommendations
    console.log('5️⃣  Getting Compliance Recommendations:\n');

    const recommendations = await client.compliance.getRecommendations(
      scanContent.trim(),
      'pci_dss',
      ['Credit card data not properly encrypted', 'Missing access controls']
    );

    console.log('   💡 Actionable Recommendations:\n');

    recommendations.forEach((rec, i) => {
      const priorityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[rec.priority];

      console.log(`      ${i + 1}. ${priorityEmoji} ${rec.priority.toUpperCase()} Priority`);
      console.log(`         Category: ${rec.category}`);
      console.log(`         Suggestion: ${rec.suggestion}`);
      console.log(`         Effort: ${rec.effort}`);
      console.log(`         Impact: ${rec.impact}`);
      console.log();
    });

    // 6. Get framework requirements
    console.log('6️⃣  Framework Requirements Details:\n');

    const requirements = await client.compliance.getRequirements('gdpr');

    console.log(`   📚 ${requirements.name} (${requirements.version})`);
    console.log(`   ${requirements.description}\n`);

    if (requirements.categories) {
      console.log('   Categories:');
      requirements.categories.forEach((category, i) => {
        console.log(`      ${i + 1}. ${category.name}`);
        console.log(`         Requirements: ${category.requirements.length}`);
      });
      console.log();
    }

    // 7. New frameworks (v2.1.1): EU AI Act, India DPDP, India AI Governance
    console.log('7️⃣  Checking new compliance frameworks (v2.1.1):\n');

    const aiContent = `
      Our AI system uses machine learning to make automated decisions about
      loan applications. The model was trained on historical data and provides
      explanations for each decision. Users can appeal automated decisions.
    `;

    const euAiResult = await client.compliance.check(aiContent.trim(), 'eu_ai_act', {
      context: 'High-risk AI system for financial decisions',
      strict_mode: true,
    });

    console.log(`   📋 EU AI Act Compliance:`);
    console.log(`   ${euAiResult.compliant ? '✓' : '✗'} Compliant: ${euAiResult.compliant}`);
    console.log(`   📊 Score: ${formatScore(euAiResult.score)}/10`);
    console.log(`   ⚠ Violations: ${euAiResult.violations.length}\n`);

    const indiaDpdpResult = await client.compliance.check(aiContent.trim(), 'india_dpdp');
    console.log(`   📋 India DPDP Compliance:`);
    console.log(`   ${indiaDpdpResult.compliant ? '✓' : '✗'} Compliant: ${indiaDpdpResult.compliant}`);
    console.log(`   📊 Score: ${formatScore(indiaDpdpResult.score)}/10\n`);

    // 8. Compliance summary
    console.log('8️⃣  Summary:\n');

    const allCompliant = multiResults.every((r) => r.compliant);
    const avgScore =
      multiResults.reduce((sum, r) => sum + r.score, 0) / multiResults.length;

    console.log(`   📊 Overall Status:`);
    console.log(`      ${allCompliant ? '✓' : '✗'} All Frameworks: ${allCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
    console.log(`      Average Score: ${formatScore(avgScore)}/10`);
    console.log(`      Total Issues: ${scanResult.summary.totalIssues}`);
    console.log(`      Frameworks Checked: ${multiResults.length}`);
    console.log();

    console.log('✅ Compliance example completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(`   ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the example
main();
