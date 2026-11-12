import { useState, type FormEvent } from "react";
import { AlertCircle, KeyRound } from "lucide-react";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button, TextInput } from "../ui";
import { AuthLayout } from "./AuthLayout";
import "./AuthForm.scss";

const MIN_PASSWORD_LENGTH = 8;

export function ForceChangePasswordView() {
  const { completeInitialPasswordChange } = useAuth();
  const toast = useToast();

  const [newPassword, setNewPassword] = useState("");
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
          type="text"
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="off"
          spellCheck={false}
          leadingIcon={<KeyRound size={15} />}
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
