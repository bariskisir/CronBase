import type { ReactNode } from "react";
import { BrandMark } from "../ui";
import "./AuthLayout.scss";

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__backdrop" aria-hidden="true" />
      <main className="auth-layout__card">
        <div className="auth-layout__brand">
          <BrandMark size={40} />
          <h1 className="auth-layout__title">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
