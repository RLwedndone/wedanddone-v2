// src/utils/formatAuthError.ts
export function formatAuthError(code?: string): string {
    switch (code) {
      case "auth/email-already-in-use":
        return (
          "Looks like you already have a Wed&Done account with this email. " +
          "Try logging in instead, or use “Sign in with Google” if you used that before."
        );
  
      case "auth/invalid-email":
        return "That doesn’t look like a valid email address. Double-check it and try again.";
  
      case "auth/weak-password":
        return "Your password needs at least 6 characters. Add a bit more magic and try again.";
  
      case "auth/wrong-password":
        return "That password doesn’t match what we have on file. Try again or reset it.";
  
      case "auth/user-not-found":
        return "We couldn’t find an account with that email yet. Try creating one instead.";
  
      default:
        return "Something went wrong while talking to our login pixies. Please try again in a moment.";
    }
  }