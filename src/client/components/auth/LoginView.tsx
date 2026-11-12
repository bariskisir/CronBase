import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, IconButton, TextInput } from "../ui";
import { AuthLayout } from "./AuthLayout";
import "./AuthForm.scss";

export function LoginView() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;

    setSubmitting(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in">
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <TextInput
          inputSize="lg"
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          leadingIcon={<Lock size={15} />}
          invalid={error !== null}
          trailing={
            <IconButton
              size="sm"
              label={showPassword ? "Hide password" : "Show password"}
              icon={showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              onClick={() => setShowPassword((current) => !current)}
            />
          }
          autoFocus
          required
        />

        {error && (
          <p className="auth-form__error" role="alert">
            <AlertCircle size={14} />
            <span>{error}</span>
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={submitting}
          disabled={!password}
          trailingIcon={!submitting && <ArrowRight size={15} />}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
