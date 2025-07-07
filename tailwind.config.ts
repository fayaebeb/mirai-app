// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  variants: {
    extend: {
      backgroundColor: ['selection'],
      textColor: ['selection'],
    },
  },
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      typography: '(theme) => ({\\r\\n        invert: {\\r\\n          css: {\\r\\n            color: theme("colors.white"),\\r\\n            a: {\\r\\n              color: theme("colors.blue.400"),\\r\\n              "&:hover": { color: theme("colors.blue.300") },\\r\\n            },\\r\\n            strong: { color: theme("colors.white") },\\r\\n            code: {\\r\\n              color: theme("colors.white"),\\r\\n              backgroundColor: theme("colors.slate.800"),\\r\\n              padding: theme("spacing.0.5"),\\r\\n              borderRadius: theme("borderRadius.sm"),\\r\\n            },\\r\\n            pre: {\\r\\n              color: theme("colors.white"),\\r\\n              backgroundColor: theme("colors.slate.800"),\\r\\n            },\\r\\n            blockquote: {\\r\\n              borderLeftColor: theme("colors.blue.500"),\\r\\n              color: theme("colors.white"),\\r\\n            },\\r\\n            "h1, h2, h3, h4, h5, h6": { color: theme("colors.white") },\\r\\n            "ul > li::marker, ol > li::marker": {\\r\\n              color: theme("colors.blue.400"),\\r\\n            },\\r\\n            thead: { borderBottomColor: theme("colors.blue.500") },\\r\\n            "tbody tr": { borderBottomColor: theme("colors.blue.400") },\\r\\n          },\\r\\n        },\\r\\n      })',
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui'
        ]
      },
      fontWeight: {
        bold: '700',
        semibold: '600',
        medium: '500',
        regular: '400'
      },
      fontSize: {
        'heading-xl': [
          '36px',
          {
            lineHeight: '44px',
            letterSpacing: '0px'
          }
        ],
        'heading-l': [
          '32px',
          {
            lineHeight: '40px',
            letterSpacing: '0px'
          }
        ],
        'heading-m': [
          '28px',
          {
            lineHeight: '36px',
            letterSpacing: '0px'
          }
        ],
        'heading-s': [
          '24px',
          {
            lineHeight: '32px',
            letterSpacing: '0px'
          }
        ],
        'heading-xs': [
          '20px',
          {
            lineHeight: '28px',
            letterSpacing: '0px'
          }
        ],
        'body-xl': [
          '18px',
          {
            lineHeight: '28px',
            letterSpacing: '0.15px'
          }
        ],
        'body-l': [
          '16px',
          {
            lineHeight: '24px',
            letterSpacing: '0.15px'
          }
        ],
        'body-m': [
          '14px',
          {
            lineHeight: '20px',
            letterSpacing: '0.15px'
          }
        ],
        'body-s': [
          '12px',
          {
            lineHeight: '18px',
            letterSpacing: '0.15px'
          }
        ]
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        'noble-black': {
          '100': '#f2f2f2',
          '200': '#d9d9d9',
          '300': '#bfbfbf',
          '400': '#a6a6a6',
          '500': '#8c8c8c',
          '600': '#737373',
          '700': '#595959',
          '800': '#404040',
          '900': '#262626'
        },
        'day-green': {
          '100': '#f3eefb',
          '200': '#e1d8f7',
          '300': '#cfc2f3',
          '400': '#a8f0a6',
          '500': '#7ceb76',
          '600': '#53e646',
          '700': '#29e016',
          '800': '#21b00d',
          '900': '#198004'
        },
        'heisenberg-blue': {
          '100': '#e0f7ff',
          '200': '#b3efff',
          '300': '#80e6ff',
          '400': '#4ddcff',
          '500': '#1ad3ff',
          '600': '#00a0cc',
          '700': '#007099',
          '800': '#004066',
          '900': '#001833'
        },
        'happy-orange': {
          '100': '#fff2e6',
          '600': '#ff8000',
          '900': '#cc3000'
        },
        'electric-green': {
          '100': '#e6ffe6',
          '600': '#33cc33',
          '900': '#006600'
        },
        'red-power': {
          '100': '#ffe6e6',
          '600': '#ff3333',
          '900': '#990000'
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography"),],
} satisfies Config;
