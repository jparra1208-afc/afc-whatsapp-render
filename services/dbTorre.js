const { Pool } = require("pg");

if (!process.env.TORRE_DATABASE_URL) {
    throw new Error(
        "TORRE_DATABASE_URL no está configurada en las variables de entorno."
    );
}

const pool = new Pool({
    connectionString: process.env.TORRE_DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
     connect: () => pool.connect()
};