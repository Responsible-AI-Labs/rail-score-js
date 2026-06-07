# Contributing to the RAIL Score JavaScript/TypeScript SDK

Thanks for your interest in contributing! This guide covers everything you need
to set up the project, make a change, and get it merged.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit & Branch Conventions](#commit--branch-conventions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Release Process](#release-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

By participating you agree to keep interactions respectful and constructive.
Please report unacceptable behavior to research@responsibleailabs.ai.

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally.
3. Install dependencies and run the test suite to confirm a clean baseline.
4. Create a branch for your change.
5. Make the change with tests and docs.
6. Open a pull request.

## Development Setup

### Prerequisites

- Node.js >= 16
- npm
- git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/rail-score-js.git
cd rail-score-js

# Install dependencies
npm install

# Confirm a clean baseline
npm test
npm run build
```

## Project Structure

```
src/
  client.ts          # Main RailScore client (eval, compliance, safe-regenerate,
                     #   health, getConfig/getCapabilities/getDimensions)
  agent/             # client.agent namespace (tool-call/result, injection, plan)
  dpdp/              # client.dpdp namespace + DPDPCompliance + DPDPContentScanner
  providers/         # LLM provider wrappers (OpenAI, Anthropic, Gemini)
  observability/     # Langfuse + guardrail integrations
  telemetry/         # OpenTelemetry instrumentation, loggers, review queue
  session.ts         # Multi-turn RAILSession
  policy.ts          # PolicyEngine
  middleware.ts      # RAILMiddleware
  errors.ts          # Error classes
  types.ts           # Shared type definitions
  utils.ts           # Scoring/utility helpers
  index.ts           # Public entry point — every export is re-exported here
tests/               # Jest test suites (one per module)
  __mocks__/         # node-fetch mock used across tests
```

## Making Changes

- Keep changes focused; one logical change per pull request.
- When you add or change a public API, update `src/index.ts`, the relevant
  `tests/`, the `README.md`, and `CHANGELOG.md`.
- Match the surrounding code: parameters are camelCase, and request bodies are
  mapped to the API's snake_case shape inside each method. Namespaces
  (`agent`, `dpdp`) normalize snake_case responses back to camelCase.
- New runtime dependencies should be avoided. Optional integrations belong in
  `peerDependencies` with `peerDependenciesMeta: { optional: true }`.

## Testing

The suite uses [Jest](https://jestjs.io/) with `ts-jest`. `node-fetch` is mocked
(`tests/__mocks__/node-fetch.ts`) so tests never hit the network.

```bash
npm test                       # run the whole suite
npm test -- tests/dpdp.test.ts # run a single file
npm test -- -t "createSession" # run tests matching a name
```

Every behavioral change needs a test. Mirror the existing pattern: mock the
response with `setMockResponse(...)`, call the method, and assert on the mapped
result. Cover both the success path and the relevant error path.

## Code Style

- TypeScript `strict` mode is on — no implicit `any` in public signatures.
- Document exported functions/classes with JSDoc, including the HTTP method and
  path for client methods and a short `@example` where it helps.
- Prefer `const`, early returns, and small focused helpers.
- Run `npm run build` before pushing; the `--dts` step type-checks the public
  surface and will fail on type errors.

## Commit & Branch Conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional-scope>): <imperative description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Branch names follow `<type>/<short-description>`, e.g. `feature/dpdp-evidence`,
`fix/timer-mapping`, `docs/readme-examples`.

## Submitting a Pull Request

1. Rebase on the latest `main`.
2. Ensure `npm test` and `npm run build` both pass.
3. Update `README.md` and `CHANGELOG.md` (under an `## [Unreleased]` or the next
   version heading) when behavior or the public surface changes.
4. Open the PR against `main` using the pull request template. Fill in **What**,
   **Why**, and **Testing**.
5. Keep the PR title in Conventional Commit form — it becomes the squash/merge
   subject.

## Release Process

Publishing is **tag-driven** and runs through
`.github/workflows/publish.yml` using npm **trusted publishing** (OIDC — no
token). To cut a release (maintainers):

```bash
# 1. Bump the version (updates package.json AND package-lock.json)
npm version 2.7.0 --no-git-tag-version

# 2. Update CHANGELOG.md, commit, and merge to main via PR
git commit -am "chore: release v2.7.0"

# 3. Tag the release commit on main and push the tag
git tag v2.7.0
git push origin v2.7.0
```

The workflow verifies the tag matches `package.json`, runs tests + build,
publishes to npm with provenance, and creates the GitHub Release with generated
notes. The tag **must** match `package.json` or the workflow fails fast.

## Reporting Bugs

Open an issue with the **Bug report** template. Include the SDK version, Node
version, a minimal reproduction, and the actual vs. expected behavior.

## Feature Requests

Open an issue with the **Feature request** template. Describe the use case and
the API you would like to see — concrete examples help a lot.
