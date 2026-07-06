const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const router = express.Router();

const upload = multer({
    dest: "uploads/"
});

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

function obtenerFechaLlegada(row) {
    return (
        obtenerValor(row, "Fecha de Llega") ||
        obtenerValor(row, "Fecha de Llegada") ||
        obtenerValor(row, "Fecha Llegada") ||
        obtenerValor(row, "Fecha de Lleg")
    );
}

function validarExcel(rutaArchivo) {
    const workbook = XLSX.readFile(rutaArchivo);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
    });

    if (!data.length) {
        throw new Error("El Excel no contiene registros.");
    }

    const columnasRequeridas = [
        "Factura",
        "Cliente",
        "Origen Ruta",
        "Destino Ruta",
        "Unidad",
        "Remolque",
        "Chofer"
    ];

    const primeraFila = data[0];

    for (const columna of columnasRequeridas) {
        const existeColumna = Object.keys(primeraFila).some(k =>
            normalizar(k) === normalizar(columna)
        );

        if (!existeColumna) {
            throw new Error(`No existe la columna requerida: ${columna}`);
        }
    }

    const existeFechaLlegada = Object.keys(primeraFila).some(k =>
        ["Fecha de Llega", "Fecha de Llegada", "Fecha Llegada", "Fecha de Lleg"]
            .some(nombre => normalizar(k) === normalizar(nombre))
    );

    if (!existeFechaLlegada) {
        throw new Error("No existe la columna requerida: Fecha de Llega / Fecha de Llegada");
    }

    return {
        totalRegistros: data.length,
        columnas: Object.keys(primeraFila)
    };
}

router.post("/api/subir-reporte", upload.single("archivo"), async (req, res) => {
    try {
        const token = String(req.headers["x-api-token"] || "").trim();
        const apiToken = String(process.env.API_UPLOAD_TOKEN || "").trim();

        if (!apiToken || token !== apiToken) {
            return res.status(401).json({
                ok: false,
                mensaje: "No autorizado"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                ok: false,
                mensaje: "No se recibió archivo"
            });
        }

        const extension = path.extname(req.file.originalname).toLowerCase();

        if (extension !== ".xlsx" && extension !== ".xls") {
            fs.unlinkSync(req.file.path);

            return res.status(400).json({
                ok: false,
                mensaje: "Solo se permiten archivos Excel .xls o .xlsx"
            });
        }

        const validacion = validarExcel(req.file.path);

        const destino = path.join(
            __dirname,
            "..",
            "gm",
            "reporte.xlsx"
        );

        fs.copyFileSync(req.file.path, destino);
        fs.unlinkSync(req.file.path);

        console.log("Reporte actualizado correctamente");

        return res.json({
            ok: true,
            mensaje: "Reporte actualizado correctamente",
            archivoOriginal: req.file.originalname,
            validacion
        });

    } catch (error) {
        console.error(
            "Error subiendo reporte:",
            error.message
        );

        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
            ok: false,
            mensaje: error.message
        });
    }
});

router.get("/api/reporte-activo", (req, res) => {
    try {
        const rutaReporte = path.join(__dirname, "..", "gm", "reporte.xlsx");

        if (!fs.existsSync(rutaReporte)) {
            return res.status(404).json({
                ok: false,
                mensaje: "No existe reporte activo"
            });
        }

        const stats = fs.statSync(rutaReporte);

        const workbook = XLSX.readFile(rutaReporte);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const data = XLSX.utils.sheet_to_json(sheet, {
            defval: ""
        });

        const facturas = data
            .map(row => obtenerValor(row, "Factura"))
            .filter(Boolean);

        const facturaPrueba = data.find(row =>
            normalizar(obtenerValor(row, "Factura")) === normalizar("226625-TC")
        );

        const fechaLlegadaPrueba = facturaPrueba
            ? obtenerFechaLlegada(facturaPrueba)
            : "";

        return res.json({
            ok: true,
            archivoActivo: "gm/reporte.xlsx",
            fechaModificacionServidor: stats.mtime,
            totalRegistros: data.length,
            primeraFactura: facturas[0] || null,
            ultimaFactura: facturas[facturas.length - 1] || null,
            hoja: sheetName,
            columnas: Object.keys(data[0] || {}),
            facturaPrueba: facturaPrueba ? obtenerValor(facturaPrueba, "Factura") : null,
            fechaLlegadaPrueba: fechaLlegadaPrueba || null
        });

    } catch (error) {
        return res.status(500).json({
            ok: false,
            mensaje: error.message
        });
    }
});

module.exports = router;