import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Movimientos from './pages/Movimientos';  
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';





function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />



      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminPanel />
          </ProtectedRoute>
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

      {/* Ruta por defecto */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
}

export default AppRouter;
