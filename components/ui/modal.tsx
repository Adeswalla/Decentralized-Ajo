'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  footer,
  className,
  children,
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('flex flex-col gap-0 p-0 overflow-hidden', className)}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {footer && (
          <DialogFooter className="px-6 py-4 border-t">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
