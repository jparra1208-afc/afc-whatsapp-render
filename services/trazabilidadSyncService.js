const { leerEmbarquesGM } = require("./trazabilidadExcelService");
const db = require("./db");

// ============================================================
// AFC - Servicio de sincronización GM -> Trazabilidad
// ============================================================

function normalizar(valor) {
    return String(valor ?? "")
        .trim()
        .toUpperCase();
}

function normalizarComparacion(valor) {
    return String(valor ?? "").trim();
}

function normalizarNumero(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

    const numero = Number(valor);
    return Number.isNaN(numero) ? null : numero;
}

function normalizarFecha(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return "";
    }

    // GM normalmente entrega DD/MM/YYYY
    if (typeof valor === "string") {
        const texto = valor.trim();

        const formatoGM = texto.match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/
        );

        if (formatoGM) {
            const [, dia, mes, anio] = formatoGM;
            return `${anio}-${mes}-${dia}`;
        }

        // PostgreSQL / ISO
        const formatoISO = texto.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

        if (formatoISO) {
            return `${formatoISO[1]}-${formatoISO[2]}-${formatoISO[3]}`;
        }
    }

    // Cuando pg entrega un objeto Date
    const fecha = new Date(valor);

    if (!Number.isNaN(fecha.getTime())) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const dia = String(fecha.getDate()).padStart(2, "0");

        return `${anio}-${mes}-${dia}`;
    }

    return String(valor).trim();
}

function esFacturaCancelada(estatusFactura) {
    return normalizar(estatusFactura) === "CANCELADA";
}

function determinarEstadoBaseGM(embarque) {

    if (esFacturaCancelada(embarque.estatusFactura)) {
        return "CANCELADO";
    }

    if (embarque.fechaLlegada) {
        return "LLEGO_DESTINO";
    }

    if (embarque.fechaSalida) {
        return "EN_TRANSITO";
    }

    return "PENDIENTE_SALIDA";
}


// ============================================================
// CAMPOS A COMPARAR GM VS POSTGRESQL
// ============================================================

function construirCamposComparar(gm, actual) {

    return [
        ["cliente", gm.cliente, actual.cliente],
        ["origen", gm.origen, actual.origen],
        ["destino", gm.destino, actual.destino],
        ["unidad", gm.unidad, actual.unidad],
        ["caja", gm.remolque, actual.caja],
        ["chofer", gm.chofer, actual.chofer],
        ["fecha_salida", gm.fechaSalida, actual.fecha_salida],
        ["fecha_llegada", gm.fechaLlegada, actual.fecha_llegada],
        ["total", gm.total, actual.total],
        ["estatus_factura", gm.estatusFactura, actual.estatus_factura],
        ["no_viaje_cliente", gm.noViajeCliente, actual.no_viaje_cliente]
    ];
}


// ============================================================
// DETECTAR CAMBIOS
// ============================================================

function detectarCambios(gm, actual) {

    const camposComparar = construirCamposComparar(gm, actual);
    const cambios = [];

    for (const [campo, valorGM, valorBD] of camposComparar) {

        let sonIguales;

        if (campo === "total") {

            sonIguales =
                normalizarNumero(valorGM) ===
                normalizarNumero(valorBD);

        } else if (
            campo === "fecha_salida" ||
            campo === "fecha_llegada"
        ) {

            sonIguales =
                normalizarFecha(valorGM) ===
                normalizarFecha(valorBD);

        } else {

            sonIguales =
                normalizar(valorGM) ===
                normalizar(valorBD);
        }

        if (!sonIguales) {

            cambios.push({
                campo,
                gm: normalizarComparacion(valorGM),
                postgres: normalizarComparacion(valorBD)
            });
        }
    }

    return cambios;
}


// ============================================================
// CONSULTAR EXPEDIENTE
// ============================================================

