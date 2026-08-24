const { Pool } = require("pg");

// ============================================================
// AFC - Conexión PostgreSQL
//
// Desarrollo local:
//   PostgreSQL local -> sin SSL
//
// Entorno remoto / Render:
//   PostgreSQL remoto -> SSL
// ============================================================

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL no está configurada en las variables de entorno."
    );
}

const esLocal =
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.includes("[::1]");

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: esLocal
        ? false
        : {
            rejectUnauthorized: false
        }
});

module.exports = pool;