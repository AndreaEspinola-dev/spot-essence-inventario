import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../hooks/useAuth";

import { HiMenu, HiX, HiCube, HiBeaker, HiRefresh, HiOfficeBuilding, HiLogout } from 'react-icons/hi';

export default function Sidebar({ children }) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const toggleSidebar = () => setOpen(!open);

  const menuItems = [
    { name: 'Productos', path: '/dashboard', icon: <HiCube /> },
    { name: 'Materias Primas', path: '/insumos', icon: <HiBeaker /> },
    { name: 'Movimientos', path: '/movimientos', icon: <HiRefresh /> },
    { name: 'Fabricaciones', path: '/fabricaciones', icon: <HiOfficeBuilding /> },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8F6F3]">
      {/* Sidebar */}
      <aside className={`${open ? 'w-64' : 'w-16'} bg-white shadow-md transition-all duration-300`}>
        <div className="flex items-center justify-between p-4 border-b">
          <span className={`font-bold text-[#8D8376] transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}>
            Inventario
          </span>
          <button onClick={toggleSidebar} className="text-[#8D8376]">
            {open ? <HiX size={24} /> : <HiMenu size={24} />}
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map(({ name, path, icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded text-[#8D8376] hover:bg-[#F5F4F1]"
            >
              {icon}
              {open && <span>{name}</span>}
            </button>
          ))}

          {/* Cerrar sesión */}
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 rounded text-red-500 hover:bg-[#F5F4F1]"
          >
            <HiLogout />
            {open && <span>Cerrar sesión</span>}
          </button>
        </nav>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
  