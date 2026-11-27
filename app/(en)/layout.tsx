import '../globals.css';
import { DEFAULT_PALETTE, PALETTES } from '@/content/palettes';
// Interior pages (lot 4): the two fonts of the home page are preloaded so that the first paint already uses them (no
// layout shift when they arrive); theme-color is the background of the default palette (contract lot 4, Q1).
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><head><meta name="theme-color" content={PALETTES[DEFAULT_PALETTE].bg}/><link rel="preload" href="/fonts/inter-tight-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" href="/fonts/ibm-plex-mono-regular-latin1.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body>{children}</body></html>}
