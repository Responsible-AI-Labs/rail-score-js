import type { RailScore } from './client';
import type {
  ComplianceResult,
  ComplianceFramework,
} from './types';
import { ValidationError } from './errors';

/**
 * Compliance API methods for checking regulatory compliance
 */
export class Compliance {
  constructor(private client: RailScore) {}

  /**
   * Check content compliance against a specific framework
   *
   * Evaluates content against regulatory requirements and standards.
   *
   * @param content - The content to check for compliance
   * @param framework - The compliance framework to check against
   * @returns Promise resolving to compliance check result
   * @throws {ValidationError} If content or framework is invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {InsufficientCreditsError} If insufficient credits
   *
   * @example
   * ```typescript
   * const result = await client.compliance.check(
   *   'We collect and process user data for analytics...',
   *   'gdpr'
   * );
   * console.log(`Compliant: ${result.compliant}`);
   * console.log(`Score: ${result.score}/10`);
   * result.violations.forEach(v => {
   *   console.log(`- ${v.severity}: ${v.description}`);
   * });
   * ```
   */
  async check(
    content: string,
    framework: ComplianceFramework
  ): Promise<ComplianceResult> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (!framework) {
      throw new ValidationError('Framework is required');
    }

    return this.client.request<ComplianceResult>('/v1/compliance/check', {
      method: 'POST',
      body: JSON.stringify({
        content,
        framework,
      }),
    });
  }

  /**
   * Check content against multiple compliance frameworks
   *
   * Efficiently evaluate content against multiple regulatory frameworks in one request.
   *
   * @param content - The content to check for compliance
   * @param frameworks - Array of compliance frameworks to check against
   * @returns Promise resolving to array of compliance results
   * @throws {ValidationError} If content or frameworks are invalid
   *
   * @example
   * ```typescript
   * const results = await client.compliance.checkMultiple(
   *   'Our healthcare app processes patient data...',
   *   ['gdpr', 'hipaa']
   * );
   * results.forEach(result => {
   *   console.log(`${result.framework}: ${result.compliant ? 'PASS' : 'FAIL'}`);
   * });
   * ```
   */
  async checkMultiple(
    content: string,
    frameworks: ComplianceFramework[]
  ): Promise<ComplianceResult[]> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (!frameworks || frameworks.length === 0) {
      throw new ValidationError('At least one framework is required');
    }

    // Validate frameworks array
    if (frameworks.length > 10) {
      throw new ValidationError('Maximum 10 frameworks allowed per request');
    }

    const response = await this.client.request<{ results: ComplianceResult[] }>(
      '/v1/compliance/check-multiple',
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          frameworks,
        }),
      }
    );

    return response.results;
  }

  /**
   * Get detailed compliance requirements for a framework
   *
   * Returns information about what a specific compliance framework requires.
   *
   * @param framework - The compliance framework to get requirements for
   * @returns Promise resolving to framework requirements
   * @throws {ValidationError} If framework is invalid
   *
   * @example
   * ```typescript
   * const requirements = await client.compliance.getRequirements('gdpr');
   * console.log(`${requirements.name}: ${requirements.description}`);
   * requirements.categories.forEach(cat => {
   *   console.log(`- ${cat.name}: ${cat.requirements.length} requirements`);
   * });
   * ```
   */
  async getRequirements(framework: ComplianceFramework): Promise<any> {
    if (!framework) {
      throw new ValidationError('Framework is required');
    }

    return this.client.request<any>(
      `/v1/compliance/requirements/${framework}`,
      { method: 'GET' }
    );
  }

  /**
   * Scan content for potential compliance issues across all frameworks
   *
   * Performs a broad scan to identify potential compliance concerns.
   *
   * @param content - The content to scan
   * @returns Promise resolving to scan results with identified issues
   * @throws {ValidationError} If content is invalid
   *
   * @example
   * ```typescript
   * const scan = await client.compliance.scan(
   *   'We store customer credit card information in our database...'
   * );
   * console.log(`Issues found: ${scan.issues.length}`);
   * scan.issues.forEach(issue => {
   *   console.log(`- [${issue.frameworks.join(', ')}] ${issue.description}`);
   * });
   * ```
   */
  async scan(content: string): Promise<any> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    return this.client.request<any>('/v1/compliance/scan', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  /**
   * Get compliance recommendations for improving content
   *
   * Provides actionable suggestions to achieve compliance.
   *
   * @param content - The content to analyze
   * @param framework - The target compliance framework
   * @param currentViolations - Optional array of known violations to address
   * @returns Promise resolving to recommendations
   * @throws {ValidationError} If content or framework is invalid
   *
   * @example
   * ```typescript
   * const recommendations = await client.compliance.getRecommendations(
   *   'We use cookies to track users.',
   *   'gdpr'
   * );
   * recommendations.forEach(rec => {
   *   console.log(`Priority ${rec.priority}: ${rec.suggestion}`);
   * });
   * ```
   */
  async getRecommendations(
    content: string,
    framework: ComplianceFramework,
    currentViolations?: string[]
  ): Promise<any> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (!framework) {
      throw new ValidationError('Framework is required');
    }

    return this.client.request<any>('/v1/compliance/recommendations', {
      method: 'POST',
      body: JSON.stringify({
        content,
        framework,
        current_violations: currentViolations,
      }),
    });
  }

  /**
   * List all available compliance frameworks
   *
   * Returns information about all supported compliance frameworks.
   *
   * @returns Promise resolving to list of available frameworks
   *
   * @example
   * ```typescript
   * const frameworks = await client.compliance.listFrameworks();
   * frameworks.forEach(fw => {
   *   console.log(`${fw.id}: ${fw.name} (${fw.version})`);
   * });
   * ```
   */
  async listFrameworks(): Promise<any> {
    return this.client.request<any>('/v1/compliance/frameworks', {
      method: 'GET',
    });
  }
}
