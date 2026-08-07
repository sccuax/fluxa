interface GoogleAuthButtonProps {
  label: string;
  onClick: () => void;
}

// Label is the only thing that differs between sign-in ("Sign in with
// Google") and sign-up ("Sign up with Google") - the click handler stays on
// each screen, since the network call differs too (sign-up must pass
// requestSignUp: true to /api/auth/sign-in/social, per better-auth's
// disableImplicitSignUp - see CLAUDE.md).
export function GoogleAuthButton({ label, onClick }: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[42px] w-full items-center justify-center gap-[8px] border border-border-border rounded-4 text-text-sm-medium text-[#212121]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_150_923)">
          <path d="M15.844 8.18429C15.844 7.64047 15.7999 7.09371 15.7058 6.55872H8.15997V9.63937H12.4811C12.3018 10.6329 11.7257 11.5119 10.882 12.0704V14.0693H13.46C14.9739 12.6759 15.844 10.6182 15.844 8.18429Z" fill="#4285F4" />
          <path d="M8.15999 16.0006C10.3176 16.0006 12.1372 15.2922 13.4629 14.0693L10.885 12.0704C10.1677 12.5584 9.24174 12.8347 8.16293 12.8347C6.07584 12.8347 4.30623 11.4266 3.67128 9.53357H1.01099V11.5942C2.36906 14.2956 5.13518 16.0006 8.15999 16.0006V16.0006Z" fill="#34A853" />
          <path d="M3.66833 9.53356C3.33322 8.53999 3.33322 7.46411 3.66833 6.47054V4.40991H1.01097C-0.123694 6.67043 -0.123694 9.33367 1.01097 11.5942L3.66833 9.53356V9.53356Z" fill="#FBBC04" />
          <path d="M8.15999 3.16644C9.30053 3.1488 10.4029 3.57798 11.2289 4.36578L13.5129 2.08174C12.0667 0.72367 10.1471 -0.0229773 8.15999 0.000539111C5.13518 0.000539111 2.36906 1.70548 1.01099 4.40987L3.66834 6.4705C4.30035 4.57449 6.0729 3.16644 8.15999 3.16644V3.16644Z" fill="#EA4335" />
        </g>
        <defs>
          <clipPath id="clip0_150_923">
            <rect width="16" height="16" fill="white" />
          </clipPath>
        </defs>
      </svg>
      {label}
    </button>
  );
}
