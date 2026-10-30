import { CSSProperties } from 'react'
import mark from './assets/claude-mark.png'

// The Claude spark. The shape comes from the icon shipped with the installed Claude app (a black shape on transparent),
// used as a mask so it can take any colour.
export default function ClaudeMark({ size = 18, color, style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        background: color ?? 'currentColor',
        WebkitMaskImage: `url(${mark})`, maskImage: `url(${mark})`,
        WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        ...style,
      }}
    />
  )
}
