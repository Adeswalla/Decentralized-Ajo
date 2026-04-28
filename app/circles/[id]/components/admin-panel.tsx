'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/auth-client';
import { Trash2, UserMinus, UserPlus, AlertTriangle } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  rotationOrder: number;
  status: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface AdminPanelProps {
  circleId: string;
  circle: {
    id: string;
    organizerId: string;
    members: Member[];
  };
  currentUserId: string;
  onUpdate: () => void;
}

export function AdminPanel({ circleId, circle, currentUserId, onUpdate }: AdminPanelProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [removing, setRemoving] = useState(false);
  const [dissolveConfirmation, setDissolveConfirmation] = useState('');
  const [dissolving, setDissolving] = useState(false);

  // Security check: Only show to organizer
  const isAdmin = currentUserId === circle.organizerId;
  if (!isAdmin) return null;

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setInviting(true);

    try {
      const response = await authenticatedFetch(`/api/circles/${circleId}/admin/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to invite member');
        return;
      }

      toast.success('Member invited successfully!');
      setInviteEmail('');
      onUpdate();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('An error occurred while inviting member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) {
      toast.error('Please select a member to remove');
      return;
    }

    setRemoving(true);

    try {
      const response = await authenticatedFetch(`/api/circles/${circleId}/admin/remove-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedMember }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove member');
        return;
      }

      toast.success('Member removed successfully!');
      setSelectedMember('');
      onUpdate();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('An error occurred while removing member');
    } finally {
      setRemoving(false);
    }
  };

  const handleDissolveCircle = async () => {
    if (dissolveConfirmation !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setDissolving(true);

    try {
      const response = await authenticatedFetch(`/api/circles/${circleId}/admin/dissolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to dissolve circle');
        return;
      }

      const result = await response.json();
      
      // Show detailed success message with fund distribution info
      if (result.data?.refunds?.length > 0) {
        toast.success(
          `Circle dissolved successfully. ${result.data.refunds.length} member(s) will receive refunds totaling ${result.data.remainingPool.toFixed(2)}`
        );
      } else {
        toast.success('Circle dissolved successfully');
      }
      
      onUpdate();
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (error) {
      console.error('Error dissolving circle:', error);
      toast.error('An error occurred while dissolving circle');
    } finally {
      setDissolving(false);
    }
  };

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          Admin Controls
        </CardTitle>
        <CardDescription>
          Manage circle members and perform administrative actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Member */}
        <div className="space-y-3">
          <Label htmlFor="invite-email" className="text-base font-semibold">
            Invite Member
          </Label>
          <form onSubmit={handleInviteMember} className="flex gap-2">
            <div className="flex-1">
              <Input
                id="invite-email"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>
            <Button type="submit" variant="outline" disabled={inviting}>
              <UserPlus className="h-4 w-4 mr-2" />
              {inviting ? 'Inviting...' : 'Invite'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Send an invitation to a user by their email address
          </p>
        </div>

        <Separator />

        {/* Remove Member */}
        <div className="space-y-3">
          <Label htmlFor="remove-member" className="text-base font-semibold">
            Remove Member
          </Label>
          <div className="flex gap-2">
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger id="remove-member" className="flex-1">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {circle.members
                  .filter((m) => m.userId !== circle.organizerId)
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.user.firstName} {member.user.lastName || member.user.email} (Order #{member.rotationOrder})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!selectedMember || removing}>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Member</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove this member from the circle? This action cannot be undone.
                    The member will lose access to the circle and their contributions.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {removing ? 'Removing...' : 'Remove Member'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-xs text-muted-foreground">
            Remove a member from the circle (organizer cannot be removed)
          </p>
        </div>

        <Separator />

        {/* Dissolve Circle */}
        <div className="space-y-3">
          <Label className="text-base font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </Label>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Dissolve Circle
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Emergency Dissolution</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This will permanently dissolve the circle and distribute all remaining funds back to members based on their contribution history.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm">
                    <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">What happens:</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-200">
                      <li>Circle status will be set to DISSOLVED</li>
                      <li>All members will be exited from the circle</li>
                      <li>Remaining funds will be refunded to members (no penalty)</li>
                      <li>Each member receives: totalContributed - totalWithdrawn</li>
                      <li>All members will be notified</li>
                    </ul>
                  </div>
                  <p className="font-semibold text-foreground">
                    Type <span className="text-red-600">DELETE</span> to confirm:
                  </p>
                  <Input
                    placeholder="Type DELETE"
                    value={dissolveConfirmation}
                    onChange={(e) => setDissolveConfirmation(e.target.value)}
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDissolveConfirmation('')}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDissolveCircle}
                  disabled={dissolveConfirmation !== 'DELETE' || dissolving}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {dissolving ? 'Dissolving...' : 'Dissolve Circle'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground">
            Emergency dissolution: Permanently dissolve this circle and refund all remaining funds to members based on their contributions (no penalty applied).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
