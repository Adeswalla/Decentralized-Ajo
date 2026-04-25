'use client';

/**
 * ExplorerLink — renders a truncated hash / ID with an external Stellar
 * Explorer link (and an optional Stellar Lab link).
 *
 * Props
 * ─────
 * hash        The full transaction hash or contract / account ID.
 * type        'tx' | 'contract' | 'account'  (default: 'tx')
 * label       Override the displayed text (defaults to truncated hash).
 * showLab     When true, also renders a secondary "Lab" link.
 * className   Additional classes for the outer <span>.
 */

import { ExternalLink, FlaskConical } from 'lucide-react';
import {
  getStellarExplorerTxUrl,
  getStellarExplorerContractUrl,
  getStellarExplorerAccountUrl,
  getStellarLabTxUrl,
  getStellarLabContractUrl,
  getStellarNetworkLabel,
} from '@/lib/stellar-explorer';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateHash(hash: string, chars = 6): string {
  if (!hash) return '';
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExplorerLinkProps {
  hash: string;
  type?: 'tx' | 'contract' | 'account';
  /** Override the anchor label. Defaults to a truncated hash. */
  label?: string;
  /** Show a secondary Stellar Lab link (only meaningful for tx / contract). */
  showLab?: boolean;
  /** Extra classes on the wrapper <span>. */
  className?: string;
  /** Number of chars to keep at each end of the truncated display. Default 6. */
  truncateChars?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExplorerLink({
  hash,
  type = 'tx',
  label,
  showLab = false,
  className,
  truncateChars = 6,
}: ExplorerLinkProps) {
  if (!hash) return null;

  // Resolve URLs
  const explorerResult =
    type === 'tx'
      ? getStellarExplorerTxUrl(hash)
      : type === 'contract'
      ? getStellarExplorerContractUrl(hash)
      : getStellarExplorerAccountUrl(hash);

  const labResult =
    showLab && type !== 'account'
      ? type === 'tx'
        ? getStellarLabTxUrl(hash)
        : getStellarLabContractUrl(hash)
      : null;

  const displayText = label ?? truncateHash(hash, truncateChars);
  const networkLabel = getStellarNetworkLabel();

  // Graceful degradation: unsupported network
  if (!explorerResult.supported || !explorerResult.url) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-mono text-xs text-muted-foreground',
          className
        )}
        title={`Explorer links unavailable — unknown network config (${networkLabel})`}
      >
        <span>{displayText}</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-xs', className)}>
      {/* Hash + Explorer link */}
      <a
        href={explorerResult.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`View on Stellar Expert (${networkLabel}): ${hash}`}
        className="inline-flex items-center gap-0.5 text-primary hover:underline underline-offset-2 transition-colors"
      >
        <span>{displayText}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      </a>

      {/* Optional Lab link */}
      {labResult?.supported && labResult.url && (
        <a
          href={labResult.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open in Stellar Lab (${networkLabel})`}
          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Open in Stellar Lab"
        >
          <FlaskConical className="h-3 w-3 shrink-0" aria-hidden="true" />
        </a>
      )}
    </span>
  );
}
