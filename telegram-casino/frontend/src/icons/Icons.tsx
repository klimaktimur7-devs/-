import { CSSProperties, SVGProps, useId } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  size?: number;
  color?: string;
}

// Icons are decorative by default (aria-hidden) since they always sit next to
// a visible text label; pass an explicit aria-label to make one meaningful on
// its own (e.g. an icon-only button).
function iconA11yProps(rest: SVGProps<SVGSVGElement>) {
  return rest['aria-label'] ? {} : { 'aria-hidden': true as const };
}

// React's useId() returns ids like ":r4:" — the colons break `fill="url(#id)"`
// gradient references in some WebViews (notably iOS WKWebView, which Telegram
// uses), silently rendering a flat fill instead. Strip them for anything used
// as an SVG fragment id.
function useGradientId() {
  return useId().replace(/:/g, '');
}

export function VolumeXIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z" />
      <path d="m16.5 14.5 5-5" />
      <path d="m16.5 9.5 5 5" />
    </svg>
  );
}

export function EyeOffIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function LanguagesIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

export function CopyIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function UsersIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

export function SlidersIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M10 5H3" />
      <path d="M12 19H3" />
      <path d="M14 3v4" />
      <path d="M16 17v4" />
      <path d="M21 12h-9" />
      <path d="M21 19h-5" />
      <path d="M21 5h-7" />
      <path d="M8 10v4" />
      <path d="M8 12H3" />
    </svg>
  );
}

export function GemIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} stroke="none" {...iconA11yProps(rest)} {...rest}>
      <path d="M12.7238 1.00488H3.27565C1.53846 1.00488 0.437395 2.87874 1.31137 4.39358L7.14243 14.5002C7.52294 15.1601 8.47652 15.1601 8.85703 14.5002L14.6893 4.39358C15.5621 2.88116 14.461 1.00488 12.725 1.00488H12.7238ZM7.13769 11.4694L5.86778 9.01168L2.80363 3.53153C2.60149 3.18078 2.85116 2.7313 3.27446 2.7313H7.1365V11.4705L7.13769 11.4694ZM13.1935 3.53035L10.1305 9.01287L8.86059 11.4694V2.73011H12.7226C13.1459 2.73011 13.3956 3.17959 13.1935 3.53035Z" />
    </svg>
  );
}

export function SwordsIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="m13 19 6-6" />
      <path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5" />
      <path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="m5 14 4 4" />
      <path d="m5 21-2-2" />
      <path d="M7.5 16.5 4 20" />
    </svg>
  );
}

export function OverlapCirclesIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9.5" cy="12" r="1.4" fill={color} stroke="none" />
      <circle cx="14.5" cy="12" r="1.4" fill={color} stroke="none" />
    </svg>
  );
}

export function SparkleIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" {...iconA11yProps(rest)} {...rest}>
      <path d="M12 2c.5 4.5 1.5 5.5 6 6-4.5.5-5.5 1.5-6 6-.5-4.5-1.5-5.5-6-6 4.5-.5 5.5-1.5 6-6z" />
    </svg>
  );
}

export function SunburstIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M12,2.8 L13.91,7.38 L18.51,5.49 L16.62,10.09 L21.2,12 L16.62,13.91 L18.51,18.51 L13.91,16.62 L12,21.2 L10.09,16.62 L5.49,18.51 L7.38,13.91 L2.8,12 L7.38,10.09 L5.49,5.49 L10.09,7.38 Z" />
    </svg>
  );
}

export function UserSparkleIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M18 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="11" cy="7" r="4" />
      <path d="M18.5 12.5c.2 1.7.6 2.1 2.3 2.3-1.7.2-2.1.6-2.3 2.3-.2-1.7-.6-2.1-2.3-2.3 1.7-.2 2.1-.6 2.3-2.3z" fill={color} stroke="none" />
    </svg>
  );
}

export function StoreIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M4 9V6l1.5-3h13L20 6v3" />
      <path d="M4 9a2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 2.8.9" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <rect x="9.5" y="15" width="5" height="5" />
    </svg>
  );
}

export function GamepadIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

