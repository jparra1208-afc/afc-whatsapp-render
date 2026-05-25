const XLSX = require("xlsx");
const path = require("path");

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
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
        const facturaExcel = normalizar(row.Factura);

        console.log("Comparando con factura Excel:", facturaExcel);

        return facturaExcel.includes(facturaNormalizada);
    });

    console.log("Resultado encontrado:", resultado || "NO ENCONTRADO");

    return resultado || null;
}

module.exports = {
    buscarFactura
};