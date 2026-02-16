/**
 * Photo Service
 * Handles photo uploads, storage, and retrieval for refurbishment items
 * Supports local filesystem storage with optional S3/R2 integration
 */

import { getPool, generateUUID } from '../database.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';

// ==================== TYPES ====================

export type PhotoStage = 'INTAKE' | 'TESTING' | 'REPAIR' | 'CLEANING' | 'FINAL_QC' | 'COMPLETE';
export type PhotoType = 'INTAKE' | 'DEFECT' | 'REPAIR' | 'SERIAL' | 'FINAL' | 'BEFORE' | 'AFTER';

export interface ItemPhoto {
  id: string;
  qlid: string;
  stage: PhotoStage;
  photoType: PhotoType;
  filePath: string;
  thumbnailPath: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  caption: string | null;
  capturedBy: string | null;
  capturedAt: string;
}

export interface PhotoUploadInput {
  qlid: string;
  stage: PhotoStage;
  photoType: PhotoType;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  capturedBy?: string;
  caption?: string;
}

// ==================== CONFIGURATION ====================

const STORAGE_MODE = process.env.PHOTO_STORAGE_MODE || 'local';
const LOCAL_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads/photos';
const THUMBNAIL_SIZE = 200; // pixels

// S3 Configuration (for Hetzner Object Storage or any S3-compatible service)
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://fsn1.your-objectstorage.com';
const S3_BUCKET = process.env.S3_BUCKET || 'quickrefurbz-photos';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
const S3_REGION = process.env.S3_REGION || 'fsn1';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      throw new Error('S3 credentials not configured. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY env vars.');
    }
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

// ==================== STORAGE ABSTRACTION ====================

async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory already exists, ignore
  }
}

async function saveToLocal(
  buffer: Buffer,
  qlid: string,
  filename: string
): Promise<{ filePath: string; relativePath: string }> {
  const baseDir = path.resolve(LOCAL_STORAGE_PATH);
  const qlidDir = path.join(baseDir, qlid);
  await ensureDirectory(qlidDir);

  const ext = path.extname(filename) || '.jpg';
  const uniqueFilename = `${generateUUID()}${ext}`;
  const filePath = path.join(qlidDir, uniqueFilename);

  await fs.writeFile(filePath, buffer);

  return {
    filePath,
    relativePath: `${qlid}/${uniqueFilename}`
  };
}

async function deleteFromLocal(relativePath: string): Promise<void> {
  const filePath = path.join(path.resolve(LOCAL_STORAGE_PATH), relativePath);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // File doesn't exist, ignore
  }
}

async function getLocalFile(relativePath: string): Promise<Buffer> {
  const filePath = path.join(path.resolve(LOCAL_STORAGE_PATH), relativePath);
  return fs.readFile(filePath);
}

async function saveToS3(
  buffer: Buffer,
  qlid: string,
  filename: string,
  mimeType: string
): Promise<{ filePath: string; relativePath: string }> {
  const ext = path.extname(filename) || '.jpg';
  const uniqueFilename = `${generateUUID()}${ext}`;
  const key = `photos/${qlid}/${uniqueFilename}`;

  const client = getS3Client();
  await client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));

  return {
    filePath: key,
    relativePath: key,
  };
}

async function deleteFromS3(key: string): Promise<void> {
  try {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
  } catch (error) {
    // File doesn't exist, ignore
  }
}

async function getS3File(key: string): Promise<Buffer> {
  const client = getS3Client();
  const response = await client.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }));

  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ==================== DATABASE OPERATIONS ====================

