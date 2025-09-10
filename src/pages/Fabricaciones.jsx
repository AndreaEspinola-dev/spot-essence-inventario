import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { format } from 'date-fns';
import Sidebar from '../components/Sidebar';
import { exportarFabricacionesCSV } from '../utils/exportarFabricacionesCSV';
import { exportarFabricacionesExcel } from '../utils/exportarFabricacionesExcel';

export default function Fabricaciones() {
  const [fabricaciones, setFabricaciones] = useState([]);

  // Helper: formatea cantidades (sin decimales si es entero; 2 decimales si no)
  const formatCantidad = (n) => {
    const x = Number(n) || 0;
    return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.00$/, '');
  };

  const fetchFabricaciones = async () => {
    const q = query(collection(db, 'fabricaciones'), orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setFabricaciones(data);
  };

  useEffect(() => {
    fetchFabricaciones();
  }, []);

  return (
    <Sidebar>

      
      <h2 className="text-lg font-bold text-[#8D8376] mb-4">Historial de Fabricaciones</h2>


            <button
        onClick={() => exportarFabricacionesCSV(fabricaciones)}
        className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 mt-4"
      >
        Exportar a CSV
      </button>

      <button
        onClick={() => exportarFabricacionesExcel(fabricaciones)}
        className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 mt-4"
      >
        Exportar a Excel
      </button>

      <div className="bg-white rounded-xl shadow-md p-4 overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-[#EDEBE8] text-[#8D8376]">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Insumos usados</th>
            </tr>
          </thead>
          <tbody>
            {fabricaciones.map((fab) => (
              <tr key={fab.id} className="border-t hover:bg-[#F5F4F1]">
                <td className="px-4 py-2">
                  {fab.fecha?.toDate ? format(fab.fecha.toDate(), 'dd-MM-yyyy HH:mm') : ''}
                </td>
                <td className="px-4 py-2">{fab.productName}</td>
                <td className="px-4 py-2">{fab.cantidadFabricada}</td>
                <td className="px-4 py-2">{fab.usuario}</td>
                <td className="px-4 py-2">
                  <ul className="list-disc pl-4">
                    {(fab.insumosConsumidos || []).map((i, idx) => {
                      const recetaCant = Number(i.cantidad) || 0;               // por 1 unidad
                      const total = recetaCant * (Number(fab.cantidadFabricada) || 0); // total consumido
                      return (
                        <li key={idx}>
                          {i.nombre}: <strong>{formatCantidad(total)} {i.unidad}</strong>
                        </li>

                      );
                    })}
                  </ul>
                </td>
              </tr>
            ))}

            {fabricaciones.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-500">
                  No hay registros de fabricación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


    </Sidebar>
  );
}
