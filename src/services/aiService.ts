/**
 * AI Service - OpenAI GPT-4o Vision Integration
 *
 * Features:
 * 1. Auto-grading from photos — analyzes device images to suggest condition grade
 * 2. Smart product descriptions — generates marketplace-ready descriptions
 * 3. Item identification — identifies device from photo/UPC
 */

import OpenAI from 'openai';
import { getPool } from '@quickwms/database';
import * as photoService from './photoService.js';
import * as gradingService from './gradingService.js';
import type { ProductCategory, FinalGrade, RefurbItem } from '../types.js';

// ==================== CONFIGURATION ====================

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith('sk-placeholder')) {
      throw new Error('OPENAI_API_KEY not configured. Set a valid key in .env');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

const MODEL = 'gpt-4o';
const MAX_PHOTOS_PER_REQUEST = 6;

// ==================== TYPES ====================

export interface AIGradeResult {
  suggestedGrade: FinalGrade;
  confidence: number; // 0-100
  cosmeticScore: number; // 0-100
  functionalNotes: string;
  defectsFound: AIDefect[];
  reasoning: string;
  modelUsed: string;
}

export interface AIDefect {
  type: string; // SCRATCH, DENT, CRACK, DISCOLORATION, MISSING_PART, etc.
  severity: 'COSMETIC' | 'MINOR' | 'MAJOR' | 'CRITICAL';
  location: string;
  description: string;
}

export interface AIDescriptionResult {
  title: string;
  shortDescription: string; // 1-2 sentences
  fullDescription: string; // Full marketplace listing
  bulletPoints: string[];
  keywords: string[];
  suggestedPrice?: { low: number; mid: number; high: number };
  modelUsed: string;
}

export interface AIIdentifyResult {
  manufacturer: string;
  model: string;
  category: ProductCategory;
  confidence: number;
  alternativeMatches: { manufacturer: string; model: string; confidence: number }[];
  specifications: Record<string, string>;
  modelUsed: string;
}

// ==================== PHOTO HELPERS ====================

async function getPhotoBase64(qlid: string, maxPhotos: number = MAX_PHOTOS_PER_REQUEST): Promise<{
  images: { base64: string; mimeType: string; caption?: string }[];
  photoCount: number;
}> {
  const photos = await photoService.getPhotosForItem(qlid);
  if (!photos || photos.length === 0) {
    throw new Error(`No photos found for item ${qlid}`);
  }

  // Prioritize: FINAL > INTAKE > DEFECT > others
  const priorityOrder = ['FINAL', 'INTAKE', 'DEFECT', 'SERIAL', 'REPAIR', 'BEFORE', 'AFTER'];
  const sorted = [...photos].sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.photoType || '');
    const bIdx = priorityOrder.indexOf(b.photoType || '');
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  const selected = sorted.slice(0, maxPhotos);
  const images: { base64: string; mimeType: string; caption?: string }[] = [];

  for (const photo of selected) {
    try {
      const file = await photoService.getPhotoFile(photo.id);
      if (file) {
        images.push({
          base64: file.buffer.toString('base64'),
          mimeType: file.mimeType || 'image/jpeg',
          caption: photo.caption || `${photo.photoType} photo`,
        });
      }
    } catch {
      // Skip unreadable photos
    }
  }

  if (images.length === 0) {
    throw new Error(`Could not read any photo files for item ${qlid}`);
  }

  return { images, photoCount: photos.length };
}

function buildImageMessages(images: { base64: string; mimeType: string; caption?: string }[]): OpenAI.ChatCompletionContentPart[] {
  const parts: OpenAI.ChatCompletionContentPart[] = [];
  for (const img of images) {
    if (img.caption) {
      parts.push({ type: 'text', text: `[${img.caption}]` });
    }
    parts.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: 'high',
      },
    });
  }
  return parts;
}

// ==================== 1. AUTO-GRADE FROM PHOTOS ====================

