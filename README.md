# Kinetic Trust - Decentralized Identity Dashboard

A modern, responsive dashboard application for managing decentralized identity credentials and verification on the Kinetic Trust network.

## Features

- **Identity Verification**: Display user's verified identity status on the mainnet
- **Credentials Management**: View and manage active credentials with issuer details
- **Trust Score**: Visual trust score gauge showing verification level (0-100)
- **Pending Requests**: Track incoming credential and verification requests
- **Network Activity**: Real-time feed of identity verification updates and transactions
- **Admin Dashboard**: Workspace and organization management tools

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4 with dark theme
- **Icons**: Lucide React
- **Deployment**: Optimized for Vercel

## Project Structure

```
app/
├── layout.tsx           # Root layout with metadata and theme
├── page.tsx            # Main dashboard page
└── globals.css         # Global styles and design tokens

components/
├── sidebar.tsx              # Left navigation sidebar
├── header.tsx              # Top header with search and profile
├── welcome-section.tsx     # Welcome greeting section
├── credentials-section.tsx # Active credentials display
├── pending-requests-section.tsx # Pending requests table
├── trust-score-section.tsx # Trust score circular gauge
└── network-activity-section.tsx # Activity feed

lib/
└── utils.ts            # Utility functions (cn helper)
```

## Design System

### Color Palette

- **Background**: `#0f1419` (dark navy)
- **Card**: `#1a2332` (dark blue-gray)
- **Accent**: `#00d9c4` (bright cyan/teal)
- **Foreground**: `#e4e8f0` (light gray)
- **Muted**: `#3f5a7f` (muted blue)

### Typography

- **Headings**: Inter/System font, weights 600-700
- **Body**: Inter/System font, weight 400-500
- **Monospace**: Code styling for hashes and technical data

## Installation

### Quick Start with v0

1. Use the shadcn CLI to set up the project:
   ```bash
   npx shadcn-cli@latest init
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### GitHub Integration

To use with GitHub:

1. Connect your repository through the v0 project settings
2. All changes are automatically pushed to your configured branch
3. Deploy to Vercel with one click

## Components

### Sidebar
Navigation menu with role switching (Issuer/Holder), workspace links, and mainnet connection status.

### Header
Search bar for decentralized web, user status indicator, notifications, and profile avatar.

### Welcome Section
Personalized greeting with user identity, verification status, and action buttons (Share Verification, Request New).

### Credentials Section
Grid display of active credentials with:
- Credential type and icon
- Issuing organization
- Credential hash and validity period
- Active status badge

### Pending Requests Section
Table view of incoming requests with:
- Credential type
- Requesting issuer
- Current status (PENDING)

### Trust Score Section
Circular progress gauge showing:
- Trust score (0-100)
- Visual indicator of verification level
- Description of score meaning

### Network Activity Section
Timeline feed showing:
- Identity verification updates
- Request approvals
- Credential submissions
- Transaction hashes and timestamps

## Customization

### Colors

Edit the CSS variables in `app/globals.css` under `:root`:

```css
:root {
  --background: #0f1419;
  --accent: #00d9c4;
  --card: #1a2332;
  /* ... more colors ... */
}
```

### Icons

Icons are from Lucide React. Replace or add icons in component files:

```tsx
import { IconName } from 'lucide-react'
```

### Data

Currently using mock data. To integrate with a real API:

1. Create API routes in `app/api/`
2. Use SWR or React Query for data fetching
3. Update component state management
4. Add authentication as needed

## Deployment

### Deploy to Vercel

1. Push your repository to GitHub
2. Import the project in [Vercel Dashboard](https://vercel.com)
3. Click "Deploy"

The application will be live in minutes with automatic deployments on every push.

### Environment Variables

No environment variables required for the base application. Add them as needed for API integrations.

## Performance

- **Optimized Images**: Lucide SVG icons load efficiently
- **Code Splitting**: Next.js automatically splits code at route level
- **CSS-in-JS**: Tailwind CSS generates only used styles
- **Component Lazy Loading**: Components are code-split by default

## Accessibility

- Semantic HTML elements throughout
- ARIA labels where needed
- High contrast text (teal on dark background)
- Keyboard-navigable interface
- Focus states on interactive elements

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT - feel free to use for personal or commercial projects

## Support

For issues or questions:
1. Check the [Next.js Documentation](https://nextjs.org)
2. Review [Tailwind CSS Docs](https://tailwindcss.com)
3. Visit [Lucide Icons](https://lucide.dev)
4. Open a support ticket on Vercel
