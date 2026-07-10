// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-base':     '#050506',
        'bg-surface':  '#0C0C0F',
        'bg-elevated': '#131318',
        'bg-card':     '#0F0F13',
        'bg-border':   '#1E1E26',
        'bg-hover':    '#16161C',

        // Text
        'text-primary':   '#EEEEF5',
        'text-secondary': '#A8A8B8',
        'text-dim':       '#5A5A70',
        'text-muted':     '#2E2E3A',

        // Gold
        'gold':    '#C8962A',
        'gold-hi': '#E8B84B',
        'gold-lo': '#7A5A14',

        // Status
        'status-green':  '#1DB954',
        'status-red':    '#E53E3E',
        'status-blue':   '#3B82F6',
        'status-orange': '#F97316',
        'status-purple': '#8B5CF6',
      },
      fontFamily: {
        sans: ['Barlow', 'sans-serif'],
        cond: ['Barlow Condensed', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)',
        'lg':   '0 8px 40px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)',
        'gold': '0 4px 20px rgba(200,150,42,0.3)',
      },
    },
  },
  plugins: [],
}

export default config
