const XLSX = require("xlsx");
const path = require("path");

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function obtenerValor(row, nombreColumna) {
    const key = Object.keys(row).find(k =>
        normalizar(k) === normalizar(nombreColumna)
    );

    return key ? row[key] : "";
}

function separarUnidades(valor) {
    return String(valor || "")
        .split(/[\/,]/)
        .map(v => v.trim())
        .filter(Boolean);
}

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

function buscarFactura(facturaBuscada) {
    const rutaExcel = path.join(__dirname, "..", "gm", "reporte.xlsx");

    console.log("Leyendo Excel:", rutaExcel);

    const workbook = XLSX.readFile(rutaExcel);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
    });

    console.log("Total filas Excel:", data.length);
    console.log("Columnas detectadas:", Object.keys(data[0] || {}));

    const facturaNormalizada = normalizar(facturaBuscada);

    console.log("Factura buscada:", facturaNormalizada);

    const resultado = data.find(row => {
        const facturaExcel = normalizar(obtenerValor(row, "Factura"));

        console.log("Comparando con factura Excel:", facturaExcel);

        return facturaExcel.includes(facturaNormalizada);
    });

    console.log("Resultado encontrado:", resultado || "NO ENCONTRADO");

    if (!resultado) {
        return null;
    }

    const unidad = obtenerValor(resultado, "Unidad");
    const remolque = obtenerValor(resultado, "Remolque");

    const fechaLlegada = formatearFechaExcel(
        obtenerValor(resultado, "Fecha de Llegada") ||
        obtenerValor(resultado, "Fecha de Llega") ||
        obtenerValor(resultado, "Fecha Llegada")
    );

    console.log("==============================");
    console.log("Factura encontrada:", obtenerValor(resultado, "Factura"));
    console.log("FechaLlegada formateada:", fechaLlegada);
    console.log("==============================");

    return {
        Factura: String(obtenerValor(resultado, "Factura") || "").trim(),
        Cliente: String(obtenerValor(resultado, "Cliente") || "").trim(),
        Origen: String(obtenerValor(resultado, "Origen Ruta") || "").trim(),
        Destino: String(obtenerValor(resultado, "Destino Ruta") || "").trim(),
        Unidad: String(unidad || "").trim(),
        UnidadesLista: separarUnidades(unidad),
        Remolque: String(remolque || "").trim(),
        RemolquesLista: separarUnidades(remolque),
        Chofer: String(obtenerValor(resultado, "Chofer") || "").trim(),
        FechaLlegada: fechaLlegada
    };
}

module.exports = {
    buscarFactura,
    separarUnidades
};