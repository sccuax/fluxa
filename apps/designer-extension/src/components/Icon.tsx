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
  | "cube";

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
