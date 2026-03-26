import React from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export type TimelineStatus = 'initiated' | 'pending' | 'success' | 'failed' | 'reversed';

export interface TimelineEvent {
  status: TimelineStatus;
  timestamp: string; // ISO string form
}

export function TransferTimeline({ events }: { events: TimelineEvent[] }) {
  // Sort events chronologically just in case, though they should be ordered
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="flex flex-col gap-0 px-2">
      {sortedEvents.map((event, idx) => {
        const isLast = idx === sortedEvents.length - 1;
        
        let bgColor = 'bg-accent border-accent';
        let textColor = 'text-foreground';
        
        switch (event.status) {
          case 'success':
            bgColor = 'bg-green-500 border-green-500';
            break;
          case 'failed':
          case 'reversed':
            bgColor = 'bg-red-500 border-red-500';
            textColor = 'text-red-500';
            break;
          case 'pending':
            bgColor = 'bg-blue-500 border-blue-500';
            textColor = 'text-blue-500';
            break;
          case 'initiated':
            bgColor = 'bg-primary border-primary';
            textColor = 'text-foreground';
            break;
        }

        return (
          <div key={idx} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div 
                className={cn("w-3.5 h-3.5 rounded-full border-2 bg-background z-10", bgColor)} 
              />
              {!isLast && (
                <div className="w-[2px] -mt-1 -mb-1 flex-1 bg-border z-0" />
              )}
            </div>
            
            <div className={cn("flex flex-col pb-6", isLast ? "pb-0" : "")}>
              <span className={cn("text-sm font-semibold capitalize tracking-tight leading-none", textColor)}>
                {event.status}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                {format(new Date(event.timestamp), "MMM d, yyyy - h:mm a")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
