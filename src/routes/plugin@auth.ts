import { KyselyAdapter } from "@auth/kysely-adapter";
import { QwikAuth$ } from "@auth/qwik";
import { db } from "../db/db";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
	({ env }) => {
		// 1. Fetch Whitelist from Env
		// Format in .env: WHITELISTed_EMAILS="user@example.com,admin@site.com"
		const whitelistEnv = env.get("WHITELISTED_EMAILS");
		const whitelist = whitelistEnv
			? whitelistEnv.split(",").map((e) => e.trim().toLowerCase())
			: null;

		return {
			providers: [
				{
					id: "oidc", // e.g., "keycloak", "google", or "mock"
					name: env.get("OIDC_NAME") || "OIDC Provider",
					type: "oidc",
					issuer: env.get("OIDC_ISSUER"), // e.g., "https://oidcmock.dev"
					clientId: env.get("OIDC_CLIENT_ID"),
					clientSecret: env.get("OIDC_CLIENT_SECRET"),
					client: {
						token_endpoint_auth_method: "client_secret_post",
					},
				},
			],
			adapter: KyselyAdapter(db as any),
			callbacks: {
				// 3. Whitelist Logic
				async signIn({ user }) {
					// If no whitelist is defined in ENV, allow everyone
					if (!whitelist) return true;

					// Check if email exists and is in the list
					if (user.email && whitelist.includes(user.email.toLowerCase())) {
						return true;
					}

					// Return false to display a default error message or string URL to redirect
					// return "/auth/error?error=AccessDenied"; 
					return false;
				},
				session({ session, user }) {
					session.user.id = user.id;
					return session;
				},
			},
		};
	}
);;