export function BagIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M16 10a4 4 0 0 1-8 0" />
      <path d="M3.103 6.034h17.794" />
      <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
    </svg>
  );
}

export function GiftIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M12 7v14" />
      <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
      <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" />
      <rect x="3" y="7" width="18" height="4" rx="1" />
    </svg>
  );
}

export function UserIcon({ size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function DotsGridIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" {...iconA11yProps(rest)} {...rest}>
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="8" cy="16" r="2" />
      <circle cx="16" cy="16" r="2" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function SearchIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function SortIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M7 4v16" />
      <path d="m4 7 3-3 3 3" />
      <path d="M17 20V4" />
      <path d="m14 17 3 3 3-3" />
    </svg>
  );
}

export function PencilIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} stroke="none" {...iconA11yProps(rest)} {...rest}>
      <path d="M14 14.668H2C1.72667 14.668 1.5 14.4413 1.5 14.168C1.5 13.8946 1.72667 13.668 2 13.668H14C14.2733 13.668 14.5 13.8946 14.5 14.168C14.5 14.4413 14.2733 14.668 14 14.668Z" />
      <path d="M12.6799 2.32043C11.3866 1.0271 10.1199 0.993764 8.79322 2.32043L7.98655 3.1271C7.91989 3.19376 7.89322 3.30043 7.91989 3.39376C8.42655 5.16043 9.83989 6.57376 11.6066 7.08045C11.6332 7.08712 11.6599 7.09378 11.6866 7.09378C11.7599 7.09378 11.8266 7.06712 11.8799 7.01378L12.6799 6.2071C13.3399 5.55376 13.6599 4.92043 13.6599 4.28043C13.6666 3.62043 13.3466 2.98043 12.6799 2.32043Z" />
      <path d="M10.4066 7.68807C10.2132 7.59473 10.0266 7.5014 9.84657 7.39473C9.69991 7.30807 9.55991 7.21473 9.41991 7.11473C9.30657 7.0414 9.17324 6.93473 9.04657 6.82807C9.03324 6.8214 8.98657 6.7814 8.93324 6.72807C8.71324 6.54139 8.46657 6.30139 8.24657 6.03472C8.22657 6.02139 8.19324 5.97472 8.14657 5.91472C8.07991 5.83472 7.96657 5.70139 7.86657 5.54805C7.78657 5.44805 7.69324 5.30139 7.60657 5.15472C7.49991 4.97472 7.40657 4.79472 7.31324 4.60805C7.29911 4.57779 7.28544 4.54768 7.27217 4.51775C7.17377 4.29553 6.88404 4.23057 6.71217 4.40241L2.89322 8.2214C2.80655 8.30807 2.72655 8.47473 2.70655 8.58807L2.34655 11.1414C2.27989 11.5947 2.40655 12.0214 2.68655 12.3081C2.92655 12.5414 3.25989 12.6681 3.61989 12.6681C3.69989 12.6681 3.77989 12.6614 3.85989 12.6481L6.41989 12.2881C6.53989 12.2681 6.70657 12.1881 6.78657 12.1014L10.6008 8.2872C10.7738 8.11413 10.7085 7.8172 10.4834 7.72113C10.4581 7.71033 10.4325 7.69927 10.4066 7.68807Z" />
    </svg>
  );
}

export function PlusIcon({ size = 16, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function StarIcon({ size = 14, color = '#FBBF24', ...rest }: IconProps) {
  const gradientId = useGradientId();
  const isDefaultGold = color === '#FBBF24';
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" {...iconA11yProps(rest)} {...rest}>
      {isDefaultGold && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FDEB32" />
            <stop offset="44%" stopColor="#FEBD04" />
            <stop offset="100%" stopColor="#D75902" />
          </linearGradient>
        </defs>
      )}
      <path
        transform="rotate(-20 128 128)"
        fill={isDefaultGold ? `url(#${gradientId})` : color}
        d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"
      />
    </svg>
  );
}

