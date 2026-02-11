"use client";
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { api } from '@/api/client';
import { AuroraBackground } from '@/components/aceternity/aurora-background';
import { CardContainer, CardBody, CardItem } from '@/components/aceternity/3d-card';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { cn } from '@/lib/utils';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
                <CardItem translateZ={50} className="w-full">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-green/20 flex items-center justify-center"
                  >
                    <Mail className="w-10 h-10 text-accent-green" />
                  </motion.div>
                  <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
                  <p className="text-zinc-400 text-sm mb-6">
                    If an account exists with <span className="text-ql-yellow font-medium">{email}</span>,
                    you'll receive a password reset link shortly.
                  </p>
                  <Link to="/login">
                    <Button variant="primary" className="w-full">
                      <ArrowLeft size={16} />
                      Back to Login
                    </Button>
                  </Link>
                </CardItem>
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
                <h1 className="text-3xl font-bold text-ql-yellow mb-2">QuickRefurbz</h1>
                <p className="text-white font-medium">Reset Your Password</p>
                <p className="text-zinc-400 text-sm mt-2">
                  Enter your email and we'll send you a link to reset your password
                </p>
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      autoFocus
                    />
                  </LabelInputContainer>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    loading={loading}
                  >
                    Send Reset Link
                  </Button>

                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-ql-yellow hover:text-ql-yellow-hover transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Back to Login
                  </Link>
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
