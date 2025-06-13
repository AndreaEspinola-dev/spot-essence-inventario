
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import Sidebar from '../components/Sidebar';
import { format } from 'date-fns';

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState({});
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const fetchData = async () => {
    const movSnap = await getDocs(collection(db, 'movements'));
    const movs = [];

    for (const docu of movSnap.docs) {
      const data = docu.data();
      const prodId = data.productId;

      let producto = productos[prodId];
      if (!producto) {
        const prodDoc = await getDoc(doc(db, 'products', prodId));
        producto = prodDoc.exists() ? prodDoc.data() : { name: 'Eliminado' };
        setProductos((prev) => ({ ...prev, [prodId]: producto }));
      }

      movs.push({
        ...data,
        id: docu.id,
        productName: producto.name || 'Sin nombre',
      });
    }

    setMovimientos(
      movs.sort((a, b) => b.date.seconds - a.date.seconds)
    );
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrarMovimientos = () => {
    return movimientos.filter((mov) => {
      const fecha = mov.date.toDate();
      const cumpleTipo =
        filtroTipo === 'todos' || mov.type === filtroTipo;
      const cumpleDesde = fechaDesde
        ? fecha >= new Date(fechaDesde)
        : true;
      const cumpleHasta = fechaHasta
        ? fecha <= new Date(fechaHasta + 'T23:59:59')
        : true;

      return cumpleTipo && cumpleDesde && cumpleHasta;
    });
  };

  const movimientosFiltrados = filtrarMovimientos();

  return (
    <Sidebar>
      <h2 className="text-lg font-bold text-[#8D8376] mb-4">Historial de Movimientos</h2>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-semibold text-[#8D8376]">Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="todos">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#8D8376]">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#8D8376]">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-md p-4 overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-[#EDEBE8] text-[#8D8376]">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2">Motivo</th>
              <th className="px-4 py-2">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movimientosFiltrados.map((mov) => (
              <tr key={mov.id} className="border-t hover:bg-[#F5F4F1]">
                <td className="px-4 py-2">{format(mov.date.toDate(), 'dd-MM-yyyy HH:mm')}</td>
                <td className="px-4 py-2">{mov.productName}</td>
                <td className="px-4 py-2 capitalize">{mov.type}</td>
                <td className="px-4 py-2">{mov.quantity}</td>
                <td className="px-4 py-2">{mov.reason}</td>
                <td className="px-4 py-2">{mov.userEmail}</td>
              </tr>
            ))}
            {movimientosFiltrados.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-4 text-gray-500">
                  No hay movimientos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Sidebar>
  );
}
