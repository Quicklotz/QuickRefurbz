/**
 * Grading Service
 * Provides structured grading rubrics and assessment tools for refurbished items
 */

import { getPool, generateUUID } from '../database.js';

// ==================== TYPES ====================

export type GradeLevel = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GradingCriterion {
  code: string;
  name: string;
  description: string;
  type: 'cosmetic' | 'functional';
  weight: number; // 1-10, how much this affects overall grade
  options: Array<{
    value: number; // 0-100 score
    label: string;
    description?: string;
  }>;
}

export interface GradingRubric {
  id: string;
  category: string;
  criteria: GradingCriterion[];
  gradeThresholds: {
    A: number; // Minimum score for A
    B: number;
    C: number;
    D: number;
    // Below D threshold = F
  };
}

export interface GradingAssessment {
  id: string;
  qlid: string;
  category: string;
  cosmeticScore: number;
  functionalScore: number;
  overallScore: number;
  calculatedGrade: GradeLevel;
  finalGrade: GradeLevel;
  criteriaResults: Record<string, { score: number; notes?: string }>;
  assessedBy: string;
  assessedAt: string;
}

export interface AssessmentInput {
  qlid: string;
  category: string;
  criteriaResults: Record<string, { score: number; notes?: string }>;
  assessedBy: string;
  gradeOverride?: GradeLevel;
}

// ==================== DEFAULT RUBRICS ====================

