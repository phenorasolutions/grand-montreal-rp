import {
  hashPassword,
  json,
  normalizeUsername,
  validUsername
} from "../_lib/security.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: "Le binding D1 DB est introuvable."
        },
        500
      );
    }

    const count = await db
      .prepare("SELECT COUNT(*) AS total FROM users")
      .first();

    return json({
      success: true,
      setupAvailable: Number(count?.total || 0) === 0
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: "Le binding D1 DB est introuvable."
        },
        500
      );
    }

    const requestOrigin = new URL(context.request.url).origin;
    const origin = context.request.headers.get("Origin");

    if (origin && origin !== requestOrigin) {
      return json(
        {
          success: false,
          error: "Origine de requête refusée."
        },
        403
      );
    }

    const count = await db
      .prepare("SELECT COUNT(*) AS total FROM users")
      .first();

    if (Number(count?.total || 0) > 0) {
      return json(
        {
          success: false,
          error: "Le compte fondateur existe déjà."
        },
        409
      );
    }

    const body = await context.request.json();

    const displayName = String(body.displayName || "").trim();
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");

    if (displayName.length < 2 || displayName.length > 60) {
      return json(
        {
          success: false,
          error: "Le nom affiché doit contenir entre 2 et 60 caractères."
        },
        400
      );
    }

    if (!validUsername(username)) {
      return json(
        {
          success: false,
          error: "L'identifiant doit contenir 3 à 40 caractères : lettres, chiffres, point, tiret ou soulignement."
        },
        400
      );
    }

    if (password.length < 12 || password.length > 200) {
      return json(
        {
          success: false,
          error: "Le mot de passe doit contenir au moins 12 caractères."
        },
        400
      );
    }

    const passwordData = await hashPassword(password);

    const result = await db.prepare(
      `INSERT INTO users (
        username,
        password_hash,
        password_salt,
        password_iterations,
        display_name,
        role,
        active
      ) VALUES (?1, ?2, ?3, ?4, ?5, 100, 1)`
    ).bind(
      username,
      passwordData.hash,
      passwordData.salt,
      passwordData.iterations,
      displayName
    ).run();

    const userId = result.meta.last_row_id;

    await db.prepare(
      `INSERT INTO activity_logs (
        user_id,
        action,
        category,
        details
      ) VALUES (?1, 'founder_created', 'auth', ?2)`
    ).bind(
      userId,
      JSON.stringify({
        username,
        displayName,
        role: 100
      })
    ).run();

    return json(
      {
        success: true,
        created: true,
        user: {
          id: userId,
          username,
          displayName,
          role: 100
        }
      },
      201
    );
  } catch (error) {
    console.error(error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      },
      500
    );
  }
}
