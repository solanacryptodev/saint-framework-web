"use server";
// src/lib/auth.ts
//
// SurrealDB-native authentication using DEFINE SCOPE.
//
// How it works:
//   • SurrealDB issues its own signed JWTs on signup/signin — no external
//     auth library needed. The token is everything.
//   • The server's root connection (getDB) is used only for admin ops:
//     schema definition, agent tools, Mastra pipelines.
//   • Player API calls pass their JWT and we validate it by attempting a
//     scoped connection — if SurrealDB accepts it, it's valid.
//   • The JWT payload contains the player record ID, which we use to
//     scope all session data.
//
// SurrealDB schema additions (run once via applyAuthSchema):
//
//   DEFINE SCOPE player_scope SESSION 30d
//     SIGNUP (CREATE player SET ...)
//     SIGNIN (SELECT * FROM player WHERE ...)
//
//   DEFINE TABLE player SCHEMAFULL
//     Fields: username, email, password_hash, display_name,
//             created_at, last_seen, active_session_id
//
// Token flow:
//   POST /api/auth/signup  → { token, player }
//   POST /api/auth/signin  → { token, player }
//   GET  /api/auth/me      → { player }          (requires Authorization header)
//   POST /api/auth/signout → {}                  (client drops token)

import { Surreal, surql } from "surrealdb";

// ── Environment variable helper ─────────────────────────────────────────────
// Trims whitespace/newlines that can cause authentication failures

