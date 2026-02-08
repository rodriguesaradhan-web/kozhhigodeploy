import { service } from './service.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = service.getCurrentUser();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('user-greeting').textContent = `Hello, ${currentUser.name} (${currentUser.role})`;

    // Setup Navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const tab = e.currentTarget.dataset.tab;
            if (tab) loadTab(tab);
        });
    });

    // Initial Load
    loadTab('home');

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        service.logout();
    });

    // Create Ride Form (Driver)
    const createRideForm = document.getElementById('create-ride-form');
    if (createRideForm) {
        createRideForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(createRideForm);
            const rideData = {
                from: formData.get('from'),
                to: formData.get('to'),
                date: formData.get('date'),
                time: formData.get('time'),
                seats: formData.get('seats')
            };

            try {
                await service.createRide(rideData);
                window.closeModal('create-ride-modal');
                alert('Ride posted successfully!');
                loadTab('home'); // Refresh
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // OTP Input Logic
    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach((input, index) => {
        input.addEventListener('keyup', (e) => {
            if (e.key >= 0 && e.key <= 9) {
                if (index < inputs.length - 1) inputs[index + 1].focus();
            } else if (e.key === 'Backspace') {
                if (index > 0) inputs[index - 1].focus();
            }
        });
    });

    // Verify OTP Logic
    const verifyBtn = document.getElementById('verify-otp-btn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const inputs = Array.from(document.querySelectorAll('.otp-input'));
            const otp = inputs.map(i => i.value).join('');

            if (otp.length !== 4) return alert('Enter 4-digit OTP');

            try {
                const valid = await service.verifyOtp(window.currentRideId, otp);
                if (valid) {
                    alert('OTP Verified! Ride Started.');
                    window.closeModal('otp-modal');
                    loadTab('home');
                } else {
                    alert('Invalid OTP');
                    inputs.forEach(i => i.value = '');
                }
            } catch (e) { alert(e.message); }
        });
    }
});

async function loadTab(tab) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div class="text-center" style="margin-top: 4rem;"><h2>Loading...</h2></div>';

    if (tab === 'home') {
        if (currentUser.role === 'driver') {
            renderDriverHome(mainContent);
        } else {
            renderPassengerHome(mainContent);
        }
    } else if (tab === 'my-rides') {
        renderMyRides(mainContent);
    } else if (tab === 'requests') {
        renderRequests(mainContent);
    }
}

// --- RENDER FUNCTIONS ---

async function renderDriverHome(container) {
    const rides = await service.getRides({ driverId: currentUser.uid });
    const activeRides = rides.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');

    let html = `
        <div class="flex-center" style="justify-content: space-between; margin-bottom: 2rem;">
            <h1>Dashboard</h1>
            <button class="btn btn-primary" onclick="window.openModal('create-ride-modal')">
                <span>➕</span> Post a Ride
            </button>
        </div>
        
        <h3>Your Active Rides</h3>
        <div class="ride-list">
    `;

    if (activeRides.length === 0) {
        html += `<p class="text-center" style="margin-top: 2rem; width: 100%;">No active rides. Post one now!</p>`;
    } else {
        html += activeRides.map(ride => createRideCard(ride)).join('');
    }

    html += `</div>`;
    container.innerHTML = html;
    attachRideActions();
}

async function renderPassengerHome(container) {
    // Passenger sees all available pending rides
    const rides = await service.getRides({ search: true });

    let html = `
        <div style="margin-bottom: 2rem;">
            <h1>Find a Ride</h1>
            <div class="card" style="margin-top: 1rem; padding: 1rem; display: flex; gap: 1rem;">
                <input type="text" class="form-control" placeholder="Where do you want to go?" id="search-dest">
                <button class="btn btn-primary" onclick="window.filterRides()">Search</button>
            </div>
        </div>
        
        <h3>Available Rides</h3>
        <div class="ride-list" id="passenger-ride-list">
    `;

    if (rides.length === 0) {
        html += `<p class="text-center" style="margin-top: 2rem; width: 100%;">No rides available right now.</p>`;
    } else {
        html += rides.map(ride => createRideCard(ride)).join('');
    }

    html += `</div>`;
    container.innerHTML = html;

    // Attach simple filter logic
    window.filterRides = () => {
        const query = document.getElementById('search-dest').value.toLowerCase();
        const cards = document.querySelectorAll('.ride-card');
        cards.forEach(card => {
            const text = card.innerText.toLowerCase();
            card.style.display = text.includes(query) ? 'block' : 'none';
        });
    };

    attachRideActions();
}

async function renderMyRides(container) {
    // For both: show history
    let rides;
    if (currentUser.role === 'driver') {
        rides = await service.getRides({ driverId: currentUser.uid });
    } else {
        // Passengers rely on finding rides where they are in passengers list
        // Currently getRides doesn't support complex filtering, let's fetch all and filter client side for prototype
        const allRides = await service.getRides({});
        rides = allRides.filter(r => r.passengers.some(p => p.uid === currentUser.uid));
    }

    let html = `<h1>My Rides Journey</h1><div class="ride-list">`;
    if (rides.length === 0) html += `<p>No ride history found.</p>`;
    else html += rides.map(ride => createRideCard(ride)).join('');
    html += `</div>`;
    container.innerHTML = html;
    attachRideActions();
}

