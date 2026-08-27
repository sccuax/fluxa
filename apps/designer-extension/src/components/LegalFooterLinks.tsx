// "Privacy policy" / "Terms of use" footer row - identical markup was
// duplicated across SignInScreen/SignUpScreen/ForgotPasswordScreen/
// ResetCodeScreen/ResetPasswordScreen before this; AccountTab is now a 6th
// call site, so it's a shared component instead of a 6th copy-paste.
//
// className is optional and appended (not replaced) - SignUpScreen's own
// call site needs an extra `pb-8` on this row that none of the other
// screens have, so the base layout classes stay fixed here and only that
// one extra class is passed in per call site.
const PRIVACY_POLICY_URL = "https://app.notion.com/p/Fluxa-Privacy-Policy-3c8f1890e7c0819ebbb5e5edcc52dbf4";
const TERMS_OF_USE_URL = "https://app.notion.com/p/Fluxa-Terms-of-Use-3c8f1890e7c08196bc60d874c78da9a8";

export function LegalFooterLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-row justify-center items-center gap-[12px] ${className}`}>
      <a
        href={PRIVACY_POLICY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-mobile-text-md-regular text-text-secondary hover:underline"
      >
        Privacy policy
      </a>
      <a
        href={TERMS_OF_USE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-mobile-text-md-regular text-text-secondary hover:underline"
      >
        Terms of use
      </a>
    </div>
  );
}
