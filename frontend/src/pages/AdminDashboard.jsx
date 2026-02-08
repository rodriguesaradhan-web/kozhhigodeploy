import { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const AdminDashboard = () => {
    const { toast, showConfirm } = useToast();
    const [stats, setStats] = useState(null);
    const [rides, setRides] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [driverApplications, setDriverApplications] = useState([]);
    const [reports, setReports] = useState([]);
    const [activeTab, setActiveTab] = useState('stats');
    const [rejectReason, setRejectReason] = useState({});
    const [driverRejectReason, setDriverRejectReason] = useState({});
    const [reportAdminNote, setReportAdminNote] = useState({});
    const [processingReport, setProcessingReport] = useState(null);

    const fetchStats = async () => {
        try {
            const res = await api.get('/admin/stats');
            setStats(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Error fetching stats');
        }
    };

    const fetchRides = async () => {
        try {
            const res = await api.get('/admin/rides');
            setRides(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Error fetching rides');
        }
    };

    const fetchRegistrations = async () => {
        try {
            const res = await api.get('/admin/registrations');
            setRegistrations(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Error fetching registrations');
        }
    };

    const fetchDriverApplications = async () => {
        try {
            const res = await api.get('/admin/driver-applications');
            setDriverApplications(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Error fetching driver applications');
        }
    };

    const fetchReports = async () => {
        try {
            const res = await api.get('/admin/reports');
            setReports(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Error fetching reports');
        }
    };

    useEffect(() => {
        const loadData = async () => {
            await Promise.all([
                fetchStats(),
                fetchRides(),
                fetchRegistrations(),
                fetchDriverApplications(),
                fetchReports()
            ]);
        };
        loadData();
    }, []);

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('Delete this ride?');
        if (!confirmed) return;
        try {
            await api.delete(`/admin/rides/${id}`);
            fetchRides();
            fetchStats();
            toast.success('Ride deleted');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error deleting ride');
        }
    };

    const handleApprove = async (regId) => {
        try {
            await api.put(`/admin/registrations/${regId}/approve`);
            toast.success('Student approved! User account created.');
            fetchRegistrations();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error approving student');
        }
    };

    const handleReject = async (regId) => {
        const reason = rejectReason[regId];
        if (!reason || !reason.trim()) {
            toast.warning('Please provide a rejection reason');
            return;
        }

        try {
            await api.put(`/admin/registrations/${regId}/reject`, { rejectionReason: reason });
            toast.success('Student registration rejected.');
            setRejectReason(prev => ({ ...prev, [regId]: '' }));
            fetchRegistrations();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error rejecting student');
        }
    };

    const handleApproveDriver = async (appId) => {
        try {
            await api.put(`/admin/driver-applications/${appId}/approve`);
            toast.success('Driver application approved! User upgraded to driver.');
            fetchDriverApplications();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error approving driver application');
        }
    };

    const handleRejectDriver = async (appId) => {
        const reason = driverRejectReason[appId];
        if (!reason || !reason.trim()) {
            toast.warning('Please provide a rejection reason');
            return;
        }

        try {
            await api.put(`/admin/driver-applications/${appId}/reject`, { rejectionReason: reason });
            toast.success('Driver application rejected.');
            setDriverRejectReason(prev => ({ ...prev, [appId]: '' }));
            fetchDriverApplications();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error rejecting driver application');
        }
    };

    const handleWarnDriver = async (reportId) => {
        const confirmed = await showConfirm('Issue a warning to this driver?');
        if (!confirmed) return;
        try {
            setProcessingReport(reportId);
            const res = await api.put(`/admin/reports/${reportId}/warn`, {
                adminNote: reportAdminNote[reportId] || ''
            });
            toast.success(res.data.message);
            setReportAdminNote(prev => ({ ...prev, [reportId]: '' }));
            await fetchReports();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error issuing warning');
        } finally {
            setProcessingReport(null);
        }
    };

    const handleDeleteDriverAccount = async (reportId) => {
        const confirmed = await showConfirm('DELETE this driver\'s account? This will cancel all their active rides. This action cannot be undone!');
        if (!confirmed) return;
        try {
            setProcessingReport(reportId);
            const res = await api.put(`/admin/reports/${reportId}/delete-account`, {
                adminNote: reportAdminNote[reportId] || ''
            });
            toast.success(res.data.message);
            setReportAdminNote(prev => ({ ...prev, [reportId]: '' }));
            await Promise.all([fetchReports(), fetchStats()]);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error deleting account');
        } finally {
            setProcessingReport(null);
        }
    };

    const handleDismissReport = async (reportId) => {
        const confirmed = await showConfirm('Dismiss this report? No action will be taken.');
        if (!confirmed) return;
        try {
            setProcessingReport(reportId);
            const res = await api.put(`/admin/reports/${reportId}/dismiss`, {
                adminNote: reportAdminNote[reportId] || ''
            });
            toast.success(res.data.message);
            setReportAdminNote(prev => ({ ...prev, [reportId]: '' }));
            await fetchReports();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error dismissing report');
        } finally {
            setProcessingReport(null);
        }
    };

    const styles = {
        container: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
        tabs: { display: 'flex', gap: '1rem', marginBottom: '2rem' },
        tab: {
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: '#f0f0f0',
            cursor: 'pointer',
            borderRadius: '0.25rem',
            fontSize: '1rem'
        },
        activeTab: {
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: '#007bff',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '0.25rem',
            fontSize: '1rem'
        },
        statsContainer: { display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' },
        card: {
            padding: '1rem',
            background: '#ffffff',
            border: '1px solid #e2e2e2',
            borderRadius: '0.6rem',
            minWidth: '150px',
            textAlign: 'center',
            color: '#1a1a1a',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        },
        registrationCard: {
            border: '1px solid #e2e2e2',
            borderRadius: '0.6rem',
            padding: '1.5rem',
            marginBottom: '1rem',
            background: '#ffffff',
            color: '#1a1a1a',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        },
        imagePreview: { maxWidth: '200px', maxHeight: '200px', marginTop: '1rem', borderRadius: '0.25rem' },
        reasonInput: { width: '100%', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc' },
        buttonGroup: { display: 'flex', gap: '1rem', marginTop: '1rem' },
        approveBtn: { padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' },
        rejectBtn: { padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }
    };

    return (
        <div style={styles.container}>
            <h1>Admin Dashboard</h1>
            
            <div style={styles.tabs}>
                <button
                    style={activeTab === 'stats' ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab('stats')}
                >
                    Stats & Rides
                </button>
                <button
                    style={activeTab === 'registrations' ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab('registrations')}
                >
                    Student Verifications ({registrations.length})
                </button>
                <button
                    style={activeTab === 'driver-apps' ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab('driver-apps')}
                >
                    Driver Applications ({driverApplications.length})
                </button>
                <button
                    style={activeTab === 'reports' ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab('reports')}
                >
                    Driver Reports ({reports.filter(r => r.status === 'PENDING').length})
                </button>
            </div>

            {activeTab === 'stats' && (
                <>
                    {stats && (
                        <div style={styles.statsContainer}>
                            <div style={styles.card}>Total Users: {stats.users}</div>
                            <div style={styles.card}>Drivers: {stats.drivers}</div>
                            <div style={styles.card}>Passengers: {stats.passengers}</div>
                            <div style={styles.card}>Rides: {stats.rides}</div>
                            <div style={styles.card}>Active: {stats.active}</div>
                        </div>
                    )}

                    <h3>All Rides</h3>
                    <div className="ride-list">
                        {rides.length === 0 ? (
                            <p>No rides found</p>
                        ) : (
                            rides.map(r => (
                                <div key={r._id} style={styles.registrationCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ background: '#007bff', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.25rem' }}>
                                            {r.status}
                                        </span>
                                        <small>{new Date(r.date).toLocaleString()}</small>
                                    </div>
                                    <div style={{ marginTop: '0.5rem' }}>{r.from} → {r.to}</div>
                                    <div style={{ marginTop: '0.5rem' }}>Driver: {r.driver?.name} ({r.driver?.email})</div>
                                    <button
                                        style={{ ...styles.rejectBtn, marginTop: '1rem' }}
                                        onClick={() => handleDelete(r._id)}
                                    >
                                        Delete Ride
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {activeTab === 'registrations' && (
                <>
                    <h3>Pending Student Registrations</h3>
                    {registrations.length === 0 ? (
                        <p style={{ fontSize: '1.1rem', color: '#666' }}>No pending registrations</p>
                    ) : (
                        registrations.map(reg => (
                            <div key={reg._id} style={styles.registrationCard}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 0.5rem 0' }}>{reg.name}</h4>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <strong>Student ID:</strong> {reg.sid}
                                        </div>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <strong>Email:</strong> {reg.email}
                                        </div>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                            <strong>Submitted:</strong> {new Date(reg.createdAt).toLocaleDateString()} {new Date(reg.createdAt).toLocaleTimeString()}
                                        </div>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <span style={{ background: '#fff3cd', color: '#856404', padding: '0.25rem 0.75rem', borderRadius: '0.25rem' }}>
                                                Status: {reg.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <h5 style={{ margin: '0 0 0.5rem 0' }}>Student ID Image:</h5>
                                        {reg.studentIdImagePath ? (
                                            <img
                                                src={`http://localhost:5000${reg.studentIdImagePath}`}
                                                alt="Student ID"
                                                style={styles.imagePreview}
                                                onError={(e) => {
                                                    e.target.src = 'https://via.placeholder.com/200?text=Image+Not+Found';
                                                    e.target.style.border = '2px solid #dc3545';
                                                }}
                                            />
                                        ) : (
                                            <div style={{ color: '#999', fontStyle: 'italic' }}>No image provided</div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                                    <h5 style={{ margin: '0 0 0.5rem 0' }}>Actions:</h5>
                                    <button
                                        style={styles.approveBtn}
                                        onClick={() => handleApprove(reg._id)}
                                    >
                                        Approve & Create Account
                                    </button>

                                    <div style={{ marginTop: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <textarea
                                                placeholder="Rejection reason (e.g., Image unclear, Invalid Student ID, etc.)"
                                                value={rejectReason[reg._id] || ''}
                                                onChange={(e) => setRejectReason(prev => ({ ...prev, [reg._id]: e.target.value }))}
                                                style={{ ...styles.reasonInput, flex: 1, minHeight: '60px' }}
                                            />
                                        </div>
                                        <button
                                            style={styles.rejectBtn}
                                            onClick={() => handleReject(reg._id)}
                                        >
                                            Reject Registration
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}

            {activeTab === 'driver-apps' && (
                <>
                    <h3>Pending Driver Applications</h3>
                    {driverApplications.length === 0 ? (
                        <p style={{ fontSize: '1.1rem', color: '#666' }}>No pending driver applications</p>
                    ) : (
                        driverApplications.map(app => (
                            <div key={app._id} style={styles.registrationCard}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 0.5rem 0' }}>{app.userName}</h4>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <strong>Email:</strong> {app.userEmail}
                                        </div>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <strong>User ID:</strong> {app.user?._id || app.user}
                                        </div>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                            <strong>Submitted:</strong> {new Date(app.createdAt).toLocaleDateString()} {new Date(app.createdAt).toLocaleTimeString()}
                                        </div>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <span style={{ background: '#fff3cd', color: '#856404', padding: '0.25rem 0.75rem', borderRadius: '0.25rem' }}>
                                                Status: {app.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <h5 style={{ margin: '0 0 0.5rem 0' }}>Driving License:</h5>
                                        {app.drivingLicenseImagePath ? (
                                            <img
                                                src={`http://localhost:5000${app.drivingLicenseImagePath}`}
                                                alt="Driving License"
                                                style={styles.imagePreview}
                                                onError={(e) => {
                                                    e.target.src = 'https://via.placeholder.com/200?text=Image+Not+Found';
                                                    e.target.style.border = '2px solid #dc3545';
                                                }}
                                            />
                                        ) : (
                                            <div style={{ color: '#999', fontStyle: 'italic' }}>No image provided</div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                                    <h5 style={{ margin: '0 0 0.5rem 0' }}>Actions:</h5>
                                    <button
                                        style={styles.approveBtn}
                                        onClick={() => handleApproveDriver(app._id)}
                                    >
                                        Approve & Upgrade to Driver
                                    </button>

                                    <div style={{ marginTop: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <textarea
                                                placeholder="Rejection reason (e.g., Invalid license, Unclear image, etc.)"
                                                value={driverRejectReason[app._id] || ''}
                                                onChange={(e) => setDriverRejectReason(prev => ({ ...prev, [app._id]: e.target.value }))}
                                                style={{ ...styles.reasonInput, flex: 1, minHeight: '60px' }}
                                            />
                                        </div>
                                        <button
                                            style={styles.rejectBtn}
                                            onClick={() => handleRejectDriver(app._id)}
                                        >
                                            Reject Application
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}

            {activeTab === 'reports' && (
                <>
                    <h3>Driver Reports</h3>
                    {reports.length === 0 ? (
                        <p style={{ fontSize: '1.1rem', color: '#666' }}>No reports submitted</p>
                    ) : (
                        reports.map(report => {
                            const isPending = report.status === 'PENDING';
                            const statusColors = {
                                PENDING: { bg: '#fff3cd', color: '#856404' },
                                WARNING_ISSUED: { bg: '#fff3cd', color: '#e65100' },
                                ACCOUNT_DELETED: { bg: '#f8d7da', color: '#721c24' },
                                DISMISSED: { bg: '#d4edda', color: '#155724' }
                            };
                            const statusStyle = statusColors[report.status] || statusColors.PENDING;

                            return (
                                <div key={report._id} style={{
                                    ...styles.registrationCard,
                                    borderLeft: isPending ? '4px solid #ff9800' : '4px solid #ccc'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <span style={{
                                                background: statusStyle.bg,
                                                color: statusStyle.color,
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '0.25rem',
                                                fontWeight: 600,
                                                fontSize: '0.85rem'
                                            }}>
                                                {report.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <small style={{ color: '#666' }}>
                                            {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString()}
                                        </small>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 0.75rem 0', color: '#333' }}>Report Details</h4>
                                            <div style={{ marginBottom: '0.5rem' }}>
                                                <strong>Reason:</strong>{' '}
                                                <span style={{ textTransform: 'capitalize' }}>{report.reason?.replace('_', ' ')}</span>
                                            </div>
                                            <div style={{ marginBottom: '0.5rem' }}>
                                                <strong>Description:</strong>
                                                <p style={{ margin: '0.25rem 0 0 0', color: '#444', lineHeight: 1.5 }}>{report.description}</p>
                                            </div>
                                            {report.ride && (
                                                <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '0.25rem', fontSize: '0.9rem' }}>
                                                    <strong>Ride:</strong> {report.ride.from} → {report.ride.to}
                                                    <br />
                                                    <strong>Date:</strong> {new Date(report.ride.date).toLocaleDateString()}
                                                    <span style={{ marginLeft: '1rem' }}>
                                                        <strong>Status:</strong> {report.ride.status}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f0f0f0', borderRadius: '0.25rem' }}>
                                                <strong>Reported By:</strong> {report.reportedBy?.name || 'Unknown'} ({report.reportedBy?.email || ''})
                                            </div>
                                            <div style={{ padding: '0.75rem', background: '#fff8e1', borderRadius: '0.25rem', border: '1px solid #ffe0b2' }}>
                                                <strong>Driver:</strong> {report.driver?.name || 'Unknown'} ({report.driver?.email || ''})
                                                {report.driver?.warnings && report.driver.warnings.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem', color: '#e65100', fontWeight: 600 }}>
                                                        Existing warnings: {report.driver.warnings.length}
                                                    </div>
                                                )}
                                                {report.driver?.isDeleted && (
                                                    <div style={{ marginTop: '0.5rem', color: '#dc3545', fontWeight: 600 }}>
                                                        Account has been deleted
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {!isPending && (
                                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '0.25rem', fontSize: '0.9rem' }}>
                                            <strong>Admin Note:</strong> {report.adminNote || 'None'}
                                            {report.reviewedBy && (
                                                <span style={{ marginLeft: '1rem', color: '#666' }}>
                                                    — Reviewed by {report.reviewedBy.name} on {new Date(report.reviewedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {isPending && (
                                        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                                            <h5 style={{ margin: '0 0 0.75rem 0' }}>Actions:</h5>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <textarea
                                                    placeholder="Admin note (optional) — reason for your decision..."
                                                    value={reportAdminNote[report._id] || ''}
                                                    onChange={(e) => setReportAdminNote(prev => ({ ...prev, [report._id]: e.target.value }))}
                                                    style={{ ...styles.reasonInput, minHeight: '60px' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                <button
                                                    style={{
                                                        padding: '0.6rem 1.2rem',
                                                        background: '#ff9800',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '0.25rem',
                                                        cursor: processingReport === report._id ? 'not-allowed' : 'pointer',
                                                        fontWeight: 600,
                                                        opacity: processingReport === report._id ? 0.7 : 1
                                                    }}
                                                    onClick={() => handleWarnDriver(report._id)}
                                                    disabled={processingReport === report._id}
                                                >
                                                    {processingReport === report._id ? 'Processing...' : 'Issue Warning'}
                                                </button>
                                                <button
                                                    style={{
                                                        padding: '0.6rem 1.2rem',
                                                        background: '#dc3545',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '0.25rem',
                                                        cursor: processingReport === report._id ? 'not-allowed' : 'pointer',
                                                        fontWeight: 600,
                                                        opacity: processingReport === report._id ? 0.7 : 1
                                                    }}
                                                    onClick={() => handleDeleteDriverAccount(report._id)}
                                                    disabled={processingReport === report._id}
                                                >
                                                    {processingReport === report._id ? 'Processing...' : 'Delete Account'}
                                                </button>
                                                <button
                                                    style={{
                                                        padding: '0.6rem 1.2rem',
                                                        background: '#6c757d',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '0.25rem',
                                                        cursor: processingReport === report._id ? 'not-allowed' : 'pointer',
                                                        fontWeight: 600,
                                                        opacity: processingReport === report._id ? 0.7 : 1
                                                    }}
                                                    onClick={() => handleDismissReport(report._id)}
                                                    disabled={processingReport === report._id}
                                                >
                                                    {processingReport === report._id ? 'Processing...' : 'Dismiss'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </>
            )}
        </div>
    );
};

export default AdminDashboard;
