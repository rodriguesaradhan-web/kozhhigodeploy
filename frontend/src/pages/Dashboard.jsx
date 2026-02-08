import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

import DriverDashboard from '../components/Dashboard/DriverDashboard';
import PassengerDashboard from '../components/Dashboard/PassengerDashboard';

import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState('home');

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        } else if (!loading && user?.role === 'admin') {
            navigate('/admin');
        }
    }, [user, loading, navigate]);

    if (loading || !user) return <div>Loading...</div>;

    return (
        <div className="dashboard-grid">
            <aside className="sidebar">
                <div className={`menu-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
                    <span></span> Home
                </div>
                <div className={`menu-item ${tab === 'my-rides' ? 'active' : ''}`} onClick={() => setTab('my-rides')}>
                    <span></span> My Rides
                </div>
                {user.role === 'driver' && (
                    <>
                        <div className={`menu-item ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
                            <span></span> Requests
                        </div>
                        <div className={`menu-item ${tab === 'find-rides' ? 'active' : ''}`} onClick={() => setTab('find-rides')}>
                            <span></span> Find Rides
                        </div>
                        <div className={`menu-item ${tab === 'my-bookings' ? 'active' : ''}`} onClick={() => setTab('my-bookings')}>
                            <span></span> My Bookings
                        </div>
                    </>
                )}
                {user.role === 'passenger' && (
                    <div className={`menu-item ${tab === 'become-driver' ? 'active' : ''}`} onClick={() => setTab('become-driver')}>
                        <span></span> Become a Driver
                    </div>
                )}

            </aside>

            <main className="main-content">
                {user.role === 'driver' ? (
                    <DriverDashboard tab={tab} />
                ) : (
                    <PassengerDashboard tab={tab} />
                )}
            </main>
        </div>
    );
};

export default Dashboard;
