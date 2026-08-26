// "Privacy policy" / "Terms of use" footer row - identical markup was
// duplicated across SignInScreen/SignUpScreen/ForgotPasswordScreen/
// ResetCodeScreen/ResetPasswordScreen before this; AccountTab is now a 6th
// call site, so it's a shared component instead of a 6th copy-paste. hrefs
// are still "#" placeholders (no real destination yet), same as every
// pre-existing call site - not something this extraction changes.
//
// className is optional and appended (not replaced) - SignUpScreen's own
// call site needs an extra `pb-8` on this row that none of the other
// screens have, so the base layout classes stay fixed here and only that
// one extra class is passed in per call site.
export function LegalFooterLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-row justify-center items-center gap-[12px] ${className}`}>
      <a href="#" className="text-mobile-text-md-regular text-text-secondary hover:underline">
        Privacy policy
      </a>
      <a href="#" className="text-mobile-text-md-regular text-text-secondary hover:underline">
        Terms of use
      </a>
    </div>
  );
}
