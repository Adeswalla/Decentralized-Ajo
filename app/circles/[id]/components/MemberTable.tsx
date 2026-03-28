'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatXLM } from '@/lib/utils';
import { Crown, CheckCircle2 } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  rotationOrder: number;
  status: string;
  totalContributed: number;
  totalWithdrawn: number;
  hasReceivedPayout: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    walletAddress?: string;
  };
}

interface MemberTableProps {
  members: Member[];
  organizerId: string;
  currentRound: number;
}

export function MemberTable({ members, organizerId, currentRound }: MemberTableProps) {
  const sortedMembers = [...members].sort((a, b) => a.rotationOrder - b.rotationOrder);
  const nextInLine = sortedMembers.find((m) => !m.hasReceivedPayout);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Circle Members</CardTitle>
        <CardDescription>
          {members.length} active members • Next payout: {nextInLine ? `#${nextInLine.rotationOrder}` : 'All paid'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="text-center">Rotation</TableHead>
              <TableHead className="text-right">Contributed</TableHead>
              <TableHead className="text-right">Withdrawn</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.map((member) => {
              const isOrganizer = member.userId === organizerId;
              const isNextInLine = nextInLine?.id === member.id;
              const displayName =
                member.user.firstName && member.user.lastName
                  ? `${member.user.firstName} ${member.user.lastName}`
                  : member.user.email;

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{displayName}</p>
                        {member.user.walletAddress && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {member.user.walletAddress.slice(0, 8)}...
                            {member.user.walletAddress.slice(-6)}
                          </p>
                        )}
                      </div>
                      {isOrganizer && (
                        <Crown className="h-4 w-4 text-yellow-500" aria-label="Organizer" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-semibold">#{member.rotationOrder}</span>
                      {isNextInLine && (
                        <Badge variant="default" className="ml-2">
                          Next in Line
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatXLM(member.totalContributed)} XLM
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatXLM(member.totalWithdrawn)} XLM
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Badge
                        variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}
                      >
                        {member.status}
                      </Badge>
                      {member.hasReceivedPayout && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="Received Payout" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
