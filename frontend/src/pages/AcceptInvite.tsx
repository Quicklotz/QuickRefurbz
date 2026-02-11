"use client";
import { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/api/client';
import { AuroraBackground } from '@/components/aceternity/aurora-background';
import { CardContainer, CardBody, CardItem } from '@/components/aceternity/3d-card';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { cn } from '@/lib/utils';

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenData, setTokenData] = useState<{ email: string; name: string } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setVerifying(false);
      setLoading(false);
      return;
    }

    api.verifyToken(token, 'invite')
      .then((data) => {
        if (data.valid) {
          setTokenData({ email: data.email, name: data.name });
        } else {
          setError('Invalid or expired invite link');
        }
      })
      .catch((err) => {
        setError(err.message || 'Invalid or expired invite link');
      })
      .finally(() => {
        setVerifying(false);
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await api.acceptInvite(token!, password);
      setSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set password';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <AuroraBackground>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10"
        >
          <LoadingSpinner size="xl" text="Verifying invite link..." />
        </motion.div>
      </AuroraBackground>
    );
  }

  if (success) {
    return (
      <AuroraBackground>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md px-4"
        >
          <CardContainer containerClassName="py-0">
            <CardBody className="w-full">
              <div className="bg-dark-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-green/20 flex items-center justify-center"
                >
                  <CheckCircle className="w-10 h-10 text-accent-green" />
                </motion.div>
                <h1 className="text-2xl font-bold text-white mb-2">Welcome Aboard!</h1>
                <p className="text-zinc-400 text-sm mb-6">
                  Your account has been activated successfully.
                </p>
                <Link to="/login">
                  <Button variant="primary" className="w-full">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </CardBody>
          </CardContainer>
        </motion.div>
      </AuroraBackground>
    );
  }

  if (error && !tokenData) {
    return (
      <AuroraBackground>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md px-4"
        >
          <CardContainer containerClassName="py-0">
            <CardBody className="w-full">
              <div className="bg-dark-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-red/20 flex items-center justify-center"
                >
                  <AlertTriangle className="w-10 h-10 text-accent-red" />
                </motion.div>
                <h1 className="text-2xl font-bold text-white mb-2">Invalid Invite</h1>
                <p className="text-zinc-400 text-sm mb-6">{error}</p>
                <Link to="/login">
                  <Button variant="secondary" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </CardBody>
          </CardContainer>
        </motion.div>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <CardContainer containerClassName="py-0">
          <CardBody className="w-full">
            <div className="bg-dark-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
              <CardItem translateZ={50} className="w-full text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ql-yellow/20 flex items-center justify-center">
                  <UserPlus className="w-8 h-8 text-ql-yellow" />
                </div>
                <h1 className="text-3xl font-bold text-ql-yellow mb-2">QuickRefurbz</h1>
                <p className="text-white font-medium">Welcome, {tokenData?.name}!</p>
                <p className="text-zinc-400 text-sm mt-2">Set your password to activate your account</p>
              </CardItem>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-accent-red/10 border border-accent-red text-accent-red p-3 rounded-lg mb-4 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <CardItem translateZ={30} className="w-full">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <LabelInputContainer>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={tokenData?.email || ''}
                      disabled
                      className="opacity-70"
                    />
                  </LabelInputContainer>

                  <LabelInputContainer>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      autoFocus
                    />
                  </LabelInputContainer>

                  <LabelInputContainer>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                    />
                  </LabelInputContainer>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    loading={loading}
                  >
                    Set Password & Activate
                  </Button>
                </form>
              </CardItem>
            </div>
          </CardBody>
        </CardContainer>
      </motion.div>
    </AuroraBackground>
  );
}

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex flex-col space-y-2 w-full", className)}>
      {children}
    </div>
  );
};
