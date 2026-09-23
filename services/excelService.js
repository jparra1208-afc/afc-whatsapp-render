
const XLSX = require("xlsx");
const path = require("path");

// ============================================
// NORMALIZAR VALORES
// ============================================

function normalizar(valor) {

    return String(valor ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");

}


// ============================================
// OBTENER VALOR DE UNA COLUMNA
// ============================================

function obtenerValor(row, nombreColumna) {

    const key = Object.keys(row).find(k =>

        normalizar(k) === normalizar(nombreColumna)

    );

    return key ? row[key] : "";

}


// ============================================
// SEPARAR UNIDADES Y REMOLQUES
// ============================================

function separarUnidades(valor) {

    return String(valor ?? "")
        .split(/[\/,*,]/)
        .map(v => v.trim())
        .filter(Boolean);

}


// ============================================
// FORMATEAR FECHA EXCEL
// ============================================

function formatearFechaExcel(valor) {

    if (!valor) return "";

    if (typeof valor === "number") {

        const fecha = XLSX.SSF.parse_date_code(valor);

        if (!fecha) return "";

        const dia = String(fecha.d).padStart(2, "0");

        const mes = String(fecha.m).padStart(2, "0");

        const anio = fecha.y;

        return `${dia}/${mes}/${anio}`;

    }

    return String(valor).trim();

}


// ============================================
// BUSCAR FACTURA EN REPORTE GM
// ============================================

function buscarFactura(facturaBuscada) {

    const rutaExcel = path.join(
        __dirname,
        "..",
        "gm",
        "reporte.xlsx"
    );

    console.log("Leyendo Excel:", rutaExcel);

    // ========================================
    // LEER REPORTE
    // ========================================

    const workbook = XLSX.readFile(rutaExcel);

    const sheetName = workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
    });

    console.log(
        "Total filas Excel:",
        data.length
    );

    console.log(
        "Columnas detectadas:",
        Object.keys(data[0] || {})
    );

    // ========================================
    // NORMALIZAR FACTURA
    // ========================================

    const facturaNormalizada = normalizar(
        facturaBuscada
    );

    console.log(
        "Factura buscada:",
        facturaNormalizada
    );

    // ========================================
    // BUSCAR FACTURA
    // ========================================

    const resultado = data.find(row => {

        const facturaExcel = normalizar(
            obtenerValor(row, "Factura")
        );

        return facturaExcel === facturaNormalizada;

    });

    if (!resultado) {

        console.log(
            "Factura NO ENCONTRADA:",
            facturaNormalizada
        );

        return null;

    }

    // ========================================
    // DATOS OPERATIVOS
    // ========================================

    const unidad = obtenerValor(
        resultado,
        "Unidad"
    );

    const remolque = obtenerValor(
        resultado,
        "Remolque"
    );

    // ========================================
    // NUEVO CAMPO: NO VIAJE CLIENTE
    // ========================================

    const numeroViaje = String(

        obtenerValor(
            resultado,
            "No Viaje Cliente"
        ) ?? ""

    ).trim();

    // ========================================
    // FECHA DE LLEGADA
    // ========================================

    const fechaLlegada = formatearFechaExcel(

        obtenerValor(
            resultado,
            "Fecha de Llegada"
        ) ||

        obtenerValor(
            resultado,
            "Fecha de Llega"
        ) ||

        obtenerValor(
            resultado,
            "Fecha Llegada"
        )

    );

    // ========================================
    // VALIDACION EN TERMINAL
    // ========================================

    console.log("==============================");

    console.log(
        "Factura encontrada:",
        obtenerValor(resultado, "Factura")
    );

    console.log(
        "Cliente:",
        obtenerValor(resultado, "Cliente")
    );

    console.log(
        "Remolque:",
        remolque
    );

    console.log(
        "DEBUG No Viaje Cliente:",
        numeroViaje || "SIN NUMERO DE VIAJE"
    );

    console.log(
        "FechaLlegada formateada:",
        fechaLlegada
    );

    console.log("==============================");

    // ========================================
    // DEVOLVER INFORMACION DEL EMBARQUE
    // ========================================

    return {

        Factura: String(
            obtenerValor(resultado, "Factura") ?? ""
        ).trim(),

        Cliente: String(
            obtenerValor(resultado, "Cliente") ?? ""
        ).trim(),

        Origen: String(
            obtenerValor(resultado, "Origen Ruta") ?? ""
        ).trim(),

        Destino: String(
            obtenerValor(resultado, "Destino Ruta") ?? ""
        ).trim(),

        // DATOS INTERNOS PARA SAMSARA

        Unidad: String(
            unidad ?? ""
        ).trim(),

        UnidadesLista: separarUnidades(
            unidad
        ),

        Remolque: String(
            remolque ?? ""
        ).trim(),

        RemolquesLista: separarUnidades(
            remolque
        ),

        Chofer: String(
            obtenerValor(resultado, "Chofer") ?? ""
        ).trim(),

        // NUMERO DE VIAJE DEL CLIENTE

        NumeroViaje: numeroViaje,

        // VALIDACION DE VIAJE FINALIZADO

        FechaLlegada: fechaLlegada

    };

}


// ============================================
// EXPORTAR FUNCIONES
// ============================================

module.exports = {

    buscarFactura,

    separarUnidades

};