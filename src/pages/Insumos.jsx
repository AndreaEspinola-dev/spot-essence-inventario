import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import Sidebar from '../components/Sidebar';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import EditarInsumoModal from '../components/EditarInsumoModal';

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [formData, setFormData] = useState({
    codigo: '', nombre: '', categoria: '', unidad: '',
    factorConversion: '', unidadMayor: '', ubicacion: '', stock: '',
    
  });
  const [mostrarCriticos, setMostrarCriticos] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  const [editInsumo, setEditInsumo] = useState(null);

  const fetchInsumos = async () => {
    const snapshot = await getDocs(collection(db, 'insumos'));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setInsumos(data);
  };

  useEffect(() => {
    fetchInsumos();
  }, []);

  const convertirStock = (stock, unidad, factor, unidadMayor) => {
    if (!factor || isNaN(factor) || factor <= 1) {
      return `${stock} ${unidad}`;
    }




    const unidadesMayores = Math.floor(stock / factor);
    const resto = stock % factor;
    return `${stock} ${unidad} (${unidadesMayores} ${unidadMayor} y ${resto} ${unidad})`;
  };

  const agregarInsumo = async (e) => {
    e.preventDefault();
    try {
      const nuevo = {
        ...formData,
        stock: parseFloat(formData.stock),
        factorConversion: parseFloat(formData.factorConversion),
        createdAt: Timestamp.now(),
      };
      await addDoc(collection(db, 'insumos'), nuevo);
      toast.success('✅ Insumo agregado.');
      setShowForm(false);
      setFormData({
        codigo: '', nombre: '', categoria: '', unidad: '',
        factorConversion: '', unidadMayor: '', ubicacion: '', stock: '',
      });
      fetchInsumos();
    } catch (error) {
      console.error("Error al cargar insumos:", error);
      toast.error("❌ Hubo un error al cargar los insumos.");
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const filasSinCodigo = rows
        .map((row, index) => ({ index: index + 2, codigo: row.codigo }))
        .filter(item => !item.codigo?.toString().trim());

      if (filasSinCodigo.length > 0) {
        const mensaje = filasSinCodigo
          .map(f => `Fila ${f.index} sin código.`)
          .join('\n');
        toast.error(`❌ Error en el archivo:\n${mensaje}`);
        return;
      }

      const snapshot = await getDocs(collection(db, 'insumos'));
      const insumosActuales = new Map();
      snapshot.forEach(docSnap => {
        const insumo = docSnap.data();
        insumosActuales.set(insumo.codigo, { id: docSnap.id, ...insumo });
      });

      const operaciones = rows.map(async row => {
        const codigo = row.codigo.toString().trim();
        const stockNuevo = parseFloat(row.stock || 0);
        const existente = insumosActuales.get(codigo);

        if (existente) {
          const ref = doc(db, 'insumos', existente.id);
          await updateDoc(ref, {
            stock: existente.stock + stockNuevo,
            updatedAt: Timestamp.now()
          });
        } else {
          await addDoc(collection(db, 'insumos'), {
            codigo,
            nombre: row.nombre || '',
            categoria: row.categoria || '',
            unidad: row.unidad || '',
            unidadMayor: row.unidadMayor || '',
            factorConversion: parseFloat(row.factorConversion || 1),
            ubicacion: row.ubicacion || '',
            stock: stockNuevo,
            createdAt: Timestamp.now()
          });
        }
      });

      await Promise.all(operaciones);
      toast.success("✅ Excel cargado correctamente.");
      fetchInsumos();
    };

    reader.readAsArrayBuffer(file);
  };

  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSeleccionarTodos = () => {
    if (seleccionados.length === insumos.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(insumosFiltrados.map(i => i.id));
    }
  };

  const eliminarInsumo = async (id) => {
    if (!window.confirm('¿Eliminar este insumo?')) return;
    try {
      await deleteDoc(doc(db, 'insumos', id));
      toast.success('🗑️ Insumo eliminado');
      fetchInsumos();
    } catch (err) {
      console.error('Error al eliminar insumo:', err);
      toast.error('❌ Error al eliminar');
    }
  };


    const esStockBajo = (stock, factor) => {
      const stockNum = parseFloat(stock);
      const factorNum = parseFloat(factor);
      if (isNaN(stockNum) || isNaN(factorNum) || factorNum <= 0) return false;
      return stockNum < factorNum;
    };



  const eliminarSeleccionados = async () => {
    if (!window.confirm('¿Eliminar todos los seleccionados?')) return;
    try {
      await Promise.all(
        seleccionados.map(id => deleteDoc(doc(db, 'insumos', id)))
      );
      toast.success('✅ Insumos eliminados.');
      setSeleccionados([]);
      fetchInsumos();
    } catch (err) {
      console.error('Error al eliminar insumo:', err);
      toast.error('❌ Error al eliminar');
    }
  };

    const insumosFiltrados = mostrarCriticos
      ? insumos.filter(insumo => esStockBajo(insumo.stock, insumo.factorConversion))
      : insumos;


  return (
    <>
      <Sidebar>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-[#8D8376]">Materias Primas</h2>
          <button onClick={() => setShowForm(true)} className="bg-[#8D8376] text-white px-4 py-2 rounded hover:bg-[#7A7267]">
            + Agregar Insumo
          </button>
        </div>
                <div className="flex items-center mb-4">
          <label className="text-[#8D8376] font-semibold mr-2">🔍 Ver solo insumos críticos</label>
          <input
            type="checkbox"
            checked={mostrarCriticos}
            onChange={(e) => setMostrarCriticos(e.target.checked)}
            className="w-4 h-4"
          />
        </div>


        {showForm && (
          <form onSubmit={agregarInsumo} className="bg-white p-4 mb-4 rounded shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Código" className="border p-2" required value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} />
              <input type="text" placeholder="Nombre" className="border p-2" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
              <input type="text" placeholder="Categoría" className="border p-2" required value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })} />
              <input type="text" placeholder="Unidad" className="border p-2" required value={formData.unidad} onChange={e => setFormData({ ...formData, unidad: e.target.value })} />
              <input type="number" placeholder="Factor conversión" className="border p-2" required value={formData.factorConversion} onChange={e => setFormData({ ...formData, factorConversion: e.target.value })} />
              <input type="text" placeholder="Unidad mayor" className="border p-2" required value={formData.unidadMayor} onChange={e => setFormData({ ...formData, unidadMayor: e.target.value })} />
              <select className="border p-2" required value={formData.ubicacion} onChange={e => setFormData({ ...formData, ubicacion: e.target.value })}>
                <option value="">Selecciona Ubicación</option>
                <option value="Santa Adela">Santa Adela</option>
                <option value="Colina">Colina</option>
              </select>
              <input type="number" placeholder="Stock" className="border p-2" required value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-[#8D8376] text-white px-4 py-2 rounded">Guardar</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancelar</button>
            </div>
          </form>
        )}

        <div className="mb-4">
          <label className="block font-semibold text-[#8D8376] mb-2">Cargar Insumos desde Excel</label>
          <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="border p-2 rounded w-full" />
        </div>

        {seleccionados.length > 0 && (
          <button onClick={eliminarSeleccionados} className="bg-red-600 text-white px-4 py-2 rounded mb-4 hover:bg-red-700">
            🗑️ Eliminar seleccionados ({seleccionados.length})
          </button>
        )}

        <div className="bg-white rounded-xl shadow-md p-4 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#EDEBE8] text-[#8D8376]">
              <tr>
                <th className="px-4 py-2"><input type="checkbox" onChange={toggleSeleccionarTodos} checked={seleccionados.length === insumos.length} /></th>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2">Unidad</th>
                <th className="px-4 py-2">Factor Conversión</th>
                <th className="px-4 py-2">Ubicación</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
                  {insumosFiltrados.map(insumo => (
                    <tr key={insumo.id} className="border-t hover:bg-[#F5F4F1]">

                  <td className="px-4 py-2"><input type="checkbox" checked={seleccionados.includes(insumo.id)} onChange={() => toggleSeleccion(insumo.id)} /></td>
                  <td className="px-4 py-2">{insumo.codigo}</td>
                  <td className="px-4 py-2">{insumo.nombre}</td>
                  <td className="px-4 py-2">{insumo.categoria}</td>
                  <td className="px-4 py-2">{insumo.unidad}</td>
                  <td className="px-4 py-2">{insumo.factorConversion}</td>
                  <td className="px-4 py-2">{insumo.ubicacion}</td>
                  <td className={`px-4 py-2 font-semibold ${ esStockBajo(insumo.stock, insumo.factorConversion) ? 'text-red-600': 'text-gray-800'}`}>{convertirStock(insumo.stock, insumo.unidad, insumo.factorConversion, insumo.unidadMayor)}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button onClick={() => eliminarInsumo(insumo.id)} className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">
                      Eliminar
                    </button>
                    <button
                      onClick={() => setEditInsumo(insumo)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                    >
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sidebar>

      {editInsumo && (
        <EditarInsumoModal
          insumo={editInsumo}
          onClose={() => setEditInsumo(null)}
          onGuardar={fetchInsumos}
        />
      )}
    </>
  );
}
