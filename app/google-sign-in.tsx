"use client";

import { useEffect, useRef } from "react";

type GoogleCredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; callback: (response: GoogleCredentialResponse) => void; ux_mode?: "popup" | "redirect" }): void;
          renderButton(element: HTMLElement, options: Record<string, string | number>): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function GoogleSignIn({
  clientId,
  language,
  onCredential,
}: {
  clientId: string;
  language: "tr" | "en";
  onCredential: (credential: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !host.current) return;
    let active = true;
    loadGoogleScript().then(() => {
      if (!active || !host.current || !window.google) return;
      host.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => callback.current(response.credential),
        ux_mode: "popup",
      });
      window.google.accounts.id.renderButton(host.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
        logo_alignment: "left",
        width: Math.min(360, host.current.clientWidth || 320),
        locale: language,
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [clientId, language]);

  return <div className="google-signin" ref={host} aria-live="polite"/>;
}

export function disableGoogleAutoSelect() {
  window.google?.accounts.id.disableAutoSelect();
}

function loadGoogleScript() {
  if (window.google) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("google_script_failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("google_script_failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}
