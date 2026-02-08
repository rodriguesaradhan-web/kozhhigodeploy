import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PassengerDashboard = ({ tab = 'home' }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [rides, setRides] = useState([]);
    const [myRides, setMyRides] = useState([]);
    const [loadingRide, setLoadingRide] = useState(null);
    const [error, setError] = useState(null);
    
    // Driver application state
    const [drivingLicense, setDrivingLicense] = useState(null);
    const [applyingDriver, setApplyingDriver] = useState(false);
    const [applicationStatus, setApplicationStatus] = useState(null);
    
    // Request modal state
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedRideId, setSelectedRideId] = useState(null);
    const [requestData, setRequestData] = useState({
        phoneNumber: '',
        pickupLocation: ''
    });
    
    // Report driver and cancel trip state
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportingRideId, setReportingRideId] = useState(null);
    const [reportData, setReportData] = useState({
        reason: '',
        description: ''
    });
    const [cancellingRideId, setCancellingRideId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelingForRide, setCancelingForRide] = useState(null);
    
    const rideMapRefs = useRef({});

    const fetchRides = async () => {
        try {
            setError(null);
            const user = JSON.parse(localStorage.getItem('user'));
            const res = await api.get('/rides');
            if (!res.data || !Array.isArray(res.data)) {
                setRides([]);
                setMyRides([]);
                return;
            }

            // Find rides where current user is a passenger (requested or accepted)
            const userRides = res.data.filter(ride => {
                return ride.passengers?.some(p => {
                    const passengerId = typeof p.user === 'object' ? p.user?._id : p.user;
                    return passengerId?.toString() === user?.id?.toString();
                });
            });
            setMyRides(userRides);

            // Filter available rides (not requested by user, and no accepted passenger)
            const availableRides = res.data.filter(ride => {
                // Only show rides that are PENDING or IN_PROGRESS
                if (!['PENDING', 'IN_PROGRESS'].includes(ride.status)) return false;
                // Filter out rides with accepted passengers
                if (ride.passengers?.some(p => p.status === 'ACCEPTED')) return false;
                // Filter out rides user already requested
                if (ride.passengers?.some(p => {
                    const passengerId = typeof p.user === 'object' ? p.user?._id : p.user;
                    return passengerId?.toString() === user?.id?.toString();
                })) return false;
                return true;
            });
            setRides(availableRides);
        } catch (error) {
            console.error('Error fetching rides:', error);
            setError('Failed to load rides');
            setRides([]);
            setMyRides([]);
        }
    };

    useEffect(() => {
        fetchRides();
        // Auto-refresh rides every 10 seconds
        const interval = setInterval(fetchRides, 10000);
        return () => clearInterval(interval);
    }, []);

    // Cleanup maps when tab changes
    useEffect(() => {
        // Clean up all existing maps when tab changes
        Object.keys(rideMapRefs.current).forEach(key => {
            if (rideMapRefs.current[key]) {
                rideMapRefs.current[key].remove();
            }
        });
        rideMapRefs.current = {};
        
        return () => {
            Object.keys(rideMapRefs.current).forEach(key => {
                if (rideMapRefs.current[key]) {
                    rideMapRefs.current[key].remove();
                }
            });
            rideMapRefs.current = {};
        };
    }, [tab]);

    const handleRequest = (rideId) => {
        setSelectedRideId(rideId);
        setShowRequestModal(true);
        setRequestData({ phoneNumber: '', pickupLocation: '' });
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.warning('Geolocation is not supported by your browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Reverse geocode to get address
                    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
                    const response = await fetch(url, { headers: { 'User-Agent': 'student-ride-share' } });
                    const data = await response.json();
                    setRequestData(prev => ({
                        ...prev,
                        pickupLocation: data.display_name || `${latitude}, ${longitude}`
                    }));
                } catch {
                    setRequestData(prev => ({
                        ...prev,
                        pickupLocation: `${latitude}, ${longitude}`
                    }));
                }
            },
            (error) => {
                toast.error('Unable to get your location: ' + error.message);
            }
        );
    };

    const submitRequest = async () => {
        if (!requestData.phoneNumber || !requestData.pickupLocation) {
            toast.warning('Please fill in all fields');
            return;
        }

        try {
            setLoadingRide(selectedRideId);
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.id) {
                setError('You must be logged in to request a ride');
                return;
            }

            const response = await api.post(`/rides/${selectedRideId}/request`, {
                passengerId: user.id,
                phoneNumber: requestData.phoneNumber,
                pickupLocation: requestData.pickupLocation
            });
            
            console.log('Request successful:', response.data);
            setError(null);
            toast.success('Ride requested successfully!');
            setShowRequestModal(false);
            setSelectedRideId(null);
            setRequestData({ phoneNumber: '', pickupLocation: '' });
            await fetchRides();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Error requesting ride';
            console.error('Request error:', errorMsg, error);
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoadingRide(null);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.warning('Please select an image file');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            toast.warning('File size must be less than 5MB');
            return;
        }

        setDrivingLicense(file);
        setError(null);
    };

    const handleDriverApplication = async (e) => {
        e.preventDefault();
        
        if (!drivingLicense) {
            setError('Please upload your driving license image');
            return;
        }

        try {
            setApplyingDriver(true);
            setError(null);

            const formData = new FormData();
            formData.append('drivingLicense', drivingLicense);

            const response = await fetch('http://localhost:5000/api/auth/apply-driver', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Application failed');
            }

            setApplicationStatus('PENDING');
            toast.success('Driver application submitted successfully! Please wait for admin approval.');
            setDrivingLicense(null);
        } catch (err) {
            console.error('Driver application error:', err);
            setError(err.message || 'Failed to submit application');
            toast.error(err.message || 'Failed to submit application');
        } finally {
            setApplyingDriver(false);
        }
    };

    const handleCancelTrip = async (rideId) => {
        if (!cancelReason.trim()) {
            toast.warning('Please provide a reason for cancellation');
            return;
        }

        try {
            setCancellingRideId(rideId);
            await api.post(`/rides/${rideId}/cancel-passenger`, {
                reason: cancelReason,
                passengerId: user.id
            });
            
            toast.success('Trip cancelled. Driver has been notified.');
            setCancelReason('');
            setShowCancelModal(false);
            setCancelingForRide(null);
            setCancellingRideId(null);
            await fetchRides();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel trip');
            setCancellingRideId(null);
        }
    };

    const handleReportDriver = async (e) => {
        e.preventDefault();
        if (!reportData.reason || !reportData.description.trim()) {
            toast.warning('Please provide both reason and description');
            return;
        }

        try {
            const ride = myRides.find(r => r._id === reportingRideId);
            await api.post(`/rides/${reportingRideId}/report-driver`, {
                driverId: ride.driver._id,
                reason: reportData.reason,
                description: reportData.description
            });
            
            toast.success('Report submitted successfully. Admin will review it.');
            setShowReportModal(false);
            setReportingRideId(null);
            setReportData({ reason: '', description: '' });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit report');
        }
    };

    const initRideMap = (rideId, driverLocation, pickupLocation) => {
        const elementId = `ride-map-${rideId}`;
        // Check if map already exists
        if (rideMapRefs.current[elementId]) return;
        
        setTimeout(() => {
            const mapElement = document.getElementById(elementId);
            if (!mapElement || rideMapRefs.current[elementId]) return;

            // Parse pickup location - could be "lat,lng" or address
            const parts = pickupLocation?.split(',') || [];
            let passengerLat, passengerLng;

            if (parts.length >= 2) {
                const parsedLat = parseFloat(parts[0].trim());
                const parsedLng = parseFloat(parts[1].trim());
                
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                    passengerLat = parsedLat;
                    passengerLng = parsedLng;
                    initRideMapWithCoords(elementId, driverLocation, passengerLat, passengerLng);
                    return;
                }
            }

            // If not coordinates, try geocoding the address
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupLocation)}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const location = data[0];
                        initRideMapWithCoords(elementId, driverLocation, parseFloat(location.lat), parseFloat(location.lon));
                    }
                })
                .catch(err => console.error('Geocoding error:', err));
        }, 100);
    };

    const initRideMapWithCoords = (elementId, driverLocation, passengerLat, passengerLng) => {
        const mapElement = document.getElementById(elementId);
        if (!mapElement || rideMapRefs.current[elementId]) return;

        // If driver location exists, show both
        if (driverLocation && driverLocation.latitude && driverLocation.longitude) {
            const driverLat = driverLocation.latitude;
            const driverLng = driverLocation.longitude;

            // Create map centered between driver and passenger
            const centerLat = (driverLat + passengerLat) / 2;
            const centerLng = (driverLng + passengerLng) / 2;
            
            const map = L.map(elementId).setView([centerLat, centerLng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            // Add driver marker (blue)
            L.marker([driverLat, driverLng], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background: #3498db; color: white; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">D</div>',
                    iconSize: [35, 35]
                })
            }).addTo(map).bindPopup('Driver Location');

            // Add passenger marker (red)
            L.marker([passengerLat, passengerLng], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">P</div>',
                    iconSize: [30, 30]
                })
            }).addTo(map).bindPopup('Your Pickup Location');

            // Draw route line
            const routeLine = L.polyline([[driverLat, driverLng], [passengerLat, passengerLng]], {
                color: '#3498db',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 10'
            }).addTo(map);

            // Fit bounds to show both markers
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

            rideMapRefs.current[elementId] = map;
        } else {
            // Only show passenger location
            const map = L.map(elementId).setView([passengerLat, passengerLng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            L.marker([passengerLat, passengerLng], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">P</div>',
                    iconSize: [30, 30]
                })
            }).addTo(map).bindPopup('Your Pickup Location');

            rideMapRefs.current[elementId] = map;
        }
    };

    return (
        <div>
            {/* Welcome Section */}
            {tab === 'home' && (
                <div className="welcome-card">
                    <div className="welcome-card-content">
                        <h3>Welcome, Passenger!</h3>
                        <p>Find affordable rides to campus and manage your bookings easily.</p>
                    </div>
                </div>
            )}

            {/* Tab-based Header */}
            <div>
                <h1 style={{ margin: '0 0 2rem 0' }}>
                    {tab === 'home' && 'Passenger Dashboard'}
                    {tab === 'my-rides' && 'My Ride Requests'}
                </h1>
            </div>

            {/* Stats Section */}
            {tab === 'home' && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-number">{rides.length}</div>
                        <div className="stat-label">Available Rides</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{myRides.filter(r => r.passengers?.some(p => p.user?.toString() === user?.id?.toString() && ['REQUESTED'].includes(p.status))).length}</div>
                        <div className="stat-label">Pending Requests</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{myRides.filter(r => r.passengers?.some(p => p.user?.toString() === user?.id?.toString() && p.status === 'ACCEPTED')).length}</div>
                        <div className="stat-label">Accepted Rides</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{myRides.filter(r => r.passengers?.some(p => p.user?.toString() === user?.id?.toString() && p.status === 'COMPLETED')).length}</div>
                        <div className="stat-label">Completed Trips</div>
                    </div>
                </div>
            )}
            
            {tab !== 'my-rides' && (
                <div className="dashboard-section">
                    <div className="section-header">
                        <div className="section-icon"></div>
                        <h2>Available Rides</h2>
                    </div>
                    {error && (
                        <div style={{
                            background: '#fee',
                            border: '1px solid #fcc',
                            borderRadius: '4px',
                            padding: '1rem',
                            marginBottom: '1rem',
                            color: '#c00'
                        }}>
                            {error}
                        </div>
                    )}
                    <div style={{ marginBottom: '1rem' }}>
                        <button 
                            className="btn btn-outline" 
                            onClick={fetchRides}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                        >
                            ↻ Refresh Rides
                        </button>
                    </div>
                    <div className="ride-list">
                        {rides.length === 0 ? (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <div className="empty-state-icon"></div>
                                <h3>No Available Rides</h3>
                                <p>Check back soon or refresh to see new rides posted by drivers</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={fetchRides}
                                >
                                    Refresh Rides
                                </button>
                            </div>
                        ) : (
                            rides.map(ride => (
                                <div key={ride._id} className="ride-card">
                                    <div className="ride-header">
                                        <span className={`badge badge-${ride.status.toLowerCase()}`}>{ride.status}</span>
                                        <small>{new Date(ride.date).toLocaleDateString()}</small>
                                    </div>
                                    <div className="ride-path">
                                        <span>{ride.from}</span> → <span>{ride.to}</span>
                                    </div>
                                    <div className="ride-details" style={{ marginTop: '1rem' }}>
                                        <span>{ride.time}</span>
                                        <span>Two-wheeler ride</span>
                                        <span>{ride.driver?.name}</span>
                                    </div>
                                    {ride.distance && ride.duration && (
                                        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            <span>{(ride.distance / 1000).toFixed(1)} km — {(ride.duration / 60).toFixed(0)} mins</span>
                                        </div>
                                    )}
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ marginTop: '1rem', width: '100%' }} 
                                        onClick={() => handleRequest(ride._id)}
                                        disabled={loadingRide === ride._id}
                                    >
                                        {loadingRide === ride._id ? 'Requesting...' : 'Request Ride'}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {tab === 'my-rides' && (
                <div className="dashboard-section">
                    <div className="section-header">
                        <div className="section-icon"></div>
                        <h2>My Ride Requests</h2>
                    </div>
                    <div className="ride-list">
                        {myRides.length === 0 ? (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <div className="empty-state-icon"></div>
                                <h3>No Ride Requests Yet</h3>
                                <p>Browse available rides and request one to start your journey</p>
                            </div>
                        ) : (
                            myRides.map(ride => {
                                const user = JSON.parse(localStorage.getItem('user'));
                                const userPassenger = ride.passengers?.find(p => {
                                    // Handle both string IDs and object references with _id
                                    const passengerId = typeof p.user === 'object' ? p.user?._id : p.user;
                                    return passengerId?.toString() === user?.id?.toString();
                                });
                                
                                if (!userPassenger) {
                                    console.log('No matching passenger found for user', user?.id, 'in ride', ride._id);
                                    return null;
                                }
                                
                                return (
                                <div key={ride._id} className="ride-card">
                                    <div className="ride-header">
                                        <span className={`badge badge-${ride.status.toLowerCase()}`}>{ride.status}</span>
                                        <small>{new Date(ride.date).toLocaleDateString()}</small>
                                    </div>
                                    <div className="ride-path">
                                        <span>{ride.from}</span> → <span>{ride.to}</span>
                                    </div>
                                    <div className="ride-details" style={{ marginTop: '1rem' }}>
                                        <span>{ride.time}</span>
                                        <span>Two-wheeler ride</span>
                                        <span>{ride.driver?.name}</span>
                                        {userPassenger.status === 'ACCEPTED' && ride.driverPhone && (
                                            <span>{ride.driverPhone}</span>
                                        )}
                                    </div>
                                    {ride.distance && ride.duration && (
                                        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            <span>{(ride.distance / 1000).toFixed(1)} km — {(ride.duration / 60).toFixed(0)} mins</span>
                                        </div>
                                    )}
                                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(108,93,211,0.1)', borderRadius: '4px' }}>
                                        <span style={{ fontWeight: 600 }}>Request Status: </span>
                                        <span style={{ textTransform: 'capitalize', color: userPassenger.status === 'ACCEPTED' ? 'var(--success)' : userPassenger.status === 'REQUESTED' ? 'var(--secondary)' : 'var(--accent)' }}>
                                            {userPassenger.status}
                                        </span>
                                    </div>

                                    {userPassenger.status === 'ACCEPTED' && !['COMPLETED', 'CANCELLED'].includes(ride.status) && (
                                        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <button 
                                                className="btn btn-outline"
                                                style={{ borderColor: '#E53E3E', color: '#E53E3E' }}
                                                onClick={() => {
                                                    setShowCancelModal(true);
                                                    setCancelingForRide(ride._id);
                                                }}
                                                disabled={cancellingRideId === ride._id}
                                            >
                                                {cancellingRideId === ride._id ? 'Cancelling...' : 'Cancel Trip'}
                                            </button>
                                            <button 
                                                className="btn btn-outline"
                                                style={{ borderColor: '#F6AD55', color: '#F6AD55' }}
                                                onClick={() => {
                                                    setShowReportModal(true);
                                                    setReportingRideId(ride._id);
                                                }}
                                            >
                                                Report Driver
                                            </button>
                                        </div>
                                    )}
                                    {ride.status === 'STARTED' && userPassenger.eta && (
                                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#e3f2fd', borderRadius: '0.5rem', border: '2px solid #1976d2', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Driver Arriving In</div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1976d2' }}>{Math.ceil(userPassenger.eta / 60)} minutes</div>
                                        </div>
                                    )}
                                    {ride.status === 'ARRIVED' && userPassenger.status === 'ACCEPTED' && (
                                        <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.3rem', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>Driver Has Arrived!</div>
                                            <div style={{ fontSize: '0.95rem', color: 'white', opacity: 0.9 }}>Your driver is waiting at the pickup location</div>
                                            {userPassenger.distanceToPickup && (
                                                <div style={{ fontSize: '1rem', color: 'white', fontWeight: 600, marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.25)', borderRadius: '0.25rem' }}>
                                                    Driver traveled: {(userPassenger.distanceToPickup / 1000).toFixed(2)} km
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {ride.status === 'IN_PROGRESS' && userPassenger.status === 'ACCEPTED' && (
                                        <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(30, 136, 229, 0.3)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>Trip In Progress</div>
                                            <div style={{ fontSize: '0.95rem', color: 'white', opacity: 0.9 }}>Heading to the destination</div>
                                            {ride.tripDistance && (
                                                <div style={{ fontSize: '1rem', color: 'white', fontWeight: 600, marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.25)', borderRadius: '0.25rem' }}>
                                                    Trip distance: {(ride.tripDistance / 1000).toFixed(2)} km
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {ride.status === 'COMPLETED' && userPassenger.status === 'ACCEPTED' && (
                                        <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>Reached Destination</div>
                                            <div style={{ fontSize: '0.95rem', color: 'white', opacity: 0.9 }}>Thanks for riding!</div>
                                            {ride.tripDistance && (
                                                <div style={{ fontSize: '1rem', color: 'white', fontWeight: 600, marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.25)', borderRadius: '0.25rem' }}>
                                                    Total trip: {(ride.tripDistance / 1000).toFixed(2)} km
                                                </div>
                                            )}
                                            {ride.price && (
                                                <div style={{ fontSize: '1.2rem', color: '#FFD700', fontWeight: 700, marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255, 215, 0, 0.2)', borderRadius: '0.25rem' }}>
                                                    Total Fare: ₹{ride.price.toFixed(0)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {userPassenger.status === 'ACCEPTED' && userPassenger.pickupLocation && (
                                        <div 
                                            id={`ride-map-${ride._id}`} 
                                            style={{ 
                                                height: '300px', 
                                                width: '100%', 
                                                borderRadius: '0.5rem', 
                                                marginTop: '1rem',
                                                border: '2px solid #ddd'
                                            }}
                                            ref={() => initRideMap(ride._id, ride.driverLocation, userPassenger.pickupLocation)}
                                        ></div>
                                    )}
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {tab === 'become-driver' && (
                <>
                    <h3>Become a Driver</h3>
                    <div style={{
                        maxWidth: '600px',
                        margin: '0 auto',
                        padding: '2rem',
                        background: '#ffffff',
                        borderRadius: '0.6rem',
                        border: '1px solid #e2e2e2',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                    }}>
                        {applicationStatus === 'PENDING' ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '2rem'
                            }}>
                                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}></div>
                                <h4>Application Pending</h4>
                                <p style={{ color: '#666' }}>
                                    Your driver application is under review by the admin. 
                                    You'll be notified once it's approved.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
                                    <h4>Apply to Become a Driver</h4>
                                    <p style={{ color: '#666', marginTop: '0.5rem' }}>
                                        Upload your driving license for verification. 
                                        Once approved by admin, you can start offering rides!
                                    </p>
                                </div>

                                {error && (
                                    <div style={{
                                        background: '#fee',
                                        border: '1px solid #fcc',
                                        borderRadius: '4px',
                                        padding: '1rem',
                                        marginBottom: '1rem',
                                        color: '#c00'
                                    }}>
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleDriverApplication}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: '0.5rem',
                                            fontWeight: '500',
                                            color: '#333'
                                        }}>
                                            Driving License Image *
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                border: '2px dashed #ddd',
                                                borderRadius: '0.5rem',
                                                cursor: 'pointer'
                                            }}
                                        />
                                        {drivingLicense && (
                                            <div style={{
                                                marginTop: '0.5rem',
                                                padding: '0.5rem',
                                                background: '#e8f5e9',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.9rem',
                                                color: '#2e7d32'
                                            }}>
                                                File selected: {drivingLicense.name}
                                            </div>
                                        )}
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                                            Accepted formats: JPG, PNG, GIF, WebP (Max 5MB)
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                        disabled={applyingDriver || !drivingLicense}
                                        style={{ 
                                            width: '100%', 
                                            padding: '0.75rem',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        {applyingDriver ? 'Submitting...' : 'Submit Application'}
                                    </button>
                                </form>

                                <div style={{
                                    marginTop: '2rem',
                                    padding: '1rem',
                                    background: '#f0f7ff',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.9rem'
                                }}>
                                    <strong>Requirements:</strong>
                                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                        <li>Valid driving license</li>
                                        <li>Clear image of your license</li>
                                        <li>Admin verification required</li>
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {showRequestModal && (
                <div className="modal-overlay open">
                    <div className="modal">
                        <h2>Request Ride</h2>
                        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                            Please provide your contact details and pickup location
                        </p>

                        <div className="form-group">
                            <label className="form-label">Phone Number *</label>
                            <input
                                type="tel"
                                className="form-control"
                                placeholder="Enter your phone number"
                                value={requestData.phoneNumber}
                                onChange={(e) => setRequestData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Pickup Location *</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Enter your pickup location"
                                    value={requestData.pickupLocation}
                                    onChange={(e) => setRequestData(prev => ({ ...prev, pickupLocation: e.target.value }))}
                                    required
                                />
                                <button 
                                    type="button" 
                                    className="btn btn-outline"
                                    onClick={getCurrentLocation}
                                >
                                    Current Location
                                </button>
                            </div>
                        </div>

                        <div className="flex-center" style={{ gap: '1rem', marginTop: '2rem' }}>
                            <button 
                                type="button" 
                                className="btn btn-outline"
                                onClick={() => {
                                    setShowRequestModal(false);
                                    setSelectedRideId(null);
                                    setRequestData({ phoneNumber: '', pickupLocation: '' });
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-primary"
                                onClick={submitRequest}
                                disabled={loadingRide === selectedRideId}
                            >
                                {loadingRide === selectedRideId ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Trip Modal */}
            {showCancelModal && (
                <div className="modal-overlay open">
                    <div className="modal">
                        <h2>Cancel Trip</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Please provide a reason for cancelling this trip. The driver will be notified immediately.
                        </p>

                        <div className="form-group">
                            <label className="form-label">Reason for Cancellation *</label>
                            <textarea
                                className="form-control"
                                placeholder="Tell us why you're cancelling..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                style={{ minHeight: '120px', resize: 'vertical' }}
                                required
                            />
                        </div>

                        <div className="flex-center" style={{ gap: '1rem', marginTop: '2rem' }}>
                            <button 
                                type="button" 
                                className="btn btn-outline"
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelingForRide(null);
                                    setCancelReason('');
                                }}
                            >
                                Keep Trip
                            </button>
                            <button 
                                type="button" 
                                className="btn"
                                style={{ background: '#E53E3E', color: 'white' }}
                                onClick={() => handleCancelTrip(cancelingForRide)}
                                disabled={cancellingRideId === cancelingForRide}
                            >
                                {cancellingRideId === cancelingForRide ? 'Cancelling...' : 'Confirm Cancellation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Driver Modal */}
            {showReportModal && (
                <div className="modal-overlay open">
                    <div className="modal">
                        <h2>Report Driver</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Help us improve our service by reporting any issues with your driver. Admin will review your report.
                        </p>

                        <form onSubmit={handleReportDriver}>
                            <div className="form-group">
                                <label className="form-label">Reason *</label>
                                <select
                                    className="form-control"
                                    value={reportData.reason}
                                    onChange={(e) => setReportData(prev => ({ ...prev, reason: e.target.value }))}
                                    required
                                >
                                    <option value="">Select a reason...</option>
                                    <option value="rude_behavior">Rude Behavior</option>
                                    <option value="unsafe_driving">Unsafe Driving</option>
                                    <option value="wrong_route">Wrong Route</option>
                                    <option value="overcharging">Overcharging</option>
                                    <option value="vehicle_condition">Poor Vehicle Condition</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Details *</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Please describe what happened..."
                                    value={reportData.description}
                                    onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                                    style={{ minHeight: '120px', resize: 'vertical' }}
                                    required
                                />
                            </div>

                            <div className="flex-center" style={{ gap: '1rem', marginTop: '2rem' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-outline"
                                    onClick={() => {
                                        setShowReportModal(false);
                                        setReportingRideId(null);
                                        setReportData({ reason: '', description: '' });
                                    }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary"
                                >
                                    Submit Report
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PassengerDashboard;
