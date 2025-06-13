import { useState } from 'react';
import Papa from 'papaparse';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

export default function ImportarInsumos() {
  const [csvData, setCsvData] = useState([]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
      }
    });
  };

  const subirInsumos = async () => {
    try {
      for (let row of csvData) {
        const insumo = {
          code: row.code,
          name: row.name,
          currentStock: parseFloat(row.currentStock || 0),
          unidad: row.unidad || 'unidad',
          location: row.ubicacion || 'Santa Adela',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        await addDoc(collection(db, 'products'), insumo);
      }
      toast.success('✅ Insumos cargados correctamente');
    } catch (error) {
      console.error(error);
      toast.error('❌ Error al cargar insumos');
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow-md">
      <h3 className="text-lg font-bold mb-2">Importar insumos desde CSV</h3>
      <input type="file" accept=".csv" onChange={handleFile} className="mb-4" />
      <button
        onClick={subirInsumos}
        className="bg-[#8D8376] text-white px-4 py-2 rounded hover:bg-[#7A7267]"
        disabled={csvData.length === 0}
      >
        Subir a Firestore
      </button>
    </div>
  );
}
