import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export const fmt = (n:number) => `KES ${Number(n).toFixed(2)}`
export const timeAgo = (date:string) => { const s=Math.floor((Date.now()-new Date(date).getTime())/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago` }
export const generateToken = () => { const chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; return 'bst_'+Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>chars[b%chars.length]).join('') }
export const buildQRUrl = (token:string) => `${process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'}/gate?token=${token}`
export const STATUS_CONFIG = { 'new':{label:'New',color:'#3B82F6',bg:'rgba(59,130,246,0.1)'}, 'confirmed':{label:'Confirmed',color:'#E8B84B',bg:'rgba(232,184,75,0.1)'}, 'processing':{label:'Processing',color:'#8B5CF6',bg:'rgba(139,92,246,0.1)'}, 'out-for-delivery':{label:'Out for Delivery',color:'#F97316',bg:'rgba(249,115,22,0.1)'}, 'delivered':{label:'Delivered',color:'#1DB954',bg:'rgba(29,185,84,0.1)'}, 'cancelled':{label:'Cancelled',color:'#E53E3E',bg:'rgba(229,62,62,0.1)'} } as const
