import type { ReactElement, SVGProps } from 'react';
import { Camera, Gamepad2, Globe, House, Monitor, Signpost, Store, type LucideProps } from 'lucide-react';

/** Hand-drawn ball icons in the same 24px stroke style as the rest of the set. */
function SoccerBall(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m12 7 4.2 3-1.6 5h-5.2L7.8 10z" />
      <path d="M12 7V2.5M16.2 10l4.3-1.5M14.6 15l2.7 4M9.4 15l-2.7 4M7.8 10 3.5 8.5" />
    </svg>
  );
}

function Basketball(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2v20" />
      <path d="M5 4.9c2.6 2 3.9 4.3 3.9 7.1S7.6 17.1 5 19.1M19 4.9c-2.6 2-3.9 4.3-3.9 7.1s1.3 5.1 3.9 7.1" />
    </svg>
  );
}

export const ICONS = {
  arcade: Gamepad2,
  monitor: Monitor,
  psp: Gamepad2,
  globe: Globe,
  camera: Camera,
  house: House,
  stall: Store,
  sign: Signpost,
  soccer: SoccerBall,
  basketball: Basketball
} satisfies Record<string, (props: LucideProps & SVGProps<SVGSVGElement>) => unknown>;

export type IconName = keyof typeof ICONS;

/** A station or UI icon by name. */
export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const Component = ICONS[name] as (props: SVGProps<SVGSVGElement>) => ReactElement;
  return <Component width={size} height={size} aria-hidden="true" {...rest} />;
}