async function renderRequests(container) {
    if (currentUser.role !== 'driver') {
        container.innerHTML = `<h1>Requests</h1><p>Only drivers receive requests.</p>`;
        return;
    }

    const rides = await service.getRides({ driverId: currentUser.uid });
    // Aggregating pending requests
    const pendingRequests = [];
    rides.forEach(ride => {
        ride.passengers.forEach(p => {
            if (p.status === 'REQUESTED') {
                pendingRequests.push({ ...p, rideId: ride.id, rideFrom: ride.from, rideTo: ride.to });
            }
        });
    });

    let html = `<h1>Incoming Requests</h1><div class="ride-list" style="display: block;">`;

    if (pendingRequests.length === 0) {
        html += `<p>No pending requests.</p>`;
    } else {
        html += pendingRequests.map(req => `
            <div class="card" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${req.name}</strong> wants to join your ride<br>
                    <small>${req.rideFrom} ➔ ${req.rideTo}</small>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-success" style="background: var(--success); color: #fff;" 
                        onclick="handleRequest('${req.rideId}', '${req.uid}', 'ACCEPTED')">Accept</button>
                    <button class="btn btn-outline" style="border-color: var(--accent); color: var(--accent);" 
                        onclick="handleRequest('${req.rideId}', '${req.uid}', 'REJECTED')">Decline</button>
                </div>
            </div>
        `).join('');
    }
    html += `</div>`;
    container.innerHTML = html;

    window.handleRequest = async (rideId, uid, action) => {
        try {
            await service.respondToRequest(rideId, uid, action);
            alert(`Request ${action.toLowerCase()}`);
            loadTab('requests');
        } catch (e) { alert(e.message); }
    };
}

// --- HELPER COMPONENT ---

function createRideCard(ride) {
    const isDriver = currentUser.role === 'driver';
    const isPassengerInRide = ride.passengers.some(p => p.uid === currentUser.uid);
    const myStatus = isPassengerInRide ? ride.passengers.find(p => p.uid === currentUser.uid).status : null;

    let actionBtn = '';

    if (isDriver) {
        if (ride.status === 'Wait for OTP') {
            actionBtn = `<button class="btn btn-primary start-ride-btn" data-id="${ride.id}">Start Ride (Enter OTP)</button>`;
        } else if (ride.status === 'IN_PROGRESS') {
            actionBtn = `<button class="btn btn-success complete-ride-btn" data-id="${ride.id}">Complete Ride</button>`;
        } else {
            actionBtn = `<span class="badge badge-${ride.status.toLowerCase()}">${ride.status}</span>`;
        }
    } else {
        // Passenger View
        if (isPassengerInRide) {
            if (myStatus === 'ACCEPTED' && ride.status === 'Wait for OTP' && ride.otp) {
                actionBtn = `<div class="card" style="background: var(--primary); padding: 0.5rem; text-align: center;">
                                <strong>OTP: ${ride.otp}</strong><br><small>Show this to driver</small>
                              </div>`;
            } else {
                actionBtn = `<span class="badge badge-active">${myStatus}</span>`;
            }
        } else {
            if (ride.availableSeats > 0 && ride.status === 'PENDING') {
                actionBtn = `<button class="btn btn-outline request-ride-btn" data-id="${ride.id}">Request Ride</button>`;
            } else {
                actionBtn = `<span class="badge badge-completed">Full / Start</span>`;
            }
        }
    }

    return `
    <div class="ride-card">
        <div class="ride-header">
            <span class="badge badge-${ride.status === 'PENDING' ? 'pending' : 'active'}">${ride.status}</span>
            <small>${new Date(ride.date).toLocaleDateString()}</small>
        </div>
        <div class="ride-path">
            <span>📍 ${ride.from}</span> ➔ <span>🏫 ${ride.to}</span>
        </div>
        <div class="ride-details" style="margin-top: 1rem;">
            <span>🕒 ${ride.time}</span>
            <span>💺 ${ride.availableSeats} seats left</span>
            <span>👤 ${ride.driverName}</span>
        </div>
        <div style="margin-top: 1.5rem;">
            ${actionBtn}
        </div>
    </div>
    `;
}

function attachRideActions() {
    // Request Ride
    document.querySelectorAll('.request-ride-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const rideId = e.target.dataset.id;
            try {
                e.target.disabled = true;
                e.target.innerText = 'Requesting...';
                await service.requestRide(rideId);
                alert('Request sent!');
                loadTab('home');
            } catch (err) {
                alert(err.message);
                e.target.disabled = false;
            }
        });
    });

    // Start Ride (Driver)
    document.querySelectorAll('.start-ride-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rideId = e.target.dataset.id;
            window.currentRideId = rideId; // Store for modal
            window.openModal('otp-modal');
        });
    });

    // Complete Ride
    document.querySelectorAll('.complete-ride-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const rideId = e.target.dataset.id;
            if (confirm('End this ride?')) {
                await service.completeRide(rideId);
                loadTab('home');
            }
        });
    });

}


