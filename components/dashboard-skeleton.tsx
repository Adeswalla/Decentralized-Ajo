'use client';

import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg shadow-sm">
          <div className="w-2/3 h-6 bg-gray-300 dark:bg-gray-600 rounded mx-4 mt-4"></div>
          <div className="w-1/2 h-8 bg-gray-300 dark:bg-gray-600 rounded mx-4 mt-6"></div>
        </div>
      ))}
    </div>
  );
}