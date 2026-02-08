import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles = [] }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return null;

    if (!user) {
        // Not logged in — redirect to login, preserving intended path
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles.length && !roles.includes(user.role)) {
        // Logged in but not authorized
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;
