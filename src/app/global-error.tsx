"use client";

/**
 * Last-resort boundary: replaces the root layout when it is the layout itself
 * that failed, so it must render its own `html` and `body`. Styling is
 * deliberately inline - global CSS may be exactly what broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#3e2723",
          background: "#fff8e1",
        }}
      >
        <main
          style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ lineHeight: 1.6, color: "#5a423c" }}>
            The application ran into an unexpected problem. Please try again.
          </p>
          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#5a423c" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "9999px",
              border: "1px solid #c9ccc5",
              background: "transparent",
              font: "inherit",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
