import { useEffect, useState } from 'react';
import AsignarRecetaModal from '../components/AsignarRecetaModal';

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  Timestamp,
  updateDoc,
  increment,
  doc,
} from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from "../hooks/useAuth";
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';
import { deleteDoc } from 'firebase/firestore';
import { query, where, } from 'firebase/firestore'; 



export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',  // ← agregado
    currentStock: '',
    location: '',
  });

  

  // 👉 Contexto para saber el usuario (para guardar el email en movimientos)
  const { user } = useAuth();

  // 👉 Modal de movimiento (entrada/salida)
  const [movementModal, setMovementModal] = useState({
    open: false,
    product: null,
    type: '', // 'entrada' o 'salida'
  });

  const [movementForm, setMovementForm] = useState({
    quantity: '',
    reason: '',
  });
  const [recetaModal, setRecetaModal] = useState({ open: false, producto: null });

  const [searchTerm, setSearchTerm] = useState('');


  
  

  // 👉 Obtener productos de Firestore
  const fetchProducts = async () => {
    const querySnapshot = await getDocs(collection(db, 'products'));
    const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 👉 Guardar nuevo producto
const handleAddProduct = async (e) => {
  e.preventDefault();

  const { code, name, currentStock, location } = formData;

  if (!code || !name || !currentStock || !location) {
    toast.warn("⚠️ Completa todos los campos.");
    return;
  }

  const newProduct = {
    code,
    name,
    location,
    currentStock: parseInt(currentStock),
    category: formData.category,
    components: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  try {
    await addDoc(collection(db, 'products'), newProduct);
    toast.success("✅ Producto agregado exitosamente.");

    setFormData({ code: '', name: '', category: '', currentStock: '', location: '' });
    setShowForm(false);
    fetchProducts();
  } catch (error) {
    console.error("Error al agregar producto:", error);
    toast.error("❌ No se pudo agregar el producto.");
  }
};

  // 👉 Guardar movimiento de stock
  const handleRegisterMovement = async (e) => {
  e.preventDefault();
  const { product, type } = movementModal;
  const quantity = parseInt(movementForm.quantity);

  // Validaciones básicas
  if (!product || isNaN(quantity) || quantity <= 0) {
      toast.warn("⚠️ La cantidad ingresada no es válida.");
      return;
    }
  // Validación específica para salida
  if (type === 'salida' && quantity > product.currentStock) {
    toast.error(`❌ No puedes retirar más de ${product.currentStock} unidades.`);
    return;
  }

  const factor = type === 'entrada' ? 1 : -1;

  try {
    // 1. Guardar el movimiento
    await addDoc(collection(db, 'movements'), {
      productId: product.id,
      type,
      quantity,
      reason: movementForm.reason,
      userEmail: user?.email || '',
      date: Timestamp.now(),
    });

    // 2. Actualizar stock del producto
    const ref = doc(db, 'products', product.id);
    await updateDoc(ref, {
      currentStock: increment(quantity * factor),
      updatedAt: Timestamp.now(),
    });

    // 3. Limpiar y cerrar modal
    setMovementModal({ open: false, product: null, type: '' });
    setMovementForm({ quantity: '', reason: '' });
    fetchProducts();
    toast.success("✅ Movimiento registrado correctamente.");
  } catch (error) {
    console.error("Error:", error);
    toast.error("❌ Ocurrió un error al guardar el movimiento.");
  }
  
};
// eliminar 
const handleDeleteProduct = async (productId) => {
  const confirm = window.confirm('¿Estás seguro que deseas eliminar este producto?');

  if (!confirm) return;

  try {
    // 1. Verificar si tiene movimientos
    const movRef = collection(db, 'movements');
    const q = query(movRef, where('productId', '==', productId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      toast.error("❌ No puedes eliminar un producto con movimientos registrados.");
      return;
    }

    // 2. Si no tiene movimientos, eliminar
    await deleteDoc(doc(db, 'products', productId));
    toast.success("🗑️ Producto eliminado correctamente.");
    fetchProducts();
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    toast.error("❌ Error al intentar eliminar el producto.");
  }
};
//fabricar producto 
const fabricarProducto = async (producto) => {
  try {
    // 1. Obtener receta del producto
    const recetaRef = collection(db, 'products', producto.id, 'receta');
    const recetaSnap = await getDocs(recetaRef);
    const receta = recetaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (receta.length === 0) {
      toast.warn("⚠️ Este producto no tiene receta asignada.");
      return;
    }

    // 2. Validar stock suficiente por insumo
    const errores = [];

    for (const item of receta) {
      const insumoRef = doc(db, 'insumos', item.insumoId);
      const insumoSnap = await getDoc(insumoRef);

      if (!insumoSnap.exists()) {
        errores.push(`❌ Insumo eliminado o inexistente: ${item.nombreInsumo}`);
        continue;
      }

      const insumo = insumoSnap.data();
      const cantidadRequerida = parseFloat(item.cantidad);

      // Aplicar factor de conversión (cajas → unidades)
      const factorConversion = insumo.factorConversion || 1;
      const cantidadADescontar = cantidadRequerida / factorConversion;

      if (insumo.stock < cantidadADescontar) {
        errores.push(
          `❌ Stock insuficiente de ${item.nombreInsumo}: requiere ${cantidadADescontar.toFixed(2)} cajas, disponibles ${insumo.stock.toFixed(2)}`
        );
      }
    }

    if (errores.length > 0) {
      errores.forEach(msg => toast.error(msg));
      return;
    }

    // 3. Descontar insumos y aumentar stock producto final
    const batchPromises = receta.map(async (item) => {
      const insumoRef = doc(db, 'insumos', item.insumoId);
      const insumoSnap = await getDoc(insumoRef);
      const insumo = insumoSnap.data();

      const factorConversion = insumo.factorConversion || 1;
      const cantidadADescontar = parseFloat(item.cantidad) / factorConversion;

      await updateDoc(insumoRef, {
        stock: increment(-cantidadADescontar),
        updatedAt: Timestamp.now(),
      });
    });

    const productoRef = doc(db, 'products', producto.id);
    const actualizarProducto = updateDoc(productoRef, {
      currentStock: increment(1),
      updatedAt: Timestamp.now(),
    });

    await Promise.all([...batchPromises, actualizarProducto]);

    toast.success("✅ Producto fabricado y stock actualizado.");
    fetchProducts();

    // 4. Registrar fabricación en historial
    await addDoc(collection(db, 'fabricaciones'), {
      productId: producto.id,
      productName: producto.name,
      cantidadFabricada: 1,
      insumosConsumidos: receta.map((item) => ({
        nombre: item.nombreInsumo,
        cantidad: parseFloat(item.cantidad),
        unidad: item.unidad
      })),
      fecha: Timestamp.now(),
      usuario: user?.email || 'anónimo'
    });

  } catch (error) {
    console.error("Error al fabricar producto:", error);
    toast.error("❌ Error al fabricar producto.");
  }
};

<AsignarRecetaModal
  open={recetaModal.open}
  producto={recetaModal.producto}
  onClose={() => setRecetaModal({ open: false, producto: null })}
/>





  return (
    <Sidebar>
      {/* CABECERA */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-[#8D8376]">Lista de productos</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#8D8376] text-white px-4 py-2 rounded hover:bg-[#7A7267]"
        >
          + Agregar Producto
        </button>

        <input
          type="text"
          placeholder="Buscar por nombre o código"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-2 md:mt-0 p-2 border rounded w-full md:w-1/3"
        />



      </div>

      {/* FORMULARIO DE NUEVO PRODUCTO */}
      {showForm && (
        <form
          onSubmit={handleAddProduct}
          className="bg-white p-4 mb-6 rounded-xl shadow-md"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Código"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="p-2 border rounded"
              required
            />
            <input
              type="text"
              placeholder="Nombre"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="p-2 border rounded"
              required
            />
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="p-2 border rounded"
              required
            >
              <option value="">Selecciona categoría</option>
              <option value="Spray home">Spray home</option>
              <option value="Aromatizador de autos">Aromatizador de autos</option>
              <option value="Difusor varillas">Difusor varillas</option>
              <option value="Refill spray home">Refill spray home</option>
              <option value="Refill difusor de varillas">Refill difusor de varillas</option>
              <option value="Esencia concentrada">Esencia concentrada</option>
              <option value="Velas">Velas</option>
              <option value="Spray alcohol">Spray alcohol</option>
            </select>
            <input
              type="number"
              placeholder="Stock inicial"
              value={formData.currentStock}
              onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
              className="p-2 border rounded"
              required
            />
            <select
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="p-2 border rounded"
              required
            >
              <option value="">Selecciona ubicación</option>
              <option value="Bodega Central">Bodega Colina</option>
              <option value="Taller Aromas">BodegaSantaAdela</option>
            </select>



            
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#8D8376] text-white rounded hover:bg-[#7A7267]"
            >
              Guardar
            </button>
            
          </div>
        </form>
      )}

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-[#EDEBE8] text-[#8D8376]">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2">Ubicación</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
              
            </thead>
            
              <tbody>
                    {products
                      .filter((product) =>
                        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        product.code.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((product) => (
                        <tr key={product.id} className="border-t hover:bg-[#F5F4F1]">
                          <td className="px-4 py-2">{product.code}</td>
                          <td className="px-4 py-2">{product.name}</td>
                          <td className="px-4 py-2">{product.category || '-'}</td>
                          <td className="px-4 py-2">{product.currentStock}</td>
                          <td className="px-4 py-2">{product.location}</td>
                          <td className="px-4 py-2 space-x-2">
                    <button
                      className="bg-[#8D8376] text-white px-2 py-1 rounded text-xs hover:bg-[#7A7267]"
                      onClick={() => setMovementModal({ open: true, product, type: 'entrada' })}
                    >
                      Entrada
                    </button>
                    <button
                      className="bg-[#8D8376] text-white px-2 py-1 rounded text-xs hover:bg-[#7A7267]"
                      onClick={() => setMovementModal({ open: true, product, type: 'salida' })}
                    >
                      Salida
                    </button>
                    <button
                      onClick={() => setRecetaModal({ open: true, product })}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                    >
                      Asignar receta
                    </button>
                    <button
                      onClick={() => fabricarProducto(product)}
                      className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                    >
                      Fabricar
                    </button>


                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL MOVIMIENTO */}
      {movementModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-[#8D8376]">
              {movementModal.type === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
            </h3>
            <form onSubmit={handleRegisterMovement} className="space-y-4">
              <input
                type="number"
                placeholder="Cantidad"
                value={movementForm.quantity}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, quantity: e.target.value })
                }
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="text"
                placeholder="Motivo"
                value={movementForm.reason}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, reason: e.target.value })
                }
                className="w-full p-2 border rounded"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovementModal({ open: false, product: null, type: '' })}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#8D8376] text-white rounded hover:bg-[#7A7267]"
                >
                  Guardar
                </button>

                    
              </div>
            </form>
          </div>
        </div>

              )}


                        {/* MODAL RECETA */}
          {recetaModal.open && (
            <AsignarRecetaModal
              producto={recetaModal.producto}
              onClose={() => setRecetaModal({ open: false, producto: null })}
              onRecetaGuardada={fetchProducts}
            />
          )}

      
    </Sidebar>
  );
}
