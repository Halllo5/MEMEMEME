import { component$ } from "@builder.io/qwik";

interface ErrorPageContentProps {
  status: number;
  message: string;
}

export const ErrorPageContent = component$<ErrorPageContentProps>(
  ({ status, message }) => {
    return (
      <div
        style={{
          maxWidth: "32rem",
          margin: "0 auto",
          padding: "1rem",
        }}
      >
        <div
          style={{
            background: "var(--error-page-card)",
            color: "var(--error-page-foreground)",
            border: "2px solid var(--error-page-border)",
            boxShadow: "var(--error-page-shadow)",
            borderRadius: 0,
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: 0 }}>
            {status}
          </h1>
          <p style={{ fontSize: "1.125rem", marginTop: "1rem", marginBottom: 0 }}>
            {message}
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 1rem",
                background: "var(--error-page-main)",
                color: "var(--error-page-foreground)",
                fontWeight: 700,
                border: "2px solid var(--error-page-border)",
                boxShadow: "var(--error-page-shadow)",
                borderRadius: 0,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  },
);
