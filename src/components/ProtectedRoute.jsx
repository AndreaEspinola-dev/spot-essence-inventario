// components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children, requiredRole }) => {
  const { usuario, rol, loading } = useAuth();

  if (loading) return <p>Cargando...</p>;

  if (!usuario || rol !== requiredRole) {
    return <Navigate to="/no-autorizado" />;
  }

  return children;
};

export default ProtectedRoute;
