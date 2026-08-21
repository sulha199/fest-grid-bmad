import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  resolveBMadProject,
  validateTargetRepo,
  resolveArtifactPaths,
  locateReferences,
  scanForFallbackReference
} from './project-resolver.js';
import { OrchestratorError } from '../ports/orchestrator-error.js';

describe('Project Resolver', () => {
  const realProjectRoot = fs.existsSync(path.resolve(process.cwd(), '_bmad'))
    ? path.resolve(process.cwd())
    : path.resolve(process.cwd(), '..');
  const tempTestDir = path.join(os.tmpdir(), 'bmad-test-' + Date.now());

  beforeAll(() => {
    // Set up a fake invalid directory
    fs.mkdirSync(tempTestDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  });

  test('should validate and resolve paths correctly for the current real BMad repository', () => {
    const result = resolveBMadProject(realProjectRoot);

    expect(result.targetRepoPath).toBe(realProjectRoot);
    expect(result.planningArtifacts).toBe(path.join(realProjectRoot, '_bmad-output/planning-artifacts'));
    expect(result.implementationArtifacts).toBe(path.join(realProjectRoot, '_bmad-output/implementation-artifacts'));
    
    // Assert resolved paths exist on disk
    expect(fs.existsSync(result.planningArtifacts)).toBe(true);
    expect(fs.existsSync(result.implementationArtifacts)).toBe(true);

    if (result.prdPath) {
      expect(fs.existsSync(result.prdPath)).toBe(true);
      expect(result.prdPath).toContain('prd.md');
    }
    if (result.architecturePath) {
      expect(fs.existsSync(result.architecturePath)).toBe(true);
    }
  });

  test('should throw unrecoverable OrchestratorError if TARGET_REPO_PATH is missing both _bmad and _bmad-output', () => {
    expect(() => validateTargetRepo(tempTestDir)).toThrow(OrchestratorError);
    try {
      validateTargetRepo(tempTestDir);
    } catch (err: any) {
      expect(err.recoverable).toBe(false);
      expect(err.message).toContain("missing both '_bmad/' and '_bmad-output/'");
    }
  });

  test('should throw unrecoverable OrchestratorError if TARGET_REPO_PATH is missing _bmad directory only', () => {
    const customTempDir = path.join(tempTestDir, 'missing-bmad-only');
    fs.mkdirSync(customTempDir, { recursive: true });
    fs.mkdirSync(path.join(customTempDir, '_bmad-output'), { recursive: true });

    expect(() => validateTargetRepo(customTempDir)).toThrow(OrchestratorError);
    try {
      validateTargetRepo(customTempDir);
    } catch (err: any) {
      expect(err.recoverable).toBe(false);
      expect(err.message).toContain("missing '_bmad/' directory");
    }
  });

  test('should throw unrecoverable OrchestratorError if TARGET_REPO_PATH is missing _bmad-output directory only', () => {
    const customTempDir = path.join(tempTestDir, 'missing-bmad-output-only');
    fs.mkdirSync(customTempDir, { recursive: true });
    fs.mkdirSync(path.join(customTempDir, '_bmad'), { recursive: true });

    expect(() => validateTargetRepo(customTempDir)).toThrow(OrchestratorError);
    try {
      validateTargetRepo(customTempDir);
    } catch (err: any) {
      expect(err.recoverable).toBe(false);
      expect(err.message).toContain("missing '_bmad-output/' directory");
    }
  });

  test('should parse yaml and substitute placeholders correctly in resolveArtifactPaths', () => {
    const customTempDir = path.join(tempTestDir, 'valid-config-placeholder');
    fs.mkdirSync(customTempDir, { recursive: true });
    fs.mkdirSync(path.join(customTempDir, '_bmad/bmm'), { recursive: true });

    const fakeYaml = `
planning_artifacts: "{project-root}/custom-planning"
implementation_artifacts: "{project-root}/custom-impl"
`;
    fs.writeFileSync(path.join(customTempDir, '_bmad/bmm/config.yaml'), fakeYaml, 'utf8');

    const paths = resolveArtifactPaths(customTempDir);
    expect(paths.planningArtifacts).toBe(path.resolve(customTempDir, 'custom-planning'));
    expect(paths.implementationArtifacts).toBe(path.resolve(customTempDir, 'custom-impl'));
  });

  test('should scan recursively and find fallback references when project-context.md is missing', () => {
    const fakePlanningDir = path.join(tempTestDir, 'fake-planning');
    const fakeSpecsDir = path.join(fakePlanningDir, 'specs/some-spec');
    fs.mkdirSync(fakeSpecsDir, { recursive: true });

    const fakeSpecFile = path.join(fakeSpecsDir, 'SPEC.md');
    fs.writeFileSync(fakeSpecFile, '# SPEC', 'utf8');

    const result = scanForFallbackReference(fakePlanningDir);
    expect(result.architecturePath).toBe(path.resolve(fakeSpecFile));
  });

  test('should scan recursively and find fallback architecture-spine.md', () => {
    const fakePlanningDir = path.join(tempTestDir, 'fake-planning-spine');
    fs.mkdirSync(fakePlanningDir, { recursive: true });

    const fakeSpineFile = path.join(fakePlanningDir, 'some-architecture-spine.md');
    fs.writeFileSync(fakeSpineFile, '# Spine', 'utf8');

    const result = scanForFallbackReference(fakePlanningDir);
    expect(result.architecturePath).toBe(path.resolve(fakeSpineFile));
  });

  test('should extract references from project-context.md Reference Documents section', () => {
    const customTempDir = path.join(tempTestDir, 'project-context-test');
    const bmadOutputDir = path.join(customTempDir, '_bmad-output');
    fs.mkdirSync(bmadOutputDir, { recursive: true });

    const fakePlanningDir = path.join(customTempDir, 'planning');
    fs.mkdirSync(fakePlanningDir, { recursive: true });

    const fakePrd = path.join(fakePlanningDir, 'prd.md');
    fs.writeFileSync(fakePrd, 'PRD', 'utf8');

    const fakeSpine = path.join(fakePlanningDir, 'architecture-spine.md');
    fs.writeFileSync(fakeSpine, 'Spine', 'utf8');

    const fakeContextContent = `
# Project Context

## Reference Documents

### Planning
- \`planning/prd.md\`

### Architecture
- [Architecture](planning/architecture-spine.md)
`;
    fs.writeFileSync(path.join(bmadOutputDir, 'project-context.md'), fakeContextContent, 'utf8');

    const result = locateReferences(customTempDir, fakePlanningDir);
    expect(result.prdPath).toBe(path.resolve(fakePrd));
    expect(result.architecturePath).toBe(path.resolve(fakeSpine));
  });
});
