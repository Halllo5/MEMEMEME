import { KyselyAdapter } from "@auth/kysely-adapter";
import { QwikAuth$ } from "@auth/qwik";
import { db } from "../db/db";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  () => ({
    providers: [
      {
        id: "mock",
        name: "oidc Mock",
        type: "oidc",
        issuer: "https://oidcmock.dev",
        clientId: "id",
        clientSecret: "test-client-secret",
        client: {
          token_endpoint_auth_method: "client_secret_post",
        },
      },
    ],
    adapter: KyselyAdapter(db as any),
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  }),
);