export function CheckIcon({ size = 10, color = '#fff', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function TrophyIcon({ size = 14, color = '#4ADE80', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" />
      <path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" />
      <path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" />
      <path d="M4 22h16" />
      <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />
      <path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" />
    </svg>
  );
}

export function FrownIcon({ size = 14, color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16c-1-1.5-2.5-2.25-4-2.25S9 14.5 8 16" />
      <ellipse cx="9" cy="9.5" rx="1" ry="1.5" fill={color} stroke="none" />
      <ellipse cx="15" cy="9.5" rx="1" ry="1.5" fill={color} stroke="none" />
    </svg>
  );
}

export function CircleXIcon({ size = 14, color = '#F87171', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

export function ZapIcon({ size = 14, color = '#FBBF24', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" {...iconA11yProps(rest)} {...rest}>
      <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
    </svg>
  );
}

export function TonIcon({ size = 20, color = '#0098EA', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" {...iconA11yProps(rest)} {...rest}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM7.902 6.697h8.196c1.505 0 2.462 1.628 1.705 2.94l-5.059 8.765a.86.86 0 0 1-1.488 0L6.199 9.637c-.758-1.314.197-2.94 1.703-2.94zm4.844 1.496v7.58l1.102-2.128 2.656-4.756a.465.465 0 0 0-.408-.696h-3.35zM7.9 8.195a.464.464 0 0 0-.408.694l2.658 4.754 1.102 2.13V8.195H7.9z" />
    </svg>
  );
}

// Glossy 3D-look TON coin: same gem mark as TonIcon, but with a radial shading
// gradient and a highlight streak so it reads as a sphere, not a flat disc.
//
// Built from plain CSS radial-gradient backgrounds rather than SVG <radialGradient>
// fills — some Telegram in-app WebViews fail to paint SVG gradient references
// (fill="url(#id)") at all and silently render a flat circle instead, which CSS
// background gradients don't suffer from.
export function GlossyTonCoin({
  size = 44,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  // A flat circle reads as a sticker, not a coin. Real coin art shows the
  // cylinder's edge: a darker rim peeking out along the bottom because the
  // face is tilted slightly toward the viewer. Fake that with two stacked
  // circles — a darker "edge" circle offset down, and the lighter face on
  // top covering everything but that bottom sliver.
  const rimOffset = size * 0.16;
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size, position: 'relative', ...style }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: rimOffset,
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 20%, #1B6E93 0%, #073B5C 85%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 32% 28%, #8FE3FF 0%, #38BDF8 45%, #0863A0 100%)',
          boxShadow:
            'inset 0 0 0 2px rgba(4,60,92,0.55), inset 0 -3px 4px rgba(4,60,92,0.5), inset 0 2px 3px rgba(255,255,255,0.35)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '10%',
            top: '10%',
            width: '55%',
            height: '35%',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)',
          }}
        />
        <svg width={size} height={size} viewBox="0 0 48 48" style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(10.4 10.4) scale(1.7)" fill="#fff">
            <path d="M12.7238 1.00488H3.27565C1.53846 1.00488 0.437395 2.87874 1.31137 4.39358L7.14243 14.5002C7.52294 15.1601 8.47652 15.1601 8.85703 14.5002L14.6893 4.39358C15.5621 2.88116 14.461 1.00488 12.725 1.00488H12.7238ZM7.13769 11.4694L5.86778 9.01168L2.80363 3.53153C2.60149 3.18078 2.85116 2.7313 3.27446 2.7313H7.1365V11.4705L7.13769 11.4694ZM13.1935 3.53035L10.1305 9.01287L8.86059 11.4694V2.73011H12.7226C13.1459 2.73011 13.3956 3.17959 13.1935 3.53035Z" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export function UsdtIcon({ size = 20, color = '#26A17B', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" {...iconA11yProps(rest)} {...rest}>
      <path d="M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z" />
    </svg>
  );
}

export function DicesIcon({ size = 14, color = '#38BDF8', ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...iconA11yProps(rest)} {...rest}>
      <rect width="12" height="12" x="2" y="10" rx="2" ry="2" />
      <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" />
      <path d="M6 18h.01" />
      <path d="M10 14h.01" />
      <path d="M15 6h.01" />
      <path d="M18 9h.01" />
    </svg>
  );
}
