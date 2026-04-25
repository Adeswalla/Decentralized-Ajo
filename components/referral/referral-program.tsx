/**
 * Referral Program Component
 * Closes #608
 */

'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Share2, Users, Gift, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  confirmedReferrals: number;
  rewardsEarned: number;
}

interface ReferredUser {
  id: string;
  email: string;
  status: 'pending' | 'qualified' | 'rewarded';
  joinedAt: string;
  rewardAmount?: number;
}

interface ReferralData {
  referralLink: string;
  stats: ReferralStats;
  referredUsers: ReferredUser[];
}

export function ReferralProgram() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/referrals', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReferralData(data);
      } else {
        toast.error('Failed to load referral data');
      }
    } catch (error) {
      toast.error('Error loading referral data');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!referralData) return;

    try {
      await navigator.clipboard.writeText(referralData.referralLink);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleShareTwitter = () => {
    if (!referralData) return;

    const text = encodeURIComponent(
      'Join me on Stellar Ajo - a decentralized savings platform! 🚀'
    );
    const url = encodeURIComponent(referralData.referralLink);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleShareTelegram = () => {
    if (!referralData) return;

    const text = encodeURIComponent(
      'Join me on Stellar Ajo - a decentralized savings platform!'
    );
    const url = encodeURIComponent(referralData.referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    if (!referralData) return;

    const text = encodeURIComponent(
      `Join me on Stellar Ajo - a decentralized savings platform! ${referralData.referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const getStatusBadge = (status: ReferredUser['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'qualified':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Qualified
          </Badge>
        );
      case 'rewarded':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <Gift className="h-3 w-3" />
            Rewarded
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!referralData) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Failed to load referral data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Link Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
          <CardDescription>
            Share your unique referral link and earn rewards when friends join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={referralData.referralLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={handleCopyLink} variant="outline" className="shrink-0">
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Share Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleShareTwitter} variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Twitter/X
            </Button>
            <Button onClick={handleShareTelegram} variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Telegram
            </Button>
            <Button onClick={handleShareWhatsApp} variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referral Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralData.stats.totalReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralData.stats.pendingReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralData.stats.confirmedReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rewards Earned</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${referralData.stats.rewardsEarned}</div>
          </CardContent>
        </Card>
      </div>

      {/* Referred Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Referred Users</CardTitle>
          <CardDescription>Track the status of your referrals</CardDescription>
        </CardHeader>
        <CardContent>
          {referralData.referredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No referrals yet</p>
              <p className="text-sm">Share your link to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {referralData.referredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(user.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {user.rewardAmount && (
                      <span className="text-sm font-medium text-green-600">
                        +${user.rewardAmount}
                      </span>
                    )}
                    {getStatusBadge(user.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
