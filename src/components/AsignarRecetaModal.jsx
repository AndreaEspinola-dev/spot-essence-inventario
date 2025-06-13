import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { toast } from 'react-toastify';

export default function AsignarRecetaModal({ open, producto, onClose }) {
  const [insumos, setInsumos] = useState([]);
  const [nuevoInsumo, setNuevoInsumo] = useState({
    insumoId: '',
    cantidad: '',
    unidad: '',
  });
  const [recetaActual, setRecetaActual] = useState([]);



  // Obtener receta actual del producto
  const fetchReceta = async () => {
    if (!producto) return;
    const recetaRef = collection(db, 'products', producto.id, 'receta');
    const snapshot = await getDocs(recetaRef);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setRecetaActual(data);
  };

useEffect(() => {
  if (open && producto) {
    const fetchInsumos = async () => {
      const snapshot = await getDocs(collection(db, 'insumos'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInsumos(data);
    };
    

    const fetchReceta = async () => {
      const recetaRef = collection(db, 'products', producto.id, 'receta');
      const snapshot = await getDocs(recetaRef);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecetaActual(data);
    };

    fetchInsumos();
    fetchReceta();
  }
}, [open, producto]);


  const handleAgregarInsumo = async () => {
    const { insumoId, cantidad, unidad } = nuevoInsumo;

    if (!insumoId || !cantidad || !unidad) {
      toast.warn("⚠️ Completa todos los campos del insumo.");
      return;
    }

    const insumoSeleccionado = insumos.find(i => i.id === insumoId);

    try {
      const recetaRef = collection(db, 'products', producto.id, 'receta');
      await addDoc(recetaRef, {
        insumoId,
        cantidad,
        unidad,
        nombreInsumo: insumoSeleccionado?.nombre || 'Insumo desconocido',
      });

      toast.success("✅ Insumo agregado a receta.");
      setNuevoInsumo({ insumoId: '', cantidad: '', unidad: '' });
      fetchReceta();
    } catch (error) {
      console.error("Error al agregar insumo a receta:", error);
      toast.error("❌ Error al agregar insumo.");
    }
  };

  const handleEliminarInsumo = async (recetaId) => {
    try {
      const recetaRef = doc(db, 'products', producto.id, 'receta', recetaId);
      await deleteDoc(recetaRef);
      toast.success("🗑️ Insumo eliminado.");
      fetchReceta();
    } catch (error) {
      console.error("Error al eliminar insumo:", error);
      toast.error("❌ No se pudo eliminar el insumo.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-2xl">
        <h2 className="text-xl font-bold text-[#8D8376] mb-4">Asignar receta a: {producto?.name}</h2>

        {/* NUEVO INSUMO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <select
            value={nuevoInsumo.insumoId}
            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, insumoId: e.target.value })}
            className="p-2 border rounded"
          >
            <option value="">Selecciona insumo</option>
            {insumos.map(insumo => (
              <option key={insumo.id} value={insumo.id}>{insumo.nombre}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Cantidad"
            value={nuevoInsumo.cantidad}
            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, cantidad: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Unidad (ej: ml, g, cajas)"
            value={nuevoInsumo.unidad}
            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, unidad: e.target.value })}
            className="p-2 border rounded"
          />
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={handleAgregarInsumo}
            className="bg-[#8D8376] text-white px-4 py-2 rounded hover:bg-[#7A7267]"
          >
            Agregar insumo
          </button>
        </div>

        {/* LISTA DE INSUMOS ACTUALES */}
        {recetaActual.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-[#EDEBE8] text-[#8D8376]">
                <tr>
                  <th className="px-4 py-2">Insumo</th>
                  <th className="px-4 py-2">Cantidad</th>
                  <th className="px-4 py-2">Unidad</th>
                  <th className="px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recetaActual.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">{item.nombreInsumo}</td>
                    <td className="px-4 py-2">{item.cantidad}</td>
                    <td className="px-4 py-2">{item.unidad}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleEliminarInsumo(item.id)}
                        className="text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No hay insumos asignados aún.</p>
        )}

        {/* BOTÓN CERRAR */}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
