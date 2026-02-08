import { service } from './service.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const user = service.getCurrentUser();
    if (user) {
        window.location.href = 'dashboard.html';
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = loginForm.querySelector('button');
            const originalText = btn.innerText;

            try {
                btn.innerText = 'Logging in...';
                btn.disabled = true;
                await service.login(email, password);
                window.location.href = 'dashboard.html';
            } catch (error) {
                alert(error.message);
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }

    // Register Form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const name = document.getElementById('reg-name').value;
            const role = document.getElementById('register-role').value;
            const btn = registerForm.querySelector('button');
            const originalText = btn.innerText;

            try {
                btn.innerText = 'Creating Account...';
                btn.disabled = true;
                await service.register(email, password, name, role);
                alert('Account created! Please log in.');
                // Switch to login view
                window.toggleAuth('login');
            } catch (error) {
                alert(error.message);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});
