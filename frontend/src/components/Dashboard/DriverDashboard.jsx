import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import { useToast } from '../../context/ToastContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DriverDashboard = ({ tab = 'home' }) => {
    const { toast, showConfirm } = useToast();
    const [rides, setRides] = useState([]);
    const [availableRides, setAvailableRides] = useState([]);
    const [myBookings, setMyBookings] = useState([]);
    const [loadingRide, setLoadingRide] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [expandedRide, setExpandedRide] = useState(null);
    const [respondingTo, setRespondingTo] = useState(null);
    const [startingRide, setStartingRide] = useState(null);
    const [arrivingRide, setArrivingRide] = useState(null);
    const [startingTrip, setStartingTrip] = useState(null);
    const [completingTrip, setCompletingTrip] = useState(null);
    
    // Warnings state
    const [warnings, setWarnings] = useState([]);
    const [dismissedWarnings, setDismissedWarnings] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('dismissedWarnings') || '[]');
        } catch { return []; }
    });
    
    // Request modal state
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedRideId, setSelectedRideId] = useState(null);
    const [requestData, setRequestData] = useState({
        phoneNumber: '',
        pickupLocation: ''
    });
    const [formData, setFormData] = useState({
        from: '',
        to: 'College Campus',
        time: '',
        seats: 1,
        distance: null,
        duration: null,
        phoneNumber: ''
    });
    const [fromCoord, setFromCoord] = useState(null);
    const [toCoord, setToCoord] = useState(null);
    const [routeGeo, setRouteGeo] = useState(null);
    const mapRef = useRef(null);
    const markersRef = useRef({ from: null, to: null });
    const routeLayerRef = useRef(null);
    const passengerMapRefs = useRef({});

    const fetchRides = async () => {
        try {
            const res = await api.get('/rides');
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            if (!user || !user.id) {
                setRides([]);
                setAvailableRides([]);
                setMyBookings([]);
                return;
            }
            
            // Filter my rides as a driver
            const myRides = res.data.filter(r => {
                const driverId = r.driver?._id || r.driver;
                return driverId && driverId.toString() === user.id.toString();
            });
            setRides(myRides);

            // Filter rides where I'm a passenger (bookings)
            const userBookings = res.data.filter(ride => {
                return ride.passengers?.some(p => {
                    const passengerId = typeof p.user === 'object' ? p.user?._id : p.user;
                    return passengerId?.toString() === user?.id?.toString();
                });
            });
            setMyBookings(userBookings);

            // Filter available rides to request (as passenger)
            const available = res.data.filter(ride => {
                // Exclude own driver rides
                const driverId = ride.driver?._id || ride.driver;
                if (driverId?.toString() === user.id.toString()) return false;
                
                // Only show PENDING or IN_PROGRESS
                if (!['PENDING', 'IN_PROGRESS'].includes(ride.status)) return false;
                
                // Filter out rides with accepted passengers
                if (ride.passengers?.some(p => p.status === 'ACCEPTED')) return false;
                
                // Filter out rides already requested
                if (ride.passengers?.some(p => {
                    const passengerId = typeof p.user === 'object' ? p.user?._id : p.user;
                    return passengerId?.toString() === user?.id?.toString();
                })) return false;
                
                return true;
            });
            setAvailableRides(available);
        } catch (error) {
            console.error('Error fetching rides:', error);
        }
    };

    const fetchWarnings = async () => {
        try {
            const res = await api.get('/auth/my-warnings');
            setWarnings(res.data.warnings || []);
        } catch (error) {
            console.error('Error fetching warnings:', error);
        }
    };

    const dismissWarning = (warningId) => {
        const updated = [...dismissedWarnings, warningId];
        setDismissedWarnings(updated);
        localStorage.setItem('dismissedWarnings', JSON.stringify(updated));
    };

    const activeWarnings = warnings.filter(w => !dismissedWarnings.includes(w._id));

    useEffect(() => {
        fetchRides();
        fetchWarnings();
        // Auto-refresh to see new passenger requests
        const interval = setInterval(fetchRides, 10000);
        return () => clearInterval(interval);
    }, []);

    // Cleanup passenger maps when tab changes or ride is collapsed
    useEffect(() => {
        // Clean up all existing maps when tab changes
        Object.keys(passengerMapRefs.current).forEach(key => {
            if (passengerMapRefs.current[key]) {
                passengerMapRefs.current[key].remove();
            }
        });
        passengerMapRefs.current = {};
        
        return () => {
            Object.keys(passengerMapRefs.current).forEach(key => {
                if (passengerMapRefs.current[key]) {
                    passengerMapRefs.current[key].remove();
                }
            });
            passengerMapRefs.current = {};
        };
    }, [tab, expandedRide]);

    // Reset expanded ride when tab changes
    useEffect(() => {
        setExpandedRide(null);
    }, [tab]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Check if driver has any active rides (not completed or cancelled)
        const hasActiveRide = rides.some(r => !['COMPLETED', 'CANCELLED'].includes(r.status));
        if (hasActiveRide) {
            toast.warning('You have an active ride in progress. Please complete it before posting a new ride.');
            return;
        }
        
        // Validate all required fields
        if (!formData.from || !formData.to || !formData.time || !formData.phoneNumber) {
            toast.warning('Please fill in all fields (From, To, Time, and Phone Number)');
            return;
        }
        
        if (!fromCoord || !toCoord) {
            toast.warning('Please set both From and To locations on the map');
            return;
        }
        
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.id) {
                toast.error('You must be logged in to post a ride');
                return;
            }
            
            const payload = {
                ...formData,
                driverId: user.id,
                fromCoord,
                toCoord,
                seats: 1, // Two-wheeler: always 1 seat for passenger
                date: new Date()
            };
            await api.post('/rides', payload);
            setShowModal(false);
            setFormData({ from: '', to: 'College Campus', time: '', seats: 1, distance: null, duration: null, phoneNumber: '' });
            setFromCoord(null);
            setToCoord(null);
            setRouteGeo(null);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            fetchRides();
            toast.success('Ride posted!');
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Error posting ride';
            console.error('Error posting ride:', errorMsg, error);
            toast.error(errorMsg);
        }
    };

    const initMap = () => {
        if (mapRef.current) return;
        // Ensure the map container exists in DOM (modal may not be mounted yet)
        const el = document.getElementById('map');
        if (!el) return;
        mapRef.current = L.map(el, { center: [12.97, 77.59], zoom: 13, scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapRef.current);
    };

    // Initialize the map when modal opens (DOM element becomes available)
    useEffect(() => {
        if (showModal) {
            // small delay to ensure modal DOM is mounted
            const t = setTimeout(() => initMap(), 50);
            return () => clearTimeout(t);
        }
    }, [showModal]);

    const setCurrentLocation = async () => {
        if (!navigator.geolocation) return toast.error('Geolocation not supported');
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setFromCoord({ lat, lng });
            
            // Reverse geocode to get location name
            try {
                const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
                const response = await fetch(url, { headers: { 'User-Agent': 'student-ride-share' } });
                const data = await response.json();
                const locationName = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                setFormData(f => ({ ...f, from: locationName }));
            } catch (err) {
                console.error('Reverse geocoding error:', err);
                setFormData(f => ({ ...f, from: 'Current location' }));
            }
            
            if (!mapRef.current) initMap();
            if (markersRef.current.from) markersRef.current.from.remove();
            markersRef.current.from = L.marker([lat, lng]).addTo(mapRef.current).bindPopup('From (you)');
            mapRef.current.setView([lat, lng], 13);
        }, err => {
            console.error('Geolocation error:', err);
            toast.error(`Unable to get location: ${err.message}`);
        });
    };

    const geocode = async (query) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'student-ride-share' } });
        const data = await res.json();
        if (!data || data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
    };

    const findDestination = async () => {
        const q = formData.to || 'College Campus';
        const dest = await geocode(q);
        if (!dest) return toast.error('Destination not found');
        setToCoord({ lat: dest.lat, lng: dest.lng });
        setFormData(f => ({ ...f, to: dest.display_name }));
        if (!mapRef.current) initMap();
        if (markersRef.current.to) markersRef.current.to.remove();
        markersRef.current.to = L.marker([dest.lat, dest.lng]).addTo(mapRef.current).bindPopup('To (destination)');
        mapRef.current.setView([dest.lat, dest.lng], 13);
        if (fromCoord) await computeRoute();
    };

    const computeRoute = async () => {
        if (!fromCoord || !toCoord) return;
        const url = `https://router.project-osrm.org/route/v1/driving/${fromCoord.lng},${fromCoord.lat};${toCoord.lng},${toCoord.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data || !data.routes || data.routes.length === 0) return toast.error('No route found');
        const route = data.routes[0];
        setRouteGeo(route.geometry);
        setFormData(f => ({ ...f, distance: route.distance, duration: route.duration }));
        if (!mapRef.current) initMap();
        if (routeLayerRef.current && routeLayerRef.current.remove) {
            try { routeLayerRef.current.remove(); } catch (e) { /* ignore remove errors */ }
        }
        routeLayerRef.current = L.geoJSON(route.geometry, { style: { color: '#0074D9', weight: 4 } }).addTo(mapRef.current);
        const bounds = routeLayerRef.current.getBounds();
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    };

    const handlePassengerResponse = async (rideId, passengerId, action) => {
        try {
            setRespondingTo(`${rideId}-${passengerId}`);
            const res = await api.put(`/rides/${rideId}/response`, {
                passengerId,
                action
            });
            // Refresh rides from server to get canonical state (other requests will be rejected if one accepted)
            await fetchRides();
            toast.success(`Ride request ${action.toLowerCase()}!`);
        } catch (error) {
            const errorMsg = error.response?.data?.message || `Error ${action.toLowerCase()} request`;
            console.error('Response error:', errorMsg, error);
            toast.error(errorMsg);
        } finally {
            setRespondingTo(null);
        }
    };

    const handleRequest = (rideId) => {
        setSelectedRideId(rideId);
        setShowRequestModal(true);
        setRequestData({ phoneNumber: '', pickupLocation: '' });
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
                    const response = await fetch(url, { headers: { 'User-Agent': 'student-ride-share' } });
                    const data = await response.json();
                    setRequestData(prev => ({
                        ...prev,
                        pickupLocation: data.display_name || `${latitude}, ${longitude}`
                    }));
                } catch (err) {
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
                toast.error('You must be logged in to request a ride');
                return;
            }

            await api.post(`/rides/${selectedRideId}/request`, {
                passengerId: user.id,
                phoneNumber: requestData.phoneNumber,
                pickupLocation: requestData.pickupLocation
            });
            
            toast.success('Ride requested successfully!');
            setShowRequestModal(false);
            setSelectedRideId(null);
            setRequestData({ phoneNumber: '', pickupLocation: '' });
            await fetchRides();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Error requesting ride';
            console.error('Request error:', errorMsg, error);
            toast.error(errorMsg);
        } finally {
            setLoadingRide(null);
        }
    };

    const handleStartRide = (rideId) => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setStartingRide(rideId);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await api.post(`/rides/${rideId}/start`, {
                        driverLatitude: latitude,
                        driverLongitude: longitude
                    });

                    toast.success(`Ride started! ETA to passenger: ${Math.ceil(response.data.eta / 60)} minutes`);
                    await fetchRides();
                } catch (error) {
                    const errorMsg = error.response?.data?.message || 'Error starting ride';
                    toast.error(errorMsg);
                } finally {
                    setStartingRide(null);
                }
            },
            (error) => {
                toast.error('Unable to get your location: ' + error.message);
                setStartingRide(null);
            }
        );
    };

    const handleArrived = async (rideId) => {
        const confirmed = await showConfirm('Have you reached the passenger pickup location?');
        if (!confirmed) return;

        try {
            setArrivingRide(rideId);
            const response = await api.post(`/rides/${rideId}/arrived`);
            const distanceMsg = response.data.distanceKm 
                ? ` Distance traveled: ${response.data.distanceKm} km` 
                : '';
            toast.success(`Passenger has been notified that you have arrived!${distanceMsg}`);
            await fetchRides();
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Error marking arrival';
            toast.error(errorMsg);
        } finally {
            setArrivingRide(null);
        }
    };

    const handleStartTrip = async (rideId) => {
        const confirmed = await showConfirm('Start the trip to destination with the passenger?');
        if (!confirmed) return;

        try {
            setStartingTrip(rideId);
            const response = await api.post(`/rides/${rideId}/start-trip`);
            const distanceMsg = response.data.tripDistanceKm
                ? ` Trip distance: ${response.data.tripDistanceKm} km`
                : '';
            toast.success(`Trip to destination started!${distanceMsg}`);
            await fetchRides();
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Error starting trip';
            toast.error(errorMsg);
        } finally {
            setStartingTrip(null);
        }
    };

    const handleCompleteTrip = async (rideId) => {
        const confirmed = await showConfirm('Mark destination reached?');
        if (!confirmed) return;

        try {
            setCompletingTrip(rideId);
            const response = await api.post(`/rides/${rideId}/complete`);
            const distanceMsg = response.data.tripDistanceKm
                ? ` Trip distance: ${response.data.tripDistanceKm} km`
                : '';
            const priceMsg = response.data.price
                ? ` Total Fare: ₹${response.data.price}`
                : '';
            toast.success(`Destination reached!${distanceMsg}${priceMsg}`);
            await fetchRides();
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Error completing trip';
            toast.error(errorMsg);
        } finally {
            setCompletingTrip(null);
        }
    };

    const initPassengerMap = (elementId, pickupLocation) => {
        // Check if map already exists
        if (passengerMapRefs.current[elementId]) return;
        
        setTimeout(() => {
            const mapElement = document.getElementById(elementId);
            if (!mapElement || passengerMapRefs.current[elementId]) return;

            // Parse location - could be "lat,lng" or address
            const parts = pickupLocation.split(',');
            let lat, lng;

            if (parts.length >= 2) {
                const parsedLat = parseFloat(parts[0].trim());
                const parsedLng = parseFloat(parts[1].trim());
                
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                    // It's coordinates
                    lat = parsedLat;
                    lng = parsedLng;
                } else {
                    // It's an address, geocode it
                    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupLocation)}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data && data.length > 0) {
                                const location = data[0];
                                initMapWithCoords(elementId, parseFloat(location.lat), parseFloat(location.lon));
                            }
                        })
                        .catch(err => console.error('Geocoding error:', err));
                    return;
                }
            } else {
                // Single address string, geocode it
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupLocation)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            const location = data[0];
                            initMapWithCoords(elementId, parseFloat(location.lat), parseFloat(location.lon));
                        }
                    })
                    .catch(err => console.error('Geocoding error:', err));
                return;
            }

            initMapWithCoords(elementId, lat, lng);
        }, 100);
    };

    const initMapWithCoords = (elementId, lat, lng) => {
        const mapElement = document.getElementById(elementId);
        if (!mapElement || passengerMapRefs.current[elementId]) return;

        if (!navigator.geolocation) {
            // No geolocation, just show passenger location
            const map = L.map(elementId).setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">P</div>',
                    iconSize: [30, 30]
                })
            }).addTo(map).bindPopup('Passenger Pickup Location');

            passengerMapRefs.current[elementId] = map;
            return;
        }

        // Get driver's current location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const driverLat = position.coords.latitude;
                const driverLng = position.coords.longitude;

                // Create map centered between driver and passenger
                const centerLat = (driverLat + lat) / 2;
                const centerLng = (driverLng + lng) / 2;
                
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
                }).addTo(map).bindPopup('Your Location');

                // Add passenger marker (red)
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">P</div>',
                        iconSize: [30, 30]
                    })
                }).addTo(map).bindPopup('Passenger Pickup Location');

                // Draw route line
                const routeLine = L.polyline([[driverLat, driverLng], [lat, lng]], {
                    color: '#3498db',
                    weight: 4,
                    opacity: 0.7,
                    dashArray: '10, 10'
                }).addTo(map);

                // Fit bounds to show both markers
                map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

                passengerMapRefs.current[elementId] = map;
            },
            (error) => {
                console.error('Geolocation error:', error);
                // Fallback: show only passenger location
                const map = L.map(elementId).setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">P</div>',
                        iconSize: [30, 30]
                    })
                }).addTo(map).bindPopup('Passenger Pickup Location');

                passengerMapRefs.current[elementId] = map;
            }
        );
    };

    return (
        <div>
            {/* Warning Alerts */}
            {tab === 'home' && activeWarnings.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                    {activeWarnings.map(warning => (
                        <div key={warning._id} style={{
                            padding: '1rem 1.25rem',
                            background: '#fff3e0',
                            border: '2px solid #ff9800',
                            borderRadius: '0.5rem',
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '1rem'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, color: '#e65100', fontSize: '1rem', marginBottom: '0.25rem' }}>
                                    Warning from Admin
                                </div>
                                <div style={{ color: '#bf360c', fontSize: '0.95rem' }}>
                                    {warning.reason}
                                </div>
                                <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                    Issued: {new Date(warning.issuedAt).toLocaleString()}
                                </div>
                            </div>
                            <button
                                onClick={() => dismissWarning(warning._id)}
                                style={{
                                    background: 'none',
                                    border: '1px solid #e65100',
                                    color: '#e65100',
                                    borderRadius: '0.25rem',
                                    padding: '0.25rem 0.75rem',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Dismiss
                            </button>
                        </div>
                    ))}
                    {warnings.length >= 3 && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: '#ffebee',
                            border: '2px solid #f44336',
                            borderRadius: '0.5rem',
                            color: '#c62828',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            You have {warnings.length} warning(s) on your account. Further violations may result in account suspension.
                        </div>
                    )}
                </div>
            )}

            {/* Welcome Section */}
            {tab === 'home' && (
                <div className="welcome-card">
                    <div className="welcome-card-content">
                        <h3>Welcome, Driver!</h3>
                        <p>Share your rides and earn. Help students get to campus safely.</p>
                    </div>
                </div>
            )}

            {/* Tab-based Header */}
            <div className="flex-center" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0 }}>
                        {tab === 'home' && 'Driver Dashboard'}
                        {tab === 'requests' && 'Passenger Requests'}
                        {tab === 'my-rides' && 'Posted Rides'}
                    </h1>
                </div>
                {tab === 'home' && (
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setShowModal(true)}
                        disabled={rides.some(r => !['COMPLETED', 'CANCELLED'].includes(r.status))}
                    >
                        Post a Ride
                    </button>
                )}
            </div>

            {/* Stats Section */}
            {tab === 'home' && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-number">{rides.length}</div>
                        <div className="stat-label">Total Rides</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{rides.filter(r => !['COMPLETED', 'CANCELLED'].includes(r.status)).length}</div>
                        <div className="stat-label">Active Rides</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{rides.filter(r => r.passengers?.length > 0).length}</div>
                        <div className="stat-label">With Passengers</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">₹{rides.reduce((sum, r) => sum + (r.price || 0), 0)}</div>
                        <div className="stat-label">Total Earnings</div>
                    </div>
                </div>
            )}

            {/* Status Alerts */}
            {tab === 'home' && (
                <>
                    {rides.some(r => !['COMPLETED', 'CANCELLED'].includes(r.status)) && (
                        <div style={{ marginBottom: '2rem', padding: '1.2rem', background: 'rgba(255, 152, 0, 0.15)', borderRadius: 'var(--radius-md)', border: '2px solid #ff9800', color: '#e65100' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Ride In Progress</div>
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>You have an active ride. Please complete it before posting a new ride.</p>
                        </div>
                    )}
                </>
            )}

            {/* Dashboard Sections */}
            {(tab === 'home' || tab === 'requests' || tab === 'my-rides') && (
                <div className="dashboard-section">
                    <div className="section-header">
                        <div className="section-icon">{tab === 'requests' ? '' : tab === 'my-rides' ? '' : ''}</div>
                        <h2>{tab === 'requests' ? 'Passenger Requests' : tab === 'my-rides' ? 'My Posted Rides' : 'Your Active Rides'}</h2>
                    </div>
                    <div className="ride-list">
                        {rides.length === 0 ? (
                            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                                <div className="empty-state-icon"></div>
                                <h3>{tab === 'requests' ? 'No Pending Requests' : tab === 'my-rides' ? 'No Posted Rides' : 'No Active Rides'}</h3>
                                <p>
                                    {tab === 'requests' && 'Check back when passengers request to join your rides'}
                                    {tab === 'my-rides' && 'Post a new ride to get started'}
                                    {tab === 'home' && 'No active rides at the moment'}
                                </p>
                                {tab === 'my-rides' && (
                                    <button className="btn btn-primary">
                                        Post a Ride
                                    </button>
                                )}
                            </div>
                        ) : (
                            rides.map(ride => {
                                // On requests tab, only show rides with pending requests
                                if (tab === 'requests' && !ride.passengers?.some(p => p.status === 'REQUESTED')) {
                                    return null;
                                }
                                return (
                                    <div key={ride._id}>
                                        <div className="ride-card">
                                            <div className="ride-header">
                                                <span className={`badge badge-${(ride.status || '').toLowerCase()}`}>{ride.status || 'N/A'}</span>
                                                <small>{ride.date ? new Date(ride.date).toLocaleDateString() : 'N/A'}</small>
                                            </div>
                                            <div className="ride-path">
                                                <span>{ride.from}</span> → <span>{ride.to}</span>
                                            </div>
                                            <div className="ride-details" style={{ marginTop: '1rem' }}>
                                                <span>{ride.time}</span>
                                                <span>Two-wheeler</span>
                                            </div>
                                            {(tab === 'requests' || tab === 'home') && (
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ marginTop: '1rem', width: '100%' }}
                                                    onClick={() => setExpandedRide(expandedRide === ride._id ? null : ride._id)}
                                                >
                                                    {expandedRide === ride._id ? 'Hide Requests' : 'View Requests'} ({ride.passengers?.filter(p => p.status === 'REQUESTED').length || 0})
                                                </button>
                                            )}
                                        </div>
                            {expandedRide === ride._id && (
                                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0 0 var(--radius-md) var(--radius-md)', border: '1px solid var(--glass-border)', borderTop: 'none', marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '1rem' }}>Passenger Requests</h4>
                                    {ride.passengers?.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)' }}>No requests yet.</p>
                                    ) : (
                                        ride.passengers.map(passenger => {
                                            // Safely get passenger ID - use user._id since passengers is an array of objects with user ref
                                            const passengerId = passenger.user?._id || passenger.user || passenger._id;
                                            return (
                                            <div key={passengerId} style={{ display: 'block', padding: '1rem', background: 'rgba(108,93,211,0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }}>
                                                <div style={{ marginBottom: '0.75rem' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{passenger.user?.name || 'Passenger'}</span>
                                                    <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                        Status: <span style={{ textTransform: 'capitalize', color: passenger.status === 'REQUESTED' ? 'var(--secondary)' : passenger.status === 'ACCEPTED' ? 'var(--success)' : 'var(--accent)' }}>{passenger.status}</span>
                                                    </span>
                                                </div>
                                                {passenger.phoneNumber && (
                                                    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                                        <strong>Phone:</strong> {passenger.phoneNumber}
                                                    </div>
                                                )}
                                                {passenger.pickupLocation && (
                                                    <>
                                                        <div style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                                            <strong>Pickup:</strong> {passenger.pickupLocation}
                                                        </div>
                                                        {passenger.status === 'ACCEPTED' && (
                                                            <div 
                                                                id={`map-${ride._id}-${passengerId}`} 
                                                                style={{ 
                                                                    height: '250px', 
                                                                    width: '100%', 
                                                                    borderRadius: '0.5rem', 
                                                                    marginBottom: '1rem',
                                                                    border: '2px solid #ddd'
                                                                }}
                                                                ref={() => initPassengerMap(`map-${ride._id}-${passengerId}`, passenger.pickupLocation)}
                                                            ></div>
                                                        )}
                                                    </>
                                                )}
                                                {passenger.status === 'REQUESTED' && (
                                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                                        <button
                                                            className="btn btn-primary"
                                                            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 600, flex: 1 }}
                                                            onClick={() => handlePassengerResponse(ride._id, passengerId, 'ACCEPTED')}
                                                            disabled={respondingTo === `${ride._id}-${passengerId}`}
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            className="btn btn-outline"
                                                            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 600, flex: 1 }}
                                                            onClick={() => handlePassengerResponse(ride._id, passengerId, 'REJECTED')}
                                                            disabled={respondingTo === `${ride._id}-${passengerId}`}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {passenger.status === 'ACCEPTED' && ride.status === 'PENDING' && (
                                                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)' }}>
                                                        <button
                                                            style={{ 
                                                                width: '100%', 
                                                                border: 'none',
                                                                background: 'transparent',
                                                                color: 'white',
                                                                padding: '0.75rem 1.5rem',
                                                                fontSize: '1.05rem',
                                                                fontWeight: 700,
                                                                cursor: startingRide === ride._id ? 'not-allowed' : 'pointer',
                                                                opacity: startingRide === ride._id ? 0.8 : 1,
                                                                transition: 'all 0.3s ease'
                                                            }}
                                                            onClick={() => handleStartRide(ride._id)}
                                                            disabled={startingRide === ride._id}
                                                        >
                                                            {startingRide === ride._id ? 'Starting ride...' : 'START RIDE'}
                                                        </button>
                                                    </div>
                                                )}
                                                {passenger.status === 'ACCEPTED' && ride.status === 'STARTED' && (
                                                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)' }}>
                                                        <button
                                                            style={{ 
                                                                width: '100%', 
                                                                border: 'none',
                                                                background: 'transparent',
                                                                color: 'white',
                                                                padding: '0.75rem 1.5rem',
                                                                fontSize: '1.05rem',
                                                                fontWeight: 700,
                                                                cursor: arrivingRide === ride._id ? 'not-allowed' : 'pointer',
                                                                opacity: arrivingRide === ride._id ? 0.8 : 1,
                                                                transition: 'all 0.3s ease'
                                                            }}
                                                            onClick={() => handleArrived(ride._id)}
                                                            disabled={arrivingRide === ride._id}
                                                        >
                                                            {arrivingRide === ride._id ? 'Notifying...' : 'REACHED PASSENGER'}
                                                        </button>
                                                    </div>
                                                )}
                                                {passenger.status === 'ACCEPTED' && passenger.eta && ride.status === 'STARTED' && (
                                                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#e3f2fd', borderRadius: '0.5rem', border: '2px solid #1976d2', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ETA to Passenger</div>
                                                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1976d2' }}>{Math.ceil(passenger.eta / 60)} min</div>
                                                    </div>
                                                )}
                                                {ride.status === 'ARRIVED' && passenger.status === 'ACCEPTED' && (
                                                    <>
                                                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#4CAF50', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Arrival Confirmed</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'white', opacity: 0.9, marginTop: '0.25rem' }}>Passenger has been notified</div>
                                                            {passenger.distanceToPickup && (
                                                                <div style={{ fontSize: '0.95rem', color: 'white', fontWeight: 600, marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.2)', borderRadius: '0.25rem' }}>
                                                                    Distance to pickup: {(passenger.distanceToPickup / 1000).toFixed(2)} km
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'linear-gradient(135deg, #3F51B5 0%, #303F9F 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(63, 81, 181, 0.3)' }}>
                                                            <button
                                                                style={{
                                                                    width: '100%',
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    color: 'white',
                                                                    padding: '0.75rem 1.5rem',
                                                                    fontSize: '1.05rem',
                                                                    fontWeight: 700,
                                                                    cursor: startingTrip === ride._id ? 'not-allowed' : 'pointer',
                                                                    opacity: startingTrip === ride._id ? 0.8 : 1,
                                                                    transition: 'all 0.3s ease'
                                                                }}
                                                                onClick={() => handleStartTrip(ride._id)}
                                                                disabled={startingTrip === ride._id}
                                                            >
                                                                {startingTrip === ride._id ? 'Starting trip...' : 'START TO DESTINATION'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                                {ride.status === 'IN_PROGRESS' && passenger.status === 'ACCEPTED' && (
                                                    <>
                                                        {ride.tripDistance && (
                                                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#e8f5e9', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                                <div style={{ fontSize: '0.85rem', color: '#2e7d32', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trip Distance</div>
                                                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2e7d32' }}>{(ride.tripDistance / 1000).toFixed(2)} km</div>
                                                            </div>
                                                        )}
                                                        <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'linear-gradient(135deg, #009688 0%, #00796B 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0, 150, 136, 0.3)' }}>
                                                            <button
                                                                style={{
                                                                    width: '100%',
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    color: 'white',
                                                                    padding: '0.75rem 1.5rem',
                                                                    fontSize: '1.05rem',
                                                                    fontWeight: 700,
                                                                    cursor: completingTrip === ride._id ? 'not-allowed' : 'pointer',
                                                                    opacity: completingTrip === ride._id ? 0.8 : 1,
                                                                    transition: 'all 0.3s ease'
                                                                }}
                                                                onClick={() => handleCompleteTrip(ride._id)}
                                                                disabled={completingTrip === ride._id}
                                                            >
                                                                {completingTrip === ride._id ? 'Finishing...' : 'REACHED DESTINATION'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                                {ride.status === 'COMPLETED' && passenger.status === 'ACCEPTED' && (
                                                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#2e7d32', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Destination Reached</div>
                                                        {ride.tripDistance && (
                                                            <div style={{ fontSize: '0.95rem', color: 'white', fontWeight: 600, marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.2)', borderRadius: '0.25rem' }}>
                                                                Trip distance: {(ride.tripDistance / 1000).toFixed(2)} km
                                                            </div>
                                                        )}
                                                        {ride.price && (
                                                            <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 700, marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255, 215, 0, 0.3)', borderRadius: '0.25rem' }}>
                                                                Total Fare: ₹{ride.price.toFixed(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                            })
                        )}
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay open">
                    <div className="modal">
                        <h2>Post a New Ride</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">From</label>
                                <div style={{ display: 'flex', gap: '.5rem' }}>
                                    <input type="text" className="form-control" value={formData.from} onChange={e => setFormData({ ...formData, from: e.target.value })} required />
                                    <button type="button" className="btn btn-outline" onClick={setCurrentLocation}>Use current</button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">To</label>
                                <div style={{ display: 'flex', gap: '.5rem' }}>
                                    <input type="text" className="form-control" value={formData.to} onChange={e => setFormData({ ...formData, to: e.target.value })} required />
                                    <button type="button" className="btn btn-outline" onClick={findDestination}>Find</button>
                                </div>
                            </div>
                            <div style={{ height: '300px', marginTop: '1rem' }}>
                                <div id="map" style={{ height: '100%', width: '100%' }} />
                            </div>
                            {formData.distance && (
                                <div style={{ marginTop: '.75rem' }}>
                                    <small>Distance: {(formData.distance/1000).toFixed(1)} km — ETA: {(formData.duration/60).toFixed(0)} mins</small>
                                </div>
                            )}
                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Time of Departure</label>
                                    <input type="time" className="form-control" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                                    <small style={{ color: 'var(--text-muted)' }}>Date is set to today; time can be updated later by the driver.</small>
                                </div>
                                <div>
                                    <label className="form-label">Phone Number</label>
                                    <input type="tel" className="form-control" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="Enter your phone number" required />
                                    <small style={{ color: 'var(--text-muted)' }}>Passengers will see this number when they request the ride.</small>
                                </div>
                            </div>

                            <div className="flex-center" style={{ gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Post Ride</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {tab === 'find-rides' && (
                <>
                    <h3>Find Rides (As Passenger)</h3>
                    <div className="ride-list">
                        {availableRides.length === 0 ? (
                            <p>No available rides to request.</p>
                        ) : (
                            availableRides.map(ride => (
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
                </>
            )}

            {tab === 'my-bookings' && (
                <>
                    <h3>My Bookings (As Passenger)</h3>
                    <div className="ride-list">
                        {myBookings.length === 0 ? (
                            <p>No bookings yet.</p>
                        ) : (
                            myBookings.map(ride => {
                                const user = JSON.parse(localStorage.getItem('user'));
                                const userPassenger = ride.passengers?.find(p => {
                                    const passengerId = typeof p.user === 'object' ? p.user?._id : p.user;
                                    return passengerId?.toString() === user?.id?.toString();
                                });
                                
                                if (!userPassenger) return null;
                                
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
                                </div>
                                );
                            })
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
        </div>
    );
};

export default DriverDashboard;
