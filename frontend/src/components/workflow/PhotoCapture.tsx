"use client";
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Upload,
  X,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Trash2,
  ZoomIn,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Badge } from '@/components/shared/Badge';

export type PhotoStage = 'INTAKE' | 'TESTING' | 'REPAIR' | 'CLEANING' | 'FINAL_QC' | 'COMPLETE';
export type PhotoType = 'INTAKE' | 'DEFECT' | 'REPAIR' | 'SERIAL' | 'FINAL' | 'BEFORE' | 'AFTER';

interface Photo {
  id: string;
  qlid: string;
  stage: string;
  photoType: string;
  filePath: string;
  thumbnailPath: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  caption: string | null;
  capturedBy: string | null;
  capturedAt: string;
  url?: string; // Local blob URL for display
}

interface PhotoCaptureProps {
  qlid: string;
  stage: PhotoStage;
  photoType?: PhotoType;
  onPhotosUploaded?: (photos: Photo[]) => void;
  maxPhotos?: number;
  showExisting?: boolean;
  compact?: boolean;
}

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  INTAKE: 'Intake Photo',
  DEFECT: 'Defect Photo',
  REPAIR: 'Repair Photo',
  SERIAL: 'Serial/Label',
  FINAL: 'Final Photo',
  BEFORE: 'Before',
  AFTER: 'After'
};

