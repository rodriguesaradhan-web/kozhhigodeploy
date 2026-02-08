import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

const Register = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        sid: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [studentIdFile, setStudentIdFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type (image only)
            if (!file.type.startsWith('image/')) {
                setError('Please upload an image file');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            setStudentIdFile(file);
            setError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.name.trim()) {
            setError('Full name is required');
            return;
        }
        if (!formData.sid.trim()) {
            setError('Student ID is required');
            return;
        }
        if (!formData.email.trim()) {
            setError('Email is required');
            return;
        }
        if (!formData.password) {
            setError('Password is required');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (!studentIdFile) {
            setError('Student ID image is required');
            return;
        }

        setLoading(true);
        try {
            // Create FormData to send file
            const fd = new FormData();
            fd.append('name', formData.name);
            fd.append('sid', formData.sid);
            fd.append('email', formData.email);
            fd.append('password', formData.password);
            fd.append('studentIdImage', studentIdFile);

            // Send to backend
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${API_URL}/api/auth/register-student`, {
                method: 'POST',
                body: fd
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            // Save token and user info if immediate registration is needed
            if (data.token && data.user) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            toast.success('Registration successful! Your account is pending admin verification.');
            navigate('/login');
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
            console.error('Registration error:', err);
        } finally {
            setLoading(false);
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
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
                                }} 
                            />
                        </div>
                        <h1 className="text-gradient" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Join KozhiGo</h1>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '500' }}>Register as a student to ride share</p>
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            padding: '1rem 1.25rem',
                            marginBottom: '1.5rem',
                            color: '#FCA5A5',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            backdropFilter: 'blur(10px)'
                        }}>
                            Error: {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input
                                type="text"
                                className="form-control"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="John Doe"
                                required
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Student ID (SID)</label>
                            <input
                                type="text"
                                className="form-control"
                                name="sid"
                                value={formData.sid}
                                onChange={handleInputChange}
                                placeholder="12345678"
                                required
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                className="form-control"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="student@college.edu"
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
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="At least 6 characters"
                                required
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <input
                                type="password"
                                className="form-control"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="Confirm password"
                                required
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Student ID Image</label>
                            <input
                                type="file"
                                className="form-control"
                                accept="image/*"
                                onChange={handleFileChange}
                                required
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                Upload a clear image of your student ID (JPG, PNG, etc. - max 5MB)
                            </small>
                            {studentIdFile && (
                                <small style={{ color: 'var(--success)', display: 'block', marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
                                    File selected: {studentIdFile.name}
                                </small>
                            )}
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary btn-block"
                            disabled={loading}
                            style={{
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                padding: '0.9rem 1.5rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                border: 'none',
                                color: 'white',
                                letterSpacing: '0.5px',
                                opacity: loading ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.target.style.transform = 'translateY(-2px)';
                                    e.target.style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!loading) {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.3)';
                                }
                            }}
                        >
                            {loading ? 'Registering...' : 'Create Account'}
                        </button>

                        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            Already have an account? <a href="#" onClick={() => navigate('/login')} style={{ color: 'var(--secondary)', fontWeight: '600', textDecoration: 'none', transition: 'all 0.3s ease' }}>Log In</a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;
