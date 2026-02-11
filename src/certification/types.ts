/**
 * QuickDiagnosticz - Certification Types
 * Device certification and report generation system
 *
 * Part of QuickRefurbz - Generates certifications after diagnostic testing
 */

import { ProductCategory, FinalGrade } from '../types.js';
import { DiagnosticSession, ExternalCheck } from '../diagnostics/types.js';

// ==================== CERTIFICATION LEVELS ====================

/**
 * CertificationLevel - Certification grades for devices
 */
export type CertificationLevel =
  | 'EXCELLENT'        // All tests pass, like-new condition
  | 'GOOD'             // All functional tests pass, minor cosmetic wear
  | 'FAIR'             // Functional with noted limitations
  | 'NOT_CERTIFIED';   // Failed critical tests

export const CERTIFICATION_LEVEL_DISPLAY: Record<CertificationLevel, string> = {
  EXCELLENT: 'Certified Excellent',
  GOOD: 'Certified Good',
  FAIR: 'Certified Fair',
  NOT_CERTIFIED: 'Not Certified'
};

export const CERTIFICATION_LEVEL_COLOR: Record<CertificationLevel, string> = {
  EXCELLENT: '#22c55e',    // Green
  GOOD: '#3b82f6',         // Blue
  FAIR: '#eab308',         // Yellow
  NOT_CERTIFIED: '#ef4444' // Red
};

/**
 * Map certification level to final grade
 */
export const CERT_TO_GRADE: Record<CertificationLevel, FinalGrade> = {
  EXCELLENT: 'A',
  GOOD: 'B',
  FAIR: 'C',
  NOT_CERTIFIED: 'F'
};

// ==================== CERTIFICATION ====================

/**
 * Certification - Issued certification for a device
 */
export interface Certification {
  id: string;
  certificationId: string;             // UC-20260208-0001 (Upscaled Certified)

  // Item reference
  qlid: string;
  jobId?: string;
  sessionId?: string;                  // Reference to DiagnosticSession

  // Device info
  category: ProductCategory;
  manufacturer: string;
  model: string;
  serialNumber?: string;

  // Certification details
  certificationLevel: CertificationLevel;

  // External checks (manual or API)
  reportedStolen: boolean;
  financialHold: boolean;

  // Warranty tracking
  warrantyInfo?: WarrantyInfo;
  warrantyStatus?: string;             // Legacy field for compatibility

  // For electronics with identifiers
  imei?: string;
  imei2?: string;
  esn?: string;
  macAddress?: string;

  // Certification metadata
  certifiedBy: string;
  certifiedByName?: string;
  certifiedAt: Date;

  // Generated assets
  reportPdfUrl?: string;
  labelPngUrl?: string;
  qrCodeUrl?: string;
  publicReportUrl?: string;            // https://cert.upscaled.com/r/{certificationId}

  // Validity
  validUntil?: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedBy?: string;
  revokedReason?: string;

  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * CertificationInput - Input for issuing a certification
 */
export interface CertificationInput {
  qlid: string;
  jobId?: string;
  sessionId?: string;

  category: ProductCategory;
  manufacturer: string;
  model: string;
  serialNumber?: string;

  certificationLevel: CertificationLevel;

  // External checks
  reportedStolen?: boolean;
  financialHold?: boolean;

  // Warranty info
  warrantyType?: WarrantyType;
  warrantyStatus?: WarrantyStatus;
  warrantyProvider?: string;
  warrantyStartDate?: Date;
  warrantyEndDate?: Date;
  warrantyCoverageType?: string;
  warrantyNotes?: string;

  // Identifiers
  imei?: string;
  imei2?: string;
  esn?: string;
  macAddress?: string;

  // Certifier
  certifiedBy: string;
  certifiedByName?: string;

