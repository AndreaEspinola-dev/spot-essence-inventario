import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Movimientos from './pages/Movimientos';
import Insumos from './pages/Insumos';
import PrivateRoute from './components/PrivateRoute';
import Fabricaciones from './pages/Fabricaciones';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/movimientos"
          element={
            <PrivateRoute>
              <Movimientos />
            </PrivateRoute>
          }
        />
        <Route
          path="/insumos"
          element={
            <PrivateRoute>
              <Insumos />
            </PrivateRoute>
          }
        />

        <Route
          path="/fabricaciones"
          element={
            <PrivateRoute>
              <Fabricaciones />
            </PrivateRoute>
          }
        />

        {/* Ruta fallback */}
        <Route path="*" element={<h1 style={{ padding: '2rem' }}>Página no encontrada</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
