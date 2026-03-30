import { google } from "googleapis";
import { isAllowedEmail, getAllowedDomain } from "@/lib/auth-session";

export type GoogleProfile = {
  email: string;
  name: string;
  picture?: string;
  hd?: string;
};

function getBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${getBaseUrl()}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 설정이 필요합니다",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function getOAuthClient() {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function createGoogleAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile"],
    hd: getAllowedDomain(),
  });
}

export async function getGoogleProfileFromCode(
  code: string,
): Promise<GoogleProfile> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();

  const email = me.data.email || "";
  const name = me.data.name || email;
  const picture = me.data.picture || undefined;
  const hd = me.data.hd || undefined;

  if (!email || me.data.verified_email !== true) {
    throw new Error("Google 계정 이메일 검증이 필요합니다");
  }

  if (!isAllowedEmail(email)) {
    throw new Error(
      `허용되지 않은 도메인입니다. @${getAllowedDomain()} 계정만 로그인할 수 있습니다`,
    );
  }

  return { email, name, picture, hd };
}
