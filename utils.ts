// src/lib/utils.ts

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency
export function fmt(amount: number): string {
  return `KES ${amount.toFixed(2)}`
}

// Format date
export function fmtDate(date: string): string {
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

// Time ago
export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60)   return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Generate a secure QR token
export function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const random = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => chars[b % chars.length])
    .join('')
  return `bst_${random}`
}

// Build the QR code URL for a given token
export function buildQRUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/gate?token=${token}`
}

// Order status config
export const STATUS_CONFIG = {
  'new':              { label: 'New',              color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'   },
  'confirmed':        { label: 'Confirmed',        color: '#E8B84B', bg: 'rgba(232,184,75,0.1)'   },
  'processing':       { label: 'Processing',       color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)'   },
  'out-for-delivery': { label: 'Out for Delivery', color: '#F97316', bg: 'rgba(249,115,22,0.1)'   },
  'delivered':        { label: 'Delivered',        color: '#1DB954', bg: 'rgba(29,185,84,0.1)'    },
  'cancelled':        { label: 'Cancelled',        color: '#E53E3E', bg: 'rgba(229,62,62,0.1)'    },
} as const
