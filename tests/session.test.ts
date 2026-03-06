import { RailScore } from '../src/client';
import { RAILSession } from '../src/session';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RAILSession', () => {
  let client: RailScore;

  const mockEvalResult = (score: number) => ({
    rail_score: { score, confidence: 0.9, summary: 'Score: ' + score },
    explanation: 'Evaluation result.',
    dimension_scores: {
      safety: { score: score + 0.5, confidence: 0.95, explanation: 'Safe', issues: [] },
      privacy: { score: score - 0.5, confidence: 0.85, explanation: 'Good', issues: [] },
    },
    from_cache: false,
  });

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-rail-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  it('should create a session with default config', () => {
    const session = new RAILSession(client);
    expect(session.getTurnCount()).toBe(0);
    expect(session.getHistory()).toHaveLength(0);
  });

  it('should create a session with custom config', () => {
    const session = new RAILSession(client, {
      deepEvalFrequency: 3,
      contextWindow: 5,
      qualityThreshold: 8.0,
    });
    expect(session.getTurnCount()).toBe(0);
  });

  it('should add a turn and return evaluation result', async () => {
    setMockResponse(mockEvalResult(8.0));
    const session = new RAILSession(client);

    const result = await session.addTurn('Test content');

    expect(result.rail_score.score).toBe(8.0);
    expect(session.getTurnCount()).toBe(1);
    expect(session.getHistory()).toHaveLength(1);
  });

  it('should add multiple turns', async () => {
    const session = new RAILSession(client);

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 1');

    setMockResponse(mockEvalResult(7.5));
    await session.addTurn('Turn 2');

    setMockResponse(mockEvalResult(9.0));
    await session.addTurn('Turn 3');

    expect(session.getTurnCount()).toBe(3);
  });

  it('should accept explicit mode override', async () => {
    setMockResponse(mockEvalResult(8.0));
    const session = new RAILSession(client);

    const result = await session.addTurn('Content', 'deep');
    expect(result).toBeDefined();
  });

  it('should return correct metrics', async () => {
    const session = new RAILSession(client, { qualityThreshold: 7.0 });

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 1');

    setMockResponse(mockEvalResult(6.0));
    await session.addTurn('Turn 2');

    setMockResponse(mockEvalResult(9.0));
    await session.addTurn('Turn 3');

    const metrics = session.getMetrics();

    expect(metrics.turnCount).toBe(3);
    expect(metrics.averageScore).toBeCloseTo(7.67, 1);
    expect(metrics.minScore).toBe(6.0);
    expect(metrics.maxScore).toBe(9.0);
    expect(metrics.passingRate).toBeCloseTo(66.67, 0);
    expect(metrics.dimensionAverages).toBeDefined();
    expect(metrics.dimensionAverages.safety).toBeDefined();
    expect(metrics.dimensionAverages.privacy).toBeDefined();
  });

  it('should return zero metrics for empty session', () => {
    const session = new RAILSession(client);
    const metrics = session.getMetrics();

    expect(metrics.averageScore).toBe(0);
    expect(metrics.minScore).toBe(0);
    expect(metrics.maxScore).toBe(0);
    expect(metrics.turnCount).toBe(0);
    expect(metrics.passingRate).toBe(0);
  });

  it('should reset the session', async () => {
    setMockResponse(mockEvalResult(8.0));
    const session = new RAILSession(client);

    await session.addTurn('Turn 1');
    expect(session.getTurnCount()).toBe(1);

    session.reset();
    expect(session.getTurnCount()).toBe(0);
    expect(session.getHistory()).toHaveLength(0);
  });

  it('should return a copy of history (not reference)', async () => {
    setMockResponse(mockEvalResult(8.0));
    const session = new RAILSession(client);

    await session.addTurn('Turn 1');
    const history = session.getHistory();

    expect(history).toHaveLength(1);
    history.pop();
    expect(session.getHistory()).toHaveLength(1);
  });

  it('should use deep mode every N turns based on deepEvalFrequency', async () => {
    const session = new RAILSession(client, { deepEvalFrequency: 2 });

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 1');

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 2');

    expect(session.getTurnCount()).toBe(2);
  });

  it('should use deep mode when quality dips below threshold', async () => {
    const session = new RAILSession(client, { qualityThreshold: 7.0 });

    setMockResponse(mockEvalResult(5.0));
    await session.addTurn('Turn 1');

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 2');

    expect(session.getTurnCount()).toBe(2);
  });

  it('should calculate dimension averages across turns', async () => {
    const session = new RAILSession(client);

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 1');

    setMockResponse(mockEvalResult(6.0));
    await session.addTurn('Turn 2');

    const metrics = session.getMetrics();
    // safety: (8.5 + 6.5) / 2 = 7.5
    expect(metrics.dimensionAverages.safety).toBeCloseTo(7.5, 1);
    // privacy: (7.5 + 5.5) / 2 = 6.5
    expect(metrics.dimensionAverages.privacy).toBeCloseTo(6.5, 1);
  });

  it('should calculate 100% passing rate when all turns pass', async () => {
    const session = new RAILSession(client, { qualityThreshold: 7.0 });

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 1');

    setMockResponse(mockEvalResult(9.0));
    await session.addTurn('Turn 2');

    const metrics = session.getMetrics();
    expect(metrics.passingRate).toBe(100);
  });

  it('should calculate 0% passing rate when no turns pass', async () => {
    const session = new RAILSession(client, { qualityThreshold: 9.5 });

    setMockResponse(mockEvalResult(8.0));
    await session.addTurn('Turn 1');

    setMockResponse(mockEvalResult(7.0));
    await session.addTurn('Turn 2');

    const metrics = session.getMetrics();
    expect(metrics.passingRate).toBe(0);
  });
});
