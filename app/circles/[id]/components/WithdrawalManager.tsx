'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, ArrowDownToLine, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface Withdrawal {
  id: string;
  amount: number;
  requestedAmount: number;
  status: string;
  reason?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  approvals: Array<{
    id: string;
    approved: boolean;
    comment?: string;
    createdAt: string;
    approver: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };
  }>;
}

interface WithdrawalManagerProps {
  circleId: string;
  userId: string;
  availableBalance: number;
  isApprover: boolean;
}

export default function WithdrawalManager({
  circleId,
  userId,
  availableBalance,
  isApprover,
}: WithdrawalManagerProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchWithdrawals();
  }, [circleId]);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch(`/api/circles/${circleId}/withdraw`);
      if (!response.ok) throw new Error('Failed to fetch withdrawals');
      
      const data = await response.json();
      setWithdrawals(data.withdrawals);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/circles/${circleId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount) * 10000000, // Convert XLM to stroops
          reason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request withdrawal');
      }

      setShowRequestDialog(false);
      setAmount('');
      setReason('');
      await fetchWithdrawals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (withdrawalId: string, approved: boolean, comment?: string) => {
    try {
      const response = await fetch(
        `/api/circles/${circleId}/withdraw/${withdrawalId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved, comment }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process approval');
      }

      await fetchWithdrawals();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      PENDING: { variant: 'secondary', icon: Clock },
      APPROVED: { variant: 'default', icon: CheckCircle },
      REJECTED: { variant: 'destructive', icon: XCircle },
      COMPLETED: { variant: 'default', icon: CheckCircle },
      CANCELLED: { variant: 'outline', icon: XCircle },
    };

    const config = variants[status] || variants.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const formatXLM = (stroops: number) => {
    return (stroops / 10000000).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                Withdrawals
              </CardTitle>
              <CardDescription>
                Available balance: {formatXLM(availableBalance)} XLM
              </CardDescription>
            </div>
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button>Request Withdrawal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Withdrawal</DialogTitle>
                  <DialogDescription>
                    Request to withdraw funds from your circle balance
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (XLM)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={formatXLM(availableBalance)}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                    <p className="text-xs text-muted-foreground">
                      Note: A 10% penalty will be applied to early withdrawals
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why you need this withdrawal"
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleRequestWithdrawal}
                    disabled={submitting || !amount || parseFloat(amount) <= 0}
                    className="w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No withdrawal requests yet
            </p>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => (
                <Card key={withdrawal.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {withdrawal.user.firstName || withdrawal.user.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(withdrawal.createdAt)}
                          </p>
                        </div>
                        {getStatusBadge(withdrawal.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Requested</p>
                          <p className="font-medium">
                            {formatXLM(withdrawal.requestedAmount)} XLM
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">After Penalty</p>
                          <p className="font-medium">{formatXLM(withdrawal.amount)} XLM</p>
                        </div>
                      </div>

                      {withdrawal.reason && (
                        <div>
                          <p className="text-sm text-muted-foreground">Reason</p>
                          <p className="text-sm">{withdrawal.reason}</p>
                        </div>
                      )}

                      {withdrawal.approvals.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Approvals</p>
                          <div className="space-y-2">
                            {withdrawal.approvals.map((approval) => (
                              <div
                                key={approval.id}
                                className="flex items-start gap-2 text-sm p-2 bg-muted rounded"
                              >
                                {approval.approved ? (
                                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {approval.approver.firstName || approval.approver.email}
                                  </p>
                                  {approval.comment && (
                                    <p className="text-muted-foreground">{approval.comment}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(approval.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isApprover &&
                        withdrawal.status === 'PENDING' &&
                        withdrawal.user.id !== userId &&
                        !withdrawal.approvals.some((a) => a.approver.id === userId) && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(withdrawal.id, true)}
                              className="flex-1"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApprove(withdrawal.id, false)}
                              className="flex-1"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
