import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "eye"
  | "eyeOff"
  | "chevronDown"
  | "threeDots"
  | "editor"
  | "presets"
  | "account"
  | "remove"
  | "add"
  | "close"
  | "copy"
  | "eyedropper"
  | "cube"
  | "about"
  | "preferences"
  | "cookies"
  | "sparkle"
  | "gear"
  | "billing"
  | "support"
  | "logout"
  | "upload"
  | "delete"
  | "lock"
  | "search"
  | "filter"
  | "cluster"
  | "box"
  | "code"
  | "chain"
  | "stars"
  | "filterFunnel"
  | "closeChip"
  | "help"
  | "chevronRight";

// SVG markup lives inline here (not imported from an assets folder) so
// adding a new icon is a one-file edit - see the paste.txt example this
// pattern is based on. Each entry is a small render function (not a plain
// JSX element) so {...props} is applied per-call, the same as every
// standalone icon component before this migration.
const icons: Record<IconName, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  eye: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.41421 9.41421C9.78929 9.03914 10 8.53043 10 8C10 7.46957 9.78929 6.96086 9.41421 6.58579C9.03914 6.21071 8.53043 6 8 6C7.46957 6 6.96086 6.21071 6.58579 6.58579C6.21071 6.96086 6 7.46957 6 8C6 8.53043 6.21071 9.03914 6.58579 9.41421C6.96086 9.78929 7.46957 10 8 10C8.53043 10 9.03914 9.78929 9.41421 9.41421Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.63867 7.99998C2.48801 5.29531 5.01534 3.33331 8.00001 3.33331C10.9853 3.33331 13.512 5.29531 14.3613 7.99998C13.512 10.7046 10.9853 12.6666 8.00001 12.6666C5.01534 12.6666 2.48801 10.7046 1.63867 7.99998Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  eyeOff: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.25 12.55C8.8379 12.6279 8.4194 12.667 8 12.6667C5.01467 12.6667 2.488 10.7047 1.638 8C1.86685 7.27207 2.21933 6.58898 2.68 5.98067M11.608 11.608L9.414 9.41467L6.58533 6.586C6.96044 6.2109 7.46919 6.00016 7.99967 6.00016C8.53015 6.00016 9.0389 6.2109 9.414 6.586C9.78911 6.9611 9.99984 7.46986 9.99984 8.00033C9.99984 8.53081 9.78911 9.03956 9.414 9.41467M6.58533 6.586L9.41333 9.41333M6.58667 6.58667L4.39333 4.39333M4.39333 4.39333L2 2M4.39333 4.39333C5.46824 3.69971 6.72073 3.3316 8 3.33333C10.9853 3.33333 13.512 5.29533 14.362 8C13.8927 9.48697 12.9183 10.763 11.6073 11.6073M4.39333 4.39333L11.6073 11.6073M11.6073 11.6073L14 14"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  chevronDown: (props) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M9.5 4.5L6 8L2.5 4.5" stroke="#858179" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  threeDots: (props) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M5 12H5.01M12 12H12.01M19 12H19.01M6 12C6 12.2652 5.89464 12.5196 5.70711 12.7071C5.51957 12.8946 5.26522 13 5 13C4.73478 13 4.48043 12.8946 4.29289 12.7071C4.10536 12.5196 4 12.2652 4 12C4 11.7348 4.10536 11.4804 4.29289 11.2929C4.48043 11.1054 4.73478 11 5 11C5.26522 11 5.51957 11.1054 5.70711 11.2929C5.89464 11.4804 6 11.7348 6 12ZM13 12C13 12.2652 12.8946 12.5196 12.7071 12.7071C12.5196 12.8946 12.2652 13 12 13C11.7348 13 11.4804 12.8946 11.2929 12.7071C11.1054 12.5196 11 12.2652 11 12C11 11.7348 11.1054 11.4804 11.2929 11.2929C11.4804 11.1054 11.7348 11 12 11C12.2652 11 12.5196 11.1054 12.7071 11.2929C12.8946 11.4804 13 11.7348 13 12ZM20 12C20 12.2652 19.8946 12.5196 19.7071 12.7071C19.5196 12.8946 19.2652 13 19 13C18.7348 13 18.4804 12.8946 18.2929 12.7071C18.1054 12.5196 18 12.2652 18 12C18 11.7348 18.1054 11.4804 18.2929 11.2929C18.4804 11.1054 18.7348 11 19 11C19.2652 11 19.5196 11.1054 19.7071 11.2929C19.8946 11.4804 20 11.7348 20 12Z"
        stroke="#ECE8E2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  editor: (props) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M9.99999 5.00016V3.3335M9.99999 5.00016C9.55797 5.00016 9.13404 5.17576 8.82148 5.48832C8.50892 5.80088 8.33333 6.2248 8.33333 6.66683C8.33333 7.10886 8.50892 7.53278 8.82148 7.84534C9.13404 8.1579 9.55797 8.3335 9.99999 8.3335M9.99999 5.00016C10.442 5.00016 10.8659 5.17576 11.1785 5.48832C11.4911 5.80088 11.6667 6.2248 11.6667 6.66683C11.6667 7.10886 11.4911 7.53278 11.1785 7.84534C10.8659 8.1579 10.442 8.3335 9.99999 8.3335M9.99999 8.3335V16.6668M4.99999 11.6668C4.55797 11.6668 4.13404 11.8424 3.82148 12.155C3.50892 12.4675 3.33333 12.8915 3.33333 13.3335C3.33333 13.7755 3.50892 14.1994 3.82148 14.512C4.13404 14.8246 4.55797 15.0002 4.99999 15.0002C5.44202 15.0002 5.86595 14.8246 6.17851 14.512C6.49107 14.1994 6.66666 13.7755 6.66666 13.3335C6.66666 12.8915 6.49107 12.4675 6.17851 12.155C5.86595 11.8424 5.44202 11.6668 4.99999 11.6668ZM4.99999 15.0002V16.6668M4.99999 11.6668V3.3335M15 11.6668C14.558 11.6668 14.134 11.8424 13.8215 12.155C13.5089 12.4675 13.3333 12.8915 13.3333 13.3335C13.3333 13.7755 13.5089 14.1994 13.8215 14.512C14.134 14.8246 14.558 15.0002 15 15.0002C15.442 15.0002 15.8659 14.8246 16.1785 14.512C16.4911 14.1994 16.6667 13.7755 16.6667 13.3335C16.6667 12.8915 16.4911 12.4675 16.1785 12.155C15.8659 11.8424 15.442 11.6668 15 11.6668ZM15 15.0002V16.6668M15 11.6668V3.3335"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  presets: (props) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M14.1667 11.6668V16.6668M11.6667 14.1668H16.6667M5.00001 8.3335H6.66668C7.1087 8.3335 7.53263 8.1579 7.84519 7.84534C8.15775 7.53278 8.33334 7.10886 8.33334 6.66683V5.00016C8.33334 4.55814 8.15775 4.13421 7.84519 3.82165C7.53263 3.50909 7.1087 3.3335 6.66668 3.3335H5.00001C4.55798 3.3335 4.13406 3.50909 3.8215 3.82165C3.50894 4.13421 3.33334 4.55814 3.33334 5.00016V6.66683C3.33334 7.10886 3.50894 7.53278 3.8215 7.84534C4.13406 8.1579 4.55798 8.3335 5.00001 8.3335ZM13.3333 8.3335H15C15.442 8.3335 15.866 8.1579 16.1785 7.84534C16.4911 7.53278 16.6667 7.10886 16.6667 6.66683V5.00016C16.6667 4.55814 16.4911 4.13421 16.1785 3.82165C15.866 3.50909 15.442 3.3335 15 3.3335H13.3333C12.8913 3.3335 12.4674 3.50909 12.1548 3.82165C11.8423 4.13421 11.6667 4.55814 11.6667 5.00016V6.66683C11.6667 7.10886 11.8423 7.53278 12.1548 7.84534C12.4674 8.1579 12.8913 8.3335 13.3333 8.3335ZM5.00001 16.6668H6.66668C7.1087 16.6668 7.53263 16.4912 7.84519 16.1787C8.15775 15.8661 8.33334 15.4422 8.33334 15.0002V13.3335C8.33334 12.8915 8.15775 12.4675 7.84519 12.155C7.53263 11.8424 7.1087 11.6668 6.66668 11.6668H5.00001C4.55798 11.6668 4.13406 11.8424 3.8215 12.155C3.50894 12.4675 3.33334 12.8915 3.33334 13.3335V15.0002C3.33334 15.4422 3.50894 15.8661 3.8215 16.1787C4.13406 16.4912 4.55798 16.6668 5.00001 16.6668Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  account: (props) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12.357 8.19036C12.9821 7.56523 13.3333 6.71739 13.3333 5.83333C13.3333 4.94928 12.9821 4.10143 12.357 3.47631C11.7319 2.85119 10.884 2.5 9.99999 2.5C9.11593 2.5 8.26809 2.85119 7.64297 3.47631C7.01785 4.10143 6.66666 4.94928 6.66666 5.83333C6.66666 6.71739 7.01785 7.56523 7.64297 8.19036C8.26809 8.81548 9.11593 9.16667 9.99999 9.16667C10.884 9.16667 11.7319 8.81548 12.357 8.19036Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.8752 13.3752C6.96916 12.2812 8.45289 11.6667 9.99999 11.6667C11.5471 11.6667 13.0308 12.2812 14.1248 13.3752C15.2187 14.4692 15.8333 15.9529 15.8333 17.5H4.16666C4.16666 15.9529 4.78124 14.4692 5.8752 13.3752Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  remove: (props) => (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M4.66699 5.99984V9.99984M7.33366 5.99984V9.99984M0.666992 3.33317H11.3337M10.667 3.33317L10.089 11.4278C10.065 11.7642 9.91452 12.079 9.66774 12.3089C9.42095 12.5387 9.09623 12.6665 8.75899 12.6665H3.24166C2.90442 12.6665 2.5797 12.5387 2.33292 12.3089C2.08613 12.079 1.9356 11.7642 1.91166 11.4278L1.33366 3.33317H10.667ZM8.00033 3.33317V1.33317C8.00033 1.15636 7.93009 0.98679 7.80506 0.861766C7.68004 0.736742 7.51047 0.666504 7.33366 0.666504H4.66699C4.49018 0.666504 4.32061 0.736742 4.19559 0.861766C4.07056 0.98679 4.00033 1.15636 4.00033 1.33317V3.33317H8.00033Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  add: (props) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M6 3V6M6 6V9M6 6H9M6 6H3" stroke="#2D2C29" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (props) => (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 1L10 10M1 10L10 1L1 10Z" stroke="#2D2C29" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // A separate, much smaller "x" for the filter chips' own remove button -
  // not just `close` scaled down via width/height props, since scaling the
  // whole 11x11/strokeWidth:2 glyph down to 6x6 would scale the stroke down
  // with it (to ~1.1px, not the requested 0.67px) rather than keep a real,
  // separately-chosen hairline weight. Own viewBox sized to match the
  // rendered box 1:1, so strokeWidth is a literal px value, not a ratio.
  closeChip: (props) => (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1 1L5 5M1 5L5 1" stroke="currentColor" strokeWidth="0.67" strokeLinecap="round" />
    </svg>
  ),
  copy: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M5.33329 10.6667H3.99996C3.64634 10.6667 3.3072 10.5263 3.05715 10.2762C2.8071 10.0262 2.66663 9.68704 2.66663 9.33341V4.00008C2.66663 3.64646 2.8071 3.30732 3.05715 3.05727C3.3072 2.80722 3.64634 2.66675 3.99996 2.66675H9.33329C9.68691 2.66675 10.0261 2.80722 10.2761 3.05727C10.5262 3.30732 10.6666 3.64646 10.6666 4.00008V5.33341M6.66663 13.3334H12C12.3536 13.3334 12.6927 13.1929 12.9428 12.9429C13.1928 12.6928 13.3333 12.3537 13.3333 12.0001V6.66675C13.3333 6.31313 13.1928 5.97399 12.9428 5.72394C12.6927 5.47389 12.3536 5.33341 12 5.33341H6.66663C6.313 5.33341 5.97387 5.47389 5.72382 5.72394C5.47377 5.97399 5.33329 6.31313 5.33329 6.66675V12.0001C5.33329 12.3537 5.47377 12.6928 5.72382 12.9429C5.97387 13.1929 6.313 13.3334 6.66663 13.3334Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode asset (copy-paste/paste.txt), replacing the earlier
  // hand-drawn placeholder. The pasted svg wrapped its path in a
  // <clipPath>/<defs> pair clipping to the full 0-16 viewBox - every path
  // coordinate already stays within that range on its own (checked, not
  // assumed), so the clip was a no-op and is dropped here rather than kept
  // (an unused clipPath id is also a real risk in this file specifically,
  // since icons[name] render functions are invoked directly rather than
  // mounted as their own component - a duplicate id would collide if this
  // icon were ever rendered twice at once). stroke swapped from the pasted
  // fixed #858179 to currentColor, matching every other interactive icon in
  // this file, since EyeDropperButton drives its color via hover/disabled
  // state.
  eyedropper: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M8.00016 5.99997L2.39083 11.6093C2.14076 11.8593 2.00024 12.1984 2.00016 12.552V13.448C2.00009 13.8016 1.85956 14.1406 1.6095 14.3906M1.6095 14.3906C1.85949 14.1406 2.19857 14 2.55216 14H3.44816C3.80176 13.9999 4.14084 13.8594 4.39083 13.6093L10.0002 7.99997M1.6095 14.3906L1.3335 14.6666M12.0002 5.99997L12.2668 6.26664C12.3982 6.39796 12.5023 6.55386 12.5734 6.72544C12.6445 6.89702 12.681 7.08092 12.681 7.26664C12.681 7.45236 12.6445 7.63625 12.5734 7.80783C12.5023 7.97942 12.3982 8.13532 12.2668 8.26664C12.1355 8.39796 11.9796 8.50213 11.808 8.5732C11.6364 8.64427 11.4525 8.68085 11.2668 8.68085C11.0811 8.68085 10.8972 8.64427 10.7256 8.5732C10.5541 8.50213 10.3982 8.39796 10.2668 8.26664L7.7335 5.73331C7.46828 5.46809 7.31928 5.10838 7.31928 4.73331C7.31928 4.54759 7.35586 4.36369 7.42693 4.19211C7.498 4.02053 7.60217 3.86463 7.7335 3.73331C7.86482 3.60198 8.02072 3.49781 8.1923 3.42674C8.36388 3.35567 8.54778 3.31909 8.7335 3.31909C9.10857 3.31909 9.46828 3.46809 9.7335 3.73331L10.0002 3.99997L12.2668 1.73331C12.532 1.46809 12.8918 1.31909 13.2668 1.31909C13.6419 1.31909 14.0016 1.46809 14.2668 1.73331C14.532 1.99852 14.681 2.35823 14.681 2.73331C14.681 3.10838 14.532 3.46809 14.2668 3.73331L12.0002 5.99997Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode asset (copy-paste/paste.txt) - an isometric cube
  // outline, used by AppliedGradientsMenu.tsx's rows to mark each listed
  // element.
  cube: (props) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M6 10.5L2 8.5V3.5L6 1.5L10 3.5V8.5L6 10.5ZM10 3.5L6 5.5M2 3.5L6 5.5M6 5.5V10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode assets (copy-paste/paste.txt) - HeaderAppMenu.tsx's
  // "..." menu rows. Stroke swapped from the pasted fixed colors (About's
  // export was pink/#E23F8C, Preferences/Cookies were gray/#858179) to
  // currentColor - a real bug found by testing: with the fixed pink kept,
  // About rendered visibly "highlighted" (accent-colored) the instant the
  // menu opened, even though nothing had been clicked yet. HeaderAppMenu
  // drives each row's actual color via its own click state (text-secondary
  // at rest, text-color-accent once clicked - see that component's
  // activeLabel), the same way AppliedGradientsMenu's "cube" icon already
  // does for its own rows - these three need to follow that same pattern to
  // stay in sync with their row's real state instead of a hardcoded color.
  about: (props) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M4.114 4.5C4.3885 3.9175 5.129 3.5 6 3.5C7.105 3.5 8 4.1715 8 5C8 5.7 7.361 6.2875 6.497 6.4535C6.226 6.5055 6 6.7235 6 7M6 8.5H6.005M10.5 6C10.5 6.59095 10.3836 7.17611 10.1575 7.72208C9.93131 8.26804 9.59984 8.76412 9.18198 9.18198C8.76412 9.59984 8.26804 9.93131 7.72208 10.1575C7.17611 10.3836 6.59095 10.5 6 10.5C5.40905 10.5 4.82389 10.3836 4.27792 10.1575C3.73196 9.93131 3.23588 9.59984 2.81802 9.18198C2.40016 8.76412 2.06869 8.26804 1.84254 7.72208C1.6164 7.17611 1.5 6.59095 1.5 6C1.5 4.80653 1.97411 3.66193 2.81802 2.81802C3.66193 1.97411 4.80653 1.5 6 1.5C7.19347 1.5 8.33807 1.97411 9.18198 2.81802C10.0259 3.66193 10.5 4.80653 10.5 6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  preferences: (props) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M6.8375 2.1585C6.6245 1.2805 5.3755 1.2805 5.1625 2.1585C5.0245 2.726 4.3745 2.995 3.8765 2.691C3.1045 2.221 2.2215 3.1045 2.6915 3.876C2.76215 3.99188 2.80444 4.1228 2.81493 4.25811C2.82543 4.39342 2.80382 4.52929 2.75187 4.65467C2.69993 4.78006 2.61911 4.8914 2.516 4.97964C2.41289 5.06789 2.2904 5.13054 2.1585 5.1625C1.2805 5.3755 1.2805 6.6245 2.1585 6.8375C2.29028 6.86955 2.41264 6.93224 2.51564 7.02047C2.61863 7.10871 2.69935 7.22001 2.75124 7.34531C2.80312 7.47062 2.82471 7.6064 2.81424 7.74161C2.80378 7.87683 2.76155 8.00767 2.691 8.1235C2.221 8.8955 3.1045 9.7785 3.876 9.3085C3.99188 9.23785 4.1228 9.19556 4.25811 9.18507C4.39342 9.17457 4.52929 9.19618 4.65467 9.24813C4.78006 9.30007 4.8914 9.38089 4.97964 9.484C5.06789 9.58711 5.13054 9.7096 5.1625 9.8415C5.3755 10.7195 6.6245 10.7195 6.8375 9.8415C6.86955 9.70972 6.93224 9.58736 7.02047 9.48436C7.10871 9.38137 7.22001 9.30065 7.34531 9.24876C7.47062 9.19688 7.6064 9.17529 7.74161 9.18576C7.87683 9.19622 8.00767 9.23845 8.1235 9.309C8.8955 9.779 9.7785 8.8955 9.3085 8.124C9.23785 8.00812 9.19556 7.8772 9.18507 7.74189C9.17457 7.60658 9.19618 7.47071 9.24813 7.34533C9.30007 7.21994 9.38089 7.1086 9.484 7.02036C9.58711 6.93211 9.7096 6.86946 9.8415 6.8375C10.7195 6.6245 10.7195 5.3755 9.8415 5.1625C9.70972 5.13045 9.58736 5.06776 9.48436 4.97953C9.38137 4.89129 9.30065 4.77999 9.24876 4.65469C9.19688 4.52938 9.17529 4.3936 9.18576 4.25839C9.19622 4.12317 9.23845 3.99233 9.309 3.8765C9.779 3.1045 8.8955 2.2215 8.124 2.6915C8.00812 2.76215 7.8772 2.80444 7.74189 2.81493C7.60658 2.82543 7.47071 2.80382 7.34533 2.75187C7.21994 2.69993 7.1086 2.61911 7.02036 2.516C6.93211 2.41289 6.86946 2.2904 6.8375 2.1585Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.06066 7.06066C7.34196 6.77936 7.5 6.39782 7.5 6C7.5 5.60218 7.34196 5.22064 7.06066 4.93934C6.77936 4.65804 6.39782 4.5 6 4.5C5.60218 4.5 5.22064 4.65804 4.93934 4.93934C4.65804 5.22064 4.5 5.60218 4.5 6C4.5 6.39782 4.65804 6.77936 4.93934 7.06066C5.22064 7.34196 5.60218 7.5 6 7.5C6.39782 7.5 6.77936 7.34196 7.06066 7.06066Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // The pasted svg wrapped its path in a <clipPath>/<defs> pair clipping to
  // the full 0-12 viewBox - every path coordinate already stays within that
  // range on its own (checked, not assumed - same diagnosis as the
  // eyedropper icon above), so the clip was a no-op and is dropped here
  // rather than kept (an unused clipPath id is also a real risk in this
  // file specifically, since icons[name] render functions are invoked
  // directly rather than mounted as their own component - a duplicate id
  // would collide if this icon were ever rendered twice at once).
  cookies: (props) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M4.25 4.25V4.255M8 7.75V7.755M6 6V6.005M5.5 8.5V8.505M3.5 7V7.005M6 1C5.0111 1 4.0444 1.29324 3.22215 1.84265C2.39991 2.39206 1.75904 3.17295 1.3806 4.08658C1.00217 5.00021 0.90315 6.00555 1.09608 6.97545C1.289 7.94536 1.76521 8.83627 2.46447 9.53553C3.16373 10.2348 4.05465 10.711 5.02455 10.9039C5.99446 11.0969 6.99979 10.9978 7.91342 10.6194C8.82705 10.241 9.60794 9.6001 10.1573 8.77785C10.7068 7.95561 11 6.98891 11 6C10.6525 6.107 10.2824 6.11725 9.92953 6.02964C9.57665 5.94203 9.25433 5.75988 8.99723 5.50278C8.74013 5.24567 8.55798 4.92335 8.47037 4.57047C8.38276 4.21759 8.393 3.8475 8.5 3.5C8.15251 3.607 7.78242 3.61725 7.42953 3.52964C7.07665 3.44203 6.75433 3.25988 6.49723 3.00278C6.24013 2.74567 6.05798 2.42335 5.97037 2.07047C5.88276 1.71758 5.893 1.3475 6 1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode asset (copy-paste/paste.txt) - AccountTab's "Upgrade
  // to Pro" button icon. stroke swapped from the pasted fixed #ECE8E2 to
  // currentColor, same reasoning as every other icon in this file that used
  // to hardcode a color it should instead inherit from its context
  // (ButtonPrimary already sets text-text-white on the button, which is the
  // same color this was hardcoded to).
  sparkle: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M3.33333 2V4.66667V2ZM2 3.33333H4.66667H2ZM4 11.3333V14V11.3333ZM2.66667 12.6667H5.33333H2.66667ZM8.66667 2L10.1907 6.57133L14 8L10.1907 9.42867L8.66667 14L7.14267 9.42867L3.33333 8L7.14267 6.57133L8.66667 2Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode assets (copy-paste/paste.txt) - AccountTab's
  // LinksCard rows (Preferences/Plan & billing/Support). "gear" is a
  // deliberately separate entry from the existing "preferences" icon
  // (HeaderAppMenu's 12x12 gear) rather than a reuse - this one is a
  // different 16x16 asset the user pasted specifically for this row, not the
  // same SVG at a different size. Stroke swapped from the pasted fixed
  // #0B0D12 to currentColor, same reasoning as every other icon in this file
  // that used to hardcode a color it should instead inherit from its
  // context (LinksCard sets text-text-secondary on each of these).
  gear: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.11667 2.878C8.83267 1.70733 7.16733 1.70733 6.88333 2.878C6.69933 3.63467 5.83267 3.99333 5.16867 3.588C4.13933 2.96133 2.962 4.13933 3.58867 5.168C3.68287 5.3225 3.73926 5.49706 3.75325 5.67748C3.76723 5.85789 3.73843 6.03906 3.66916 6.20623C3.5999 6.37341 3.49215 6.52187 3.35467 6.63953C3.21719 6.75719 3.05387 6.84072 2.878 6.88333C1.70733 7.16733 1.70733 8.83267 2.878 9.11667C3.05371 9.1594 3.21686 9.24298 3.35418 9.36063C3.49151 9.47828 3.59913 9.62667 3.66831 9.79375C3.7375 9.96082 3.76628 10.1419 3.75232 10.3222C3.73837 10.5024 3.68207 10.6769 3.588 10.8313C2.96133 11.8607 4.13933 13.038 5.168 12.4113C5.3225 12.3171 5.49706 12.2607 5.67748 12.2468C5.85789 12.2328 6.03906 12.2616 6.20623 12.3308C6.37341 12.4001 6.52187 12.5079 6.63953 12.6453C6.75719 12.7828 6.84072 12.9461 6.88333 13.122C7.16733 14.2927 8.83267 14.2927 9.11667 13.122C9.1594 12.9463 9.24298 12.7831 9.36063 12.6458C9.47828 12.5085 9.62667 12.4009 9.79375 12.3317C9.96082 12.2625 10.1419 12.2337 10.3222 12.2477C10.5024 12.2616 10.6769 12.3179 10.8313 12.412C11.8607 13.0387 13.038 11.8607 12.4113 10.832C12.3171 10.6775 12.2607 10.5029 12.2468 10.3225C12.2328 10.1421 12.2616 9.96094 12.3308 9.79377C12.4001 9.62659 12.5079 9.47813 12.6453 9.36047C12.7828 9.24281 12.9461 9.15928 13.122 9.11667C14.2927 8.83267 14.2927 7.16733 13.122 6.88333C12.9463 6.8406 12.7831 6.75702 12.6458 6.63937C12.5085 6.52172 12.4009 6.37333 12.3317 6.20625C12.2625 6.03918 12.2337 5.85814 12.2477 5.67785C12.2616 5.49756 12.3179 5.3231 12.412 5.16867C13.0387 4.13933 11.8607 2.962 10.832 3.58867C10.6775 3.68287 10.5029 3.73926 10.3225 3.75325C10.1421 3.76723 9.96094 3.73843 9.79377 3.66916C9.62659 3.5999 9.47813 3.49215 9.36047 3.35467C9.24281 3.21719 9.15928 3.05387 9.11667 2.878Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.41421 9.41421C9.78929 9.03914 10 8.53043 10 8C10 7.46957 9.78929 6.96086 9.41421 6.58579C9.03914 6.21071 8.53043 6 8 6C7.46957 6 6.96086 6.21071 6.58579 6.58579C6.21071 6.96086 6 7.46957 6 8C6 8.53043 6.21071 9.03914 6.58579 9.41421C6.96086 9.78929 7.46957 10 8 10C8.53043 10 9.03914 9.78929 9.41421 9.41421Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  billing: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2 6.66634H14M4.66667 9.99967H5.33333M8 9.99967H8.66667M4 12.6663H12C12.5304 12.6663 13.0391 12.4556 13.4142 12.0806C13.7893 11.7055 14 11.1968 14 10.6663V5.33301C14 4.80257 13.7893 4.29387 13.4142 3.91879C13.0391 3.54372 12.5304 3.33301 12 3.33301H4C3.46957 3.33301 2.96086 3.54372 2.58579 3.91879C2.21071 4.29387 2 4.80257 2 5.33301V10.6663C2 11.1968 2.21071 11.7055 2.58579 12.0806C2.96086 12.4556 3.46957 12.6663 4 12.6663Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  support: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12.2427 3.75733L9.88533 6.11467M12.2427 3.75733C11.1174 2.63212 9.5913 2 8 2C6.4087 2 4.88255 2.63212 3.75733 3.75733M12.2427 3.75733C13.3679 4.88255 14 6.4087 14 8C14 8.78793 13.8448 9.56815 13.5433 10.2961C13.2417 11.0241 12.7998 11.6855 12.2427 12.2427M9.88533 6.11467C9.38524 5.61457 8.70724 5.33333 8 5.33333C7.29276 5.33333 6.61476 5.61457 6.11467 6.11467M9.88533 6.11467C10.3854 6.61476 10.6667 7.29276 10.6667 8C10.6667 8.70724 10.3854 9.38524 9.88533 9.88533M9.88533 9.88533L12.2427 12.2427M9.88533 9.88533C9.38524 10.3854 8.70724 10.6667 8 10.6667C7.29276 10.6667 6.61476 10.3854 6.11467 9.88533M12.2427 12.2427C11.6855 12.7998 11.0241 13.2417 10.2961 13.5433C9.56815 13.8448 8.78793 14 8 14C7.21207 14 6.43185 13.8448 5.7039 13.5433C4.97595 13.2417 4.31449 12.7998 3.75733 12.2427M6.11467 6.11467L3.75733 3.75733M6.11467 6.11467C5.61457 6.61476 5.33333 7.29276 5.33333 8C5.33333 8.70724 5.61457 9.38524 6.11467 9.88533M3.75733 3.75733C2.63212 4.88255 2 6.4087 2 8C2 8.78793 2.15519 9.56815 2.45672 10.2961C2.75825 11.0241 3.20018 11.6855 3.75733 12.2427M6.11467 9.88533L3.75733 12.2427"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode asset (copy-paste/paste.txt) - ButtonSecondary's
  // "Log out" call site. Stroke swapped from the pasted fixed #E23F8C to
  // currentColor, same reasoning as every other icon in this file - it
  // already happens to be that exact color here (ButtonSecondary sets
  // text-text-color-accent), but inheriting it keeps this icon correct if
  // ButtonSecondary is ever reused with a different label color.
  logout: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M11.3333 5.33366L14 8.00033L11.3333 10.667M14 8.00033H4.66667M8.66667 10.667V11.3337C8.66667 11.8641 8.45595 12.3728 8.08088 12.7479C7.70581 13.1229 7.1971 13.3337 6.66667 13.3337H4C3.46957 13.3337 2.96086 13.1229 2.58579 12.7479C2.21071 12.3728 2 11.8641 2 11.3337V4.66699C2 4.13656 2.21071 3.62785 2.58579 3.25278C2.96086 2.87771 3.46957 2.66699 4 2.66699H6.66667C7.1971 2.66699 7.70581 2.87771 8.08088 3.25278C8.45595 3.62785 8.66667 4.13656 8.66667 4.66699V5.33366"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode asset (copy-paste/paste.txt) - ManageProfileScreen's
  // "Change photo" ButtonSecondary. Stroke swapped from the pasted fixed
  // #E23F8C to currentColor, same reasoning as every other icon in this file
  // - it already happens to be that exact color here (ButtonSecondary sets
  // text-text-color-accent), but inheriting it keeps this icon correct if
  // ButtonSecondary is ever reused with a different label color.
  upload: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2.6665 10.667V11.3337C2.6665 11.8641 2.87722 12.3728 3.25229 12.7479C3.62736 13.1229 4.13607 13.3337 4.6665 13.3337H11.3332C11.8636 13.3337 12.3723 13.1229 12.7474 12.7479C13.1225 12.3728 13.3332 11.8641 13.3332 11.3337V10.667M5.33317 5.33366L7.99984 2.66699L10.6665 5.33366M7.99984 2.66699V10.667"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Real Figma Dev Mode asset (copy-paste/paste.txt) - ManageProfileScreen's
  // "Delete account" ButtonSecondary. Stroke swapped from the pasted fixed
  // #E23F8C to currentColor, same reasoning as every other icon in this
  // file - already that exact color here (ButtonSecondary sets
  // text-text-color-accent), but inheriting it keeps this icon correct if
  // ButtonSecondary is ever reused with a different label color.
  delete: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M6.6665 7.33333V11.3333M9.33317 7.33333V11.3333M2.6665 4.66667H13.3332M12.6665 4.66667L12.0885 12.7613C12.0646 13.0977 11.914 13.4125 11.6672 13.6424C11.4205 13.8722 11.0957 14 10.7585 14H5.24117C4.90393 14 4.57922 13.8722 4.33243 13.6424C4.08564 13.4125 3.93511 13.0977 3.91117 12.7613L3.33317 4.66667H12.6665ZM9.99984 4.66667V2.66667C9.99984 2.48986 9.9296 2.32029 9.80458 2.19526C9.67955 2.07024 9.50998 2 9.33317 2H6.6665C6.48969 2 6.32012 2.07024 6.1951 2.19526C6.07008 2.32029 5.99984 2.48986 5.99984 2.66667V4.66667H9.99984Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),

  // Hand-drawn (no Figma asset provided for this one) - a plain padlock,
  // same 16x16/stroke-currentColor/1.33333 convention as every other icon
  // here. PresetsTab's own coming-soon state.
  lock: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect
        x="3.3335"
        y="7.33333"
        width="9.33333"
        height="6.66667"
        rx="1.33333"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.3335 7.33333V4.66667C5.3335 3.95942 5.61445 3.28115 6.11454 2.78105C6.61464 2.28095 7.29292 2 8.00016 2C8.7074 2 9.38568 2.28095 9.88578 2.78105C10.3859 3.28115 10.6668 3.95942 10.6668 4.66667V7.33333"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),

  // Hand-drawn (no Figma asset provided for either of these two) - same
  // 16x16/stroke-currentColor/1.33333 convention as every other icon here.
  // PresetsTab's search bar and its filter-button trigger.
  search: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M14 14L11.1 11.1M12.6667 7.33333C12.6667 10.2789 10.2789 12.6667 7.33333 12.6667C4.38781 12.6667 2 10.2789 2 7.33333C2 4.38781 4.38781 2 7.33333 2C10.2789 2 12.6667 4.38781 12.6667 7.33333Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // A plain "sliders" glyph (three horizontal rails, each with one round
  // handle) - a common, recognizable filter symbol, distinct enough from
  // "search" and "gear" not to be confused with either.
  filter: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2 4H10.6667M13.3333 4H14M2 8H5.33333M8 8H14M2 12H8.66667M11.3333 12H14"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="4" r="1.33333" stroke="currentColor" strokeWidth="1.33333" />
      <circle cx="6.66667" cy="8" r="1.33333" stroke="currentColor" strokeWidth="1.33333" />
      <circle cx="10" cy="12" r="1.33333" stroke="currentColor" strokeWidth="1.33333" />
    </svg>
  ),

  // A real funnel glyph (copy-paste/paste.txt) - distinct from the "sliders"
  // `filter` icon above (that one's the PresetsTab button that opens this
  // modal; this one is the modal's own header icon). stroke="currentColor"
  // rather than the pasted asset's hardcoded "#20242D" - a hardcoded stroke
  // baked in from whatever state a Figma export was captured in is a
  // recurring real bug in this file (see HeaderAppMenu's own icons).
  filterFunnel: (props) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M2.74408 2.74408C2.5878 2.90036 2.5 3.11232 2.5 3.33333V5.48833C2.50005 5.70933 2.58788 5.92126 2.74417 6.0775L8.08917 11.4225C8.24546 11.5787 8.33329 11.7907 8.33333 12.0117V17.5L11.6667 14.1667V12.0117C11.6667 11.7907 11.7545 11.5787 11.9108 11.4225L17.2558 6.0775C17.4121 5.92126 17.5 5.70933 17.5 5.48833V3.33333C17.5 3.11232 17.4122 2.90036 17.2559 2.74408C17.0996 2.5878 16.8877 2.5 16.6667 2.5H3.33333C3.11232 2.5 2.90036 2.5878 2.74408 2.74408Z"
        stroke="currentColor"
        strokeWidth="1.875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),

  cluster: (props) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
