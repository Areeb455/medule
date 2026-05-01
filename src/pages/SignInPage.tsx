import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center mb-8">
        <SignIn routing="hash" signUpUrl="/sign-in#/sign-up" afterSignInUrl="/dashboard" />
      </div>
    </div>
  );
}