  // Validity
  validDays?: number;                  // Days until expiration (default: 90)
}

// ==================== CERTIFICATION PHOTOS ====================

/**
 * PhotoType - Types of certification photos
 */
export type CertificationPhotoType =
  | 'FRONT'
  | 'BACK'
  | 'LEFT'
  | 'RIGHT'
  | 'TOP'
  | 'BOTTOM'
  | 'SERIAL'
  | 'LABEL'
  | 'DEFECT'
  | 'ACCESSORY'
  | 'PACKAGING';

/**
 * CertificationPhoto - Photo attached to a certification
 */
export interface CertificationPhoto {
  id: string;
  certificationId: string;

  photoType: CertificationPhotoType;
  photoUrl: string;
  thumbnailUrl?: string;
  caption?: string;

  displayOrder: number;

  createdAt: Date;
}

// ==================== CERTIFICATION CHECKS ====================

/**
 * CertificationCheck - Individual check displayed on report
 */
export interface CertificationCheck {
  code: string;                        // STOLEN, LOCK, FINANCIAL, etc.
  name: string;                        // "Not reported lost or stolen"
  passed: boolean;
  details?: string;
  icon?: 'check' | 'warning' | 'error';
}

/**
 * Standard certification checks
 */
export const STANDARD_CHECKS: Array<{ code: string; name: string; passText: string; failText: string }> = [
  { code: 'STOLEN', name: 'Stolen Status', passText: 'Not reported lost or stolen', failText: 'Reported lost or stolen' },
  { code: 'FINANCIAL', name: 'Financial Status', passText: 'No financial issues reported', failText: 'Financial hold detected' },
  { code: 'FUNCTIONAL', name: 'Functionality', passText: 'All functional tests passed', failText: 'Functional issues found' },
  { code: 'SAFETY', name: 'Safety', passText: 'Passed safety inspection', failText: 'Safety concerns identified' },
  { code: 'COSMETIC', name: 'Cosmetic Condition', passText: 'Good cosmetic condition', failText: 'Cosmetic damage noted' },
  { code: 'COMPLETE', name: 'Completeness', passText: 'All components present', failText: 'Missing components' },
  { code: 'WARRANTY', name: 'Warranty Status', passText: 'Warranty verified', failText: 'No warranty or expired' },
];

// ==================== DEVICE HISTORY REPORT ====================

/**
 * DeviceHistoryReport - Full report data for PDF/web generation
 */
export interface DeviceHistoryReport {
  certification: Certification;
  session?: DiagnosticSession;
  externalChecks: ExternalCheck[];
  photos: CertificationPhoto[];
  checks: CertificationCheck[];

  // Test results summary
  testResults?: Array<{
    testCode: string;
    testName: string;
    result: 'PASS' | 'FAIL' | 'SKIP' | 'N/A';
    measurementValue?: number;
    measurementUnit?: string;
    notes?: string;
  }>;

  // For report rendering
  reportDate: Date;
  qrCodeDataUrl?: string;              // Base64 QR code image
}

// ==================== CERTIFICATION LABEL ====================

/**
 * CertificationLabelData - Data for thermal label generation
 */
export interface CertificationLabelData {
  certificationId: string;             // UC-20260208-0001
  qlid: string;                        // QLID000000001
  barcodeValue: string;                // P1BBY-QLID000000001

  manufacturer: string;
  model: string;

  certificationLevel: CertificationLevel;
  certificationLevelDisplay: string;   // "CERTIFIED EXCELLENT"

  certifiedAt: Date;
  technicianId: string;

