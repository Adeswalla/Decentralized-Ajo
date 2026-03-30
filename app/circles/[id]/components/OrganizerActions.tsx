'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/auth-client';
import { Settings, UserPlus, PlayCircle, PauseCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface OrganizerActionsProps {
  circle: any;
  onRefresh: () => void;
}

export function OrganizerActions({ circle, onRefresh }: OrganizerActionsProps) {
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState(circle.status);

  const handleStatusUpdate = async () => {
    if (newStatus === circle.status) {
      toast.info('Status unchanged');
      return;
    }

    setUpdating(true);

    try {
      const response = await authenticatedFetch(`/api/circles/${circle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to update status');
        return;
      }

      toast.success('Circle status updated successfully');
      onRefresh();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('An error occurred while updating status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Organizer Controls
          </CardTitle>
          <CardDescription>
            Manage circle settings and member access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Circle Status</label>
            <div className="flex gap-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleStatusUpdate}
                disabled={updating || newStatus === circle.status}
              >
                {updating ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>

          <div className="pt-4 space-y-2">
            <Button asChild className="w-full" variant="outline">
              <Link href={`/circles/${circle.id}/governance`}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Create Governance Proposal
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Circle Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Total Contributions</p>
              <p className="text-2xl font-bold">{circle.contributions?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-2xl font-bold">
                {circle.members?.filter((m: any) => m.status === 'ACTIVE').length || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Payouts</p>
              <p className="text-2xl font-bold">
                {circle.members?.filter((m: any) => m.hasReceivedPayout).length || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contract Status</p>
              <Badge variant={circle.contractDeployed ? 'default' : 'secondary'}>
                {circle.contractDeployed ? 'Deployed' : 'Not Deployed'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect the entire circle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <PauseCircle className="mr-2 h-4 w-4" />
                Cancel Circle
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently cancel the circle
                  and may affect all members. Consider creating a governance proposal instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setNewStatus('CANCELLED');
                    handleStatusUpdate();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, cancel circle
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
