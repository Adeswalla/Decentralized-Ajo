interface MemberAvatarProps {
  address: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function MemberAvatar({ address, name, size = 'md' }: MemberAvatarProps) {
  // Generate color based on address
  const hash = address.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
  
  const colors = [
    'from-stellar to-indigo',
    'from-indigo to-purple-600',
    'from-success to-teal-500',
    'from-warning to-orange-500',
    'from-danger to-red-600',
  ]
  
  const colorClass = colors[Math.abs(hash) % colors.length]
  const initials = (name || address).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  // Truncate address
  const truncatedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center font-bold text-white flex-shrink-0`}>
        {initials || '○'}
      </div>
      {size !== 'sm' && (
        <div className="flex-1 min-w-0">
          {name && <div className="text-sm font-medium text-foreground truncate">{name}</div>}
          <div className="text-xs text-muted-foreground font-mono">{truncatedAddress}</div>
        </div>
      )}
    </div>
  )
}
