import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const loggedInUser = await login(email, password);
            // Redirect based on user role
            if (loggedInUser?.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (error) {
            toast.error(error?.toString() || 'Login failed');
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="bg-shape shape-1"></div>
            <div className="bg-shape shape-2"></div>

            <div className="animate-fade-in auth-card">
                <div className="card">
                    <div className="text-center" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <img 
                                src="/KozhGo-LOGO.png" 
                                alt="KozhiGo" 
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
                                }} 
                            />
                        </div>
                        <h2 style={{
                            background: 'linear-gradient(135deg, #818CF8 0%, #06B6D4 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            fontSize: '2rem',
                            fontWeight: '900',
                            margin: '0.5rem 0 0 0',
                            letterSpacing: '-0.5px'
                        }}>KozhiGo</h2>
                        <p style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-muted)', margin: '0.5rem 0 0 0', letterSpacing: '0.5px' }}>Ride Smart. Ride Fast.</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                className="form-control"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-control"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="btn btn-primary btn-block"
                            style={{
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                padding: '0.9rem 1.5rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                cursor: 'pointer',
                                border: 'none',
                                color: 'white',
                                letterSpacing: '0.5px'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.3)';
                            }}
                        >
                            Log In
                        </button>
                        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            New to KozhiGo? <a href="#" onClick={() => navigate('/register')} style={{ color: 'var(--secondary)', fontWeight: '600', textDecoration: 'none', transition: 'all 0.3s ease' }}>Create Account</a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
