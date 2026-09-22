import { AppearanceProvider } from '@/components/AppearanceProvider'

/** Loads appearance settings and injects CSS variables before rendering children. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <AppearanceProvider>{children}</AppearanceProvider>
}