export function PhotoCapture({
  qlid,
  stage,
  photoType = 'INTAKE',
  onPhotosUploaded,
  maxPhotos = 10,
  showExisting = true,
  compact = false
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [currentPhotoType, setCurrentPhotoType] = useState<PhotoType>(photoType);

  // Load existing photos
  useEffect(() => {
    if (showExisting && qlid) {
      loadExistingPhotos();
    }
  }, [qlid, stage, showExisting]);

  const loadExistingPhotos = async () => {
    try {
      const photos = await api.getPhotos(qlid, stage);

      // Load URLs for each photo
      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => {
          try {
            const url = await api.getPhotoUrl(photo.id);
            return { ...photo, url };
          } catch {
            return photo;
          }
        })
      );

      setExistingPhotos(photosWithUrls);
    } catch (err) {
      console.error('Failed to load existing photos:', err);
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      // Cleanup blob URLs
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [stream, previews]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setMode('camera');
      setError('');
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setMode('select');
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        setPendingFiles(prev => [...prev, file]);
        setPreviews(prev => [...prev, previewUrl]);
      }
    }, 'image/jpeg', 0.9);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = maxPhotos - pendingFiles.length - existingPhotos.length;
    const filesToAdd = files.slice(0, remainingSlots);

    const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));

    setPendingFiles(prev => [...prev, ...filesToAdd]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setMode('preview');

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePreview = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setPreviews(prev => prev.filter((_, i) => i !== index));
    setPendingFiles(prev => prev.filter((_, i) => i !== index));

    if (pendingFiles.length === 1) {
      setMode('select');
    }
  };

  const uploadPhotos = async () => {
    if (pendingFiles.length === 0) return;

    setUploading(true);
    setError('');

    try {
      const result = await api.uploadPhotos(
        qlid,
        pendingFiles,
        stage,
        currentPhotoType
      );

      // Clear pending files
      previews.forEach(url => URL.revokeObjectURL(url));
      setPendingFiles([]);
      setPreviews([]);
      setMode('select');

      // Reload existing photos
      await loadExistingPhotos();

      // Notify parent
      onPhotosUploaded?.(result.photos as unknown as Photo[]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const deleteExistingPhoto = async (photoId: string) => {
    try {
      await api.deletePhoto(photoId);
      setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
      setSelectedPhotoIndex(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete photo');
    }
  };

  const canAddMore = pendingFiles.length + existingPhotos.length < maxPhotos;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="default" size="sm">
            <ImageIcon size={12} className="mr-1" />
            {existingPhotos.length} photos
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canAddMore}
          >
            <Camera size={14} />
            Add
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Camera size={18} className="text-ql-yellow" />
          {PHOTO_TYPE_LABELS[currentPhotoType] || 'Photos'}
        </h3>
        <div className="flex items-center gap-2">
          <select
            className="bg-dark-tertiary border border-border rounded px-2 py-1 text-sm text-white"
            value={currentPhotoType}
            onChange={(e) => setCurrentPhotoType(e.target.value as PhotoType)}
          >
            {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Badge variant="default" size="sm">
            {existingPhotos.length + pendingFiles.length} / {maxPhotos}
          </Badge>
        </div>
      </div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-accent-red text-sm bg-accent-red/10 p-2 rounded"
          >
            <AlertCircle size={14} />
            {error}
            <button onClick={() => setError('')} className="ml-auto">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="bg-dark-primary border border-border rounded-lg overflow-hidden">
        {mode === 'select' && (
          <div className="p-6">
            {/* Existing photos grid */}
            {existingPhotos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-2">Existing photos</p>
                <div className="grid grid-cols-4 gap-2">
                  {existingPhotos.map((photo, index) => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative aspect-square rounded-lg overflow-hidden bg-dark-tertiary cursor-pointer group"
                      onClick={() => setSelectedPhotoIndex(index)}
                    >
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt={photo.caption || 'Photo'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={24} className="text-zinc-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn size={20} className="text-white" />
                      </div>
                      <Badge
                        variant="default"
                        size="sm"
                        className="absolute bottom-1 left-1"
                      >
                        {photo.photoType}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Add photos buttons */}
            {canAddMore ? (
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={startCamera}
                >
                  <Camera size={18} />
                  Take Photo
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Upload
                </Button>
              </div>
            ) : (
              <p className="text-center text-zinc-500 text-sm">
                Maximum photos reached ({maxPhotos})
              </p>
            )}
          </div>
        )}

        {mode === 'camera' && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full aspect-video bg-black"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button variant="ghost" onClick={stopCamera}>
                <X size={18} />
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={capturePhoto}
                className="rounded-full w-16 h-16"
              >
                <Camera size={24} />
              </Button>
              {pendingFiles.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    stopCamera();
                    setMode('preview');
                  }}
                >
                  <CheckCircle size={18} />
                  Done ({pendingFiles.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {mode === 'preview' && pendingFiles.length > 0 && (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {previews.map((url, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative aspect-square rounded-lg overflow-hidden bg-dark-tertiary"
                >
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removePreview(index)}
                    className="absolute top-1 right-1 p-1 bg-accent-red rounded-full"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </motion.div>
              ))}
              {canAddMore && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-ql-yellow transition-colors"
                >
                  <Camera size={24} className="text-zinc-500" />
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  previews.forEach(url => URL.revokeObjectURL(url));
                  setPendingFiles([]);
                  setPreviews([]);
                  setMode('select');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={uploadPhotos}
                loading={uploading}
              >
                <Upload size={16} />
                Upload {pendingFiles.length} Photo{pendingFiles.length > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Photo viewer modal */}
      <AnimatePresence>
        {selectedPhotoIndex !== null && existingPhotos[selectedPhotoIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setSelectedPhotoIndex(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 text-white hover:text-ql-yellow"
              onClick={() => setSelectedPhotoIndex(null)}
            >
              <X size={24} />
            </button>

            {selectedPhotoIndex > 0 && (
              <button
                className="absolute left-4 p-2 text-white hover:text-ql-yellow"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIndex(prev => (prev !== null ? prev - 1 : null));
                }}
              >
                <ChevronLeft size={32} />
              </button>
            )}

            {selectedPhotoIndex < existingPhotos.length - 1 && (
              <button
                className="absolute right-4 p-2 text-white hover:text-ql-yellow"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIndex(prev => (prev !== null ? prev + 1 : null));
                }}
              >
                <ChevronRight size={32} />
              </button>
            )}

            <div className="max-w-4xl max-h-[80vh] relative" onClick={(e) => e.stopPropagation()}>
              <img
                src={existingPhotos[selectedPhotoIndex].url}
                alt={existingPhotos[selectedPhotoIndex].caption || 'Photo'}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-3 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="info" size="sm">
                      {existingPhotos[selectedPhotoIndex].photoType}
                    </Badge>
                    <p className="text-xs text-zinc-400 mt-1">
                      {new Date(existingPhotos[selectedPhotoIndex].capturedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteExistingPhoto(existingPhotos[selectedPhotoIndex].id)}
                    className="text-accent-red hover:bg-accent-red/10"
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PhotoCapture;
