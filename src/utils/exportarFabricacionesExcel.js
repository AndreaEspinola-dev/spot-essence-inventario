import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export function exportarFabricacionesExcel(fabricaciones) {
  if (!fabricaciones || fabricaciones.length === 0) return;

  const datos = fabricaciones.map((fab) => ({
    Fecha: fab.fecha?.toDate?.().toLocaleString() || "Sin fecha",
    Producto: fab.productName || "Desconocido",
    Cantidad: typeof fab.cantidadFabricada === "number" ? fab.cantidadFabricada : parseFloat(fab.cantidadFabricada) || 0,
    Usuario: fab.usuario || "N/A",
    "Insumos Usados": fab.insumosConsumidos?.map(i => `${i.nombre}: ${i.cantidad} ${i.unidad}`).join(", ") || "N/A"
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Fabricaciones");

  const excelBuffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

  saveAs(blob, `Fabricaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