async function insertPhotoRecord(photo: Omit<ItemPhoto, 'id' | 'capturedAt'>): Promise<ItemPhoto> {
  const db = getPool();
  const id = generateUUID();

  await db.query(`
    INSERT INTO item_photos (
      id, qlid, stage, photo_type, file_path, thumbnail_path,
      original_filename, mime_type, file_size, caption, captured_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    id,
    photo.qlid,
    photo.stage,
    photo.photoType,
    photo.filePath,
    photo.thumbnailPath,
    photo.originalFilename,
    photo.mimeType,
    photo.fileSize,
    photo.caption,
    photo.capturedBy
  ]);

  const result = await db.query<{
    id: string;
    qlid: string;
    stage: string;
    photo_type: string;
    file_path: string;
    thumbnail_path: string | null;
    original_filename: string | null;
    mime_type: string | null;
    file_size: number | null;
    caption: string | null;
    captured_by: string | null;
    captured_at: string;
  }>(`SELECT * FROM item_photos WHERE id = $1`, [id]);

  const row = result.rows[0];
  return {
    id: row.id,
    qlid: row.qlid,
    stage: row.stage as PhotoStage,
    photoType: row.photo_type as PhotoType,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    caption: row.caption,
    capturedBy: row.captured_by,
    capturedAt: row.captured_at
  };
}

// ==================== PUBLIC API ====================

/**
 * Upload a photo for an item
 */
export async function uploadPhoto(input: PhotoUploadInput): Promise<ItemPhoto> {
  const { qlid, stage, photoType, buffer, filename, mimeType, capturedBy, caption } = input;

  // Save to storage
  let filePath: string;
  if (STORAGE_MODE === 'local') {
    const { relativePath } = await saveToLocal(buffer, qlid, filename);
    filePath = relativePath;
  } else if (STORAGE_MODE === 's3') {
    const { relativePath } = await saveToS3(buffer, qlid, filename, mimeType);
    filePath = relativePath;
  } else {
    throw new Error(`Unsupported storage mode: ${STORAGE_MODE}`);
  }

  // Insert database record
  const photo = await insertPhotoRecord({
    qlid,
    stage,
    photoType,
    filePath,
    thumbnailPath: null, // TODO: Generate thumbnails
    originalFilename: filename,
    mimeType,
    fileSize: buffer.length,
    caption: caption || null,
    capturedBy: capturedBy || null
  });

  return photo;
}

/**
 * Get all photos for an item
 */
export async function getPhotosForItem(qlid: string): Promise<ItemPhoto[]> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    qlid: string;
    stage: string;
    photo_type: string;
    file_path: string;
    thumbnail_path: string | null;
    original_filename: string | null;
    mime_type: string | null;
    file_size: number | null;
    caption: string | null;
    captured_by: string | null;
    captured_at: string;
  }>(`
    SELECT * FROM item_photos
    WHERE qlid = $1
    ORDER BY captured_at DESC
  `, [qlid]);

  return result.rows.map(row => ({
    id: row.id,
    qlid: row.qlid,
    stage: row.stage as PhotoStage,
    photoType: row.photo_type as PhotoType,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    caption: row.caption,
    capturedBy: row.captured_by,
    capturedAt: row.captured_at
  }));
}

/**
 * Get photos for an item filtered by stage
 */
export async function getPhotosByStage(qlid: string, stage: PhotoStage): Promise<ItemPhoto[]> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    qlid: string;
    stage: string;
    photo_type: string;
    file_path: string;
    thumbnail_path: string | null;
    original_filename: string | null;
    mime_type: string | null;
    file_size: number | null;
    caption: string | null;
    captured_by: string | null;
    captured_at: string;
  }>(`
    SELECT * FROM item_photos
    WHERE qlid = $1 AND stage = $2
    ORDER BY captured_at DESC
  `, [qlid, stage]);

  return result.rows.map(row => ({
    id: row.id,
    qlid: row.qlid,
    stage: row.stage as PhotoStage,
    photoType: row.photo_type as PhotoType,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    caption: row.caption,
    capturedBy: row.captured_by,
    capturedAt: row.captured_at
  }));
}

/**
 * Get a single photo by ID
 */
export async function getPhoto(photoId: string): Promise<ItemPhoto | null> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    qlid: string;
    stage: string;
    photo_type: string;
    file_path: string;
    thumbnail_path: string | null;
    original_filename: string | null;
    mime_type: string | null;
    file_size: number | null;
    caption: string | null;
    captured_by: string | null;
    captured_at: string;
  }>(`SELECT * FROM item_photos WHERE id = $1`, [photoId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    qlid: row.qlid,
    stage: row.stage as PhotoStage,
    photoType: row.photo_type as PhotoType,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    caption: row.caption,
    capturedBy: row.captured_by,
    capturedAt: row.captured_at
  };
}

/**
 * Get photo file content
 */
export async function getPhotoFile(photoId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const photo = await getPhoto(photoId);
  if (!photo) return null;

  try {
    if (STORAGE_MODE === 'local') {
      const buffer = await getLocalFile(photo.filePath);
      return {
        buffer,
        mimeType: photo.mimeType || 'image/jpeg'
      };
    }
    if (STORAGE_MODE === 's3') {
      const buffer = await getS3File(photo.filePath);
      return { buffer, mimeType: photo.mimeType || 'image/jpeg' };
    }
    return null;
  } catch (error) {
    console.error('Error reading photo file:', error);
    return null;
  }
}

/**
 * Delete a photo
 */
export async function deletePhoto(photoId: string): Promise<boolean> {
  const db = getPool();

  // Get photo first to delete file
  const photo = await getPhoto(photoId);
  if (!photo) return false;

  // Delete file from storage
  if (STORAGE_MODE === 'local') {
    await deleteFromLocal(photo.filePath);
    if (photo.thumbnailPath) {
      await deleteFromLocal(photo.thumbnailPath);
    }
  } else if (STORAGE_MODE === 's3') {
    await deleteFromS3(photo.filePath);
    if (photo.thumbnailPath) {
      await deleteFromS3(photo.thumbnailPath);
    }
  }

  // Delete database record
  await db.query(`DELETE FROM item_photos WHERE id = $1`, [photoId]);

  return true;
}

/**
 * Update photo caption
 */
export async function updatePhotoCaption(photoId: string, caption: string): Promise<ItemPhoto | null> {
  const db = getPool();

  await db.query(`
    UPDATE item_photos SET caption = $1 WHERE id = $2
  `, [caption, photoId]);

  return getPhoto(photoId);
}

/**
 * Get photo count for an item
 */
export async function getPhotoCount(qlid: string): Promise<{
  total: number;
  byStage: Record<string, number>;
  byType: Record<string, number>;
}> {
  const db = getPool();

  const totalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM item_photos WHERE qlid = $1`,
    [qlid]
  );

  const stageResult = await db.query<{ stage: string; count: string }>(
    `SELECT stage, COUNT(*) as count FROM item_photos WHERE qlid = $1 GROUP BY stage`,
    [qlid]
  );

  const typeResult = await db.query<{ photo_type: string; count: string }>(
    `SELECT photo_type, COUNT(*) as count FROM item_photos WHERE qlid = $1 GROUP BY photo_type`,
    [qlid]
  );

  const byStage: Record<string, number> = {};
  for (const row of stageResult.rows) {
    byStage[row.stage] = parseInt(row.count);
  }

  const byType: Record<string, number> = {};
  for (const row of typeResult.rows) {
    byType[row.photo_type] = parseInt(row.count);
  }

  return {
    total: parseInt(totalResult.rows[0].count),
    byStage,
    byType
  };
}