function getEnvVar(key: string, fallback?: string): string {
    const value = process.env[key];
    if (!value && fallback === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return (value ?? fallback!).trim();
}

// ── Schema ──────────────────────────────────────────────────────────────────

export async function applyAuthSchema(db: Surreal) {

    // Player accounts table
    await db.query(`
    DEFINE TABLE OVERWRITE player SCHEMAFULL
        PERMISSIONS
      FOR select, update WHERE id = $auth.id OR $auth.id = NONE
      FOR create, delete NONE;
    DEFINE FIELD IF NOT EXISTS username          ON player TYPE string;
    DEFINE FIELD IF NOT EXISTS email             ON player TYPE string;
    DEFINE FIELD IF NOT EXISTS password_hash     ON player TYPE string;
    DEFINE FIELD IF NOT EXISTS first_name        ON player TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS last_name         ON player TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS display_name      ON player TYPE string;
    DEFINE FIELD IF NOT EXISTS tier              ON player TYPE string DEFAULT "free";
    DEFINE FIELD IF NOT EXISTS created_at        ON player TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS last_seen         ON player TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS active_session_id ON player TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS preferences       ON player TYPE object DEFAULT {};

    DEFINE INDEX IF NOT EXISTS player_username ON player COLUMNS username UNIQUE;
    DEFINE INDEX IF NOT EXISTS player_email    ON player COLUMNS email    UNIQUE;
  `);

    // SurrealDB native scope — issues JWTs directly
    // SESSION 30d means tokens are valid for 30 days
    await db.query(`
    DEFINE ACCESS IF NOT EXISTS player_scope ON DATABASE TYPE RECORD
        SIGNUP (
        CREATE player CONTENT {
            username:      $username,
            email:         $email,
            password_hash: crypto::argon2::generate($password),
            first_name:    $first_name OR "",
            last_name:     $last_name OR "",
            display_name:  $display_name OR $username,
            tier:          $tier OR "free",
            created_at:    time::now(),
            last_seen:     time::now(),
            preferences:   {}
        }
    )
        SIGNIN (
        SELECT * FROM player
        WHERE (email = $identifier OR username = $identifier)
        AND   crypto::argon2::compare(password_hash, $password)
        )
        DURATION FOR TOKEN 7d, FOR SESSION 7d;
`);
}

// ── Signup ──────────────────────────────────────────────────────────────────

export type PlayerTier = "free" | "pro" | "builder";

export interface SignupParams {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    tier?: PlayerTier;
}

export interface AuthResult {
    token: string;
    player: PlayerRecord;
}

export async function signup(params: SignupParams): Promise<AuthResult> {
    // Use a fresh scoped connection for signup — not the root connection
    const client = new Surreal();
    await client.connect(getEnvVar("SURREALDB_URL"), {
        namespace: getEnvVar("SURREALDB_NS"),
        database: getEnvVar("SURREALDB_DB"),
        authentication: {
            username: getEnvVar("SURREALDB_USERNAME"),
            password: getEnvVar("SURREALDB_PASSWORD"),
        },
    });

    // Ensure auth schema exists before attempting signup
    try {
        await applyAuthSchema(client);
    } catch (err) {
        console.warn("Auth schema initialization warning:", err);
    }

    // console.log("Client:", client);

    const tokens = await client.signup({
        namespace: getEnvVar("SURREALDB_NS"),
        database: getEnvVar("SURREALDB_DB"),
        access: "player_scope",
        variables: {
            username: params.username,
            email: params.email,
            password: params.password,
            first_name: params.first_name ?? "",
            last_name: params.last_name ?? "",
            display_name: params.display_name ?? params.username,
            tier: params.tier ?? "free",
        },
    });

    const token = tokens.access;

    // Query the newly created player directly by username
    // (can't use $auth here because the client is still connected as admin)
    const [player] = await client.query<[PlayerRecord[]]>(
        surql`SELECT * FROM player WHERE username = ${params.username}`
    );
    console.log("Player:", player);
    await client.close();

    if (!player?.[0]) throw new Error("Signup succeeded but player record not found");

    return { token, player: sanitizePlayer(player[0]) };
}

// ── Signin ──────────────────────────────────────────────────────────────────

export interface SigninParams {
    identifier: string;  // username OR email
    password: string;
}

export async function signin(params: SigninParams): Promise<AuthResult> {
    const client = new Surreal();
    await client.connect(getEnvVar("SURREALDB_URL"), {
        namespace: getEnvVar("SURREALDB_NS"),
        database: getEnvVar("SURREALDB_DB"),
        authentication: {
            username: getEnvVar("SURREALDB_USERNAME"),
            password: getEnvVar("SURREALDB_PASSWORD"),
        },
    });

    // Ensure auth schema exists before attempting signin
    try {
        await applyAuthSchema(client);
    } catch (err) {
        console.warn("Auth schema initialization warning:", err);
    }

    const tokens = await client.signin({
        namespace: getEnvVar("SURREALDB_NS"),
        database: getEnvVar("SURREALDB_DB"),
        access: "player_scope",
        variables: {
            identifier: params.identifier,
            password: params.password,
        },
    });

    const token = tokens.access;

    // Update last_seen for the player directly by identifier
    // (more reliable than $auth which depends on authentication state)
    const trimmedIdentifier = params.identifier.trim();
    await client.query(
        `UPDATE player SET last_seen = time::now() WHERE username = $identifier OR email = $identifier`,
        { identifier: trimmedIdentifier }
    );

    // Fetch the player record directly by identifier
    const [player] = await client.query<[PlayerRecord[]]>(
        `SELECT * FROM player WHERE username = $identifier OR email = $identifier`,
        { identifier: trimmedIdentifier }
    );
    await client.close();

    if (!player?.[0]) throw new Error("Signin succeeded but player record not found");

    return { token, player: sanitizePlayer(player[0]) };
}

// ── Signout ──────────────────────────────────────────────────────────────────

export async function signout(token: string): Promise<void> {
    const client = new Surreal();
    try {
        await client.connect(getEnvVar("SURREALDB_URL"), {
            namespace: getEnvVar("SURREALDB_NS"),
            database: getEnvVar("SURREALDB_DB"),
        });

        // Authenticate as the player so $auth is available
        await client.authenticate(token);

        // Clear the active session on their record
        await client.query(`UPDATE $auth SET active_session_id = NONE`);

    } catch (err) {
        // Don't throw — if the token is already expired, signout should
        // still succeed from the client's perspective
        console.warn("Signout cleanup warning:", err);
    } finally {
        await client.close();
    }
}

// ── Token validation ─────────────────────────────────────────────────────────
// Called by the requireAuth middleware on every protected request.
// Opens a scoped connection with the player's token — if SurrealDB accepts
// it, the token is valid and we get back the player record.

export async function validateToken(token: string): Promise<PlayerRecord> {
    const client = new Surreal();
    try {
        await client.connect(getEnvVar("SURREALDB_URL", "ws://localhost:8000/rpc"));
        await client.use({
            namespace: getEnvVar("SURREALDB_NS", "narrative"),
            database: getEnvVar("SURREALDB_DB", "engine"),
        });

        await client.authenticate(token);

        const [me] = await client.query<[PlayerRecord[]]>(`SELECT * FROM $auth`);
        if (!me?.[0]) throw new Error("Token valid but no player record found");

        return sanitizePlayer(me[0]);
    } finally {
        await client.close();
    }
}

// ── Request helper ────────────────────────────────────────────────────────────
// Extracts and validates the Bearer token from an incoming API request.
// Returns the player or throws — use in API routes via requireAuth().

export async function requireAuth(request: Request): Promise<PlayerRecord> {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        throw new AuthError("Missing or malformed Authorization header", 401);
    }

    const token = authHeader.slice(7).trim();

    try {
        return await validateToken(token);
    } catch (err) {
        throw new AuthError("Invalid or expired token", 401);
    }
}

// ── Error class ───────────────────────────────────────────────────────────────

export class AuthError extends Error {
    constructor(message: string, public statusCode: number = 401) {
        super(message);
        this.name = "AuthError";
    }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlayerRecord {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string;
    tier: "free" | "pro" | "builder";
    created_at: string;
    last_seen: string;
    active_session_id: string | null;
    preferences: Record<string, unknown>;
}

// Strip password_hash before returning to client
function sanitizePlayer(raw: PlayerRecord & { password_hash?: string }): PlayerRecord {
    const { password_hash: _, ...safe } = raw as any;
    return safe;
}