const DEFAULT_RUBRICS: Record<string, Omit<GradingRubric, 'id'>> = {
  PHONE: {
    category: 'PHONE',
    criteria: [
      {
        code: 'SCREEN_CONDITION',
        name: 'Screen Condition',
        description: 'Check for scratches, cracks, and display issues',
        type: 'cosmetic',
        weight: 10,
        options: [
          { value: 100, label: 'Flawless', description: 'No visible marks or scratches' },
          { value: 85, label: 'Light scratches', description: 'Minor scratches visible under direct light' },
          { value: 60, label: 'Moderate scratches', description: 'Visible scratches but no cracks' },
          { value: 30, label: 'Cracked', description: 'Hairline cracks or chips' },
          { value: 0, label: 'Broken', description: 'Significant damage affecting use' }
        ]
      },
      {
        code: 'BODY_CONDITION',
        name: 'Body/Housing Condition',
        description: 'Check for dents, scratches, and frame damage',
        type: 'cosmetic',
        weight: 7,
        options: [
          { value: 100, label: 'Like new', description: 'No visible wear' },
          { value: 80, label: 'Minor wear', description: 'Light scratches or scuffs' },
          { value: 50, label: 'Moderate wear', description: 'Visible scratches and light dents' },
          { value: 20, label: 'Heavy wear', description: 'Significant cosmetic damage' }
        ]
      },
      {
        code: 'BATTERY_HEALTH',
        name: 'Battery Health',
        description: 'Battery capacity percentage or condition',
        type: 'functional',
        weight: 9,
        options: [
          { value: 100, label: '90%+', description: 'Excellent battery health' },
          { value: 80, label: '80-89%', description: 'Good battery health' },
          { value: 60, label: '70-79%', description: 'Acceptable battery health' },
          { value: 30, label: 'Below 70%', description: 'Battery replacement recommended' },
          { value: 0, label: 'Dead/Swollen', description: 'Battery replacement required' }
        ]
      },
      {
        code: 'POWER_CHARGING',
        name: 'Power & Charging',
        description: 'Device powers on and charges properly',
        type: 'functional',
        weight: 10,
        options: [
          { value: 100, label: 'Works perfectly', description: 'Powers on and charges normally' },
          { value: 50, label: 'Intermittent', description: 'Occasional charging issues' },
          { value: 0, label: 'Does not charge', description: 'Charging port or circuit issue' }
        ]
      },
      {
        code: 'DISPLAY_FUNCTION',
        name: 'Display Function',
        description: 'Touch responsiveness and display quality',
        type: 'functional',
        weight: 10,
        options: [
          { value: 100, label: 'Perfect', description: 'Touch works everywhere, display clear' },
          { value: 70, label: 'Minor issues', description: 'Dead pixels or touch dead zones' },
          { value: 30, label: 'Major issues', description: 'Significant touch or display problems' },
          { value: 0, label: 'Non-functional', description: 'Display or touch not working' }
        ]
      },
      {
        code: 'AUDIO',
        name: 'Audio System',
        description: 'Speakers, microphone, and audio jack',
        type: 'functional',
        weight: 6,
        options: [
          { value: 100, label: 'Works perfectly', description: 'All audio functions work' },
          { value: 70, label: 'Minor issues', description: 'Quiet speaker or mic issues' },
          { value: 0, label: 'Non-functional', description: 'Audio not working' }
        ]
      },
      {
        code: 'CAMERAS',
        name: 'Camera System',
        description: 'Front and rear camera functionality',
        type: 'functional',
        weight: 8,
        options: [
          { value: 100, label: 'Works perfectly', description: 'All cameras function properly' },
          { value: 70, label: 'Minor issues', description: 'Focus issues or one camera not working' },
          { value: 0, label: 'Non-functional', description: 'Cameras not working' }
        ]
      },
      {
        code: 'WIFI_CELLULAR',
        name: 'WiFi & Cellular',
        description: 'Wireless connectivity functions',
        type: 'functional',
        weight: 9,
        options: [
          { value: 100, label: 'Works perfectly', description: 'All wireless functions work' },
          { value: 50, label: 'Partial function', description: 'WiFi or cellular issues' },
          { value: 0, label: 'Non-functional', description: 'No wireless connectivity' }
        ]
      },
      {
        code: 'BUTTONS_PORTS',
        name: 'Buttons & Ports',
        description: 'All physical buttons and ports work',
        type: 'functional',
        weight: 5,
        options: [
          { value: 100, label: 'All work', description: 'All buttons and ports functional' },
          { value: 70, label: 'Minor issues', description: 'One button or port has issues' },
          { value: 30, label: 'Major issues', description: 'Multiple buttons/ports not working' }
        ]
      }
    ],
    gradeThresholds: {
      A: 90,
      B: 75,
      C: 60,
      D: 40
    }
  },
  LAPTOP: {
    category: 'LAPTOP',
    criteria: [
      {
        code: 'SCREEN_CONDITION',
        name: 'Screen Condition',
        description: 'Check for scratches, dead pixels, and hinge',
        type: 'cosmetic',
        weight: 9,
        options: [
          { value: 100, label: 'Flawless', description: 'Perfect display and hinge' },
          { value: 80, label: 'Light wear', description: 'Minor scratches, hinge good' },
          { value: 50, label: 'Moderate wear', description: 'Visible marks or hinge loose' },
          { value: 0, label: 'Damaged', description: 'Screen or hinge damaged' }
        ]
      },
      {
        code: 'BODY_CONDITION',
        name: 'Case & Keyboard',
        description: 'Check case, palm rest, and keyboard condition',
        type: 'cosmetic',
        weight: 7,
        options: [
          { value: 100, label: 'Like new', description: 'No visible wear' },
          { value: 80, label: 'Minor wear', description: 'Light scratches' },
          { value: 50, label: 'Moderate wear', description: 'Visible wear, key shine' },
          { value: 20, label: 'Heavy wear', description: 'Dents, missing keys' }
        ]
      },
      {
        code: 'BATTERY_HEALTH',
        name: 'Battery Health',
        description: 'Battery capacity and charging',
        type: 'functional',
        weight: 8,
        options: [
          { value: 100, label: 'Excellent', description: 'Good battery life, charges well' },
          { value: 70, label: 'Good', description: 'Acceptable battery life' },
          { value: 40, label: 'Fair', description: 'Reduced battery life' },
          { value: 0, label: 'Poor/Dead', description: 'Needs battery replacement' }
        ]
      },
      {
        code: 'POWER_CHARGING',
        name: 'Power System',
        description: 'Powers on, charges, and runs on battery',
        type: 'functional',
        weight: 10,
        options: [
          { value: 100, label: 'Perfect', description: 'All power functions work' },
          { value: 50, label: 'Issues', description: 'Charging or power issues' },
          { value: 0, label: 'Non-functional', description: 'Does not power on' }
        ]
      },
      {
        code: 'KEYBOARD_TRACKPAD',
        name: 'Input Devices',
        description: 'Keyboard and trackpad functionality',
        type: 'functional',
        weight: 9,
        options: [
          { value: 100, label: 'Perfect', description: 'All keys and trackpad work' },
          { value: 70, label: 'Minor issues', description: 'Some keys sticky or trackpad issues' },
          { value: 30, label: 'Major issues', description: 'Multiple keys or trackpad not working' }
        ]
      },
      {
        code: 'PORTS_CONNECTIVITY',
        name: 'Ports & Connectivity',
        description: 'All ports and wireless work',
        type: 'functional',
        weight: 7,
        options: [
          { value: 100, label: 'All work', description: 'All ports and WiFi/BT work' },
          { value: 70, label: 'Minor issues', description: 'One port or connectivity issue' },
          { value: 0, label: 'Major issues', description: 'Multiple non-working ports' }
        ]
      },
      {
        code: 'DISPLAY_FUNCTION',
        name: 'Display Quality',
        description: 'Screen brightness, colors, and backlight',
        type: 'functional',
        weight: 8,
        options: [
          { value: 100, label: 'Perfect', description: 'Bright, even backlight, good colors' },
          { value: 70, label: 'Minor issues', description: 'Light bleed or dimming' },
          { value: 0, label: 'Major issues', description: 'Backlight failure or lines' }
        ]
      }
    ],
    gradeThresholds: {
      A: 90,
      B: 75,
      C: 60,
      D: 40
    }
  },
  TABLET: {
    category: 'TABLET',
    criteria: [
      {
        code: 'SCREEN_CONDITION',
        name: 'Screen Condition',
        description: 'Check for scratches, cracks, and display issues',
        type: 'cosmetic',
        weight: 10,
        options: [
          { value: 100, label: 'Flawless', description: 'No visible marks' },
          { value: 80, label: 'Light scratches', description: 'Minor marks' },
          { value: 50, label: 'Moderate', description: 'Visible scratches' },
          { value: 0, label: 'Cracked', description: 'Screen damaged' }
        ]
      },
      {
        code: 'BODY_CONDITION',
        name: 'Body Condition',
        description: 'Check case and frame',
        type: 'cosmetic',
        weight: 6,
        options: [
          { value: 100, label: 'Like new', description: 'No wear' },
          { value: 70, label: 'Minor wear', description: 'Light scratches' },
          { value: 30, label: 'Heavy wear', description: 'Dents or damage' }
        ]
      },
      {
        code: 'BATTERY_HEALTH',
        name: 'Battery Health',
        description: 'Battery capacity',
        type: 'functional',
        weight: 9,
        options: [
          { value: 100, label: 'Excellent', description: '80%+ capacity' },
          { value: 60, label: 'Good', description: '60-80% capacity' },
          { value: 0, label: 'Poor', description: 'Below 60%' }
        ]
      },
      {
        code: 'DISPLAY_FUNCTION',
        name: 'Touch & Display',
        description: 'Touch response and display quality',
        type: 'functional',
        weight: 10,
        options: [
          { value: 100, label: 'Perfect', description: 'Touch works everywhere' },
          { value: 50, label: 'Issues', description: 'Dead zones or issues' },
          { value: 0, label: 'Non-functional', description: 'Touch not working' }
        ]
      },
      {
        code: 'CONNECTIVITY',
        name: 'WiFi & Cellular',
        description: 'Wireless functions',
        type: 'functional',
        weight: 8,
        options: [
          { value: 100, label: 'Works', description: 'All connectivity works' },
          { value: 50, label: 'Partial', description: 'Some issues' },
          { value: 0, label: 'Non-functional', description: 'Not working' }
        ]
      }
    ],
    gradeThresholds: {
      A: 90,
      B: 75,
      C: 60,
      D: 40
    }
  },
  OTHER: {
    category: 'OTHER',
    criteria: [
      {
        code: 'COSMETIC',
        name: 'Cosmetic Condition',
        description: 'Overall appearance',
        type: 'cosmetic',
        weight: 5,
        options: [
          { value: 100, label: 'Like new', description: 'No visible wear' },
          { value: 70, label: 'Good', description: 'Minor wear' },
          { value: 40, label: 'Fair', description: 'Moderate wear' },
          { value: 0, label: 'Poor', description: 'Heavy wear' }
        ]
      },
      {
        code: 'FUNCTIONAL',
        name: 'Functionality',
        description: 'All features work',
        type: 'functional',
        weight: 10,
        options: [
          { value: 100, label: 'Fully functional', description: 'Everything works' },
          { value: 70, label: 'Minor issues', description: 'Some features have issues' },
          { value: 30, label: 'Major issues', description: 'Significant problems' },
          { value: 0, label: 'Non-functional', description: 'Does not work' }
        ]
      }
    ],
    gradeThresholds: {
      A: 90,
      B: 75,
      C: 60,
      D: 40
    }
  }
};

