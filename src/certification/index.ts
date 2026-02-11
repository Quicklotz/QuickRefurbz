/**
 * QuickDiagnosticz - Certification Module
 * Device certification, reports, and labels
 */

// Types
export * from './types.js';

// Certification Manager
export {
  issueCertification,
  getCertification,
  revokeCertification,
  updateCertificationAssets,
  addCertificationPhoto,
  getCertificationPhotos,
  getCertificationChecks,
  buildCertificationChecks,
  getDeviceHistoryReport,
  verifyCertification,
  listCertifications,
  getCertificationStats,
} from './certificationManager.js';

// Report Generator
export {
  generateReportPdf,
  generateQrCode,
  generateQrCodeDataUrl,
} from './reportGenerator.js';

// Label Generator
export {
  generateCertificationLabel,
  generateCertificationLabelBuffer,
  generateCertificationLabelDataUrl,
  getLabelDimensions,
  getLabelsDir,
} from './labelGenerator.js';
