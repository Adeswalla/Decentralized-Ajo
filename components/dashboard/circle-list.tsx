import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleDot, ArrowRight, Wallet, Users, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Circle {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  status: string;
  members: { userId: string }[];
}

interface CircleListProps {
  circles: Circle[];
  loading: boolean;
}

export function CircleList({ circles, loading }: CircleListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-64 animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  if (circles.length === 0) {
    return (
      <Card className="text-center py-16 border-dashed bg-muted/20">
        <CardContent>
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No circles found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            We couldn't find any circles matching your current search or filter criteria.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Clear all filters
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {circles.map((circle) => (
        <Link key={circle.id} href={`/circles/${circle.id}`}>
          <Card className="h-full hover:shadow-xl transition-all duration-300 border-border/50 hover:border-primary/50 group">
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{circle.name}</CardTitle>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  circle.status.toUpperCase() === 'ACTIVE' 
                    ? 'bg-green-500/10 text-green-500' 
                    : circle.status.toUpperCase() === 'COMPLETED'
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {circle.status}
                </span>
              </div>
              <CardDescription className="line-clamp-2 min-h-[40px]">{circle.description || 'No description provided'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Members
                  </p>
                  <p className="text-sm font-semibold">{circle.members?.length || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Entry
                  </p>
                  <p className="text-sm font-semibold">{circle.contributionAmount} XLM</p>
                </div>
              </div>
              <div className="border-t pt-4 flex items-center justify-between text-primary font-bold text-xs">
                <span>VIEW CIRCLE</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
