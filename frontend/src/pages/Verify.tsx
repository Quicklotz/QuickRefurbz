"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Award,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Calendar,
  User,
  Package,
} from 'lucide-react';
import { AuroraBackground } from '@/components/aceternity/aurora-background';
import { SpotlightCard } from '@/components/aceternity/spotlight';

interface VerificationResult {
  valid: boolean;
  certification?: {
    certificationId: string;
    qlid: string;
    manufacturer: string;
    model: string;
    category: string;
    certificationLevel: string;
    certifiedAt: string;
    certifiedBy: string;
    isRevoked: boolean;
    revokedReason?: string;
  };
  checks?: {
    name: string;
    passed: boolean;
    details?: string;
  }[];
  error?: string;
}

const LEVEL_LABELS: Record<string, string> = {
  EXCELLENT: 'Certified Excellent',
  GOOD: 'Certified Good',
  FAIR: 'Certified Fair',
  NOT_CERTIFIED: 'Not Certified',
};

export function Verify() {
  const { certificationId } = useParams<{ certificationId: string }>();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (certificationId) {
      verifyCertification(certificationId);
    }
  }, [certificationId]);

  async function verifyCertification(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflow/certifications/verify/${id}`);
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({
        valid: false,
        error: 'Failed to verify certification. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AuroraBackground>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Shield className="w-12 h-12 text-ql-yellow" />
            </motion.div>
            <span className="text-white">Verifying certification...</span>
          </div>
        </motion.div>
      </AuroraBackground>
    );
  }

  if (!result) {
    return (
      <AuroraBackground>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-lg px-4"
        >
          <SpotlightCard className="p-8 text-center">
            <XCircle className="w-16 h-16 text-accent-red mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-zinc-400">Unable to verify certification. Please check the URL and try again.</p>
          </SpotlightCard>
        </motion.div>
      </AuroraBackground>
    );
  }

  const { certification, checks } = result;

  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg px-4 py-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-white">
            <Award className="w-8 h-8 text-ql-yellow" />
            <span className="text-xl font-bold">Upscaled</span>
          </div>
          <span className="text-zinc-400 text-sm">Device Verification</span>
        </div>

        <SpotlightCard className="overflow-hidden">
          {/* Status Banner */}
          {result.valid && certification && !certification.isRevoked ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-accent-green p-4 flex items-center justify-center gap-3"
            >
              <CheckCircle className="w-6 h-6 text-black" />
              <span className="font-semibold text-black">
                {LEVEL_LABELS[certification.certificationLevel]}
              </span>
            </motion.div>
          ) : certification?.isRevoked ? (
            <div className="bg-accent-red p-4 flex items-center justify-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white" />
              <span className="font-semibold text-white">Certification Revoked</span>
            </div>
          ) : (
            <div className="bg-accent-red p-4 flex items-center justify-center gap-3">
              <XCircle className="w-6 h-6 text-white" />
              <span className="font-semibold text-white">Invalid Certification</span>
            </div>
          )}

          {/* Error Message */}
          {result.error && (
            <div className="m-4 p-3 bg-accent-red/10 border border-accent-red rounded-lg flex items-center gap-2 text-accent-red text-sm">
              <AlertTriangle size={18} />
              <span>{result.error}</span>
            </div>
          )}

          {/* Revoked Message */}
          {certification?.isRevoked && (
            <div className="m-4 p-3 bg-accent-red/10 border border-accent-red rounded-lg flex items-center gap-2 text-accent-red text-sm">
              <AlertTriangle size={18} />
              <span><strong>Revoked:</strong> {certification.revokedReason}</span>
            </div>
          )}

          {/* Device Info */}
          {certification && (
            <div className="p-6 space-y-6">
              {/* Device Section */}
              <div>
                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-wide mb-3">
                  <Package size={14} />
                  Device Information
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {certification.manufacturer} {certification.model}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-zinc-500">QLID</span>
                    <p className="text-white font-mono">{certification.qlid}</p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Category</span>
                    <p className="text-white">{certification.category.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Certification Details */}
              <div>
                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-wide mb-3">
                  <Shield size={14} />
                  Certification Details
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Certification ID</span>
                    <span className="text-white font-mono text-sm">{certification.certificationId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-sm flex items-center gap-1">
                      <Calendar size={14} />
                      Certified On
                    </span>
                    <span className="text-white text-sm">
                      {new Date(certification.certifiedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-sm flex items-center gap-1">
                      <User size={14} />
                      Certified By
                    </span>
                    <span className="text-white text-sm">{certification.certifiedBy}</span>
                  </div>
                </div>
              </div>

              {/* Verification Checks */}
              {checks && checks.length > 0 && (
                <>
                  <div className="border-t border-border" />
                  <div>
                    <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-wide mb-3">
                      <CheckCircle size={14} />
                      Verification Checks
                    </div>
                    <div className="space-y-2">
                      {checks.map((check, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-start gap-3"
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            check.passed ? 'bg-accent-green' : 'bg-accent-red'
                          }`}>
                            {check.passed ? (
                              <CheckCircle size={14} className="text-black" />
                            ) : (
                              <XCircle size={14} className="text-white" />
                            )}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{check.name}</p>
                            {check.details && (
                              <p className="text-zinc-500 text-xs">{check.details}</p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="p-4 bg-dark-tertiary border-t border-border">
            <div className="flex items-start gap-3 mb-3">
              <Shield className="w-5 h-5 text-ql-yellow flex-shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">Upscaled Guarantee</p>
                <p className="text-zinc-500 text-xs">
                  This device has been professionally tested and certified by Upscaled.
                </p>
              </div>
            </div>
            <p className="text-center text-zinc-600 text-xs">
              Verified at {new Date().toLocaleString()}
            </p>
          </div>
        </SpotlightCard>

        {/* Branding */}
        <p className="text-center text-zinc-500 text-sm mt-6">
          Powered by <span className="text-ql-yellow font-semibold">QuickDiagnosticz</span> | Upscaled Electronics
        </p>
      </motion.div>
    </AuroraBackground>
  );
}