export async function gradeFromPhotos(
  qlid: string,
  category: ProductCategory,
  existingNotes?: string
): Promise<AIGradeResult> {
  const client = getClient();
  const { images, photoCount } = await getPhotoBase64(qlid);

  const systemPrompt = `You are an expert electronics refurbishment grader for a liquidation electronics company. You assess the cosmetic condition of devices from photos.

GRADING SCALE:
- A (Like New): No visible wear. Looks brand new. Score 90-100.
- B (Excellent): Minor signs of use. Light scratches only visible at certain angles. Score 75-89.
- C (Good): Visible wear marks, light scratches, minor scuffs. Fully functional appearance. Score 60-74.
- D (Fair): Noticeable cosmetic damage — scratches, dents, discoloration. Still functional. Score 40-59.
- F (Poor): Significant damage — cracked screen, deep dents, heavy wear. May not be fully functional. Score 0-39.

CATEGORY-SPECIFIC GUIDANCE for ${category}:
${getCategoryGuidance(category)}

Respond ONLY with valid JSON matching this schema:
{
  "suggestedGrade": "A"|"B"|"C"|"D"|"F",
  "confidence": <0-100>,
  "cosmeticScore": <0-100>,
  "functionalNotes": "<observations about apparent functionality>",
  "defectsFound": [
    {
      "type": "<SCRATCH|DENT|CRACK|DISCOLORATION|SCUFF|MISSING_PART|STICKER_RESIDUE|WEAR|OTHER>",
      "severity": "<COSMETIC|MINOR|MAJOR|CRITICAL>",
      "location": "<where on device>",
      "description": "<brief description>"
    }
  ],
  "reasoning": "<1-2 sentence explanation of grade>"
}`;

  const userContent: OpenAI.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: `Grade this ${category} device from ${photoCount} photos (showing ${images.length}).${existingNotes ? ` Technician notes: "${existingNotes}"` : ''}`
    },
    ...buildImageMessages(images),
  ];

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 1000,
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI model');

  const parsed = JSON.parse(cleanJsonResponse(content)) as AIGradeResult;
  parsed.modelUsed = MODEL;

  // Log the AI assessment
  await logAIAction(qlid, 'grade', parsed);

  return parsed;
}

// ==================== 2. SMART PRODUCT DESCRIPTIONS ====================

export async function generateDescription(
  qlid: string,
  item: RefurbItem,
  grade?: FinalGrade
): Promise<AIDescriptionResult> {
  const client = getClient();

  // Get photos if available
  let imageMessages: OpenAI.ChatCompletionContentPart[] = [];
  try {
    const { images } = await getPhotoBase64(qlid, 3);
    imageMessages = buildImageMessages(images);
  } catch {
    // Proceed without photos
  }

  // Get grading assessment if exists
  let gradingInfo = '';
  try {
    const assessment = await gradingService.getAssessment(qlid);
    if (assessment) {
      gradingInfo = `\nGrading assessment: Overall score ${assessment.overallScore}/100, Cosmetic: ${assessment.cosmeticScore}/100, Functional: ${assessment.functionalScore}/100`;
    }
  } catch {
    // Skip
  }

  const effectiveGrade = grade || item.finalGrade || 'C';

  const systemPrompt = `You are a professional marketplace listing writer for refurbished electronics. Write compelling, accurate product descriptions that build buyer confidence.

RULES:
- Be honest about condition — never overstate
- Highlight value proposition (refurbished = savings)
- Include relevant specs when known
- Use SEO-friendly keywords naturally
- Keep tone professional but approachable
- Mention testing/certification if grade is B or better

Respond ONLY with valid JSON:
{
  "title": "<marketplace listing title, max 80 chars>",
  "shortDescription": "<1-2 sentence summary>",
  "fullDescription": "<3-5 paragraph marketplace description with condition details>",
  "bulletPoints": ["<5-8 key selling points>"],
  "keywords": ["<8-12 SEO keywords>"],
  "suggestedPrice": { "low": <number>, "mid": <number>, "high": <number> }
}

If you cannot determine a reasonable price range, omit suggestedPrice.`;

  const itemDetails = `
Manufacturer: ${item.manufacturer || 'Unknown'}
Model: ${item.model || 'Unknown'}
Category: ${item.category}
Condition Grade: ${effectiveGrade} (${gradeDescription(effectiveGrade)})
Serial Number: ${item.serialNumber ? 'Present' : 'Not recorded'}
UPC: ${item.upc || 'N/A'}
${item.conditionNotes ? `Condition Notes: ${item.conditionNotes}` : ''}
${gradingInfo}`.trim();

  const userContent: OpenAI.ChatCompletionContentPart[] = [
    { type: 'text', text: `Write a marketplace listing for this refurbished item:\n\n${itemDetails}` },
    ...imageMessages,
  ];

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 1500,
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI model');

  const parsed = JSON.parse(cleanJsonResponse(content)) as AIDescriptionResult;
  parsed.modelUsed = MODEL;

  await logAIAction(qlid, 'describe', parsed);

  return parsed;
}

