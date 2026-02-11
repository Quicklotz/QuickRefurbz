/**
 * Hardware Diagnostics - Test Plan Loader
 * Loads JSON test plans from the plans/ directory
 */

import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { HardwareTestPlan } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve plans directory - check source first, then dist
function resolvePlansDir(): string {
  // When running from dist/, plans are in src/hardware-diag/plans/
  const srcPlans = path.resolve(__dirname, '..', '..', '..', 'src', 'hardware-diag', 'plans');
  if (existsSync(srcPlans)) return srcPlans;

  // When running from src/ directly (tsx dev mode)
  const localPlans = path.join(__dirname, '..', 'plans');
  if (existsSync(localPlans)) return localPlans;

  return localPlans; // Fallback
}

const PLANS_DIR = resolvePlansDir();

// Cache loaded plans
const planCache = new Map<string, HardwareTestPlan>();

export class TestPlanLoader {
  private plansDir: string;

  constructor(plansDir?: string) {
    this.plansDir = plansDir || PLANS_DIR;
  }

  /**
   * Load a test plan by category slug
   * e.g. 'appliance-small', 'vacuum', 'ice-maker'
   */
  async loadPlan(slug: string): Promise<HardwareTestPlan> {
    if (planCache.has(slug)) {
      return planCache.get(slug)!;
    }

    const filePath = path.join(this.plansDir, `${slug}.json`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const plan: HardwareTestPlan = JSON.parse(content);
      planCache.set(slug, plan);
      return plan;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new Error(`Test plan not found: ${slug} (looked in ${filePath})`);
      }
      throw new Error(`Failed to load test plan ${slug}: ${err.message}`);
    }
  }

  /**
   * Load plan by category enum value
   * Maps ProductCategory to file slug
   */
  async loadPlanByCategory(category: string): Promise<HardwareTestPlan> {
    const slug = categoryToSlug(category);
    return this.loadPlan(slug);
  }

  /**
   * List all available test plans
   */
  async listPlans(): Promise<Array<{
    slug: string;
    name: string;
    category: string;
    stepCount: number;
    estimatedMinutes: number;
  }>> {
    const files = await readdir(this.plansDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const plans = [];
    for (const file of jsonFiles) {
      const slug = file.replace('.json', '');
      try {
        const plan = await this.loadPlan(slug);
        plans.push({
          slug,
          name: plan.name,
          category: plan.category,
          stepCount: plan.steps.length,
          estimatedMinutes: plan.estimatedMinutes,
        });
      } catch {
        // Skip invalid plans
      }
    }

    return plans;
  }

  /**
   * Get plan details formatted for display
   */
  async getPlanDetails(slug: string): Promise<string> {
    const plan = await this.loadPlan(slug);

    const lines: string[] = [
      `Plan: ${plan.name}`,
      `Category: ${plan.category}`,
      `Version: ${plan.version}`,
      `Description: ${plan.description}`,
      `Estimated Time: ${plan.estimatedMinutes} minutes`,
      `Required Instruments: ${plan.requiredInstruments.join(', ')}`,
      '',
      `Steps (${plan.steps.length}):`,
    ];

    if (plan.safetyWarnings && plan.safetyWarnings.length > 0) {
      lines.push('');
      lines.push('Safety Warnings:');
      for (const warning of plan.safetyWarnings) {
        lines.push(`  ! ${warning}`);
      }
      lines.push('');
    }

    for (const step of plan.steps) {
      const critical = step.isCritical ? ' [CRITICAL]' : '';
      lines.push(
        `  ${step.stepNumber}. ${step.testCode} - ${step.name}${critical}`
      );
      lines.push(
        `     Measure: ${step.measurementType} | Expected: ${step.expectedMin}-${step.expectedMax} ${step.expectedUnit}`
      );
      if (step.scpiCommand) {
        lines.push(`     SCPI: ${step.scpiCommand}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Clear plan cache
   */
  clearCache(): void {
    planCache.clear();
  }
}

/**
 * Map ProductCategory enum to file slug
 */
function categoryToSlug(category: string): string {
  const map: Record<string, string> = {
    APPLIANCE_SMALL: 'appliance-small',
    VACUUM: 'vacuum',
    ICE_MAKER: 'ice-maker',
    PHONE: 'phone',
    LAPTOP: 'laptop',
    TABLET: 'tablet',
  };

  return map[category] || category.toLowerCase().replace(/_/g, '-');
}