// ==================== HELPER FUNCTIONS ====================

function calculateGrade(score: number, thresholds: GradingRubric['gradeThresholds']): GradeLevel {
  if (score >= thresholds.A) return 'A';
  if (score >= thresholds.B) return 'B';
  if (score >= thresholds.C) return 'C';
  if (score >= thresholds.D) return 'D';
  return 'F';
}

// ==================== PUBLIC API ====================

/**
 * Get grading rubric for a category
 */
export async function getRubric(category: string): Promise<GradingRubric | null> {
  const db = getPool();

  // Check database first
  const result = await db.query<{
    id: string;
    category: string;
    criteria: string;
    grade_thresholds: string;
  }>(`
    SELECT * FROM grading_rubrics WHERE category = $1
  `, [category]);

  if (result.rows.length > 0) {
    const row = result.rows[0];
    return {
      id: row.id,
      category: row.category,
      criteria: JSON.parse(row.criteria),
      gradeThresholds: JSON.parse(row.grade_thresholds)
    };
  }

  // Fall back to default rubric
  const defaultRubric = DEFAULT_RUBRICS[category] || DEFAULT_RUBRICS.OTHER;
  return {
    id: `default-${category}`,
    ...defaultRubric,
    category
  };
}

/**
 * Get all available rubrics
 */
