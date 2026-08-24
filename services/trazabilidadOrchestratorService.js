// ============================================================
// AFC - ORQUESTADOR DE TRAZABILIDAD
// Archivo: services/trazabilidadOrchestratorService.js
// ============================================================

const trazabilidadSyncService = require("./trazabilidadSyncService");
const db = require("./db");
// ============================================================
// BLOQUEO DISTRIBUIDO POSTGRESQL
// ============================================================

// ============================================================
// AFC - IDENTIFICADOR PERMANENTE DE BLOQUEO
// 740001 = Sincronización GM -> PostgreSQL
// NO CAMBIAR ENTRE EJECUCIONES
// ============================================================

const PG_LOCK_ID = 740001;

// ============================================================
// ESTADO INTERNO DEL ORQUESTADOR
// ============================================================

// Indica si actualmente existe una sincronización ejecutándose.
let sincronizacionEnProceso = false;

// Fecha/hora en que comenzó la ejecución actual.
let fechaInicioEjecucion = null;
// ============================================================
// CONTROL DE BLOQUEO POSTGRESQL
// ============================================================

async function adquirirBloqueoPostgreSQL() {

    const client = await db.connect();

    try {

        const resultado = await client.query(
            "SELECT pg_try_advisory_lock($1) AS adquirido",
            [PG_LOCK_ID]
        );

        const adquirido = resultado.rows[0].adquirido;

        if (!adquirido) {

            client.release();

            return {
                adquirido: false,
                client: null
            };
        }

        return {
            adquirido: true,
            client
        };

    } catch (error) {

        client.release();
        throw error;
    }
}


async function liberarBloqueoPostgreSQL(client) {

    if (!client) {
        return;
    }

    try {

        await client.query(
            "SELECT pg_advisory_unlock($1)",
            [PG_LOCK_ID]
        );

    } finally {

        client.release();
    }
}

// ============================================================
// CONSULTAR ESTADO DEL ORQUESTADOR
// ============================================================

function obtenerEstadoOrquestador() {

    return {
        sincronizacionEnProceso,
        fechaInicioEjecucion
    };

}


// ============================================================
// EJECUTAR SINCRONIZACION
// ============================================================

async function ejecutarSincronizacionGM(limite = null) {

    console.log("");
    console.log("==========================================");
    console.log("AFC - ORQUESTADOR DE TRAZABILIDAD");
    console.log("==========================================");

    // --------------------------------------------------------
    // EVITAR EJECUCIONES SIMULTANEAS
    // --------------------------------------------------------

    if (sincronizacionEnProceso) {

        console.log("SINCRONIZACION RECHAZADA");
        console.log("Ya existe una sincronizacion en proceso.");

        return {
            ejecutado: false,
            motivo: "SINCRONIZACION_EN_PROCESO",
            fechaInicioEjecucion
        };
    }


    // --------------------------------------------------------
    // BLOQUEAR ORQUESTADOR
    // --------------------------------------------------------

    sincronizacionEnProceso = true;
    fechaInicioEjecucion = new Date();
    let bloqueoPostgreSQL = null;
    console.log(
        "Inicio:",
        fechaInicioEjecucion.toISOString()
    );


    try {

        // ----------------------------------------------------
        // EJECUTAR MOTOR ACTUAL DE TRAZABILIDAD
        // ----------------------------------------------------
        bloqueoPostgreSQL =
    await adquirirBloqueoPostgreSQL();

if (!bloqueoPostgreSQL.adquirido) {

    console.log("");
    console.log("==========================================");
    console.log("SINCRONIZACION RECHAZADA POR POSTGRESQL");
    console.log("Otra instancia ya posee el bloqueo.");
    console.log("==========================================");

    return {
        ejecutado: false,
        motivo: "SINCRONIZACION_EN_PROCESO_POSTGRESQL",
        fechaInicioEjecucion
    };
}


// ========================================================
// ESPERA TEMPORAL PARA PRUEBA DE CONCURRENCIA
// ELIMINAR DESPUES DE LA PRUEBA
// ========================================================

console.log("");
console.log("BLOQUEO POSTGRESQL ADQUIRIDO");
//console.log("Esperando 30 segundos para prueba de concurrencia...");

//await new Promise(resolve => setTimeout(resolve, 30000));


    // ========================================================
    // EJECUTAR MOTOR ACTUAL DE TRAZABILIDAD
    // ========================================================


        const resultado =
            await trazabilidadSyncService.sincronizarLoteGM(
                limite
            );


        console.log("");
        console.log("==========================================");
        console.log("SINCRONIZACION FINALIZADA");
        console.log("==========================================");

        return {
            ejecutado: true,
            inicio: fechaInicioEjecucion,
            fin: new Date(),
            resultado
        };


    } catch (error) {

        console.error("");
        console.error("==========================================");
        console.error("ERROR EN ORQUESTADOR");
        console.error("==========================================");
        console.error(error);

        return {
            ejecutado: false,
            motivo: "ERROR_SINCRONIZACION",
            mensaje: error.message
        };


    }finally {

    // ----------------------------------------------------
    // LIBERAR BLOQUEO POSTGRESQL
    // ----------------------------------------------------

    if (
        bloqueoPostgreSQL &&
        bloqueoPostgreSQL.adquirido
    ) {

        await liberarBloqueoPostgreSQL(
            bloqueoPostgreSQL.client
        );

        console.log("");
        console.log("BLOQUEO POSTGRESQL LIBERADO");
    }
}

    // ----------------------------------------------------
    // LIBERAR BLOQUEO LOCAL NODE
    // ----------------------------------------------------

    sincronizacionEnProceso = false;
    fechaInicioEjecucion = null;

    console.log("");
    console.log("ORQUESTADOR LIBERADO");
    console.log("==========================================");

}




// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
    ejecutarSincronizacionGM,
    obtenerEstadoOrquestador
};