const XLSX = require("xlsx");
const path = require("path");

function normalizar(valor) {

    return String(valor || "")
        .trim()
        .toUpperCase();

}

function buscarFactura(facturaBuscada) {

    const rutaExcel = path.join(
        __dirname,
        "..",
        "gm",
        "reporte.xlsx"
    );

    const workbook = XLSX.readFile(rutaExcel);

    const sheetName = workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
    });

    const facturaNormalizada = normalizar(facturaBuscada);

    const resultado = data.find(row => {

        return (

            normalizar(row.Factura).includes(facturaNormalizada) ||

            normalizar(row["No. Factura"]).includes(facturaNormalizada) ||

            normalizar(row["Factura #"]).includes(facturaNormalizada) ||

            normalizar(row.Folio).includes(facturaNormalizada) ||

            normalizar(row.Documento).includes(facturaNormalizada)

        );

    });

    return resultado || null;

}

module.exports = {
    buscarFactura
};
