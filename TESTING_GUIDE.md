# Dashboard Feature Testing Guide

## Quick Start

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Test the Landing Page
- Navigate to `http://localhost:3000/`
- You should see the landing page with "Stellar Ajo" branding
- Click "Sign In" or "Get Started" buttons to test navigation

### 3. Test Authentication Flow
- Register a new account at `/auth/register`
- After successful registration, you should be redirected to `/dashboard`
- Alternatively, login at `/auth/login`

### 4. Test Dashboard
- Once authenticated, visit `/dashboard`
- You should see:
  - Welcome message with your name
  - 4 stat cards with loading skeletons initially
  - Stats should populate after loading:
    - Active Circles
    - Total Members
    - Total Contributed
    - Total Withdrawn
  - Search bar for filtering circles
  - Status filter tabs (All, Active, Pending, Done)
  - List of your circles

### 5. Test Stats Updates
To verify stats update correctly:

1. Create a new circle at `/circles/create`
2. Return to dashboard - "Active Circles" should increment
3. Make a contribution in a circle
4. Return to dashboard - "Total Contributed" should update (after contribution is marked COMPLETED)

### 6. Test Redirects
- Visit `/` while logged in → should redirect to `/dashboard`
- Visit `/dashboard` while logged out → should redirect to `/auth/login`
- Visit `/` while logged out → should show landing page

## API Testing

### Test Stats Endpoint Directly

Using curl (with your JWT token):
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/api/stats
```

Expected response:
```json
{
  "activeCircles": 2,
  "totalContributed": 100.50,
  "contributionCount": 5,
  "totalMembers": 15,
  "totalWithdrawn": 0
}
```

### Test Without Authentication
```bash
curl http://localhost:3000/api/stats
```

Expected response:
```json
{
  "error": "Unauthorized"
}
```

## Database Verification

To verify the stats are calculated correctly, you can check the database:

```sql
-- Count active circles for a user
SELECT COUNT(*) FROM "Circle" 
WHERE ("organizerId" = 'USER_ID' OR id IN (
  SELECT "circleId" FROM "CircleMember" WHERE "userId" = 'USER_ID'
)) AND status = 'ACTIVE';

-- Sum completed contributions
SELECT SUM(amount) FROM "Contribution" 
WHERE "userId" = 'USER_ID' AND status = 'COMPLETED';

-- Count total members across user's circles
SELECT COUNT(*) FROM "CircleMember" 
WHERE "circleId" IN (
  SELECT id FROM "Circle" 
  WHERE "organizerId" = 'USER_ID' OR id IN (
    SELECT "circleId" FROM "CircleMember" WHERE "userId" = 'USER_ID'
  )
) AND status = 'ACTIVE';
```

## Common Issues & Solutions

### Issue: Stats not loading
- Check browser console for errors
- Verify JWT token is valid in localStorage
- Check network tab for API call to `/api/stats`
- Verify database connection

### Issue: Stats showing 0 for everything
- This is normal for new users with no circles
- Create a circle and make contributions to see stats populate

### Issue: Redirect loop
- Clear localStorage: `localStorage.clear()`
- Logout and login again

### Issue: Skeleton loaders never disappear
- Check if `/api/stats` endpoint is responding
- Check browser console for fetch errors
- Verify authentication token is being sent

## Performance Notes

- Stats refresh automatically every 30 seconds
- Stats also refresh when you focus the browser tab
- Uses SWR for efficient caching and revalidation
- Database queries use transactions for consistency
- All queries use indexed fields for performance

## Next Steps

After verifying the basic functionality:

1. Test with multiple circles
2. Test with multiple contributions
3. Test search and filter functionality
4. Test on mobile viewport
5. Test with slow network (throttle in DevTools)
6. Verify skeleton loaders appear correctly
7. Test error states by temporarily breaking the API
