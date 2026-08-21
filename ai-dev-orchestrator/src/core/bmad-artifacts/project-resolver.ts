import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'yaml';
import { OrchestratorError } from '../ports/orchestrator-error.js';

export interface BMadProject {
  targetRepoPath: string;
  planningArtifacts: string;
  implementationArtifacts: string;
  prdPath: string | null;
  architecturePath: string | null;
}

export interface BMadConfig {
  planning_artifacts?: string;
  implementation_artifacts?: string;
}

/**
 * Validates that the TARGET_REPO_PATH contains both _bmad/ and _bmad-output/ directories.
 * Throws an unrecoverable OrchestratorError if either is missing.
 */
export function validateTargetRepo(targetRepoPath: string): void {
  const absolutePath = path.resolve(targetRepoPath);
  const bmadPath = path.join(absolutePath, '_bmad');
  const bmadOutputPath = path.join(absolutePath, '_bmad-output');

  const bmadExists = fs.existsSync(bmadPath) && fs.statSync(bmadPath).isDirectory();
  const bmadOutputExists = fs.existsSync(bmadOutputPath) && fs.statSync(bmadOutputPath).isDirectory();

  if (!bmadExists && !bmadOutputExists) {
    throw new OrchestratorError(
      `Invalid BMad project: missing both '_bmad/' and '_bmad-output/' directories under '${absolutePath}'`,
      false
    );
  }
  if (!bmadExists) {
    throw new OrchestratorError(
      `Invalid BMad project: missing '_bmad/' directory under '${absolutePath}'`,
      false
    );
  }
  if (!bmadOutputExists) {
    throw new OrchestratorError(
      `Invalid BMad project: missing '_bmad-output/' directory under '${absolutePath}'`,
      false
    );
  }
}

/**
 * Helper to scan a directory recursively for files.
 */
function scanDirectory(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(scanDirectory(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

/**
 * Scans planning_artifacts for fallback references: *architecture-spine.md or specs/*\/SPEC.md
 */
export function scanForFallbackReference(planningArtifacts: string): { prdPath: string | null; architecturePath: string | null } {
  let prdPath: string | null = null;
  let architecturePath: string | null = null;

  const files = scanDirectory(planningArtifacts);
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    if (normalized.endsWith('/prd.md')) {
      prdPath = file;
    } else if (normalized.includes('/prds/') && normalized.endsWith('.md')) {
      prdPath = file;
    }

    if (normalized.endsWith('architecture-spine.md')) {
      architecturePath = file;
    } else if (/\/specs\/[^/]+\/SPEC\.md$/i.test(normalized) || normalized.endsWith('/specs/SPEC.md')) {
      architecturePath = file;
    }
  }

  return { prdPath, architecturePath };
}

/**
 * Parses _bmad/bmm/config.yaml and resolves planning_artifacts/implementation_artifacts.
 */
export function resolveArtifactPaths(targetRepoPath: string): { planningArtifacts: string; implementationArtifacts: string } {
  const absolutePath = path.resolve(targetRepoPath);
  const configPath = path.join(absolutePath, '_bmad/bmm/config.yaml');
  if (!fs.existsSync(configPath)) {
    throw new OrchestratorError(
      `Missing BMad config file: expected '_bmad/bmm/config.yaml' under '${absolutePath}'`,
      false
    );
  }

  try {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    const parsed = parse(fileContent) as BMadConfig;

    let planningArtifacts = parsed.planning_artifacts;
    let implementationArtifacts = parsed.implementation_artifacts;

    if (!planningArtifacts) {
      throw new OrchestratorError(`Missing 'planning_artifacts' key in '${configPath}'`, false);
    }
    if (!implementationArtifacts) {
      throw new OrchestratorError(`Missing 'implementation_artifacts' key in '${configPath}'`, false);
    }

    // Replace {project-root} placeholder
    planningArtifacts = planningArtifacts.replace(/{project-root}/g, absolutePath);
    implementationArtifacts = implementationArtifacts.replace(/{project-root}/g, absolutePath);

    return {
      planningArtifacts: path.resolve(absolutePath, planningArtifacts),
      implementationArtifacts: path.resolve(absolutePath, implementationArtifacts),
    };
  } catch (error: any) {
    if (error instanceof OrchestratorError) {
      throw error;
    }
    throw new OrchestratorError(`Failed to parse or resolve BMad configuration: ${error.message}`, false);
  }
}

/**
 * Locates the PRD/architecture reference via _bmad-output/project-context.md or falls back.
 */
export function locateReferences(
  targetRepoPath: string,
  planningArtifacts: string
): { prdPath: string | null; architecturePath: string | null } {
  const absolutePath = path.resolve(targetRepoPath);
  const contextPath = path.join(absolutePath, '_bmad-output/project-context.md');
  if (!fs.existsSync(contextPath)) {
    return scanForFallbackReference(planningArtifacts);
  }

  try {
    const content = fs.readFileSync(contextPath, 'utf8');
    const sectionHeader = /##\s+Reference\s+Documents/i;
    const match = content.match(sectionHeader);
    
    if (!match || match.index === undefined) {
      return scanForFallbackReference(planningArtifacts);
    }

    const startIdx = match.index + match[0].length;
    const remainingContent = content.slice(startIdx);
    const nextHeaderMatch = remainingContent.match(/\n##\s+/);
    const sectionContent = nextHeaderMatch && nextHeaderMatch.index !== undefined
      ? remainingContent.slice(0, nextHeaderMatch.index)
      : remainingContent;

    const paths: string[] = [];
    const backtickRegex = /`([^`]+)`/g;
    let m;
    while ((m = backtickRegex.exec(sectionContent)) !== null) {
      paths.push(m[1].trim());
    }

    const linkRegex = /\(([^)]+\.md)\)/g;
    while ((m = linkRegex.exec(sectionContent)) !== null) {
      paths.push(m[1].trim());
    }

    let prdPath: string | null = null;
    let architecturePath: string | null = null;

    for (const relativePath of paths) {
      const fullPath = path.resolve(absolutePath, relativePath);
      if (fs.existsSync(fullPath)) {
        const lower = relativePath.toLowerCase();
        if (lower.endsWith('prd.md')) {
          prdPath = fullPath;
        } else if (lower.endsWith('architecture-spine.md') || lower.includes('architecture')) {
          architecturePath = fullPath;
        }
      }
    }

    // If any are missing, try fallback scan to fill the gaps
    if (!prdPath || !architecturePath) {
      const fallbacks = scanForFallbackReference(planningArtifacts);
      if (!prdPath) prdPath = fallbacks.prdPath;
      if (!architecturePath) architecturePath = fallbacks.architecturePath;
    }

    return { prdPath, architecturePath };
  } catch {
    // Fallback on error to ensure robust lookup
    return scanForFallbackReference(planningArtifacts);
  }
}

/**
 * Resolves the BMad project, returning validated absolute paths for all core artifacts.
 */
export function resolveBMadProject(targetRepoPath: string): BMadProject {
  const absolutePath = path.resolve(targetRepoPath);
  
  validateTargetRepo(absolutePath);
  
  const { planningArtifacts, implementationArtifacts } = resolveArtifactPaths(absolutePath);
  const { prdPath, architecturePath } = locateReferences(absolutePath, planningArtifacts);

  return {
    targetRepoPath: absolutePath,
    planningArtifacts,
    implementationArtifacts,
    prdPath,
    architecturePath,
  };
}
