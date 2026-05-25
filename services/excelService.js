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

    return {
        Factura: obtenerValor(resultado, "Factura"),
        Cliente: obtenerValor(resultado, "Cliente"),
        Origen: obtenerValor(resultado, "Origen Ruta"),
        Destino: obtenerValor(resultado, "Destino Ruta"),
        Unidad: obtenerValor(resultado, "Unidad"),
        Remolque: obtenerValor(resultado, "Remolque"),
        Chofer: obtenerValor(resultado, "Chofer")
    };
}

module.exports = {
    buscarFactura
};