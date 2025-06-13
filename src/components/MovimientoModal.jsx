import { useState } from 'react';
import { doc, updateDoc, increment, Timestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';

export default function MovimientoModal({ open, onClose, product, type }) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const { user } = useAuth();

  if (!open || !product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cantidadNum = parseInt(quantity);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      alert('La cantidad debe ser un número mayor a cero.');
      return;
    }

    const movimiento = {
      productId: product.id,
      quantity: cantidadNum,
      reason,
      type,
      userEmail: user.email,
      date: Timestamp.now()
    };

    try {
      // 1. Registrar el movimiento
      await addDoc(collection(db, 'movements'), movimiento);

      // 2. Actualizar stock
      const productoRef = doc(db, 'products', product.id);
      const factor = type === 'entrada' ? 1 : -1;
      await updateDoc(productoRef, {
        currentStock: increment(factor * cantidadNum),
        updatedAt: Timestamp.now()
      });

      onClose();
    } catch (error) {
      console.error('Error al registrar el movimiento:', error);
      alert('Error al guardar el movimiento. Intenta nuevamente.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
        <h3 className="text-lg font-bold text-[#8D8376] mb-4">
          Registrar {type === 'entrada' ? 'Entrada' : 'Salida'}
        </h3>
        <input
          type="number"
          placeholder="Cantidad"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full mb-3 p-2 border rounded"
          required
        />
        <input
          type="text"
          placeholder="Motivo"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
          required
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 bg-[#8D8376] text-white rounded hover:bg-[#7A7267]">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
