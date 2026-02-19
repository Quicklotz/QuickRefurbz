import * as manifestLookup from './manifestLookupService.js';
import type { ProductLookupResult } from './manifestLookupService.js';
import OpenAI from 'openai';

const MODEL = 'gpt-4o';

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-placeholder')) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  return new OpenAI({ apiKey });
}

export interface PhotoIdentificationResult {
  brand?: string;
  model?: string;
  upc?: string;
  serialNumber?: string;
  category?: string;
  condition?: string;
  confidence: number;
  rawResponse: string;
}

// Method A: Barcode scan -> cascading DB lookup
export async function identifyByBarcode(barcode: string): Promise<ProductLookupResult> {
  return manifestLookup.lookupByBarcode(barcode);
}

// Method B: Manual text search -> product autocomplete
export async function identifyBySearch(query: string): Promise<ProductLookupResult[]> {
  return manifestLookup.searchProducts(query);
}

// Method C: Label photo -> AI reads label text
export async function identifyFromLabelPhoto(buffer: Buffer, mimeType: string): Promise<PhotoIdentificationResult> {
  const client = getOpenAIClient();
  const base64 = buffer.toString('base64');

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert at reading product labels, stickers, and tags on electronics.
Extract all identifiable information from this label photo.

Respond ONLY with valid JSON:
{
  "brand": "<manufacturer/brand name>",
  "model": "<model number or name>",
  "upc": "<UPC/EAN barcode number if visible>",
  "serialNumber": "<serial number if visible>",
  "category": "<PHONE|TABLET|LAPTOP|DESKTOP|TV|MONITOR|AUDIO|APPLIANCE_SMALL|APPLIANCE_LARGE|GAMING|VACUUM|WEARABLE|OTHER>",
  "condition": "<any condition notes visible>",
  "confidence": <0-100>
}

Only include fields you can actually read from the label. Use null for fields not visible.`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this product label and extract all information:' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } }
        ]
      }
    ],
    max_tokens: 500,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    brand: parsed.brand || undefined,
    model: parsed.model || undefined,
    upc: parsed.upc || undefined,
    serialNumber: parsed.serialNumber || undefined,
    category: parsed.category || undefined,
    condition: parsed.condition || undefined,
    confidence: parsed.confidence || 50,
    rawResponse: content,
  };
}

// Method D: Product photo -> AI identifies the product
export async function identifyFromProductPhoto(buffer: Buffer, mimeType: string): Promise<PhotoIdentificationResult> {
  const client = getOpenAIClient();
  const base64 = buffer.toString('base64');

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert at identifying consumer electronics from photos.
Identify the product shown in the image.

Respond ONLY with valid JSON:
{
  "brand": "<manufacturer/brand>",
  "model": "<specific model name or number>",
  "category": "<PHONE|TABLET|LAPTOP|DESKTOP|TV|MONITOR|AUDIO|APPLIANCE_SMALL|APPLIANCE_LARGE|GAMING|VACUUM|WEARABLE|OTHER>",
  "condition": "<visual condition assessment>",
  "confidence": <0-100>
}

Be specific with the model if you can identify it. If unsure, provide your best guess with a lower confidence score.`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Identify this electronic product:' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } }
        ]
      }
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    brand: parsed.brand || undefined,
    model: parsed.model || undefined,
    category: parsed.category || undefined,
    condition: parsed.condition || undefined,
    confidence: parsed.confidence || 50,
    rawResponse: content,
  };
}
