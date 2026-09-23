import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  return (
    <form className="login-form">
      <Label htmlFor="email">
        Email Address
      </Label>

      <Input
        id="email"
        type="email"
        placeholder="Email Address"
      />
      <Label htmlFor="password">
        Password
      </Label>

      <Input
        id="password"
        type="password"
        placeholder="Password"
      />

      <Button 
       type="submit"
       variant="default"
       size="lg"
       className="w-full"
      >
        Log In
      </Button>
    </form>
  );
}

export default LoginForm;