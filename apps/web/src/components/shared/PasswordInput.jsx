import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * Decision 40-1: a password field with its own show / hide (eye) button, the LoginForm pattern. Every other prop
 * (id, autoComplete, react-hook-form's register(...) incl. its ref, aria-*) goes to the input.
 */
export function PasswordInput({ id, className, ...props }) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <Input id={id} type={shown ? "text" : "password"} className={className ? `pr-12 ${className}` : "pr-12"} {...props} />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-sm text-muted-foreground hover:text-heading focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {shown ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
