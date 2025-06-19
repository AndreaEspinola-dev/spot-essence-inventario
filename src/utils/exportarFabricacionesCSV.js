// src/utils/exportarFabricacionesCSV.js
import Papa from "papaparse";
import { saveAs } from "file-saver";

export const exportarFabricacionesCSV = (fabricaciones) => {
  if (!fabricaciones || fabricaciones.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  const csv = Papa.unparse(fabricaciones.map(fab => ({
    Fecha: fab.fecha || "Sin fecha",
    Producto: fab.producto || "Desconocido",
    Cantidad: fab.cantidad || 0,
    Usuario: fab.usuario || "N/A",
  })));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `fabricaciones_${new Date().toISOString().slice(0, 10)}.csv`);
};
