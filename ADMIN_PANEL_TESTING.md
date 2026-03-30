# Admin Panel Testing Guide

## Overview
The Admin Panel is an organizer-only interface for managing circles. It's accessible via a dedicated "Admin" tab on the Circle Detail page.

## Security Features
- **Client-side check**: Admin tab only visible to organizers
- **Server-side check**: All API endpoints verify organizer status
- **Component-level check**: AdminPanel component returns null for non-organizers

## Testing Checklist

### 1. Access Control Tests

#### Test as Organizer
1. Log in as the circle organizer
2. Navigate to a circle you created
3. ✅ Verify "Admin" tab is visible in the tabs list
4. ✅ Click on "Admin" tab and verify the admin panel loads
5. ✅ Verify all admin controls are visible:
   - Invite Member section
   - Remove Member section
   - Dissolve Circle button

#### Test as Regular Member
1. Log in as a regular circle member (not organizer)
2. Navigate to a circle you're a member of
3. ✅ Verify "Admin" tab is NOT visible
4. ✅ Verify only 4 tabs are shown (Overview, Members, Contributions, Governance)

#### Test as Non-Member
1. Log in as a user who is not a member of the circle
2. Try to access the circle
3. ✅ Verify you're redirected or shown an access denied message

### 2. Invite Member Functionality

1. As organizer, go to Admin tab
2. Enter a valid email address of an existing user
3. Click "Invite" button
4. ✅ Verify success toast appears
5. ✅ Navigate to Members tab and verify new member appears
6. ✅ Verify new member has correct rotation order

#### Edge Cases
- ✅ Try inviting with invalid email format (should show error)
- ✅ Try inviting a user who doesn't exist (should show error)
- ✅ Try inviting a user who is already a member (should show error)
- ✅ Try inviting with empty email field (should show error)

### 3. Remove Member Functionality

1. As organizer, go to Admin tab
2. Select a member from the dropdown (not yourself)
3. Click "Remove" button
4. ✅ Verify confirmation dialog appears
5. ✅ Read the warning message
6. Click "Remove Member" in the dialog
7. ✅ Verify success toast appears
8. ✅ Navigate to Members tab and verify member is removed or marked as EXITED
9. ✅ Verify database shows member status as EXITED with leftAt timestamp

#### Edge Cases
- ✅ Verify organizer cannot be selected in the dropdown
- ✅ Try removing without selecting a member (button should be disabled)
- ✅ Cancel the confirmation dialog and verify no changes occur

### 4. Dissolve Circle Functionality

1. As organizer, go to Admin tab
2. Click "Dissolve Circle" button
3. ✅ Verify confirmation dialog appears with warning
4. ✅ Try clicking "Dissolve Circle" without typing DELETE (should be disabled)
5. Type "DELETE" in the input field
6. ✅ Verify button becomes enabled
7. Click "Dissolve Circle"
8. ✅ Verify success toast appears
9. ✅ Verify redirect to dashboard after 2 seconds
10. ✅ Navigate back to circle and verify status is CANCELLED
11. ✅ Verify all members show status as EXITED

#### Edge Cases
- ✅ Type "delete" (lowercase) - should not work
- ✅ Type "DELET" (incomplete) - should not work
- ✅ Cancel the dialog and verify no changes occur
- ✅ Verify circle is no longer accessible to regular members

### 5. Database Synchronization Tests

After each operation, verify database state:

#### After Invite
```sql
SELECT * FROM "CircleMember" WHERE "circleId" = '[circle-id]' ORDER BY "rotationOrder";
```
- ✅ New member exists with correct userId
- ✅ Status is ACTIVE
- ✅ rotationOrder is sequential

#### After Remove
```sql
SELECT * FROM "CircleMember" WHERE id = '[member-id]';
```
- ✅ Status changed to EXITED
- ✅ leftAt timestamp is set

#### After Dissolve
```sql
SELECT * FROM "Circle" WHERE id = '[circle-id]';
SELECT * FROM "CircleMember" WHERE "circleId" = '[circle-id]';
```
- ✅ Circle status is CANCELLED
- ✅ All members have status EXITED
- ✅ All members have leftAt timestamp

### 6. UI/UX Tests

1. ✅ Verify red border on admin panel card (danger zone styling)
2. ✅ Verify AlertTriangle icon appears in card header
3. ✅ Verify all buttons have appropriate icons
4. ✅ Verify loading states work (buttons show "Inviting...", "Removing...", "Dissolving...")
5. ✅ Verify buttons are disabled during operations
6. ✅ Verify form inputs are disabled during operations
7. ✅ Verify help text appears under each section
8. ✅ Verify separators between sections

### 7. API Endpoint Tests

Test endpoints directly (using Postman, curl, or similar):

#### POST /api/circles/[id]/admin/invite
```bash
curl -X POST http://localhost:3000/api/circles/[id]/admin/invite \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```
- ✅ Returns 200 with success message
- ✅ Returns 401 without token
- ✅ Returns 403 if not organizer
- ✅ Returns 404 if circle not found
- ✅ Returns 404 if user not found
- ✅ Returns 400 if user already member

#### POST /api/circles/[id]/admin/remove-member
```bash
curl -X POST http://localhost:3000/api/circles/[id]/admin/remove-member \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"memberId": "[member-id]"}'
```
- ✅ Returns 200 with success message
- ✅ Returns 401 without token
- ✅ Returns 403 if not organizer
- ✅ Returns 404 if member not found
- ✅ Returns 400 if trying to remove organizer

#### POST /api/circles/[id]/admin/dissolve
```bash
curl -X POST http://localhost:3000/api/circles/[id]/admin/dissolve \
  -H "Authorization: Bearer [token]"
```
- ✅ Returns 200 with success message
- ✅ Returns 401 without token
- ✅ Returns 403 if not organizer
- ✅ Returns 404 if circle not found

## Known Limitations

1. Invite functionality requires the user to already exist in the system
2. Removed members cannot be re-added (status remains EXITED)
3. Dissolve action is irreversible
4. No email notifications are sent (future enhancement)

## Future Enhancements

- Email invitations for non-registered users
- Ability to modify member rotation order
- Bulk member operations
- Activity log for admin actions
- Email notifications for admin actions
- Undo functionality for recent actions