<path d="M4.16667 9.99992H15.8333M4.16667 9.99992C3.72464 9.99992 3.30072 9.82432 2.98816 9.51176C2.67559 9.1992 2.5 8.77528 2.5 8.33325V4.99992C2.5 4.55789 2.67559 4.13397 2.98816 3.82141C3.30072 3.50885 3.72464 3.33325 4.16667 3.33325H15.8333C16.2754 3.33325 16.6993 3.50885 17.0118 3.82141C17.3244 4.13397 17.5 4.55789 17.5 4.99992V8.33325C17.5 8.77528 17.3244 9.1992 17.0118 9.51176C16.6993 9.82432 16.2754 9.99992 15.8333 9.99992M4.16667 9.99992C3.72464 9.99992 3.30072 10.1755 2.98816 10.4881C2.67559 10.8006 2.5 11.2246 2.5 11.6666V14.9999C2.5 15.4419 2.67559 15.8659 2.98816 16.1784C3.30072 16.491 3.72464 16.6666 4.16667 16.6666H15.8333C16.2754 16.6666 16.6993 16.491 17.0118 16.1784C17.3244 15.8659 17.5 15.4419 17.5 14.9999V11.6666C17.5 11.2246 17.3244 10.8006 17.0118 10.4881C16.6993 10.1755 16.2754 9.99992 15.8333 9.99992M14.1667 6.66659H14.175M14.1667 13.3333H14.175" stroke="#858179" stroke-width="0.833333" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  ),
  box: (props) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M10.0002 17.5L3.3335 14.1667V5.83333L10.0002 2.5L16.6668 5.83333V14.1667L10.0002 17.5ZM16.6668 5.83333L10.0002 9.16667M3.3335 5.83333L10.0002 9.16667M10.0002 9.16667V17.5" stroke="#858179" stroke-width="0.833333" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  ),

  code: (props) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
