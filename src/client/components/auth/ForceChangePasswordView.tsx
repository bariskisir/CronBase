import { useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button, IconButton, TextInput } from "../ui";
import { AuthLayout } from "./AuthLayout";
import "./AuthForm.scss";

const MIN_PASSWORD_LENGTH = 8;

export function ForceChangePasswordView() {
  const { completeInitialPasswordChange } = useAuth();
  const toast = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await completeInitialPasswordChange(newPassword);
      toast.success("Password updated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Set new password">
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <TextInput
          inputSize="lg"
          type={showPassword ? "text" : "password"}
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          spellCheck={false}
          leadingIcon={<KeyRound size={15} />}
          trailing={
            <IconButton
              size="sm"
              label={showPassword ? "Hide password" : "Show password"}
              icon={showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              onClick={() => setShowPassword((current) => !current)}
            />
          }
          invalid={error !== null}
          autoFocus
          required
        />

        {error && (
          <p className="auth-form__error" role="alert">
            <AlertCircle size={14} />
            <span>{error}</span>
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" block loading={submitting} disabled={!newPassword}>
          {submitting ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
