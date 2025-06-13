// src/components/EditarInsumoModal.jsx
import React, { useState, useEffect } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { toast } from 'react-toastify';

export default function EditarInsumoModal({ insumo, onClose, onGuardar }) {
  const [form, setForm] = useState({ ...insumo });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 10); // Activar transición
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const ref = doc(db, 'insumos', form.id);
      const dataEditada = {
        ...form,
        stock: parseFloat(form.stock),
        factorConversion: parseFloat(form.factorConversion),
        updatedAt: Timestamp.now(),
      };
      delete dataEditada.id;
      await updateDoc(ref, dataEditada);
      toast.success("✅ Insumo actualizado.");
      onGuardar();
      setVisible(false);
      setTimeout(onClose, 200); // Espera a que la animación termine
    } catch (error) {
      console.error(error);
      toast.error("❌ Error al guardar.");
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-50 bg-black transition-opacity duration-300 ${visible ? 'bg-opacity-40' : 'bg-opacity-0'}`}>
      <div className={`bg-white rounded-lg shadow-md p-6 w-full max-w-lg transform transition-all duration-300 ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <h2 className="text-lg font-bold text-[#8D8376] mb-4">Editar Insumo</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <input type="text" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className="border p-2" placeholder="Código" required />
          <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="border p-2" placeholder="Nombre" required />
          <input type="text" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="border p-2" placeholder="Categoría" required />
          <input type="text" value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} className="border p-2" placeholder="Unidad" required />
          <input type="number" value={form.factorConversion} onChange={e => setForm({ ...form, factorConversion: e.target.value })} className="border p-2" placeholder="Factor de conversión" required />
          <select value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} className="border p-2" required>
            <option value="Santa Adela">Santa Adela</option>
            <option value="Colina">Colina</option>
          </select>
          <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="border p-2" placeholder="Stock" required />
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Guardar</button>
            <button type="button" onClick={() => {
              setVisible(false);
              setTimeout(onClose, 200);
            }} className="bg-gray-300 px-4 py-2 rounded">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