  qrCodeUrl: string;                   // URL to public report
}

/**
 * LabelDimensions - Thermal label specifications
 */
export interface LabelDimensions {
  width: number;                       // pixels
  height: number;                      // pixels
  dpi: number;                         // dots per inch
  widthInches: number;
  heightInches: number;
}

/**
 * Standard 2" x 1" label at 203 DPI
 */
export const STANDARD_LABEL: LabelDimensions = {
  width: 406,
  height: 203,
  dpi: 203,
  widthInches: 2,
  heightInches: 1
};

// ==================== WARRANTY TRACKING ====================

/**
 * WarrantyType - Types of warranties
 */
export type WarrantyType =
  | 'MANUFACTURER'     // Original manufacturer warranty
  | 'EXTENDED'         // Extended warranty (e.g., AppleCare, Asurion)
  | 'RETAILER'         // Retailer warranty (e.g., Best Buy, Costco)
  | 'UPSCALED'         // Upscaled's own warranty
  | 'NONE';            // No warranty

export const WARRANTY_TYPE_DISPLAY: Record<WarrantyType, string> = {
  MANUFACTURER: 'Manufacturer Warranty',
  EXTENDED: 'Extended Warranty',
  RETAILER: 'Retailer Warranty',
  UPSCALED: 'Upscaled Warranty',
  NONE: 'No Warranty'
};

/**
 * WarrantyStatus - Current warranty status
 */
export type WarrantyStatus =
  | 'ACTIVE'           // Warranty is currently active
  | 'EXPIRED'          // Warranty has expired
  | 'VOIDED'           // Warranty voided (e.g., damage, unauthorized repair)
  | 'UNKNOWN'          // Unable to verify warranty status
  | 'NOT_APPLICABLE';  // Product doesn't have warranty (e.g., sold as-is)

export const WARRANTY_STATUS_DISPLAY: Record<WarrantyStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  VOIDED: 'Voided',
  UNKNOWN: 'Unknown',
  NOT_APPLICABLE: 'N/A'
};

/**
 * WarrantyInfo - Detailed warranty information
 */
export interface WarrantyInfo {
  type: WarrantyType;
  status: WarrantyStatus;
  provider?: string;                   // e.g., "Apple", "Asurion", "Best Buy"

  // Dates
  startDate?: Date;
  endDate?: Date;
  daysRemaining?: number;

  // Coverage details
  coverageType?: string;               // e.g., "Full Coverage", "Parts Only", "Accidental Damage"
  deductible?: number;                 // e.g., $29 for AppleCare screen repair

  // Verification
  verifiedAt?: Date;
  verifiedBy?: string;
  verificationMethod?: 'API' | 'MANUAL' | 'DOCUMENT';

  notes?: string;
}

/**
 * Upscaled warranty levels by certification grade
 */
export const UPSCALED_WARRANTY_BY_LEVEL: Record<CertificationLevel, { days: number; description: string }> = {
  EXCELLENT: { days: 90, description: '90-day Upscaled Guarantee' },
  GOOD: { days: 60, description: '60-day Upscaled Guarantee' },
  FAIR: { days: 30, description: '30-day Upscaled Guarantee' },
  NOT_CERTIFIED: { days: 0, description: 'No Warranty' }
};

// ==================== GUARANTEE ====================

/**
 * GuaranteeType - Types of guarantees offered
 */
export type GuaranteeType = 'BUYBACK' | 'WARRANTY' | 'SATISFACTION';

/**
 * CertificationGuarantee - Guarantee attached to certification
 */
export interface CertificationGuarantee {
  type: GuaranteeType;
  name: string;
  description: string;
  terms: string;
  validDays: number;
  maxClaimAmount?: number;
}

/**
 * Upscaled Guarantee - Default guarantee for certified devices
 */
export const UPSCALED_GUARANTEE: CertificationGuarantee = {
  type: 'BUYBACK',
  name: 'Upscaled Guarantee',
  description: 'No issues were reported by our diagnostic system. If you find that this device was reported as lost or stolen to the global blacklist and not included in this report, Upscaled will buy this device back.',
  terms: 'Valid for 30 days from certification date. Device must be in same condition as certified.',
  validDays: 30
};

// ==================== STATISTICS ====================

/**
 * CertificationStats - Aggregated certification statistics
 */