<path d="M11.6668 23.3334L16.3335 4.66675M21.0002 9.33341L25.6668 14.0001L21.0002 18.6667M7.00016 18.6667L2.3335 14.0001L7.00016 9.33341" stroke="#858179" stroke-width="1.16667" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  ),

  chain: (props) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
<path d="M11.5233 8.47672C10.8982 7.85182 10.0505 7.50077 9.16661 7.50077C8.28273 7.50077 7.43504 7.85182 6.80994 8.47672L3.47661 11.8101C3.15824 12.1175 2.9043 12.4854 2.72961 12.892C2.55491 13.2987 2.46296 13.7361 2.45911 14.1787C2.45526 14.6213 2.5396 15.0602 2.70721 15.4699C2.87481 15.8796 3.12232 16.2517 3.43529 16.5647C3.74827 16.8777 4.12044 17.1252 4.5301 17.2928C4.93975 17.4604 5.37868 17.5447 5.82128 17.5409C6.26388 17.537 6.70128 17.4451 7.10796 17.2704C7.51464 17.0957 7.88246 16.8418 8.18995 16.5234L9.10828 15.6059M8.47661 11.5234C9.1017 12.1483 9.9494 12.4993 10.8333 12.4993C11.7172 12.4993 12.5649 12.1483 13.1899 11.5234L16.5233 8.19006C17.1305 7.56138 17.4665 6.71937 17.4589 5.84538C17.4513 4.9714 17.1007 4.13535 16.4827 3.51733C15.8646 2.8993 15.0286 2.54874 14.1546 2.54114C13.2806 2.53355 12.4386 2.86953 11.8099 3.47672L10.8933 4.39339" stroke="#858179" stroke-width="0.833333" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  ),

  // stroke is currentColor (was a hardcoded #ECE8E2 from the pasted Figma
  // asset - the exact recurring bug this file's own top comment warns
  // about) so ButtonPrimary's icon prop can drive its color purely via CSS
  // inheritance: text-text-white normally, text-text-secondary when the
  // button is disabled - see ButtonPrimary.tsx's own comment on this.
  stars: (props) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M3.33333 2V4.66667V2ZM2 3.33333H4.66667H2ZM4 11.3333V14V11.3333ZM2.66667 12.6667H5.33333H2.66667ZM8.66667 2L10.1907 6.57133L14 8L10.1907 9.42867L8.66667 14L7.14267 9.42867L3.33333 8L7.14267 6.57133L8.66667 2Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // AboutModal.tsx's own header icon (the "?" circle) - a Figma paste
  // (copy-paste/paste.txt), stroke="currentColor" rather than its hardcoded
  // "#20242D" for the same reason as filterFunnel above.
  help: (props) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M5.53578 6.22201C6.02378 5.18645 7.34023 4.44423 8.88867 4.44423C10.8531 4.44423 12.4442 5.63801 12.4442 7.11089C12.4442 8.35534 11.3082 9.39978 9.77223 9.69489C9.29045 9.78734 8.88867 10.1749 8.88867 10.6664M8.88867 13.3331H8.89756M16.8887 8.88867C16.8887 9.93925 16.6817 10.9795 16.2797 11.9501C15.8777 12.9207 15.2884 13.8027 14.5455 14.5455C13.8027 15.2884 12.9207 15.8777 11.9501 16.2797C10.9795 16.6817 9.93925 16.8887 8.88867 16.8887C7.8381 16.8887 6.79781 16.6817 5.8272 16.2797C4.8566 15.8777 3.97469 15.2884 3.23182 14.5455C2.48895 13.8027 1.89967 12.9207 1.49764 11.9501C1.0956 10.9795 0.888672 9.93925 0.888672 8.88867C0.888672 6.76694 1.73153 4.73211 3.23182 3.23182C4.73211 1.73153 6.76694 0.888672 8.88867 0.888672C11.0104 0.888672 13.0452 1.73153 14.5455 3.23182C16.0458 4.73211 16.8887 6.76694 16.8887 8.88867Z"
        stroke="currentColor"
        strokeWidth="1.77778"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // AboutModal.tsx's row chevrons - a 90°-rotated chevronDown, since no
  // chevron-right existed yet.
  chevronRight: (props) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  const render = icons[name];
  if (!render) {
    console.warn(`Icon '${name}' not found.`);
    return null;
  }
  return render(props);
}
