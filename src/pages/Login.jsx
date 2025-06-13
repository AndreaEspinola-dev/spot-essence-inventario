import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';// <- usamos el contexto
import { useAuth } from "../hooks/useAuth";
import { auth } from "../services/firebaseConfig";




import logo from '../assets/logonegro.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth(); // <- obtenemos el usuario desde el contexto

  // Si ya está autenticado, redirige al dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Firebase ya guarda la sesión automáticamente
      navigate('/dashboard');
    } catch (err) {
      setError('Correo o contraseña inválidos');
      console.error(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F8F6F3] px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          
          <img src={logo} alt="Logo" className="w-24 h-auto" />

        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold mb-4 text-center text-[#080808]">
          Iniciar sesión
        </h2>

        {/* Mensaje de error */}
        {error && <p className="text-red-500 mb-4 text-sm text-center">{error}</p>}

        {/* Campo Email */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[#8D8376]">
            Correo electrónico
          </label>
          <input
            type="email"
            className="w-full mt-1 p-2 border border-[#D8D7D2] rounded outline-[#8D8376]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Campo Contraseña */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#8D8376]">
            Contraseña
          </label>
          <input
            type="password"
            className="w-full mt-1 p-2 border border-[#D8D7D2] rounded outline-[#8D8376]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Botón Login */}
        <button
          type="submit"
          className="w-full bg-[#8D8376] text-white py-2 rounded hover:bg-[#7A7267] transition"
        >
          Iniciar sesión
        </button>
      </form>
    </div>
  );
}