export async function getAllRubrics(): Promise<GradingRubric[]> {
  const categories = ['PHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'TV', 'MONITOR', 'AUDIO', 'GAMING', 'WEARABLE', 'APPLIANCE', 'OTHER'];
  const rubrics: GradingRubric[] = [];

  for (const category of categories) {
    const rubric = await getRubric(category);
    if (rubric) rubrics.push(rubric);
  }

  return rubrics;
}

/**
 * Save a custom rubric
 */
export async function saveRubric(rubric: Omit<GradingRubric, 'id'>): Promise<GradingRubric> {
  const db = getPool();
  const id = generateUUID();

  await db.query(`
    INSERT INTO grading_rubrics (id, category, criteria, grade_thresholds)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (category) DO UPDATE SET
      criteria = EXCLUDED.criteria,
      grade_thresholds = EXCLUDED.grade_thresholds,
      updated_at = CURRENT_TIMESTAMP
  `, [
    id,
    rubric.category,
    JSON.stringify(rubric.criteria),
    JSON.stringify(rubric.gradeThresholds)
  ]);

  return { id, ...rubric };
}

/**
 * Create a grading assessment for an item
 */
export async function createAssessment(input: AssessmentInput): Promise<GradingAssessment> {
  const db = getPool();
  const id = generateUUID();

  // Get rubric for category
  const rubric = await getRubric(input.category);
  if (!rubric) {
    throw new Error(`No rubric found for category: ${input.category}`);
  }

  // Calculate scores
  let cosmeticTotal = 0;
  let cosmeticWeight = 0;
  let functionalTotal = 0;
  let functionalWeight = 0;

  for (const criterion of rubric.criteria) {
    const result = input.criteriaResults[criterion.code];
    if (result) {
      if (criterion.type === 'cosmetic') {
        cosmeticTotal += result.score * criterion.weight;
        cosmeticWeight += criterion.weight;
      } else {
        functionalTotal += result.score * criterion.weight;
        functionalWeight += criterion.weight;
      }
    }
  }

  const cosmeticScore = cosmeticWeight > 0 ? Math.round(cosmeticTotal / cosmeticWeight) : 100;
  const functionalScore = functionalWeight > 0 ? Math.round(functionalTotal / functionalWeight) : 100;

  // Overall score weighted 40% cosmetic, 60% functional
  const overallScore = Math.round(cosmeticScore * 0.4 + functionalScore * 0.6);
  const calculatedGrade = calculateGrade(overallScore, rubric.gradeThresholds);
  const finalGrade = input.gradeOverride || calculatedGrade;

  await db.query(`
    INSERT INTO grading_assessments (
      id, qlid, category, cosmetic_score, functional_score,
      overall_score, calculated_grade, final_grade, criteria_results, assessed_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    id,
    input.qlid,
    input.category,
    cosmeticScore,
    functionalScore,
    overallScore,
    calculatedGrade,
    finalGrade,
    JSON.stringify(input.criteriaResults),
    input.assessedBy
  ]);

  // Update the refurb_items table with the grade
  await db.query(`
    UPDATE refurb_items SET final_grade = $1 WHERE qlid = $2
  `, [finalGrade, input.qlid]);

  return {
    id,
    qlid: input.qlid,
    category: input.category,
    cosmeticScore,
    functionalScore,
    overallScore,
    calculatedGrade,
    finalGrade,
    criteriaResults: input.criteriaResults,
    assessedBy: input.assessedBy,
    assessedAt: new Date().toISOString()
  };
}

/**
 * Get assessment for an item
 */
export async function getAssessment(qlid: string): Promise<GradingAssessment | null> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    qlid: string;
    category: string;
    cosmetic_score: number;
    functional_score: number;
    overall_score: number;
    calculated_grade: string;
    final_grade: string;
    criteria_results: string;
    assessed_by: string;
    assessed_at: string;
  }>(`
    SELECT * FROM grading_assessments WHERE qlid = $1 ORDER BY assessed_at DESC LIMIT 1
  `, [qlid]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    qlid: row.qlid,
    category: row.category,
    cosmeticScore: row.cosmetic_score,
    functionalScore: row.functional_score,
    overallScore: row.overall_score,
    calculatedGrade: row.calculated_grade as GradeLevel,
    finalGrade: row.final_grade as GradeLevel,
    criteriaResults: JSON.parse(row.criteria_results),
    assessedBy: row.assessed_by,
    assessedAt: row.assessed_at
  };
}

/**
 * Get all assessments for an item (history)
 */
export async function getAssessmentHistory(qlid: string): Promise<GradingAssessment[]> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    qlid: string;
    category: string;
    cosmetic_score: number;
    functional_score: number;
    overall_score: number;
    calculated_grade: string;
    final_grade: string;
    criteria_results: string;
    assessed_by: string;
    assessed_at: string;
  }>(`
    SELECT * FROM grading_assessments WHERE qlid = $1 ORDER BY assessed_at DESC
  `, [qlid]);

  return result.rows.map(row => ({
    id: row.id,
    qlid: row.qlid,
    category: row.category,
    cosmeticScore: row.cosmetic_score,
    functionalScore: row.functional_score,
    overallScore: row.overall_score,
    calculatedGrade: row.calculated_grade as GradeLevel,
    finalGrade: row.final_grade as GradeLevel,
    criteriaResults: JSON.parse(row.criteria_results),
    assessedBy: row.assessed_by,
    assessedAt: row.assessed_at
  }));
}

/**
 * Get grade distribution stats
 */
export async function getGradeStats(): Promise<{
  total: number;
  byGrade: Record<GradeLevel, number>;
  byCategory: Record<string, Record<GradeLevel, number>>;
  averageScore: number;
}> {
  const db = getPool();

  const totalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM grading_assessments`
  );

  const gradeResult = await db.query<{ final_grade: string; count: string }>(
    `SELECT final_grade, COUNT(*) as count FROM grading_assessments GROUP BY final_grade`
  );

  const categoryResult = await db.query<{ category: string; final_grade: string; count: string }>(
    `SELECT category, final_grade, COUNT(*) as count FROM grading_assessments GROUP BY category, final_grade`
  );

  const avgResult = await db.query<{ avg: string }>(
    `SELECT AVG(overall_score) as avg FROM grading_assessments`
  );

  const byGrade: Record<GradeLevel, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const row of gradeResult.rows) {
    byGrade[row.final_grade as GradeLevel] = parseInt(row.count);
  }

  const byCategory: Record<string, Record<GradeLevel, number>> = {};
  for (const row of categoryResult.rows) {
    if (!byCategory[row.category]) {
      byCategory[row.category] = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    }
    byCategory[row.category][row.final_grade as GradeLevel] = parseInt(row.count);
  }

  return {
    total: parseInt(totalResult.rows[0].count),
    byGrade,
    byCategory,
    averageScore: parseFloat(avgResult.rows[0].avg || '0')
  };
}
