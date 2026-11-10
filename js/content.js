/* ============================================================
   Contenido editorial (texto fijo). Las cifras NO viven aquí:
   salen de data/, que genera el agente (agent/sismed_agent.py).
   ============================================================ */
const CONTENT = {
  meta: {
    shortTitle: "SISMED · Medicamentos",
    title: "Precios y mercado de medicamentos en Colombia",
    subtitle: "Precios por unidad, distribución del mercado y precio reportado frente al precio máximo de venta, por principio activo, producto y canal, con los reportes a SISMED que publica MinSalud en SISPRO.",
    author: "Fabian Dávila Ramírez",
    credentials: "MD, MBA, PhD",
    affiliation: "Fundación Universitaria de Ciencias de la Salud (FUCS) · Universidad de Navarra · Universidad de Bogotá Jorge Tadeo Lozano",
    disclaimer: "Las cifras provienen de los reportes a SISMED que publica MinSalud en SISPRO: en el canal institucional, la transacción final (venta); en el comercial, la venta primaria del laboratorio. No son valores auditados. El termómetro y la comparación con el precio regulado aplican reglas simples que se explican en Materiales y métodos y no reemplazan un análisis regulatorio ni una verificación de cumplimiento.",
    license: {
      name: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/deed.es",
      text: "Visualización y datos agregados bajo licencia CC BY-SA 4.0: puedes copiarlos y adaptarlos citando la fuente (MinSalud · SISMED · SISPRO) y manteniendo la misma licencia."
    },
    cta: {
      title: "¿El precio de tu medicamento es alto, normal o bajo?",
      text: "El termómetro compara el precio por unidad de un producto con el de los productos con el mismo principio activo, la misma concentración y la misma forma farmacéutica.",
      button: "Abrir el termómetro"
    }
  },

  objective: {
    general: "Describir los precios por unidad y la distribución del mercado de medicamentos en Colombia, por principio activo, producto y canal, con los reportes a SISMED, y contrastar el precio reportado con el precio máximo de venta que fija la Comisión Nacional de Precios de Medicamentos y Dispositivos Médicos.",
    specific: [
      "Ubicar el precio por unidad de cada producto frente a sus equivalentes (mismo principio activo, concentración y forma farmacéutica), con un termómetro de precio bajo, normal y alto.",
      "Medir el valor, las unidades y la participación de cada principio activo y de cada producto dentro de un mercado relevante de uno o varios principios activos.",
      "Comparar, presentación por presentación, el precio reportado con el precio máximo de venta regulado.",
    ]
  },

  // Por qué cada combinación de transacción, operación y actor entra o no al reporte.
  txWhy: function(tx, op, lab){
    if(op === "Operacion de compra") return "Es la otra cara de una venta ya reportada por el vendedor.";
    if(op === "Operacion de recobro") return "Cobro a la ADRES o al ente territorial de un medicamento ya facturado.";
    if(tx === "Transaccion final institucional") return "Último eslabón institucional: lo que factura quien dispensa.";
    if(tx === "Transaccion primaria comercial") return lab ? "Único eslabón comercial sin repetición: el canal no tiene transacción final." : "La venta primaria la reporta el laboratorio; lo demás son ventas repetidas.";
    if(tx === "Transaccion primaria institucional") return "El mismo medicamento vuelve a aparecer en la transacción final.";
    return "Ventas entre distribuidores: se repiten cuando un mayorista vende a otro.";
  },

  // Grupos anatómicos principales del sistema ATC (OMS), primer nivel.
  atcGroups: {
    A: "Tracto alimentario y metabolismo",
    B: "Sangre y órganos hematopoyéticos",
    C: "Sistema cardiovascular",
    D: "Dermatológicos",
    G: "Sistema genitourinario y hormonas sexuales",
    H: "Preparados hormonales sistémicos (excluye hormonas sexuales e insulinas)",
    J: "Antiinfecciosos para uso sistémico",
    L: "Antineoplásicos e inmunomoduladores",
    M: "Sistema musculoesquelético",
    N: "Sistema nervioso",
    P: "Antiparasitarios, insecticidas y repelentes",
    R: "Sistema respiratorio",
    S: "Órganos de los sentidos",
    V: "Varios"
  },

  // Canales: tipo de transacción de SISMED (ABC Circular 06 de 2018).
  channels: {
    "Transaccion primaria institucional": { short: "Primaria institucional", group: "Institucional", d: "Venta del fabricante o importador a otro actor, dispensada con cargo a recursos públicos (o la compra correspondiente)." },
    "Transaccion primaria comercial": { short: "Primaria comercial", group: "Comercial", d: "Venta del fabricante o importador a otro actor, dispensada con cargo a recursos no públicos." },
    "Transaccion secundaria institucional": { short: "Secundaria institucional", group: "Institucional", d: "Venta entre actores que no elaboran ni importan (p. ej. mayorista a IPS), con cargo a recursos públicos y sin dispensación." },
    "Transaccion secundaria comercial": { short: "Secundaria comercial", group: "Comercial", d: "Venta entre actores que no elaboran ni importan, con cargo a recursos no públicos (p. ej. droguería o farmacia)." },
    "Transaccion final institucional": { short: "Final institucional", group: "Institucional", d: "Venta o recobro de un medicamento dispensado a un paciente con cargo a recursos públicos." }
  },
  ops: { "Operacion de venta": "Venta", "Operacion de compra": "Compra", "Operacion de recobro": "Recobro" },
  units: { "Presentacion comercial": "Presentación comercial", "Unidad de dispensacion": "Unidad de dispensación", "Unidad por embalaje primario": "Unidad por embalaje primario", "Unidad minima de concentracion": "Unidad mínima de concentración" },

  // Reglas del termómetro (síntesis del autor, no una norma).
  thermometer: {
    low: 0.25, high: 0.75,
    rule: "Bajo: precio por unidad menor o igual al percentil 25 de los productos equivalentes. Normal: entre el percentil 25 y el 75. Alto: por encima del percentil 75. Son productos equivalentes los del mismo código ATC, con la misma concentración (catálogo CUM del INVIMA) y la misma familia de forma farmacéutica, con ventas en el canal (institucional o comercial) y el año elegidos."
  },

  caveats: [
    { t: "Reportes, no valores auditados", d: "Cada fila de SISMED es lo que un actor de la cadena reporta a MinSalud, con base en sus facturas: valor facturado, unidades y, hasta la Circular 21 de 2026, precio mínimo y máximo del periodo. Hay errores de digitación y valores atípicos." },
    { t: "Un solo eslabón por canal", d: "SISMED no es un sistema de trazabilidad: el laboratorio, el distribuidor, la IPS y la EPS reportan cada uno su parte, y en una misma factura el vendedor reporta la venta y el comprador la compra. Por eso la app usa un solo eslabón por canal: en el institucional, la transacción final (venta de quien dispensa); en el comercial, la venta primaria del laboratorio. Los precios de los dos canales no se comparan entre sí: corresponden a eslabones distintos de la cadena." },
    { t: "El canal comercial no llega al paciente", d: "Las droguerías no reportan a SISMED y el canal comercial no tiene transacción final. El precio comercial de la app es el del laboratorio al distribuidor, no el que paga el paciente en la droguería." },
    { t: "Unidades mínimas de dispensación", d: "Los precios y las unidades van por unidad mínima de dispensación (tableta, cápsula, vial, mililitro). Lo reportado por caja se convierte con las unidades del CUM; lo reportado por embalaje primario o por unidad de concentración queda fuera. Sumar unidades de formas distintas (tabletas con mililitros) no tiene sentido: la vista de mercado lo advierte." },
    { t: "Cambio de serie en 2026", d: "Desde septiembre de 2026 (laboratorios) y el tercer trimestre de 2026 (demás actores) rige la Circular 21 de 2026: una línea por factura electrónica, sin precio mínimo ni máximo consolidado, con notas crédito y débito del mismo periodo y bonificaciones con precio cero. MinSalud advierte que esa serie no empalma con la anterior." },
    { t: "El precio regulado es el vigente hoy", d: "El conjunto de datos de precio máximo de venta trae la circular vigente (con su fecha de inicio), no la historia. Comparar un año anterior con el precio máximo actual es una referencia, no una prueba de incumplimiento. El precio reportado es un promedio del año, y en el canal institucional se compara con el precio máximo más el margen de la IPS." },
    { t: "Filas atípicas excluidas", d: "Algunos reportes traen unidades o precios imposibles (por ejemplo, decenas de millones de viales de factor VIII en un mes, o 32 viales de ustekinumab facturados por casi $ 1 billón). Reglas del autor: se excluye toda fila de más de $ 1 billón, toda fila de más de $ 50 mil millones con más de 1 millón de unidades, y toda fila cuyo precio por unidad sea 20 veces mayor o menor que la mediana del año del mismo producto." },
    { t: "Titular y código ATC del INVIMA", d: "SISMED no trae el titular y a veces asigna códigos ATC equivocados (p. ej. V08AA05, un medio de contraste, a Entresto o Prolia). El agente toma el titular, el producto, la concentración, la forma y el ATC del catálogo CUM del INVIMA, por expediente. Algunos productos quedan sin titular porque su expediente no está en el catálogo." },
    { t: "Cobertura temporal", d: "Se usan los archivos MED100MPRE desde octubre de 2019. El primer y el último año están incompletos. Los archivos anteriores usan otros formatos y mezclan cortes acumulados, así que se dejaron fuera para no contar dos veces." }
  ],

  glossary: [
    { t: "SISMED", d: "Sistema de Información de Precios de Medicamentos de MinSalud. Su objetivo es dar la información necesaria para regular el mercado de medicamentos (ABC Circular 06 de 2018)." },
    { t: "SISPRO", d: "Sistema Integrado de Información de la Protección Social. Publica los archivos de precios reportados a SISMED." },
    { t: "ATC", d: "Clasificación Anatómica, Terapéutica y Química de la OMS. El código de 7 caracteres identifica el principio activo o la combinación (p. ej. N02BE01 = paracetamol)." },
    { t: "CUM", d: "Código Único de Medicamentos del INVIMA. El expediente identifica el registro sanitario; el consecutivo, la presentación comercial." },
    { t: "Titular del registro", d: "Empresa a nombre de la cual el INVIMA otorga el registro sanitario. Se obtiene del catálogo CUM." },
    { t: "Transacción primaria", d: "Venta del actor que elabora o importa el medicamento a otro actor (o la compra correspondiente). Es institucional si se dispensa con cargo a recursos públicos y comercial si no." },
    { t: "Transacción secundaria", d: "Venta entre actores que no elaboran ni importan el medicamento, sin dispensación al paciente." },
    { t: "Transacción final institucional", d: "Venta o recobro de un medicamento dispensado a un paciente con cargo a recursos públicos. La reportan IPS, operadores logísticos y pagadores. Es la que usa la app en el canal institucional (operación de venta)." },
    { t: "Unidad mínima de dispensación", d: "La unidad más pequeña de la forma farmacéutica que recibe el paciente: tableta, cápsula, vial, mililitro. La Circular 21 de 2026 obliga a reportar las unidades así." },
    { t: "Precio máximo de venta", d: "Precio tope por presentación comercial (CUM) que fija la Comisión Nacional de Precios de Medicamentos y Dispositivos Médicos para los medicamentos en control directo. Tiene un valor para las transacciones institucionales (más un margen para la IPS en la transacción final) y otro para las comerciales." },
    { t: "Mercado relevante", d: "Conjunto de medicamentos que compiten entre sí. En la app lo arma quien consulta con uno o varios principios activos; la Comisión de precios define los suyos para regular." },
    { t: "Actor que reporta", d: "Rol 1: el titular del registro sanitario que elabora o importa el medicamento (solo reporta ventas, cada mes desde 2024). Rol 2: los demás actores de la cadena (distribuidores, IPS, EPS, cajas de compensación), que reportan ventas, compras y recobros cada trimestre." },
    { t: "Participación en valor y en volumen", d: "Porcentaje que representa una marca o un laboratorio sobre el valor ($) o sobre las unidades del grupo consultado. En el termómetro, el grupo son las marcas equivalentes." },
    { t: "Canal comercial", d: "Transacciones con cargo a recursos no públicos (gasto de bolsillo, seguros privados). En la app, la venta primaria del laboratorio." },
    { t: "Canal institucional", d: "Transacciones con cargo a recursos públicos, incluidos los regímenes especiales y de excepción. En la app, la transacción final, operación de venta." },
    { t: "Recobro", d: "Solicitud de pago a la ADRES o a una dirección territorial de salud por medicamentos suministrados." },
    { t: "Presentación comercial", d: "Unidad de venta tal como se registra (caja, frasco). El catálogo CUM indica cuántas unidades de dispensación contiene." },
    { t: "Unidad de dispensación", d: "Unidad que recibe el paciente (tableta, cápsula, vial, jeringa prellenada)." },
    { t: "Precio promedio ponderado", d: "Valor facturado ÷ unidades facturadas. Pondera cada reporte por su volumen." },
    { t: "Productos equivalentes", d: "En el termómetro: mismo ATC, misma concentración y misma familia de forma farmacéutica." },
    { t: "Percentil 25 / 75", d: "Precio por debajo del cual está el 25 % (o el 75 %) de los productos equivalentes. Son los cortes del termómetro." },
    { t: "Circular 06 de 2018", d: "Circular de la Comisión Nacional de Precios de Medicamentos y Dispositivos Médicos que define el reporte a SISMED y sus transacciones (archivo MED100MPRE)." },
    { t: "Circular 17 de 2023", d: "Mantiene el anexo de la Circular 06 de 2018 y pasa el reporte del laboratorio de trimestral a mensual (archivo MED105)." },
    { t: "Circular 21 de 2026", d: "Nuevo anexo técnico: reporte por cada línea de factura electrónica (CUFE), con la contraparte, las unidades en unidad mínima de dispensación y las notas crédito y débito. Obligatorio desde octubre de 2026 (archivos MED106 para el rol 1 y MED101 para el rol 2)." }
  ],

  sources: {
    sispro: { label: "MinSalud · SISPRO. Consulta de precios reportados a SISMED (Circular 06 de 2018).", url: "https://web.sispro.gov.co/WebPublico/Consultas/ConsultarCNPMCadenaComercializacionCircu2yPA_028_2_2.aspx" },
    abc: { label: "MinSalud. ABECÉ SISMED — Circular 06 de 2018.", url: "https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/VS/MET/abece-circular-06-2018-sismed.pdf" },
    cum: { label: "INVIMA · datos.gov.co. Código Único de Medicamentos vigentes (i7cb-raxc), en trámite de renovación (vgr4-gemg) y vencidos (vwwf-4ftk).", url: "https://www.datos.gov.co/d/i7cb-raxc" },
    reg: { label: "MinSalud · datos.gov.co. Precio máximo de venta de los medicamentos por presentación comercial (nauz-qkjw).", url: "https://www.datos.gov.co/Salud-y-Protecci-n-Social/Precio-m-ximo-de-venta-de-los-medicamentos-por-pre/nauz-qkjw" },
    atc: { label: "WHO Collaborating Centre for Drug Statistics Methodology. ATC/DDD Index.", url: "https://atcddd.fhi.no/atc_ddd_index/" },
    license: { label: "Creative Commons. Atribución-CompartirIgual 4.0 Internacional.", url: "https://creativecommons.org/licenses/by-sa/4.0/deed.es" }
  }
};
