import '../globals.css';
import { DEFAULT_PALETTE, PALETTES } from '@/content/palettes';
// Root layout of the English home page only (contract lot 2a, E9.5): the home page preloads its own fonts
// (components/portfolio-home.tsx). theme-color: background of the default palette, as on every page (lot 4, Q1).
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><head><meta name="theme-color" content={PALETTES[DEFAULT_PALETTE].bg}/></head><body>{children}</body></html>}
