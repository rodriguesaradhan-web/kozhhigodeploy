import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  
  const calculateFare = (km) => Math.max(25, Math.ceil(km * 5));
  
  const [fares] = useState([
    { distance: '1-2 km', fare: `₹${calculateFare(2)}`, label: 'Minimum Fare' },
    { distance: '5 km', fare: `₹${calculateFare(5)}`, label: 'Short Trip' },
    { distance: '10 km', fare: `₹${calculateFare(10)}`, label: 'Medium Trip' },
    { distance: '20 km', fare: `₹${calculateFare(20)}`, label: 'Long Trip' }
  ]);

  return (
    <div className="landing-container">
      {/* Navigation Header */}
      <header className="landing-header">
        <div className="header-left">
          <img 
            src="/KozhGo-LOGO.png" 
            alt="KozhiGo" 
            className="header-logo"
          />
          <span className="header-brand">KozhiGo</span>
        </div>
        <nav className="header-nav">
          <button className="nav-btn nav-login" onClick={() => navigate('/login')}>
            Login
          </button>
          <button className="nav-btn nav-signup" onClick={() => navigate('/register')}>
            Sign Up
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="logo-section">
            <img 
              src="/KozhGo-LOGO.png" 
              alt="KozhiGo" 
              className="hero-logo"
            />
            <h1>KozhiGo</h1>
          </div>
          <p className="tagline">Ride Smart. Ride Fast.</p>
          <p className="subtitle">Your trusted campus ride-sharing platform</p>
          <p className="hero-description">
            KozhiGo is a modern, eco-friendly ride-sharing platform designed for students and commuters. 
            We connect drivers and passengers with transparent pricing, real-time tracking, and a focus on safety and affordability.
          </p>
        </div>
      </section>

      {/* Fare Information Section */}
      <section className="fares-section">
        <h2>Our Transparent Pricing</h2>
        <p className="section-subtitle">No hidden charges. Always fair pricing.</p>
        
        <div className="pricing-info">
          <div className="pricing-card highlighted">
            <div className="pricing-header">Base Rate</div>
            <div className="pricing-amount">₹25</div>
            <div className="pricing-detail">Minimum fare for any ride</div>
          </div>

          <div className="pricing-card">
            <div className="pricing-header">Per Kilometer</div>
            <div className="pricing-amount">₹5</div>
            <div className="pricing-detail">Additional charge per km</div>
          </div>
        </div>

        <div className="fare-examples">
          <h3>Fare Examples</h3>
          <div className="fares-grid">
            {fares.map((fare, index) => (
              <div key={index} className="fare-item">
                <div className="fare-distance">{fare.distance}</div>
                <div className="fare-value">{fare.fare}</div>
                <div className="fare-label">{fare.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pricing-formula">
          <h4>How We Calculate:</h4>
          <p className="formula">
            Fare = <strong>MAX(₹25, Distance in km × ₹5)</strong>
          </p>
          <p className="formula-note">
            * The minimum fare is ₹25, and after that, you pay ₹5 for every kilometer traveled.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2>Why Choose KozhiGo?</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🚗</div>
            <h3>Safe & Reliable</h3>
            <p>Verified drivers and passengers for a secure riding experience</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💵</div>
            <h3>Transparent Pricing</h3>
            <p>No hidden charges. Know exactly what you'll pay upfront</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Easy to Use</h3>
            <p>Simple interface to book or offer rides in just a few taps</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📍</div>
            <h3>Real-time Tracking</h3>
            <p>Track your ride and driver location in real-time</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⭐</div>
            <h3>Ratings & Reviews</h3>
            <p>Build trust through transparent ratings and driver reviews</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure Transactions</h3>
            <p>Your data and payment information are always protected</p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="cta-section">
        <h2>Ready to Get Started?</h2>
        <p>Join thousands of happy riders and drivers on KozhiGo today</p>
        
        <div className="cta-buttons-large">
          <button className="btn btn-primary-large" onClick={() => navigate('/register')}>
            Get Started Now
          </button>
          <button className="btn btn-secondary-large" onClick={() => navigate('/login')}>
            Already a Member?
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; 2026 KozhiGo. All rights reserved.</p>
        <p>Your trusted ride-sharing platform for campus and beyond</p>
      </footer>
    </div>
  );
};

export default Landing;
