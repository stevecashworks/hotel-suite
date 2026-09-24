import { NextRequest, NextResponse } from "next/server";
import { createSession, findOrCreateSocialUser, sessionMaxAge } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const host = request.headers.get("host") || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const isSecure = process.env.NODE_ENV === "production" || !isLocalhost;

  const cookieOptions = {
    httpOnly: true,
    sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
    secure: Boolean(isSecure),
    path: "/",
    maxAge: sessionMaxAge,
  };

  if (error) {
    return renderOAuthResponseHtml({
      success: false,
      error: errorDescription || error,
    });
  }

  if (!code) {
    return renderOAuthResponseHtml({
      success: false,
      error: "No authorization code was provided.",
    });
  }

  try {
    // Exchange code for Google token
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    // Construct redirect URI matching what was used in the authorize request
    const redirectUri = new URL(request.url).origin + new URL(request.url).pathname;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return renderOAuthResponseHtml({
        success: false,
        error: tokenData.error_description || tokenData.error,
      });
    }

    // Fetch user profile from Google UserInfo endpoint
    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await userInfoRes.json();
    if (!profile.email) {
      return renderOAuthResponseHtml({
        success: false,
        error: "Google account did not return an email address.",
      });
    }

    const { user } = await findOrCreateSocialUser({
      provider: "google",
      providerId: profile.sub,
      email: profile.email,
      name: profile.name || profile.given_name || "Google Guest",
      avatar: profile.picture,
      role: "guest",
    });

    const sessionToken = createSession(user.id);
    const response = renderOAuthResponseHtml({ success: true, user });
    response.cookies.set("hotel_session", sessionToken, cookieOptions);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Google OAuth exchange failed.";
    return renderOAuthResponseHtml({ success: false, error: msg });
  }
}

function renderOAuthResponseHtml({
  success,
  user,
  error,
}: {
  success: boolean;
  user?: unknown;
  error?: string;
}) {
  const safeData = JSON.stringify({
    type: success ? "OAUTH_AUTH_SUCCESS" : "OAUTH_AUTH_ERROR",
    user: user || null,
    error: error || null,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${success ? "Authentication Successful" : "Authentication Notice"}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: #fbf8f4;
        color: #2a1d14;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .card {
        background: #ffffff;
        border: 1px solid rgba(105, 72, 45, 0.16);
        border-radius: 20px;
        padding: 2.5rem 2rem;
        max-width: 420px;
        width: 90%;
        text-align: center;
        box-shadow: 0 16px 40px rgba(67, 43, 25, 0.08);
      }
      .icon {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: ${success ? "rgba(46, 125, 50, 0.12)" : "rgba(198, 40, 40, 0.12)"};
        color: ${success ? "#2e7d32" : "#c62828"};
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        margin-bottom: 1.25rem;
      }
      h2 {
        margin: 0 0 0.5rem;
        font-size: 1.35rem;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      p {
        margin: 0 0 1.5rem;
        font-size: 0.92rem;
        color: #65452e;
        line-height: 1.5;
      }
      .spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(101, 69, 46, 0.2);
        border-top-color: #65452e;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        vertical-align: middle;
        margin-right: 8px;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      button {
        background: #65452e;
        color: #fffaf4;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 999px;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">${success ? "✓" : "!"}</div>
      <h2>${success ? "Stay Connected" : "Authentication Notice"}</h2>
      <p>
        ${
          success
            ? `<span class="spinner"></span>Completing sign-in and redirecting to Hotelier…`
            : escapeHtml(error || "An issue occurred during authorization.")
        }
      </p>
      ${!success ? `<button onclick="window.close()">Close Window</button>` : ""}
    </div>
    <script>
      (function() {
        const payload = ${safeData};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, '*');
            ${success ? "setTimeout(function() { window.close(); }, 500);" : ""}
          } else {
            ${success ? "window.location.href = '/';" : ""}
          }
        } catch (e) {
          console.error("Popup postMessage error:", e);
        }
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
