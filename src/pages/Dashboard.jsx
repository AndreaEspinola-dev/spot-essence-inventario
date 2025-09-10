import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import AsignarRecetaModal from '../components/AsignarRecetaModal';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebaseConfig';

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  updateDoc,
  increment,
  query,
  where,
  writeBatch,
  setDoc,
  runTransaction,
} from 'firebase/firestore';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    currentStock: '',
    location: '',
  });

  const { user } = useAuth();

  // Movimientos (entrada/salida)
  const [movementModal, setMovementModal] = useState({
    open: false,
    product: null,
    type: '', // 'entrada' | 'salida'
  });
  const [movementForm, setMovementForm] = useState({
    quantity: '',
    reason: '',
  });

  // Recetas
  const [recetaModal, setRecetaModal] = useState({ open: false, producto: null });

  // Fabricación N
  const [fabricarModal, setFabricarModal] = useState({ open: false, product: null });
  const [fabricarQty, setFabricarQty] = useState(1);

  // Búsqueda
  const [searchTerm, setSearchTerm] = useState('');

  // Excel
  const fileInputRef = useRef(null);

  // ====== Helpers Comunes ======
  const toInt = (n) => Math.max(0, Math.trunc(Number(n) || 0));
  const norm = (s) => String(s ?? '').toLowerCase().trim();

  // ====== FETCH productos ======
  const fetchProducts = async () => {
    const querySnapshot = await getDocs(collection(db, 'products'));
    const data = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ====== CREATE producto con unicidad por code (ID = code) ======
  const REQUIRED_HEADERS = ['code', 'name', 'category', 'currentStock', 'location'];

  function normalizeCode(code) {
    return String(code ?? '').trim().toLowerCase();
  }

  function normalizeRow(r) {
    const code = normalizeCode(String(r.code ?? ''));
    const name = String(r.name ?? '').trim();
    const category = String(r.category ?? '').trim();
    const location = String(r.location ?? '').trim();
    const currentStockRaw = r.currentStock ?? 0;

    const currentStock = Number.isFinite(Number(currentStockRaw))
      ? Math.max(0, Math.trunc(Number(currentStockRaw)))
      : 0;

    return { code, name, category, location, currentStock };
  }

  const handleAddProduct = async (e) => {
    e.preventDefault();

    const { code, name, currentStock, location } = formData;
    if (!code || !name || !currentStock || !location) {
      toast.warn('⚠️ Completa todos los campos.');
      return;
    }

    const codeId = normalizeCode(code);

    try {
      // Chequeo unicidad por ID
      const existsSnap = await getDoc(doc(db, 'products', codeId));
      if (existsSnap.exists()) {
        toast.error(`❌ Ya existe un producto con código "${codeId}".`);
        return;
      }

      const newProduct = {
        code: codeId,
        name: name.trim(),
        location: location.trim(),
        currentStock: parseInt(currentStock, 10),
        category: (formData.category || '').trim(),
        components: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'products', codeId), newProduct); // ID = code
      toast.success('✅ Producto agregado exitosamente.');
      setFormData({ code: '', name: '', category: '', currentStock: '', location: '' });
      setShowForm(false);
      fetchProducts();
    } catch (error) {
      console.error('Error al agregar producto:', error);
      toast.error('❌ No se pudo agregar el producto.');
    }
  };

  // ====== Excel (import / plantilla) ======
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(
      [
        { code: 'P001', name: 'Spray Home Lavanda', category: 'Spray home', currentStock: 10, location: 'Bodega Colina' },
        { code: 'P002', name: 'Difusor Vainilla 250ml', category: 'Difusor varillas', currentStock: 5, location: 'BodegaSantaAdela' },
      ],
      { header: REQUIRED_HEADERS }
    );
    XLSX.utils.sheet_add_aoa(ws, [REQUIRED_HEADERS], { origin: 'A1' });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'Plantilla_Productos.xlsx');
  };

  const handleFileChange = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // 1) Objetos con primera fila como headers
      let rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) {
        toast.warn('⚠️ El Excel está vacío.');
        return;
      }

      // 2) Validación de headers (case-insensitive, trim)
      const detectedHeaders = Object.keys(rows[0] || {}).map((k) => String(k).toLowerCase().trim());
      const detectedSet = new Set(detectedHeaders);
      const missingReadable = REQUIRED_HEADERS.filter((req) => !detectedSet.has(String(req).toLowerCase()));
      if (missingReadable.length) {
        console.log('Encabezados detectados:', detectedHeaders);
        toast.error(`❌ Encabezados inválidos. Faltan: ${missingReadable.join(', ')}`);
        return;
      }

      // 3) Normalizar y filtrar válidas
      const parsed = rows.map(normalizeRow).filter((r) => r.code && r.name && r.category && r.location);
      if (!parsed.length) {
        toast.warn('⚠️ No hay filas válidas para importar.');
        return;
      }

      // 4) Upsert por code (ID = code)
      const CHUNK = 450;
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const slice = parsed.slice(i, i + CHUNK);
        const batch = writeBatch(db);

        slice.forEach((row) => {
          const ref = doc(db, 'products', row.code); // ID = code
          batch.set(
            ref,
            {
              code: row.code,
              name: row.name,
              category: row.category,
              location: row.location,
              currentStock: row.currentStock,
              components: [],
              updatedAt: Timestamp.now(),
              createdAt: Timestamp.now(), // si existe, se actualizará; si quieres no tocar createdAt, quita esta línea
            },
            { merge: true }
          );
        });

        await batch.commit();
      }

      toast.success('✅ Importación completada (upsert por código).');
      await fetchProducts();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      toast.error('❌ Error al importar. Revisa el formato del archivo.');
    }
  };

  // ====== Movimientos (entrada / salida) ======
  const handleRegisterMovement = async (e) => {
    e.preventDefault();
    const { product, type } = movementModal;
    const quantity = parseInt(movementForm.quantity, 10);

    if (!product || isNaN(quantity) || quantity <= 0) {
      toast.warn('⚠️ La cantidad ingresada no es válida.');
      return;
    }
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

      // 3. Limpiar
      setMovementModal({ open: false, product: null, type: '' });
      setMovementForm({ quantity: '', reason: '' });
      fetchProducts();
      toast.success('✅ Movimiento registrado correctamente.');
    } catch (error) {
      console.error('Error:', error);
      toast.error('❌ Ocurrió un error al guardar el movimiento.');
    }
  };

  // ====== Eliminar producto (si no tiene movimientos) ======
  const handleDeleteProduct = async (productId) => {
    const confirmDel = window.confirm('¿Estás seguro que deseas eliminar este producto?');
    if (!confirmDel) return;

    try {
      const movRef = collection(db, 'movements');
      const qMov = query(movRef, where('productId', '==', productId));
      const snapshot = await getDocs(qMov);

      if (!snapshot.empty) {
        toast.error('❌ No puedes eliminar un producto con movimientos registrados.');
        return;
      }

      await deleteDoc(doc(db, 'products', productId));
      toast.success('🗑️ Producto eliminado correctamente.');
      fetchProducts();
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      toast.error('❌ Error al intentar eliminar el producto.');
    }
  };

  // ====== FABRICACIÓN ======

  /**
   * Convierte el ítem de receta a UNIDAD MENOR (lo que guardas en 'stock').
   * - Si item.unidad === insumo.unidadMayor => receta en unidad mayor -> MULTIPLICA por factorConversion.
   * - En otro caso, asume receta en unidad menor.
   * Devuelve cantidad a descontar (en unidad menor) para 'unidadesFabricar' productos.
   */
  function requiredMenorPorFabricacion(insumo, item, unidadesFabricar) {
    const factor = toInt(insumo?.factorConversion) || 1;
    const cantidadReceta = Number(item?.cantidad) || 0;
    const unidadItem = norm(item?.unidad);
    const unidadMayor = norm(insumo?.unidadMayor);

    const porUnidadProducto_menor =
      unidadItem && unidadMayor && unidadItem === unidadMayor
        ? cantidadReceta * factor
        : cantidadReceta;

    return toInt(porUnidadProducto_menor * toInt(unidadesFabricar));
  }

  // Lee receta del producto
  async function getReceta(productoId) {
    const recetaRef = collection(db, 'products', productoId, 'receta');
    const snap = await getDocs(recetaRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

// Ejecuta fabricación atómica (lee TODO, luego escribe)
  async function fabricarProductoTx(producto, unidadesFabricar, userEmail) {
    if (!producto) throw new Error('Producto no seleccionado');

    // Receta fuera de la tx (OK)
    const receta = await getReceta(producto.id);
    if (!receta.length) throw new Error('Este producto no tiene receta asignada.');

    await runTransaction(db, async (tx) => {
      const faltantes = [];
      const updatesInsumos = []; // { ref, newStock }

      // 1) LECTURAS PRIMERO: producto
      const prodRef = doc(db, 'products', producto.id);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) throw new Error('Producto inexistente.');
      const currProd = toInt(prodSnap.data()?.currentStock);

      // 1b) LECTURAS PRIMERO: TODOS los insumos
      for (const item of receta) {
        const insRef = doc(db, 'insumos', item.insumoId);
        const insSnap = await tx.get(insRef); // <- solo leer

        if (!insSnap.exists()) {
          faltantes.push(`Insumo inexistente: ${item.nombreInsumo || item.insumoId}`);
          continue;
        }

        const ins = insSnap.data() || {};
        const reqMenor = requiredMenorPorFabricacion(ins, item, unidadesFabricar);
        const stockActual = toInt(ins.stock);

        if (stockActual < reqMenor) {
          const um = ins.unidad || 'u';
          faltantes.push(
            `${item.nombreInsumo || item.insumoId}: requiere ${reqMenor} ${um}, hay ${stockActual} ${um}`
          );
          continue;
        }

        // Guardamos el nuevo stock calculado para escribir DESPUÉS
        updatesInsumos.push({
          ref: insRef,
          newStock: stockActual - reqMenor,
        });
      }

      // Si falla alguna validación, aborta sin escribir
      if (faltantes.length) {
        throw new Error(faltantes.join(' | '));
      }

      // 2) ESCRITURAS: ahora sí, todas las updates
      for (const u of updatesInsumos) {
        tx.update(u.ref, {
          stock: u.newStock,
          updatedAt: Timestamp.now(),
        });
      }

      tx.update(prodRef, {
        currentStock: currProd + toInt(unidadesFabricar),
        updatedAt: Timestamp.now(),
      });

      const fabRef = doc(collection(db, 'fabricaciones'));
      tx.set(fabRef, {
        productId: producto.id,
        productName: producto.name,
        cantidadFabricada: toInt(unidadesFabricar),
        insumosConsumidos: receta.map((it) => ({
          nombre: it.nombreInsumo,
          cantidad: Number(it.cantidad) || 0,
          unidad: it.unidad || '',
        })),
        fecha: Timestamp.now(),
        usuario: userEmail || 'anónimo',
      });
    });
  }

  

  return (
    <Sidebar>
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-4 justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-[#8D8376]">Lista de productos</h2>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#8D8376] text-white px-4 py-2 rounded hover:bg-[#7A7267]"
          >
            + Agregar Producto
          </button>

          <button
            onClick={handleImportClick}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Importar Excel
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
          >
            Descargar plantilla
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />

          <input
            type="text"
            placeholder="Buscar por nombre o código"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-2 border rounded w-full md:w-64"
          />
        </div>
      </div>

      {/* FORM NUEVO PRODUCTO */}
      {showForm && (
        <form onSubmit={handleAddProduct} className="bg-white p-4 mb-6 rounded-xl shadow-md">
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
              <option value="Bodega Colina">Bodega Colina</option>
              <option value="BodegaSantaAdela">BodegaSantaAdela</option>
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
            <button type="submit" className="px-4 py-2 bg-[#8D8376] text-white rounded hover:bg-[#7A7267]">
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
                .filter((p) => {
                  const q = searchTerm.toLowerCase();
                  return (
                    String(p.name || '').toLowerCase().includes(q) ||
                    String(p.code || '').toLowerCase().includes(q)
                  );
                })
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
                        onClick={() => setRecetaModal({ open: true, producto: product })}
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                      >
                        Asignar receta
                      </button>
                      <button
                        onClick={() => {
                          setFabricarModal({ open: true, product });
                          setFabricarQty(1);
                        }}
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
                onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="text"
                placeholder="Motivo"
                value={movementForm.reason}
                onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
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
                <button type="submit" className="px-4 py-2 bg-[#8D8376] text-white rounded hover:bg-[#7A7267]">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FABRICAR N */}
      {fabricarModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-[#8D8376]">
              Fabricar: {fabricarModal.product?.name}
            </h3>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cantidad = toInt(fabricarQty);
                if (!cantidad || cantidad <= 0) {
                  toast.warn('⚠️ Ingresa una cantidad válida.');
                  return;
                }
                try {
                  await fabricarProductoTx(fabricarModal.product, cantidad, user?.email || '');
                  setFabricarModal({ open: false, product: null });
                  setFabricarQty(1);
                  toast.success('✅ Producto fabricado y stock actualizado.');
                  fetchProducts();
                } catch (err) {
                  console.error(err);
                  toast.error(`❌ No se pudo fabricar: ${err.message}`);
                }
              }}
              className="space-y-4"
            >
              <input
                type="number"
                min={1}
                value={fabricarQty}
                onChange={(e) => setFabricarQty(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Cantidad a fabricar"
                required
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFabricarModal({ open: false, product: null });
                    setFabricarQty(1);
                  }}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-[#16a34a] text-white rounded hover:bg-green-700">
                  Fabricar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECETA */}
      {recetaModal.open && (
        <AsignarRecetaModal
          open={recetaModal.open}
          producto={recetaModal.producto}
          onClose={() => setRecetaModal({ open: false, producto: null })}
        />
      )}
    </Sidebar>
  );
}
