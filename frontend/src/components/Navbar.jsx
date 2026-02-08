import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [theme, setTheme] = useState('dark');

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navbar">
            <div className="logo" onClick={() => navigate(user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src="/KozhGo-LOGO.png" alt="KozhiGo" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>KozhiGo</span>
            </div>
            {user && (
                <div className="flex-center" style={{ gap: '1rem' }}>
                    <span id="user-greeting" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Welcome, {user.name} ({user.role})
                    </span>
                    {user.role === 'admin' && (
                        <button className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => navigate('/admin')}>Admin</button>
                    )}
                    <button className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={handleLogout}>Log Out</button>
                    {/* Theme Toggle - Future Feature */}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
