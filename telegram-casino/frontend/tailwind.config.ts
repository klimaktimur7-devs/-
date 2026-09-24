import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#14121b',
        surface2: '#17151f',
        accent: { DEFAULT: '#7C3AED', light: '#A855F7' },
        gold: { DEFAULT: '#F59E0B', light: '#FBBF24' },
        deposit: { DEFAULT: '#0EA5E9', light: '#38BDF8' },
        danger: '#EF4444',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #7C3AED, #A855F7)',
        'gold-gradient': 'linear-gradient(135deg, #F59E0B, #FBBF24)',
        'deposit-gradient': 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
      },
      borderRadius: {
        card: '16px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config;