export interface CertificationStats {
  period: 'today' | 'week' | 'month' | 'all';

  totalCertifications: number;
  byLevel: Record<CertificationLevel, number>;

  certificationRate: number;           // % of diagnosed items that get certified

  byCategory: Record<ProductCategory, {
    total: number;
    excellent: number;
    good: number;
    fair: number;
    notCertified: number;
  }>;

  recentCertifications: Certification[];
}

// ==================== API TYPES ====================

/**
 * IssueCertificationRequest - API request to issue certification
 */
export interface IssueCertificationRequest {
  qlid: string;
  sessionId?: string;
  jobId?: string;

  category: ProductCategory;
  manufacturer: string;
  model: string;
  serialNumber?: string;

  certificationLevel: CertificationLevel;

  // Optional device identifiers
  imei?: string;
  imei2?: string;
  esn?: string;
  macAddress?: string;

  // External check results (if manual)
  reportedStolen?: boolean;
  financialHold?: boolean;

  // Warranty info
  warrantyType?: WarrantyType;
  warrantyStatus?: WarrantyStatus;
  warrantyProvider?: string;
  warrantyStartDate?: string;          // ISO date string for API
  warrantyEndDate?: string;            // ISO date string for API
  warrantyCoverageType?: string;
  warrantyNotes?: string;

  // Photos
  photos?: Array<{
    photoType: CertificationPhotoType;
    photoUrl: string;
    caption?: string;
  }>;

  // Certifier
  certifiedBy: string;
  certifiedByName?: string;

  notes?: string;
}

/**
 * RevokeCertificationRequest - API request to revoke certification
 */
export interface RevokeCertificationRequest {
  reason: string;
  revokedBy: string;
}

/**
 * CertificationResponse - API response for certification operations
 */
export interface CertificationResponse {
  success: boolean;
  certification: Certification;
  reportUrl?: string;
  labelUrl?: string;
  qrCodeUrl?: string;
  message?: string;
}

/**
 * VerificationResponse - Public verification API response
 */
export interface VerificationResponse {
  valid: boolean;
  certification?: {
    certificationId: string;
    certificationLevel: CertificationLevel;
    certificationLevelDisplay: string;
    manufacturer: string;
    model: string;
    certifiedAt: Date;
    isRevoked: boolean;
    revokedReason?: string;
    // Warranty info for public display
    warrantyType?: WarrantyType;
    warrantyStatus?: WarrantyStatus;
    warrantyEndDate?: Date;
    warrantyDaysRemaining?: number;
  };
  checks: CertificationCheck[];
  message: string;
}

// ==================== REPORT TEMPLATES ====================

/**
 * ReportTemplate - Template for generating reports
 */
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;

  // Branding
  logoUrl?: string;
  companyName: string;
  companyWebsite?: string;
  companyPhone?: string;
  companyEmail?: string;

  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Content options
  includeTestDetails: boolean;
  includePhotos: boolean;
  includeGuarantee: boolean;
  includeQrCode: boolean;

  // Footer
  footerText?: string;
  disclaimerText?: string;

  isDefault: boolean;
  createdAt: Date;
}

/**
 * Default Upscaled report template
 */
export const DEFAULT_TEMPLATE: ReportTemplate = {
  id: 'default',
  name: 'Upscaled Standard',
  description: 'Standard certification report template',

  companyName: 'Upscaled',
  companyWebsite: 'https://upscaled.com',

  primaryColor: '#22c55e',             // Green
  secondaryColor: '#1f2937',           // Dark gray
  accentColor: '#3b82f6',              // Blue

  includeTestDetails: true,
  includePhotos: true,
  includeGuarantee: true,
  includeQrCode: true,

  footerText: 'This device has been professionally tested and certified by Upscaled.',
  disclaimerText: 'Certification is based on testing performed at time of inspection. Upscaled is not responsible for issues arising after certification.',

  isDefault: true,
  createdAt: new Date()
};
