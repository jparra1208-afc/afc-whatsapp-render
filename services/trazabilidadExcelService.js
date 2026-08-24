const XLSX = require("xlsx");
const path = require("path");

// ============================================================
// AFC - Servicio de lectura de trazabilidad desde reporte GM
// Este archivo NO modifica el funcionamiento del Autobot actual.
// ============================================================

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function obtenerValor(row, ...nombresColumnas) {

    for (const nombreColumna of nombresColumnas) {

        const key = Object.keys(row).find(k =>
            normalizar(k) === normalizar(nombreColumna)
        );

        if (key) {
            return row[key];
        }
    }

    return "";
}

function separarUnidades(valor) {
    return String(valor || "")
        .split(/[\/,]/)
        .map(v => v.trim())
        .filter(Boolean);
}

function formatearFechaExcel(valor) {

    if (!valor) return null;

    // Fecha numérica de Excel
    if (typeof valor === "number") {

        const fecha = XLSX.SSF.parse_date_code(valor);

        if (!fecha) return null;

        const dia = String(fecha.d).padStart(2, "0");
        const mes = String(fecha.m).padStart(2, "0");
        const anio = fecha.y;

        return `${dia}/${mes}/${anio}`;
    }

    const texto = String(valor).trim();

    return texto || null;
}

function formatearTotal(valor) {

    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

    if (typeof valor === "number") {
        return valor;
    }

    const limpio = String(valor)
        .replace(/\$/g, "")
        .replace(/,/g, "")
        .trim();

    const numero = Number(limpio);

    return Number.isNaN(numero) ? null : numero;
}


// ============================================================
// LECTURA COMPLETA DEL REPORTE GM
// ============================================================

function leerEmbarquesGM() {

    const rutaExcel = path.join(
        __dirname,
        "..",
        "gm",
        "reporte.xlsx"
    );

    console.log("========================================");
    console.log("AFC - TRAZABILIDAD");
    console.log("Leyendo reporte GM:");
    console.log(rutaExcel);
    console.log("========================================");

    const workbook = XLSX.readFile(rutaExcel);

    const sheetName = workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
    });

    console.log("Filas detectadas en GM:", data.length);

    if (data.length > 0) {
        console.log(
            "Columnas detectadas:",
            Object.keys(data[0])
        );
    }


    // ========================================================
    // TRANSFORMAR CADA FILA GM A MODELO AFC
    // ========================================================

    const embarques = data
        .map(row => {

            const factura = String(
                obtenerValor(row, "Factura") || ""
            ).trim();

            const unidad = obtenerValor(
                row,
                "Unidad"
            );

            const remolque = obtenerValor(
                row,
                "Remolque"
            );

            return {

                factura,

                cliente: String(
                    obtenerValor(row, "Cliente") || ""
                ).trim(),

                origen: String(
                    obtenerValor(
                        row,
                        "Origen Ruta",
                        "Origen"
                    ) || ""
                ).trim(),

                destino: String(
                    obtenerValor(
                        row,
                        "Destino Ruta",
                        "Destino"
                    ) || ""
                ).trim(),

                unidad: String(
                    unidad || ""
                ).trim(),

                unidadesLista:
                    separarUnidades(unidad),

                remolque: String(
                    remolque || ""
                ).trim(),

                remolquesLista:
                    separarUnidades(remolque),

                chofer: String(
                    obtenerValor(row, "Chofer") || ""
                ).trim(),

                fechaFactura:
                    formatearFechaExcel(
                        obtenerValor(
                            row,
                            "Fecha",
                            "Fecha Factura",
                            "Fecha de Factura"
                        )
                    ),

                fechaSalida:
                    formatearFechaExcel(
                        obtenerValor(
                            row,
                            "Fecha de Salida",
                            "Fecha Salida"
                        )
                    ),

                fechaLlegada:
                    formatearFechaExcel(
                        obtenerValor(
                            row,
                            "Fecha de Llegada",
                            "Fecha de Llega",
                            "Fecha Llegada"
                        )
                    ),

                total:
                    formatearTotal(
                        obtenerValor(
                            row,
                            "Total"
                        )
                    ),

                estatusFactura: String(
                    obtenerValor(
                        row,
                        "Estatus Factura",
                        "Estatus"
                    ) || ""
                ).trim(),

                noViajeCliente: String(
                    obtenerValor(
                        row,
                        "No Viaje Cliente",
                        "No. Viaje Cliente",
                        "Numero Viaje Cliente"
                    ) || ""
                ).trim()
            };

        })

        // Evitamos filas vacías o encabezados intermedios.
        .filter(embarque => embarque.factura);


    console.log(
        "Embarques válidos detectados:",
        embarques.length
    );

    return embarques;
}


// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
    leerEmbarquesGM,
    separarUnidades
};