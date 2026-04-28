'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, Users, AlertTriangle } from 'lucide-react';

interface MultisigConfigProps {
  circleId: string;
  members: Array<{ id: string; name: string; email: string }>;
  isOrganizer: boolean;
}

interface MultisigSettings {
  multisigEnabled: boolean;
  multisigThreshold: number;
  requiredApprovals: number;
  approvers: string[];
}

export default function MultisigConfig({ circleId, members, isOrganizer }: MultisigConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<MultisigSettings>({
    multisigEnabled: false,
    multisigThreshold: 0,
    requiredApprovals: 2,
    approvers: [],
  });

  useEffect(() => {
    fetchSettings();
  }, [circleId]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/circles/${circleId}/multisig`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      setSettings({
        multisigEnabled: data.multisigEnabled,
        multisigThreshold: data.multisigThreshold,
        requiredApprovals: data.requiredApprovals,
        approvers: data.approvers || [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const response = await fetch(`/api/circles/${circleId}/multisig`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleApprover = (userId: string) => {
    setSettings((prev) => ({
      ...prev,
      approvers: prev.approvers.includes(userId)
        ? prev.approvers.filter((id) => id !== userId)
        : [...prev.approvers, userId],
    }));
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

  if (!isOrganizer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Multisig Configuration
          </CardTitle>
          <CardDescription>View multisig settings for this circle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Multisig Enabled</Label>
            <p className="text-sm text-muted-foreground">
              {settings.multisigEnabled ? 'Yes' : 'No'}
            </p>
          </div>
          {settings.multisigEnabled && (
            <>
              <div>
                <Label>Threshold Amount</Label>
                <p className="text-sm text-muted-foreground">
                  {(settings.multisigThreshold / 10000000).toFixed(2)} XLM
                </p>
              </div>
              <div>
                <Label>Required Approvals</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.requiredApprovals} of {settings.approvers.length}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Multisig Configuration
        </CardTitle>
        <CardDescription>
          Require multiple approvals for high-value withdrawals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>Settings saved successfully!</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="multisig-enabled">Enable Multisig</Label>
            <p className="text-sm text-muted-foreground">
              Require approvals for withdrawals above threshold
            </p>
          </div>
          <Switch
            id="multisig-enabled"
            checked={settings.multisigEnabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, multisigEnabled: checked }))
            }
          />
        </div>

        {settings.multisigEnabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold Amount (XLM)</Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                min="0"
                value={(settings.multisigThreshold / 10000000).toFixed(2)}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    multisigThreshold: Math.round(parseFloat(e.target.value) * 10000000),
                  }))
                }
                placeholder="Enter threshold amount"
              />
              <p className="text-xs text-muted-foreground">
                Withdrawals above this amount will require multiple approvals
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="required-approvals">Required Approvals</Label>
              <Input
                id="required-approvals"
                type="number"
                min="1"
                max={settings.approvers.length || 10}
                value={settings.requiredApprovals}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    requiredApprovals: parseInt(e.target.value) || 1,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of approvals needed (M-of-N scheme)
              </p>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Authorized Approvers
              </Label>
              <p className="text-sm text-muted-foreground">
                Select members who can approve high-value withdrawals
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 hover:bg-accent rounded-md"
                  >
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Switch
                      checked={settings.approvers.includes(member.id)}
                      onCheckedChange={() => toggleApprover(member.id)}
                    />
                  </div>
                ))}
              </div>
              {settings.approvers.length === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You must select at least one approver
                  </AlertDescription>
                </Alert>
              )}
              {settings.requiredApprovals > settings.approvers.length && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Required approvals cannot exceed number of approvers
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )}

        <Button
          onClick={handleSave}
          disabled={
            saving ||
            (settings.multisigEnabled &&
              (settings.approvers.length === 0 ||
                settings.requiredApprovals > settings.approvers.length))
          }
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
