// ============================================================
// AFC - EJECUCION PROGRAMADA DE SINCRONIZACION GM
// Archivo: scripts/sincronizarGM.js
// ============================================================

const {
    ejecutarSincronizacionGM
} = require("../services/trazabilidadOrchestratorService");


// ============================================================
// OBTENER LIMITE DE SINCRONIZACION
// ============================================================

function obtenerLimite() {

    const valor = process.env.SYNC_GM_LIMIT;

    // Sin variable, vacía o en 0 = procesar todo el lote
    if (
        valor === undefined ||
        valor === null ||
        valor === "" ||
        valor === "0"
    ) {
        return null;
    }

    const limite = Number(valor);

    if (
        !Number.isInteger(limite) ||
        limite <= 0
    ) {
        throw new Error(
            "SYNC_GM_LIMIT debe ser un entero mayor a 0, 0 o vacío."
        );
    }

    return limite;
}


// ============================================================
// EJECUCION PRINCIPAL
// ============================================================

async function main() {

    console.log("");
    console.log("==============================================");
    console.log("AFC - CRON SINCRONIZACION GM");
    console.log("==============================================");

    const limite = obtenerLimite();

    console.log(
        "Limite:",
        limite === null ? "LOTE COMPLETO" : limite
    );

    try {

        const resultado =
            await ejecutarSincronizacionGM(limite);

        console.log("");
        console.log("==============================================");
        console.log("RESULTADO CRON GM");
        console.log("==============================================");

        console.dir(
            resultado,
            {
                depth: 3
            }
        );


        // ====================================================
        // SINCRONIZACION RECHAZADA POR CONCURRENCIA
        // No lo tratamos como error crítico del proceso
        // ====================================================

        if (
            resultado &&
            resultado.ejecutado === false &&
            (
                resultado.motivo === "SINCRONIZACION_EN_PROCESO" ||
                resultado.motivo ===
                    "SINCRONIZACION_EN_PROCESO_POSTGRESQL"
            )
        ) {

            console.log("");
            console.log(
                "Sincronizacion omitida: ya existe otra ejecucion en proceso."
            );

            process.exitCode = 0;
            return;
        }


        // ====================================================
        // ERROR DEL ORQUESTADOR
        // ====================================================

        if (
            !resultado ||
            resultado.ejecutado !== true
        ) {

            console.error("");
            console.error(
                "La sincronizacion no finalizo correctamente."
            );

            process.exitCode = 1;
            return;
        }


        // ====================================================
        // VALIDAR ERRORES DEL LOTE
        // ====================================================

        const errores =
            resultado.resultado?.resumen?.errores ?? 0;

        if (errores > 0) {

            console.error("");
            console.error(
                `Sincronizacion completada con ${errores} error(es).`
            );

            process.exitCode = 1;
            return;
        }


        console.log("");
        console.log("==============================================");
        console.log("CRON GM FINALIZADO CORRECTAMENTE");
        console.log("==============================================");

        process.exitCode = 0;


    } catch (error) {

        console.error("");
        console.error("==============================================");
        console.error("ERROR GENERAL CRON GM");
        console.error("==============================================");
        console.error(error);

        process.exitCode = 1;
    }
}


// ============================================================
// INICIO
// ============================================================

main();