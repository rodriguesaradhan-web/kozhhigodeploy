/**
 * Mock Service Layer mimicking Firebase functionality
 * Uses localStorage for persistence
 */

const STORAGE_KEYS = {
    USERS: 'campuspool_users',
    RIDES: 'campuspool_rides',
    CURRENT_USER: 'campuspool_current_user'
};

class MockService {
    constructor() {
        this.init();
    }

    init() {
        if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.RIDES)) {
            localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify([]));
        }
    }

    // --- Auth Service ---

    async register(email, password, name, role) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 800));

        const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS));
        if (users.find(u => u.email === email)) {
            throw new Error('Email already in use');
        }

        const newUser = {
            uid: 'user_' + Date.now(),
            email,
            password, // In real app, hash this!
            name,
            role,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        this.setCurrentUser(newUser);
        return newUser;
    }

    async login(email, password) {
        await new Promise(r => setTimeout(r, 600));

        const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS));
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            throw new Error('Invalid email or password');
        }

        this.setCurrentUser(user);
        return user;
    }

    logout() {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        window.location.href = 'index.html';
    }

    setCurrentUser(user) {
        // sensitive data should be removed in real app
        const safeUser = { ...user };
        delete safeUser.password;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(safeUser));
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    }

    // --- Ride Service ---

    async createRide(rideData) {
        await new Promise(r => setTimeout(r, 500));
        
        const rides = JSON.parse(localStorage.getItem(STORAGE_KEYS.RIDES));
        const user = this.getCurrentUser();
        
        const newRide = {
            id: 'ride_' + Date.now(),
            driverId: user.uid,
            driverName: user.name,
            from: rideData.from,
            to: rideData.to,
            date: rideData.date,
            time: rideData.time,
            seats: parseInt(rideData.seats),
            availableSeats: parseInt(rideData.seats),
            status: 'PENDING', // PENDING, ACTIVE, COMPLETED, CANCELLED
            passengers: [], // { uid, name, status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' }
            otp: null,
            createdAt: new Date().toISOString()
        };

        rides.push(newRide);
        localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(rides));
        return newRide;
    }

    async getRides(filter = {}) {
        await new Promise(r => setTimeout(r, 300));
        const rides = JSON.parse(localStorage.getItem(STORAGE_KEYS.RIDES));
        
        return rides.filter(ride => {
            let match = true;
            if (filter.driverId) match = match && ride.driverId === filter.driverId;
            if (filter.status) match = match && ride.status === filter.status;
            // Filter out full rides or past rides if searching
            if (filter.search) {
                // simple search logic
                match = match && ride.status === 'PENDING';
                if (filter.to) match = match && ride.to.toLowerCase().includes(filter.to.toLowerCase());
                if (filter.from) match = match && ride.from.toLowerCase().includes(filter.from.toLowerCase());
            }
            return match;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async requestRide(rideId) {
        await new Promise(r => setTimeout(r, 400));
        const user = this.getCurrentUser();
        const rides = JSON.parse(localStorage.getItem(STORAGE_KEYS.RIDES));
        const rideIndex = rides.findIndex(r => r.id === rideId);
        
        if (rideIndex === -1) throw new Error('Ride not found');
        
        const ride = rides[rideIndex];
        if (ride.passengers.find(p => p.uid === user.uid)) {
            throw new Error('Already requested');
        }

        ride.passengers.push({
            uid: user.uid,
            name: user.name,
            status: 'REQUESTED'
        });

        localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(rides));
        return ride;
    }

    async respondToRequest(rideId, passengerUid, action) {
        // action: 'ACCEPT' or 'REJECT'
        await new Promise(r => setTimeout(r, 400));
        const rides = JSON.parse(localStorage.getItem(STORAGE_KEYS.RIDES));
        const ride = rides.find(r => r.id === rideId);
        
        const passenger = ride.passengers.find(p => p.uid === passengerUid);
        if(!passenger) throw new Error('Passenger not found');

        passenger.status = action;

        if (action === 'ACCEPTED') {
            ride.availableSeats--;
            // Generate OTP if not exists
            if (!ride.otp) {
                ride.otp = Math.floor(1000 + Math.random() * 9000).toString();
                ride.status = 'Wait for OTP'; 
            }
        }

        localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(rides));
        return ride;
    }

    async verifyOtp(rideId, otpInput) {
        await new Promise(r => setTimeout(r, 500));
        const rides = JSON.parse(localStorage.getItem(STORAGE_KEYS.RIDES));
        const ride = rides.find(r => r.id === rideId);
        
        if (ride.otp === otpInput) {
            ride.status = 'IN_PROGRESS';
            localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(rides));
            return true;
        }
        return false;
    }

    async completeRide(rideId) {
        const rides = JSON.parse(localStorage.getItem(STORAGE_KEYS.RIDES));
        const ride = rides.find(r => r.id === rideId);
        ride.status = 'COMPLETED';
        localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(rides));
    }

    // --- Admin ---
    async getAllStats() {
        const rides = JSON.parse(localStorage.getItem(STORAGE_KEYS.RIDES));
        const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS));
        return {
            totalRides: rides.length,
            activeRides: rides.filter(r => r.status === 'IN_PROGRESS').length,
            totalUsers: users.length,
            users: users,
            rides: rides
        };
    }
}

export const service = new MockService();