// ==================== 3. ITEM IDENTIFICATION ====================

export async function identifyItem(
  qlid: string,
  upc?: string
): Promise<AIIdentifyResult> {
  const client = getClient();
  const { images } = await getPhotoBase64(qlid, 4);

  const systemPrompt = `You are an expert at identifying consumer electronics from photos. Identify the manufacturer, model, and category of the device shown.

CATEGORIES (pick one):
PHONE, TABLET, LAPTOP, DESKTOP, TV, MONITOR, AUDIO, APPLIANCE_SMALL, APPLIANCE_LARGE, ICE_MAKER, VACUUM, GAMING, WEARABLE, OTHER

Respond ONLY with valid JSON:
{
  "manufacturer": "<brand name>",
  "model": "<specific model name/number>",
  "category": "<from categories above>",
  "confidence": <0-100>,
  "alternativeMatches": [
    { "manufacturer": "<brand>", "model": "<model>", "confidence": <0-100> }
  ],
  "specifications": {
    "<key>": "<value>"
  }
}

For specifications, include any you can determine from the photos: storage, RAM, screen size, color, year, etc. Only include specs you are reasonably confident about.`;

  const userContent: OpenAI.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: `Identify this electronic device.${upc ? ` UPC barcode: ${upc}` : ''}`
    },
    ...buildImageMessages(images),
  ];

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 1000,
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI model');

  const parsed = JSON.parse(cleanJsonResponse(content)) as AIIdentifyResult;
  parsed.modelUsed = MODEL;

  await logAIAction(qlid, 'identify', parsed);

  return parsed;
}

// ==================== HELPERS ====================

function getCategoryGuidance(category: ProductCategory): string {
  const guides: Partial<Record<ProductCategory, string>> = {
    PHONE: 'Check screen for cracks/scratches, frame/body dents, camera lens condition, port wear, button responsiveness appearance.',
    TABLET: 'Check screen for cracks/scratches, bezels for chips, back panel condition, charging port area, smart connector condition.',
    LAPTOP: 'Check screen (dead pixels visible in photos?), keyboard wear, trackpad condition, hinge tightness appearance, chassis dents/scratches, port condition.',
    TV: 'Check screen for cracks/lines/spots, bezel condition, stand/mount points, back panel condition.',
    MONITOR: 'Check panel for visible defects, bezel scratches, stand condition, port area.',
    AUDIO: 'Check speaker grills, enclosure condition, button/knob wear, cable/port condition.',
    GAMING: 'Check controller ports, disc drive area, ventilation grills, cosmetic scratches, included accessories visible.',
    VACUUM: 'Check body scratches/cracks, brush roll condition, filter area, wheels/casters, bin/canister condition.',
    WEARABLE: 'Check screen for scratches, band/strap condition, sensor area, button condition, charging contacts.',
  };
  return guides[category] || 'Assess overall cosmetic condition — scratches, dents, cracks, discoloration, missing parts, wear marks.';
}

function gradeDescription(grade: FinalGrade | string): string {
  const descriptions: Record<string, string> = {
    A: 'Like New — no visible wear',
    B: 'Excellent — minor signs of use',
    C: 'Good — visible wear, fully functional',
    D: 'Fair — noticeable damage, functional',
    F: 'Poor — significant damage',
    SALVAGE: 'Parts only',
  };
  return descriptions[grade] || 'Unknown condition';
}

function cleanJsonResponse(text: string): string {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

async function logAIAction(qlid: string, action: string, result: unknown): Promise<void> {
  try {
    const db = getPool();
    await db.query(
      `INSERT INTO ai_actions (id, qlid, action, result, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [qlid, action, JSON.stringify(result)]
    );
  } catch {
    // Non-critical — log failure shouldn't break the AI response
  }
}

// ==================== STATUS CHECK ====================

export function isConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !key.startsWith('sk-placeholder');
}
