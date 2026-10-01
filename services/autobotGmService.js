const db = require("./dbTorre");


// ======================================================
// OBTENER ULTIMA UNIDAD ASIGNADA POR GM
// ======================================================

async function obtenerUltimaUnidadGM(factura) {

    const facturaLimpia =
        String(factura || "").trim();

    if (!facturaLimpia) {
        return null;
    }

    try {

        const resultado = await db.query(
            `
            SELECT
                vf.factura,
                vf.viaje_id,
                v.folio_viaje,
                t.secuencia,
                t.unidad,
                t.remolque
            FROM public.viaje_facturas vf
            JOIN public.viajes_gm v
                ON v.id = vf.viaje_id
            JOIN public.viaje_trayectos t
                ON t.viaje_id = vf.viaje_id
            WHERE UPPER(TRIM(vf.factura)) =
                  UPPER(TRIM($1))
              AND NULLIF(TRIM(t.unidad), '') IS NOT NULL
            ORDER BY
                t.secuencia DESC NULLS LAST,
                t.id DESC
            LIMIT 1
            `,
            [facturaLimpia]
        );

        if (resultado.rows.length === 0) {

            console.log(
                "GM: no se encontro unidad para factura:",
                facturaLimpia
            );

            return null;
        }

        const fila = resultado.rows[0];

        console.log(
            "GM: ultima unidad encontrada:",
            {
                factura: fila.factura,
                viaje: fila.folio_viaje,
                secuencia: fila.secuencia,
                unidad: fila.unidad,
                remolque: fila.remolque
            }
        );

        return String(fila.unidad).trim();

    } catch (error) {

        console.error(
            "Error obteniendo ultima unidad GM:",
            error.message
        );

        // Importante:
        // un error de GM no debe detener el Autobot.
        return null;
    }

}


module.exports = {
    obtenerUltimaUnidadGM
};