async function obtenerEmbarquePorFactura(factura) {

    const consulta = await db.query(
        `
        SELECT
            id,
            factura,
            cliente,
            origen,
            destino,
            unidad,
            caja,
            chofer,
            fecha_salida,
            fecha_llegada,
            fecha_factura,
            total,
            estatus_factura,
            no_viaje_cliente
        FROM public.embarques
        WHERE factura = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [factura]
    );

    return consulta.rows[0] || null;
}


// ============================================================
// OBTENER TIPO DE EVENTO
// ============================================================

async function obtenerTipoEvento(codigo) {

    const resultado = await db.query(
        `
        SELECT id
        FROM public.tipos_evento
        WHERE codigo = $1
          AND activo = TRUE
        LIMIT 1
        `,
        [codigo]
    );

    if (resultado.rows.length === 0) {
        throw new Error(
            `No existe el tipo de evento ${codigo}.`
        );
    }

    return resultado.rows[0].id;
}


// ============================================================
// VALIDAR EVENTO DUPLICADO
// ============================================================

async function eventoYaExiste(
    embarqueId,
    tipoEventoId
) {

    const resultado = await db.query(
        `
        SELECT 1
        FROM public.eventos_embarque
        WHERE embarque_id = $1
          AND tipo_evento_id = $2
        LIMIT 1
        `,
        [
            embarqueId,
            tipoEventoId
        ]
    );

    return resultado.rows.length > 0;
}


// ============================================================
// REGISTRAR EVENTO DEL SISTEMA
// ============================================================

async function registrarEventoSistema(
    embarqueId,
    codigoEvento,
    observacion,
    evitarDuplicado = false
) {

    const tipoEventoId =
        await obtenerTipoEvento(codigoEvento);

    if (
        evitarDuplicado &&
        await eventoYaExiste(
            embarqueId,
            tipoEventoId
        )
    ) {
        return null;
    }

    const resultado = await db.query(
        `
        INSERT INTO public.eventos_embarque
        (
            embarque_id,
            tipo_evento_id,
            area,
            usuario,
            observacion,
            origen_evento
        )
        VALUES
        (
            $1,
            $2,
            'SISTEMA',
            'AUTOBOT_GM',
            $3,
            'SISTEMA'
        )
        RETURNING
            id,
            embarque_id,
            tipo_evento_id,
            fecha_evento,
            observacion
        `,
        [
            embarqueId,
            tipoEventoId,
            observacion
        ]
    );

    return resultado.rows[0];
}
// ============================================================
// SIMULACIÓN SOLO CON REPORTE GM
// ============================================================

function simularSincronizacion() {

    console.log("========================================");
    console.log("AFC - SIMULADOR DE SINCRONIZACION");
    console.log("MODO: SOLO LECTURA");
    console.log("NO MODIFICA POSTGRESQL");
    console.log("========================================");

    const embarques = leerEmbarquesGM();

    const resumen = {
        total: embarques.length,
        activos: 0,
        cancelados: 0,
        pendienteSalida: 0,
        enTransito: 0,
        llegoDestino: 0
    };

    const resultado = embarques.map(embarque => {

        const estadoBase =
            determinarEstadoBaseGM(embarque);

        if (estadoBase === "CANCELADO") {

            resumen.cancelados++;

            return {
                factura: embarque.factura,
                accion: "NOTIFICAR_CANCELACION",
                estadoBase,
                cliente: embarque.cliente
            };
        }

        resumen.activos++;

        if (estadoBase === "PENDIENTE_SALIDA") {
            resumen.pendienteSalida++;
        }

        if (estadoBase === "EN_TRANSITO") {
            resumen.enTransito++;
        }

        if (estadoBase === "LLEGO_DESTINO") {
            resumen.llegoDestino++;
        }

        return {
            factura: embarque.factura,
            accion: "PROCESAR_TRAZABILIDAD",
            estadoBase,
            cliente: embarque.cliente,
            origen: embarque.origen,
            destino: embarque.destino,
            unidad: embarque.unidad,
            remolque: embarque.remolque,
            chofer: embarque.chofer,
            fechaFactura: embarque.fechaFactura,
            fechaSalida: embarque.fechaSalida,
            fechaLlegada: embarque.fechaLlegada,
            noViajeCliente: embarque.noViajeCliente
        };
    });

    console.log("RESUMEN", resumen);
    console.table(resultado.slice(0, 10));

    return {
        resumen,
        resultado
    };
}


// ============================================================
// COMPARACIÓN GM VS POSTGRESQL
// SOLO LECTURA
// ============================================================

async function compararConPostgreSQL() {

    console.log("========================================");
    console.log("AFC - COMPARACION GM vs POSTGRESQL");
    console.log("MODO: SOLO LECTURA");
    console.log("NO INSERTA / NO ACTUALIZA");
    console.log("========================================");

    const embarquesGM = leerEmbarquesGM();

    const resumen = {
        totalGM: embarquesGM.length,
        nuevas: 0,
        actualizar: 0,
        sinCambios: 0,
        canceladas: 0
    };

    const resultados = [];

    for (const gm of embarquesGM) {

        if (esFacturaCancelada(gm.estatusFactura)) {

            resumen.canceladas++;

            resultados.push({
                factura: gm.factura,
                accion: "CANCELADA_NOTIFICAR"
            });

            continue;
        }

        const actual =
            await obtenerEmbarquePorFactura(
                gm.factura
            );

        if (!actual) {

            resumen.nuevas++;

            resultados.push({
                factura: gm.factura,
                accion: "NUEVA"
            });

            continue;
        }

        const cambios =
            detectarCambios(gm, actual);

        if (cambios.length === 0) {

            resumen.sinCambios++;

            resultados.push({
                factura: gm.factura,
                accion: "SIN_CAMBIOS"
            });

        } else {

            resumen.actualizar++;

            resultados.push({
                factura: gm.factura,
                accion: "ACTUALIZAR",
                cambios
            });
        }
    }

    console.log("========================================");
    console.log("RESUMEN COMPARACION");
    console.log("========================================");

    console.log("Total GM:", resumen.totalGM);
    console.log("Nuevas:", resumen.nuevas);
    console.log("Actualizar:", resumen.actualizar);
    console.log("Sin cambios:", resumen.sinCambios);
    console.log("Canceladas:", resumen.canceladas);

    console.table(
        resultados.slice(0, 20)
    );

    return {
        resumen,
        resultados
    };
}

// ============================================================
// SINCRONIZACIÓN CONTROLADA DE UNA FACTURA
// ============================================================

async function sincronizarFacturaPrueba(factura) {

    console.log("========================================");
    console.log("AFC - SINCRONIZACION CONTROLADA");
    console.log("FACTURA:", factura);
    console.log("========================================");

    const embarquesGM = leerEmbarquesGM();

    const gm = embarquesGM.find(
        embarque =>
            normalizar(embarque.factura) ===
            normalizar(factura)
    );

    if (!gm) {
        throw new Error(
            `La factura ${factura} no existe en el reporte GM.`
        );
    }

    // ========================================================
    // CANCELADA
    // ========================================================

    if (esFacturaCancelada(gm.estatusFactura)) {

        console.log("FACTURA CANCELADA:", gm.factura);

        return {
            factura: gm.factura,
            accion: "CANCELADA_NOTIFICAR"
        };
    }

    const actual =
        await obtenerEmbarquePorFactura(
            gm.factura
        );

    // ========================================================
    // EXPEDIENTE EXISTENTE
    // ========================================================

    if (actual) {

        const cambios =
            detectarCambios(gm, actual);

        if (cambios.length === 0) {

            console.log("========================================");
            console.log("SIN CAMBIOS");
            console.log("GM y PostgreSQL coinciden.");
            console.log("========================================");

            return {
                factura: gm.factura,
                accion: "SIN_CAMBIOS",
                embarqueId: actual.id
            };
        }

        console.log("========================================");
        console.log("CAMBIOS DETECTADOS");
        console.log("========================================");

        console.table(cambios);

        const resultadoUpdate =
            await db.query(
                `
                UPDATE public.embarques
                SET
                    cliente = $1,
                    origen = $2,
                    destino = $3,
                    unidad = $4,
                    caja = $5,
                    chofer = $6,

                    fecha_salida = CASE
                        WHEN $7::text IS NULL
                          OR $7::text = ''
                            THEN NULL
                        ELSE TO_DATE(
                            $7,
                            'DD/MM/YYYY'
                        )
                    END,

                    fecha_llegada = CASE
                        WHEN $8::text IS NULL
                          OR $8::text = ''
                            THEN NULL
                        ELSE TO_DATE(
                            $8,
                            'DD/MM/YYYY'
                        )
                    END,

                    total = $9,
                    estatus_factura = $10,
                    no_viaje_cliente = $11

                WHERE id = $12

                RETURNING
                    id,
                    factura,
                    unidad,
                    caja,
                    chofer
                `,
                [
                    gm.cliente || null,
                    gm.origen || null,
                    gm.destino || null,
                    gm.unidad || null,
                    gm.remolque || null,
                    gm.chofer || null,
                    gm.fechaSalida || null,
                    gm.fechaLlegada || null,
                    gm.total || null,
                    gm.estatusFactura || null,
                    gm.noViajeCliente || null,
                    actual.id
                ]
            );

        console.log("========================================");
        console.log("UPDATE REALIZADO");
        console.log("========================================");

        console.log(
            resultadoUpdate.rows[0]
        );

        const cambioSalida =
            cambios.find(
                c => c.campo === "fecha_salida"
            );

        const cambioLlegada =
            cambios.find(
                c => c.campo === "fecha_llegada"
            );

        let eventoSalida = null;
        let eventoLlegada = null;

        // ====================================================
        // NUEVA FECHA DE SALIDA
        // ====================================================

        if (
            cambioSalida &&
            !cambioSalida.postgres &&
            cambioSalida.gm
        ) {

            eventoSalida =
                await registrarEventoSistema(
                    actual.id,
                    "SALIDA_DETECTADA",
                    `Fuente: GM | Fecha de salida detectada: ${gm.fechaSalida}`,
                    true
                );

            if (eventoSalida) {

                console.log(
                    "SALIDA_DETECTADA REGISTRADA"
                );

                console.log(eventoSalida);
            }
        }

        // ====================================================
        // NUEVA FECHA DE LLEGADA
        // ====================================================

        if (
            cambioLlegada &&
            !cambioLlegada.postgres &&
            cambioLlegada.gm
        ) {

            eventoLlegada =
                await registrarEventoSistema(
                    actual.id,
                    "LLEGADA_DETECTADA",
                    `Fuente: GM | Fecha de llegada detectada: ${gm.fechaLlegada}`,
                    true
                );

            if (eventoLlegada) {

                console.log(
                    "LLEGADA_DETECTADA REGISTRADA"
                );

                console.log(eventoLlegada);
            }
        }

        // ====================================================
        // EVENTO DE AUDITORÍA ACTUALIZACION_GM
        // ====================================================

        const detalleCambios =
            cambios
                .map(
                    cambio =>
                        `${cambio.campo}: ` +
                        `${cambio.postgres || "(vacío)"} -> ` +
                        `${cambio.gm || "(vacío)"}`
                )
                .join(" | ");

        const eventoRegistrado =
            await registrarEventoSistema(
                actual.id,
                "ACTUALIZACION_GM",
                `Fuente: GM | ${detalleCambios}`,
                false
            );

        console.log("========================================");
        console.log(
            "EVENTO DE TRAZABILIDAD REGISTRADO"
        );
        console.log("========================================");

        console.log(eventoRegistrado);

        return {
            factura: gm.factura,
            accion: "ACTUALIZAR",
            embarqueId: actual.id,
            cambios,
            registro: resultadoUpdate.rows[0],
            evento: eventoRegistrado,
            eventoSalida,
            eventoLlegada
        };
    }


    // ========================================================
    // FACTURA NUEVA
    // CREAR EXPEDIENTE
    // ========================================================

    const insert = await db.query(
        `
        INSERT INTO public.embarques
        (
            factura,
            cliente,
            origen,
            destino,
            unidad,
            caja,
            chofer,
            fecha_salida,
            estatus_factura,
            archivo_origen,
            fecha_factura,
            fecha_llegada,
            total,
            no_viaje_cliente
        )
        VALUES
        (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,

            CASE
                WHEN $8::text IS NULL
                  OR $8::text = ''
                    THEN NULL
                ELSE TO_DATE(
                    $8,
                    'DD/MM/YYYY'
                )
            END,

            $9,
            $10,

            CASE
                WHEN $11::text IS NULL
                  OR $11::text = ''
                    THEN NULL
                ELSE TO_DATE(
                    $11,
                    'DD/MM/YYYY'
                )
            END,

            CASE
                WHEN $12::text IS NULL
                  OR $12::text = ''
                    THEN NULL
                ELSE TO_DATE(
                    $12,
                    'DD/MM/YYYY'
                )
            END,

            $13,
            $14
        )

        RETURNING
            id,
            factura
        `,
        [
            gm.factura,
            gm.cliente,
            gm.origen,
            gm.destino,
            gm.unidad,
            gm.remolque,
            gm.chofer,
            gm.fechaSalida,
            gm.estatusFactura,
            "gm/reporte.xlsx",
            gm.fechaFactura,
            gm.fechaLlegada,
            gm.total,
            gm.noViajeCliente
        ]
    );

    console.log("========================================");
    console.log("INSERT REALIZADO");
    console.log("========================================");

    console.log(insert.rows[0]);

    const embarqueId =
        insert.rows[0].id;


    // ========================================================
    // EMBARQUE DETECTADO
    // ========================================================

    const eventoDetectado =
        await registrarEventoSistema(
            embarqueId,
            "EMBARQUE_DETECTADO",
            `Fuente: GM | Embarque detectado automáticamente | Factura: ${gm.factura}`,
            true
        );

    console.log("========================================");
    console.log(
        "EVENTO EMBARQUE_DETECTADO REGISTRADO"
    );
    console.log("========================================");

    console.log(eventoDetectado);


    // ========================================================
    // EVENTOS INICIALES
    // ========================================================

    let eventoSalidaInicial = null;
    let eventoLlegadaInicial = null;

    if (gm.fechaSalida) {

        eventoSalidaInicial =
            await registrarEventoSistema(
                embarqueId,
                "SALIDA_DETECTADA",
                `Fuente: GM | Fecha de salida detectada al crear expediente: ${gm.fechaSalida}`,
                true
            );

        if (eventoSalidaInicial) {

            console.log(
                "SALIDA_DETECTADA INICIAL REGISTRADA"
            );

            console.log(
                eventoSalidaInicial
            );
        }
    }

    if (gm.fechaLlegada) {

        eventoLlegadaInicial =
            await registrarEventoSistema(
                embarqueId,
                "LLEGADA_DETECTADA",
                `Fuente: GM | Fecha de llegada detectada al crear expediente: ${gm.fechaLlegada}`,
                true
            );

        if (eventoLlegadaInicial) {

            console.log(
                "LLEGADA_DETECTADA INICIAL REGISTRADA"
            );

            console.log(
                eventoLlegadaInicial
            );
        }
    }

    return {
        factura: gm.factura,
        accion: "INSERTADA",
        embarqueId,
        evento: eventoDetectado,
        eventoSalida: eventoSalidaInicial,
        eventoLlegada: eventoLlegadaInicial
    };
}
// ============================================================
// SINCRONIZACIÓN POR LOTE
// ============================================================
// ============================================================
// AUDITORIA DE SINCRONIZACIONES GM
// ============================================================

async function iniciarAuditoriaSincronizacion(totalGM) {

    const resultado = await db.query(
        `
        INSERT INTO public.sincronizaciones_gm
        (
            total_gm,
            estatus,
            origen,
            archivo_origen
        )
        VALUES
        (
            $1,
            'EN_PROCESO',
            'GM_EXCEL',
            'gm/reporte.xlsx'
        )
        RETURNING
            id,
            fecha_inicio,
            estatus
        `,
        [totalGM]
    );

    return resultado.rows[0];
}


async function finalizarAuditoriaSincronizacion(
    sincronizacionId,
    resumen,
    estatus,
    mensajeError = null
) {

    const resultado = await db.query(
        `
        UPDATE public.sincronizaciones_gm
        SET
            fecha_fin = NOW(),
            total_gm = $1,
            insertadas = $2,
            actualizadas = $3,
            sin_cambios = $4,
            canceladas = $5,
            errores = $6,
            estatus = $7,
            mensaje_error = $8
        WHERE id = $9
        RETURNING
            id,
            fecha_inicio,
            fecha_fin,
            total_gm,
            insertadas,
            actualizadas,
            sin_cambios,
            canceladas,
            errores,
            estatus
        `,
        [
            resumen.totalGM,
            resumen.insertadas,
            resumen.actualizadas,
            resumen.sinCambios,
            resumen.canceladas,
            resumen.errores,
            estatus,
            mensajeError,
            sincronizacionId
        ]
    );

    return resultado.rows[0];
}

async function sincronizarLoteGM(limite = null) {

    console.log("========================================");
    console.log("AFC - SINCRONIZACION LOTE GM");
    console.log("========================================");

    const embarquesGM =
        leerEmbarquesGM();

    const embarquesProcesar =
        limite !== null && limite > 0
            ? embarquesGM.slice(0, limite)
            : embarquesGM;

    const resumen = {
        totalGM: embarquesProcesar.length,
        insertadas: 0,
        actualizadas: 0,
        sinCambios: 0,
        canceladas: 0,
        errores: 0
    };
const auditoria =
    await iniciarAuditoriaSincronizacion(
        resumen.totalGM
    );

console.log("");
console.log("========================================");
console.log("AUDITORIA DE SINCRONIZACION INICIADA");
console.log("ID:", auditoria.id);
console.log("========================================");
    const resultados = [];
    const errores = [];

    for (const gm of embarquesProcesar) {

        const factura = gm.factura;

        if (!factura) {

            resumen.errores++;

            errores.push({
                factura: "(sin factura)",
                error:
                    "Registro GM sin número de factura."
            });

            continue;
        }

        try {

            console.log("");
            console.log("----------------------------------------");
            console.log("PROCESANDO:", factura);
            console.log("----------------------------------------");

            const resultado =
                await sincronizarFacturaPrueba(
                    factura
                );

            resultados.push(resultado);

            switch (resultado.accion) {

                case "INSERTADA":
                    resumen.insertadas++;
                    break;

                case "ACTUALIZAR":
                case "ACTUALIZADA":
                    resumen.actualizadas++;
                    break;

                case "SIN_CAMBIOS":
                    resumen.sinCambios++;
                    break;

                case "CANCELADA":
                case "CANCELADA_NOTIFICAR":
                    resumen.canceladas++;
                    break;

                default:

                    console.log(
                        "Acción no clasificada:",
                        resultado.accion
                    );

                    break;
            }

        } catch (error) {

            resumen.errores++;

            errores.push({
                factura,
                error: error.message
            });

            console.error(
                `ERROR EN ${factura}:`,
                error.message
            );

            // No detener el lote.
            // Continuar con la siguiente factura.
        }
    }

    console.log("");
    console.log("========================================");
    console.log("RESUMEN SINCRONIZACION GM");
    console.log("========================================");

    console.log(
        "Total GM:        ",
        resumen.totalGM
    );

    console.log(
        "Insertadas:      ",
        resumen.insertadas
    );

    console.log(
        "Actualizadas:    ",
        resumen.actualizadas
    );

    console.log(
        "Sin cambios:     ",
        resumen.sinCambios
    );

    console.log(
        "Canceladas:      ",
        resumen.canceladas
    );

    console.log(
        "Errores:         ",
        resumen.errores
    );

    console.log("========================================");

    if (errores.length > 0) {

        console.log("");
        console.log("ERRORES DETECTADOS");

        console.table(errores);
    }
const estatusFinal =
    resumen.errores > 0
        ? "COMPLETADA_CON_ERRORES"
        : "COMPLETADA";

const mensajeError =
    errores.length > 0
        ? errores
            .map(
                e =>
                    `${e.factura}: ${e.error}`
            )
            .join(" | ")
        : null;

const auditoriaFinal =
    await finalizarAuditoriaSincronizacion(
        auditoria.id,
        resumen,
        estatusFinal,
        mensajeError
    );

console.log("");
console.log("========================================");
console.log("AUDITORIA DE SINCRONIZACION FINALIZADA");
console.log("========================================");
console.log(auditoriaFinal);

    return {
        sincronizacionId: auditoria.id,
        resumen,
        resultados,
        errores,
        auditoria: auditoriaFinal
    };
}


// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
    simularSincronizacion,
    determinarEstadoBaseGM,
    esFacturaCancelada,
    compararConPostgreSQL,
    sincronizarFacturaPrueba,
    sincronizarLoteGM
};