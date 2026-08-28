// ============================================================================
// AttendEase Application Controller & Workflow Engine
// Multi-Role Cloud Portal with Supabase Auth, PostgreSQL & RLS Isolation
// ============================================================================

// Global App State
let currentUserProfile = null;
let currentSession = null;
let pendingAttendanceSubmission = null;

// ================= NOTIFICATION TOAST =================
function showToast(message, type = 'info') {
    const toast = document.getElementById('notification-toast');
    const msgSpan = document.getElementById('notification-message');
    const iconSpan = document.getElementById('notification-icon');
    if (!toast || !msgSpan || !iconSpan) return;
    
    msgSpan.textContent = message;
    if (type === 'success') {
        iconSpan.textContent = '✅';
        toast.className = 'notification show success';
    } else if (type === 'error') {
        iconSpan.textContent = '❌';
        toast.className = 'notification show error';
    } else {
        iconSpan.textContent = '🔔';
        toast.className = 'notification show';
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ================= NETWORK STATUS LISTENER =================
if (typeof NetworkStatus !== 'undefined') {
    NetworkStatus.subscribe(status => {
        const badge = document.getElementById('network-status-badge');
        const text = document.getElementById('network-status-text');
        if (!badge || !text) return;

        badge.className = `network-status-badge ${status}`;
        if (status === 'online') {
            text.textContent = 'Cloud Connected';
        } else if (status === 'syncing') {
            text.textContent = 'Syncing...';
        } else {
            text.textContent = 'Offline (Local)';
        }
    });
}

// ================= AUTHENTICATION & LOGIN WORKFLOW =================

let currentAuthMode = 'login'; // 'login' | 'register' | 'forgot'

function switchLoginPortal(role) {
    const container = document.getElementById('login-view');
    const subtitle = document.getElementById('portal-subtitle');
    const inputRole = document.getElementById('login-role');
    const tabs = document.querySelectorAll('#auth-portal-tabs .portal-btn');
    const slider = document.getElementById('portal-slider-bar');

    if (inputRole) inputRole.value = role;

    tabs.forEach(tab => {
        const isSelected = tab.id === `toggle-${role}`;
        tab.classList.toggle('active', isSelected);
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    if (container) {
        container.className = `login-container ${role}-mode`;
    }

    if (subtitle) {
        if (role === 'teacher') subtitle.textContent = 'Department Faculty & Teacher Portal';
        else if (role === 'student') subtitle.textContent = 'Student Attendance & Academic Progress Portal';
        else if (role === 'monitor') subtitle.textContent = 'Class Monitor Attendance Portal';
        else if (role === 'admin') subtitle.textContent = 'Institutional Super Admin Portal';
    }

    if (slider) {
        if (role === 'teacher') slider.style.left = '4px';
        else if (role === 'student') slider.style.left = 'calc(25% + 2px)';
        else if (role === 'monitor') slider.style.left = 'calc(50% + 2px)';
        else if (role === 'admin') slider.style.left = 'calc(75% - 2px)';
    }
}

function toggleAuthMode(mode) {
    currentAuthMode = mode;
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-password-form');
    const portalTabs = document.getElementById('auth-portal-tabs');

    if (loginForm) loginForm.style.display = mode === 'login' ? 'block' : 'none';
    if (registerForm) registerForm.style.display = mode === 'register' ? 'block' : 'none';
    if (forgotForm) forgotForm.style.display = mode === 'forgot' ? 'block' : 'none';
    if (portalTabs) portalTabs.style.display = mode === 'login' ? 'flex' : 'none';

    if (mode === 'register') {
        populateRegistrationDropdowns();
    }
}

function showForgotPasswordForm() {
    toggleAuthMode('forgot');
}

function togglePasswordVisibility(fieldId, btn) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function checkPasswordStrength(password, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const seg1 = container.querySelector('#reg-seg-1');
    const seg2 = container.querySelector('#reg-seg-2');
    const seg3 = container.querySelector('#reg-seg-3');
    const label = container.querySelector('#reg-strength-label');

    if (!password) {
        if (seg1) seg1.className = 'strength-bar-seg';
        if (seg2) seg2.className = 'strength-bar-seg';
        if (seg3) seg3.className = 'strength-bar-seg';
        if (label) label.textContent = 'Password strength';
        return;
    }

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) strength++;
    if (password.length >= 10 && /[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength === 1) {
        if (seg1) seg1.className = 'strength-bar-seg weak';
        if (seg2) seg2.className = 'strength-bar-seg';
        if (seg3) seg3.className = 'strength-bar-seg';
        if (label) label.textContent = 'Weak password (min 6 chars)';
    } else if (strength === 2) {
        if (seg1) seg1.className = 'strength-bar-seg medium';
        if (seg2) seg2.className = 'strength-bar-seg medium';
        if (seg3) seg3.className = 'strength-bar-seg';
        if (label) label.textContent = 'Medium password';
    } else {
        if (seg1) seg1.className = 'strength-bar-seg strong';
        if (seg2) seg2.className = 'strength-bar-seg strong';
        if (seg3) seg3.className = 'strength-bar-seg strong';
        if (label) label.textContent = 'Strong password ✓';
    }
}

function fillDemoCredentials(email, password, role) {
    switchLoginPortal(role);
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    if (usernameInput) usernameInput.value = email;
    if (passwordInput) passwordInput.value = password;
    showToast(`Loaded ${role.toUpperCase()} demo credentials`, 'info');
}

async function populateRegistrationDropdowns() {
    const deptSelect = document.getElementById('reg-dept');
    const depts = await select('departments');
    if (deptSelect && depts) {
        deptSelect.innerHTML = depts.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        await handleRegistrationDeptChange();
    }
}

async function handleRegistrationRoleChange() {
    const role = document.getElementById('reg-role').value;
    const classGroup = document.getElementById('reg-class-group');
    if (classGroup) {
        classGroup.style.display = role === 'student' ? 'block' : 'none';
    }
}

async function handleRegistrationDeptChange() {
    const deptId = document.getElementById('reg-dept').value;
    const classSelect = document.getElementById('reg-class');
    if (!classSelect || !deptId) return;

    const classes = await select('academic_classes');
    const deptClasses = classes.filter(c => c.department_id === deptId);
    if (deptClasses.length === 0) {
        classSelect.innerHTML = '<option value="">No classes available in this department</option>';
    } else {
        classSelect.innerHTML = deptClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value;
    const submitBtn = document.getElementById('login-submit-btn');

    if (!usernameInput || !passwordInput) {
        showToast('Please enter your email and password.', 'error');
        return;
    }

    // Rate Limiting Check
    const rateLimit = await checkLoginRateLimit(usernameInput);
    if (!rateLimit.allowed) {
        showToast(rateLimit.reason, 'error');
        await logAuditEvent('LOGIN_LOCKED', usernameInput, { reason: rateLimit.reason });
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Authenticating...</span> ⏳';
    }

    try {
        if (!supabaseClient) initSupabase();

        // Real Supabase Authentication Call
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: usernameInput,
            password: passwordInput
        });

        if (error) {
            await recordLoginAttempt(usernameInput, false);
            await logAuditEvent('LOGIN_FAILURE', usernameInput, { error: error.message });
            showToast(error.message || 'Invalid credentials.', 'error');
            return;
        }

        await recordLoginAttempt(usernameInput, true);
        currentSession = data.session;

        // Fetch User Profile from database (Determines actual role securely via RLS)
        const profile = await selectOne('SELECT * FROM profiles WHERE email = ?', [data.user.email]);
        if (!profile) {
            showToast('User profile not found in institutional database.', 'error');
            return;
        }

        currentUserProfile = profile;
        await logAuditEvent('LOGIN_SUCCESS', profile.email, { role: profile.role, name: profile.full_name });
        showToast(`Welcome back, ${profile.full_name}!`, 'success');

        await renderAppForSession();
    } catch (e) {
        console.error('Login error:', e);
        showToast('Authentication failed: ' + e.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Login Securely</span> →';
        }
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const role = document.getElementById('reg-role').value;
    const deptId = document.getElementById('reg-dept').value;
    const classId = document.getElementById('reg-class') ? document.getElementById('reg-class').value : null;
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const submitBtn = document.getElementById('reg-submit-btn');

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating Account...</span> ⏳';
    }

    try {
        if (!supabaseClient) initSupabase();

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role,
                    department_id: deptId,
                    class_id: classId,
                    phone
                }
            }
        });

        if (error) {
            showToast(error.message, 'error');
            return;
        }

        await logAuditEvent('USER_REGISTRATION', email, { name, role, deptId, classId });
        showToast('Registration successful! You can now log in.', 'success');
        
        document.getElementById('register-form').reset();
        document.getElementById('username').value = email;
        toggleAuthMode('login');
    } catch (e) {
        console.error('Registration error:', e);
        showToast('Registration failed: ' + e.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Create Account</span> ✓';
        }
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const submitBtn = document.getElementById('forgot-submit-btn');

    if (!email) {
        showToast('Please enter your registered email address.', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Sending Link...</span> ⏳';
    }

    try {
        if (!supabaseClient) initSupabase();
        await supabaseClient.auth.resetPasswordForEmail(email);
        await logAuditEvent('PASSWORD_RESET_REQUEST', email, { timestamp: new Date().toISOString() });

        showToast('Password reset link has been dispatched to your email.', 'success');
        document.getElementById('forgot-password-form').reset();
        toggleAuthMode('login');
    } catch (e) {
        console.error('Forgot password error:', e);
        showToast('Could not send reset link: ' + e.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Send Recovery Link</span> 📩';
        }
    }
}

async function handlePasswordUpdate(event) {
    event.preventDefault();
    const newPass = document.getElementById('new-student-password').value;
    const confirmPass = document.getElementById('confirm-student-password').value;

    if (newPass !== confirmPass) {
        showToast('Passwords do not match.', 'error');
        return;
    }
    if (newPass.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }

    try {
        if (!supabaseClient) initSupabase();
        const { error } = await supabaseClient.auth.updateUser({ password: newPass });
        if (error) throw error;

        await logAuditEvent('PASSWORD_UPDATED', currentUserProfile ? currentUserProfile.email : 'user');
        showToast('Account password updated successfully!', 'success');
        document.getElementById('new-student-password').value = '';
        document.getElementById('confirm-student-password').value = '';
    } catch (e) {
        showToast('Password update failed: ' + e.message, 'error');
    }
}

async function handleLogout() {
    try {
        if (!supabaseClient) initSupabase();
        await logAuditEvent('LOGOUT', currentUserProfile ? currentUserProfile.email : 'user');
        await supabaseClient.auth.signOut();
    } catch (e) {
        console.warn('Signout warning:', e);
    }
    currentUserProfile = null;
    currentSession = null;
    showToast('Logged out successfully.');
    await renderAppForSession();
}

// ================= SESSION RESTORATION & ROUTER =================
async function renderAppForSession() {
    if (!supabaseClient) initSupabase();

    // Check active Supabase session
    const { data } = await supabaseClient.auth.getSession();
    const session = data ? data.session : null;

    // Hide all dashboard views & login view
    const views = ['login-view', 'teacher-dashboard', 'student-dashboard', 'monitor-dashboard', 'admin-dashboard'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });

    if (!session || !session.user) {
        // No active session -> show login
        const loginEl = document.getElementById('login-view');
        if (loginEl) loginEl.style.display = 'block';
        toggleAuthMode('login');
        return;
    }

    // Load profile
    if (!currentUserProfile) {
        currentUserProfile = await selectOne('SELECT * FROM profiles WHERE email = ?', [session.user.email]);
    }

    if (!currentUserProfile) {
        // Fallback user from session metadata
        currentUserProfile = {
            id: 'prof-' + session.user.id,
            email: session.user.email,
            full_name: (session.user.user_metadata && session.user.user_metadata.full_name) || session.user.email.split('@')[0],
            role: (session.user.user_metadata && session.user.user_metadata.role) || 'student',
            department_id: session.user.user_metadata && session.user.user_metadata.department_id
        };
    }

    const role = currentUserProfile.role;

    if (role === 'super_admin') {
        const adminView = document.getElementById('admin-dashboard');
        if (adminView) {
            adminView.style.display = 'block';
            adminView.classList.add('active');
        }
        document.getElementById('admin-display-name').textContent = currentUserProfile.full_name;
        await initializeAdminDashboard();
    } else if (role === 'teacher') {
        const teacherView = document.getElementById('teacher-dashboard');
        if (teacherView) {
            teacherView.style.display = 'block';
            teacherView.classList.add('active');
        }
        document.getElementById('teacher-display-name').textContent = currentUserProfile.full_name;
        await initializeTeacherDashboard();
    } else if (role === 'student') {
        const studentView = document.getElementById('student-dashboard');
        if (studentView) {
            studentView.style.display = 'block';
            studentView.classList.add('active');
        }
        document.getElementById('student-display-name').textContent = currentUserProfile.full_name;
        await initializeStudentDashboard();
    } else if (role === 'monitor') {
        const monView = document.getElementById('monitor-dashboard');
        if (monView) {
            monView.style.display = 'block';
            monView.classList.add('active');
        }
        document.getElementById('monitor-display-name').textContent = currentUserProfile.full_name;
        await initializeMonitorDashboard();
    }
}

// ================= DATA HELPER: ATTENDANCE SESSIONS & RECORDS =================
async function getAttendanceLogsFromDB(whereSql = '', params = []) {
    const sessions = await select(`SELECT * FROM attendance_sessions ${whereSql}`, params);
    if (!sessions || sessions.length === 0) return [];

    const sessionIds = sessions.map(s => s.id);
    const records = await select('attendance_records');
    const filteredRecords = records.filter(r => sessionIds.includes(r.session_id));

    const recordsBySession = {};
    filteredRecords.forEach(r => {
        if (!recordsBySession[r.session_id]) recordsBySession[r.session_id] = {};
        recordsBySession[r.session_id][r.student_id] = r.status;
    });

    return sessions.map(s => ({
        id: s.id,
        classId: s.class_id,
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        subject: s.subject_name,
        topic: s.topic,
        submittedBy: s.submitted_by_name || 'Teacher',
        records: recordsBySession[s.id] || {}
    }));
}


// ================= TEACHER DASHBOARD WORKFLOWS =================
let teacherActiveTab = 'overview';

async function switchTeacherTab(tabId) {
    teacherActiveTab = tabId;
    
    const navItems = document.querySelectorAll('#teacher-dashboard .nav-item');
    navItems.forEach(item => {
        const match = item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabId);
        item.classList.toggle('active', match);
    });

    const tabs = document.querySelectorAll('#teacher-dashboard .tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const targetSection = document.getElementById(`tab-teacher-${tabId}`);
    if (targetSection) targetSection.classList.add('active');

    if (tabId === 'overview') await loadTeacherOverview();
    else if (tabId === 'take-attendance') await setupTeacherTakeAttendanceTab();
    else if (tabId === 'alerts') await loadTeacherAlerts();
    else if (tabId === 'logs') await setupTeacherLogsTab();
    else if (tabId === 'roster') await setupTeacherRosterTab();
}

async function initializeTeacherDashboard() {
    // Set department subtitle
    if (currentUserProfile && currentUserProfile.department_id) {
        const dept = await selectOne('SELECT * FROM departments WHERE id = ?', [currentUserProfile.department_id]);
        if (dept) {
            document.getElementById('teacher-dept-subtitle').textContent = `Teacher Console — ${dept.name} (${dept.code})`;
        }
    }
    await switchTeacherTab('overview');
}

async function loadTeacherOverview() {
    const classes = await select('academic_classes');
    const students = await select('students');
    const logs = await getAttendanceLogsFromDB();
    const alerts = await calculateAbsenteeAlerts();

    document.getElementById('metric-classes').textContent = classes.length;
    document.getElementById('metric-students').textContent = students.length;
    document.getElementById('metric-alerts').textContent = alerts.length;

    const pillCount = document.getElementById('alert-pill-count');
    if (pillCount) {
        if (alerts.length > 0) {
            pillCount.textContent = alerts.length;
            pillCount.style.display = 'inline-block';
        } else {
            pillCount.style.display = 'none';
        }
    }

    // Overall Attendance Rate
    let total = 0, present = 0;
    logs.forEach(log => {
        Object.values(log.records).forEach(status => {
            total++;
            if (status === 'present') present++;
        });
    });

    const rate = total > 0 ? Math.round((present / total) * 100) : 100;
    document.getElementById('metric-rate').textContent = `${rate}%`;

    // Render Class Statistics Bars
    const chartContainer = document.getElementById('class-analytics-chart');
    if (chartContainer) {
        if (classes.length === 0) {
            chartContainer.innerHTML = '<p class="empty-state">No assigned classes found for your department.</p>';
        } else {
            chartContainer.innerHTML = classes.map(c => {
                let classTot = 0, classPres = 0;
                const classLogs = logs.filter(l => l.classId === c.id);
                classLogs.forEach(l => {
                    Object.values(l.records).forEach(st => {
                        classTot++;
                        if (st === 'present') classPres++;
                    });
                });
                const classRate = classTot > 0 ? Math.round((classPres / classTot) * 100) : 100;
                return `
                    <div class="chart-bar-item">
                        <span class="chart-bar-label" title="${c.name}">${c.name}</span>
                        <div class="chart-bar-wrapper">
                            <div class="chart-bar-fill" style="width: ${classRate}%;"></div>
                        </div>
                        <span class="chart-bar-val">${classRate}%</span>
                    </div>
                `;
            }).join('');
        }
    }

    // Recent Submissions Table
    const recentTbody = document.getElementById('teacher-recent-logs-tbody');
    if (recentTbody) {
        const sorted = [...logs].sort((a,b) => b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || '')).slice(0, 5);
        if (sorted.length === 0) {
            recentTbody.innerHTML = '<tr><td colspan="6" class="empty-state">No attendance records in your department yet</td></tr>';
        } else {
            recentTbody.innerHTML = sorted.map(log => {
                const cls = classes.find(c => c.id === log.classId);
                const className = cls ? cls.name : 'Class';
                let pCount = 0, tCount = 0;
                Object.values(log.records).forEach(st => {
                    tCount++;
                    if (st === 'present') pCount++;
                });
                const r = tCount > 0 ? Math.round((pCount / tCount) * 100) : 100;
                return `
                    <tr>
                        <td>${log.date}</td>
                        <td style="font-weight:600;">${className}</td>
                        <td><strong>${log.subject}</strong><br><span style="font-size:0.85rem; color:var(--text-secondary);">${log.topic}</span></td>
                        <td>${log.startTime} - ${log.endTime}</td>
                        <td><span class="badge-present">${r}% Rate</span></td>
                        <td>${log.submittedBy}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

async function setupTeacherTakeAttendanceTab() {
    const classes = await select('academic_classes');
    const classSelect = document.getElementById('teach-att-class');
    if (classSelect) {
        classSelect.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Populate Subject Suggestions
    const subjects = await select('subjects');
    const datalist = document.getElementById('subject-suggestions');
    if (datalist && subjects) {
        datalist.innerHTML = subjects.map(s => `<option value="${s.name}">${s.name} (${s.code})</option>`).join('');
    }

    // Default Date and Times
    const now = new Date();
    const dateField = document.getElementById('teach-att-date');
    const startTimeField = document.getElementById('teach-att-start-time');
    const endTimeField = document.getElementById('teach-att-end-time');

    if (dateField) dateField.value = now.toISOString().split('T')[0];
    if (startTimeField) startTimeField.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (endTimeField) {
        const endH = (now.getHours() + 1) % 24;
        endTimeField.value = `${String(endH).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    await loadStudentsForTeacherAttendance();
}

async function loadStudentsForTeacherAttendance() {
    const classSelect = document.getElementById('teach-att-class');
    if (!classSelect || !classSelect.value) return;
    const classId = classSelect.value;

    const allStudents = await select('students');
    const students = allStudents.filter(s => s.class_id === classId);
    const container = document.getElementById('teach-attendance-checklist-container');
    const rosterCount = document.getElementById('teach-roster-count');

    if (rosterCount) rosterCount.textContent = `${students.length} Student${students.length !== 1 ? 's' : ''}`;

    if (!container) return;
    if (students.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><p>No students enrolled in this class yet.</p></div>';
        return;
    }

    container.innerHTML = students.map(s => `
        <div class="attendance-row" data-student-id="${s.id}">
            <div class="student-info-col">
                <span class="student-name-txt">${s.full_name || s.name}</span>
                <span class="student-phone-txt">
                    <span>🆔 ${s.student_id || s.roll_number || 'N/A'}</span>
                    <span>📞 ${s.phone}</span>
                </span>
            </div>
            <div class="attendance-pills" role="radiogroup">
                <button type="button" class="pill-btn present-pill active" onclick="setTeacherStudentStatus('${s.id}', 'present')" id="teach-pill-p-${s.id}">P</button>
                <button type="button" class="pill-btn absent-pill" onclick="setTeacherStudentStatus('${s.id}', 'absent')" id="teach-pill-a-${s.id}">A</button>
            </div>
        </div>
    `).join('');
}

function setTeacherStudentStatus(studentId, status) {
    const pPill = document.getElementById(`teach-pill-p-${studentId}`);
    const aPill = document.getElementById(`teach-pill-a-${studentId}`);
    if (status === 'present') {
        if (pPill) pPill.classList.add('active');
        if (aPill) aPill.classList.remove('active');
    } else {
        if (aPill) aPill.classList.add('active');
        if (pPill) pPill.classList.remove('active');
    }
}

function markAllAttendance(status) {
    const container = document.getElementById('teach-attendance-checklist-container');
    if (!container) return;
    const rows = container.querySelectorAll('.attendance-row');
    rows.forEach(r => {
        const studentId = r.getAttribute('data-student-id');
        setTeacherStudentStatus(studentId, status);
    });
}

// Attendance Safety Confirmation Modal & Duplicate Check
async function handleTeacherAttendanceSubmit(event) {
    event.preventDefault();
    const classId = document.getElementById('teach-att-class').value;
    const attDate = document.getElementById('teach-att-date').value;
    const startTime = document.getElementById('teach-att-start-time').value;
    const endTime = document.getElementById('teach-att-end-time').value;
    const subject = document.getElementById('teach-att-subject').value.trim();
    const topic = document.getElementById('teach-att-topic').value.trim();

    if (!classId || !attDate || !startTime || !endTime || !subject || !topic) {
        showToast('Please fill all lecture attendance details.', 'error');
        return;
    }

    const allStudents = await select('students');
    const students = allStudents.filter(s => s.class_id === classId);
    if (students.length === 0) {
        showToast('Cannot take attendance for class with zero students.', 'error');
        return;
    }

    // Duplicate session safety check
    const existingSessions = await select('attendance_sessions');
    const duplicate = existingSessions.find(s => 
        s.class_id === classId && 
        s.date === attDate && 
        (s.start_time || '').slice(0, 5) === startTime.slice(0, 5) &&
        (s.subject_name || '').toLowerCase() === subject.toLowerCase()
    );

    if (duplicate) {
        if (!confirm(`Warning: A session for ${subject} on ${attDate} at ${startTime} already exists. Do you want to submit anyway?`)) {
            return;
        }
    }

    // Calculate Summary
    const recordsMap = {};
    let presentCount = 0;
    let absentCount = 0;

    students.forEach(s => {
        const aPill = document.getElementById(`teach-pill-a-${s.id}`);
        const isAbsent = aPill && aPill.classList.contains('active');
        const st = isAbsent ? 'absent' : 'present';
        recordsMap[s.id] = st;
        if (st === 'present') presentCount++;
        else absentCount++;
    });

    const classes = await select('academic_classes');
    const cls = classes.find(c => c.id === classId);

    pendingAttendanceSubmission = {
        classId,
        date: attDate,
        startTime,
        endTime,
        subject,
        topic,
        recordsMap,
        className: cls ? cls.name : 'Class',
        totalStudents: students.length,
        presentCount,
        absentCount
    };

    // Open Confirmation Modal
    document.getElementById('confirm-class-txt').textContent = pendingAttendanceSubmission.className;
    document.getElementById('confirm-subject-txt').textContent = subject;
    document.getElementById('confirm-datetime-txt').textContent = `${attDate} (${startTime} - ${endTime})`;
    document.getElementById('confirm-topic-txt').textContent = topic;
    document.getElementById('confirm-total-count').textContent = students.length;
    document.getElementById('confirm-present-count').textContent = presentCount;
    document.getElementById('confirm-absent-count').textContent = absentCount;

    document.getElementById('attendance-confirm-modal').classList.add('active');
}

function closeConfirmModal() {
    const modal = document.getElementById('attendance-confirm-modal');
    if (modal) modal.classList.remove('active');
}

async function finalizeAttendanceSubmission() {
    if (!pendingAttendanceSubmission) return;
    const btn = document.getElementById('confirm-final-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Writing to Cloud... ⏳';
    }

    try {
        const sessionId = 'sess-' + Date.now();
        const teacherName = currentUserProfile ? currentUserProfile.full_name : 'Teacher';

        // Insert Session
        await insert('attendance_sessions', {
            id: sessionId,
            class_id: pendingAttendanceSubmission.classId,
            subject_name: pendingAttendanceSubmission.subject,
            teacher_id: currentUserProfile ? currentUserProfile.id : null,
            date: pendingAttendanceSubmission.date,
            start_time: pendingAttendanceSubmission.startTime,
            end_time: pendingAttendanceSubmission.endTime,
            topic: pendingAttendanceSubmission.topic,
            submitted_by_name: teacherName
        });

        // Insert Records
        for (const [studentId, status] of Object.entries(pendingAttendanceSubmission.recordsMap)) {
            await insert('attendance_records', {
                session_id: sessionId,
                student_id: studentId,
                status
            });
        }

        await logAuditEvent('ATTENDANCE_CREATED', currentUserProfile ? currentUserProfile.email : 'teacher', {
            class: pendingAttendanceSubmission.className,
            subject: pendingAttendanceSubmission.subject,
            present: pendingAttendanceSubmission.presentCount,
            absent: pendingAttendanceSubmission.absentCount
        });

        showToast('Attendance logged securely to cloud database!', 'success');
        closeConfirmModal();

        document.getElementById('teach-att-topic').value = '';
        await loadStudentsForTeacherAttendance();
        pendingAttendanceSubmission = null;
    } catch (e) {
        console.error('Failed to submit attendance:', e);
        showToast('Failed to save attendance: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Confirm & Submit ✓';
        }
    }
}

// Absentee Alerts Calculation: Students absent >= 2 consecutive lecture sessions
async function calculateAbsenteeAlerts() {
    const classes = await select('academic_classes');
    const students = await select('students');
    const logs = await getAttendanceLogsFromDB();
    const alerts = [];

    classes.forEach(cls => {
        const classStudents = students.filter(s => s.class_id === cls.id);
        const classLogs = logs.filter(l => l.classId === cls.id)
                              .sort((a,b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

        if (classLogs.length < 2) return;

        classStudents.forEach(student => {
            if (student.alerts_enabled === false || student.alertsEnabled === 0) return;
            let streak = 0;
            let lastAbsentLog = null;

            for (let i = classLogs.length - 1; i >= 0; i--) {
                const log = classLogs[i];
                const status = log.records[student.id];
                if (status === 'absent') {
                    streak++;
                    if (!lastAbsentLog) lastAbsentLog = log;
                } else if (status === 'present') {
                    break;
                }
            }

            if (streak >= 2) {
                alerts.push({
                    student,
                    className: cls.name,
                    streak,
                    lastTopic: lastAbsentLog ? lastAbsentLog.topic : 'N/A',
                    lastDate: lastAbsentLog ? lastAbsentLog.date : 'N/A'
                });
            }
        });
    });

    return alerts;
}

async function loadTeacherAlerts() {
    const alerts = await calculateAbsenteeAlerts();
    const tbody = document.getElementById('absentee-alerts-tbody');
    if (!tbody) return;

    if (alerts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state" style="padding: 50px;">
                    <div class="empty-state-icon" style="color:var(--color-present);">✓</div>
                    <p style="color:var(--text-primary); font-weight:600; font-size:1.1rem; margin-bottom:4px;">Roster Healthy</p>
                    <p style="font-size:0.85rem;">No students are flagged for 2 or more consecutive absences in your assigned classes.</p>
                </td>
            </tr>
        `;
        return;
    }

    const teacherName = currentUserProfile ? currentUserProfile.full_name : 'Teacher';

    tbody.innerHTML = alerts.map(alert => {
        const studentName = alert.student.full_name || alert.student.name;
        const phone = alert.student.phone || '';
        const wa = alert.student.whatsapp || alert.student.phone || '';
        const msgText = `Hello, this is ${teacherName}. I noticed that ${studentName} has been absent for ${alert.streak} consecutive classes in ${alert.className} (Last absent: ${alert.lastDate} on topic "${alert.lastTopic}"). Please update us on the reason. Thank you.`;
        const waLink = `https://wa.me/${wa.replace('+', '')}?text=${encodeURIComponent(msgText)}`;

        return `
            <tr class="alert-row">
                <td style="font-weight:700; color:#fb7185;">⚠️ ${studentName}</td>
                <td>${alert.className}</td>
                <td><span class="badge-absent">${alert.streak} Classes Streak</span></td>
                <td>${alert.lastDate}<br><span style="font-size:0.8rem; color:var(--text-secondary);">${alert.lastTopic}</span></td>
                <td>
                    <div class="action-buttons-group">
                        <a href="tel:${phone}" class="action-icon-btn call-btn">📞 Call Student</a>
                        <a href="${waLink}" target="_blank" rel="noopener" class="action-icon-btn wa-btn">💬 WhatsApp</a>
                        <button onclick="toggleStudentAlerts('${alert.student.id}')" class="action-icon-btn" style="background: rgba(244,63,94,0.1); color: #fb7185; border: 1px solid rgba(244,63,94,0.3); font-size: 0.85rem;">🔕 Mute</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function setupTeacherLogsTab() {
    const classes = await select('academic_classes');
    const filterClass = document.getElementById('log-filter-class');
    if (filterClass) {
        const sel = filterClass.value || 'all';
        filterClass.innerHTML = '<option value="all">All Classes</option>' + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        filterClass.value = sel;
    }
    await filterAttendanceLogs();
}

async function filterAttendanceLogs() {
    const classId = document.getElementById('log-filter-class').value;
    const dateVal = document.getElementById('log-filter-date').value;
    const logs = await getAttendanceLogsFromDB();
    const classes = await select('academic_classes');
    const tbody = document.getElementById('all-logs-tbody');

    let filtered = [...logs];
    if (classId !== 'all') filtered = filtered.filter(l => l.classId === classId);
    if (dateVal) filtered = filtered.filter(l => l.date === dateVal);

    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No matching attendance logs found</td></tr>';
        return;
    }

    filtered.sort((a,b) => b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || ''));

    tbody.innerHTML = filtered.map(log => {
        const cls = classes.find(c => c.id === log.classId);
        const className = cls ? cls.name : 'Class';
        let pres = 0, tot = 0;
        Object.values(log.records).forEach(st => {
            tot++;
            if (st === 'present') pres++;
        });
        const r = tot > 0 ? Math.round((pres / tot) * 100) : 100;

        return `
            <tr>
                <td>${log.date}</td>
                <td style="font-weight:600;">${className}</td>
                <td>${log.startTime} - ${log.endTime}</td>
                <td><strong>${log.subject}</strong><br><span style="font-size:0.85rem; color:var(--text-secondary);">${log.topic}</span></td>
                <td><span class="badge-present">${r}% Rate</span></td>
                <td>${log.submittedBy}</td>
                <td>
                    <button class="action-icon-btn share-btn-secondary" onclick="viewLogDetails('${log.id}')">Inspect 🔍</button>
                </td>
            </tr>
        `;
    }).join('');
}

function clearLogFilters() {
    document.getElementById('log-filter-class').value = 'all';
    document.getElementById('log-filter-date').value = '';
    filterAttendanceLogs();
}

async function viewLogDetails(logId) {
    const logs = await getAttendanceLogsFromDB();
    const log = logs.find(l => l.id === logId);
    if (!log) return;

    const classes = await select('academic_classes');
    const cls = classes.find(c => c.id === log.classId);
    const students = await select('students');

    document.getElementById('modal-lecture-title').textContent = 'Lecture Attendance Details';
    document.getElementById('modal-lecture-class').textContent = cls ? cls.name : 'Class';
    document.getElementById('modal-lecture-subject').textContent = log.subject;
    document.getElementById('modal-lecture-topic').textContent = log.topic;
    document.getElementById('modal-lecture-datetime').textContent = `${log.date} (${log.startTime} - ${log.endTime})`;

    const modalRosterTbody = document.getElementById('modal-roster-tbody');
    modalRosterTbody.innerHTML = '';

    Object.entries(log.records).forEach(([studentId, status]) => {
        const student = students.find(s => s.id === studentId);
        if (student) {
            const badge = status === 'present' ? '<span class="badge-present">Present</span>' : '<span class="badge-absent">Absent</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="font-weight:600;">${student.full_name || student.name}</td><td>${badge}</td>`;
            modalRosterTbody.appendChild(tr);
        }
    });

    document.getElementById('attendance-details-modal').classList.add('active');
}

function closeDetailsModal() {
    const m = document.getElementById('attendance-details-modal');
    if (m) m.classList.remove('active');
}

async function setupTeacherRosterTab() {
    const classes = await select('academic_classes');
    const filterClass = document.getElementById('roster-filter-class');
    if (filterClass) {
        const sel = filterClass.value || 'all';
        filterClass.innerHTML = '<option value="all">All Classes</option>' + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        filterClass.value = sel;
    }
    await filterRosterTable();
}

async function filterRosterTable() {
    const search = document.getElementById('roster-search').value.toLowerCase().trim();
    const classId = document.getElementById('roster-filter-class').value;
    const students = await select('students');
    const classes = await select('academic_classes');
    const logs = await getAttendanceLogsFromDB();
    const tbody = document.getElementById('roster-tbody');

    let filtered = [...students];
    if (classId !== 'all') filtered = filtered.filter(s => s.class_id === classId);
    if (search) {
        filtered = filtered.filter(s => 
            (s.full_name || s.name || '').toLowerCase().includes(search) || 
            (s.student_id || s.roll_number || '').toLowerCase().includes(search)
        );
    }

    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No students found matching filters</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(student => {
        const cls = classes.find(c => c.id === student.class_id);
        const className = cls ? cls.name : 'Class';
        
        let tot = 0, pres = 0;
        logs.forEach(l => {
            if (l.classId === student.class_id && l.records[student.id]) {
                tot++;
                if (l.records[student.id] === 'present') pres++;
            }
        });
        const rate = tot > 0 ? Math.round((pres / tot) * 100) : 100;
        const rateClass = rate < 75 ? 'badge-absent' : 'badge-present';
        const alertsActive = student.alerts_enabled !== false && student.alertsEnabled !== 0;

        return `
            <tr>
                <td style="font-weight:600;">${student.student_id || student.roll_number || 'N/A'}</td>
                <td style="font-weight:600;">${student.full_name || student.name}</td>
                <td>${className}</td>
                <td>📞 ${student.phone}</td>
                <td><span class="${rateClass}">${rate}%</span> (${pres}/${tot})</td>
                <td>
                    <button onclick="toggleStudentAlerts('${student.id}')" class="demo-pill" style="font-size:0.75rem;">
                        ${alertsActive ? '🔔 Active' : '🔕 Muted'}
                    </button>
                </td>
                <td>
                    <button class="action-icon-btn logout-btn" style="padding: 4px 8px; font-size:0.75rem;" onclick="removeStudent('${student.id}')">Remove 🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleStudentAlerts(studentId) {
    const student = await selectOne('SELECT * FROM students WHERE id = ?', [studentId]);
    if (!student) return;
    const current = student.alerts_enabled !== false && student.alertsEnabled !== 0;
    const updated = !current;
    await update('students', { alerts_enabled: updated }, 'id = ?', [studentId]);
    showToast(`Alerts for ${student.full_name || student.name} ${updated ? 'enabled' : 'muted'}.`, 'info');
    
    if (currentUserProfile && currentUserProfile.role === 'teacher') {
        await loadTeacherOverview();
        await loadTeacherAlerts();
        await filterRosterTable();
    }
}

async function removeStudent(studentId) {
    const student = await selectOne('SELECT * FROM students WHERE id = ?', [studentId]);
    if (!student) return;
    if (confirm(`Are you sure you want to deactivate ${student.full_name || student.name}'s profile?`)) {
        await deleteRow('students', 'id = ?', [studentId]);
        showToast('Student deactivated from roster.', 'info');
        await filterRosterTable();
    }
}

async function openAddStudentModal() {
    const classes = await select('academic_classes');
    const sel = document.getElementById('modal-stud-class');
    if (sel) sel.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const m = document.getElementById('add-student-modal');
    if (m) m.classList.add('active');
}

function closeAddStudentModal() {
    const m = document.getElementById('add-student-modal');
    if (m) m.classList.remove('active');
    document.getElementById('modal-add-student-form').reset();
}

async function handleAddStudentModalSubmit(event) {
    event.preventDefault();
    const classId = document.getElementById('modal-stud-class').value;
    const name = document.getElementById('modal-stud-name').value.trim();
    const studentId = document.getElementById('modal-stud-id').value.trim();
    const email = document.getElementById('modal-stud-email').value.trim();
    const phone = document.getElementById('modal-stud-phone').value.trim();
    const whatsapp = document.getElementById('modal-stud-whatsapp').value.trim();

    if (!classId || !name || !studentId || !phone) {
        showToast('Please fill required student details.', 'error');
        return;
    }

    const classes = await select('academic_classes');
    const cls = classes.find(c => c.id === classId);

    const newStudent = {
        id: 'stu-' + Date.now(),
        student_id: studentId,
        full_name: name,
        email: email || `${studentId.toLowerCase()}@college.edu`,
        phone,
        whatsapp: whatsapp || phone,
        department_id: cls ? cls.department_id : (currentUserProfile ? currentUserProfile.department_id : null),
        class_id: classId,
        alerts_enabled: true,
        status: 'active'
    };

    await insert('students', newStudent);
    await logAuditEvent('STUDENT_CREATED', currentUserProfile ? currentUserProfile.email : 'teacher', { name, studentId, classId });
    showToast(`Added ${name} to roster database!`, 'success');
    closeAddStudentModal();
    await filterRosterTable();
}

async function exportDatabaseToCSV() {
    const logs = await getAttendanceLogsFromDB();
    const students = await select('students');
    const classes = await select('academic_classes');

    if (logs.length === 0) {
        showToast('No attendance logs to export.', 'error');
        return;
    }

    let csv = 'Date,Class,Start Time,End Time,Subject,Topic Covered,Student ID,Student Name,Status,Phone,Logged By\r\n';

    logs.forEach(log => {
        const cls = classes.find(c => c.id === log.classId);
        const className = cls ? cls.name : 'Class';

        Object.entries(log.records).forEach(([studentId, status]) => {
            const student = students.find(s => s.id === studentId);
            const studentName = student ? (student.full_name || student.name) : 'Student';
            const sId = student ? (student.student_id || student.roll_number || 'N/A') : 'N/A';
            const phone = student ? student.phone : 'N/A';

            const sub = (log.subject || '').replace(/"/g, '""');
            const top = (log.topic || '').replace(/"/g, '""');
            const nameClean = studentName.replace(/"/g, '""');

            csv += `"${log.date}","${className}","${log.startTime}","${log.endTime}","${sub}","${top}","${sId}","${nameClean}","${status.toUpperCase()}","${phone}","${log.submittedBy}"\r\n`;
        });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendease_attendance_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Department attendance CSV database downloaded!', 'success');
}


// ================= STUDENT DASHBOARD WORKFLOWS =================
let studentActiveTab = 'overview';

async function switchStudentTab(tabId) {
    studentActiveTab = tabId;

    const navItems = document.querySelectorAll('#student-dashboard .nav-item');
    navItems.forEach(item => {
        const match = item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabId);
        item.classList.toggle('active', match);
    });

    const tabs = document.querySelectorAll('#student-dashboard .tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const targetSection = document.getElementById(`tab-student-${tabId}`);
    if (targetSection) targetSection.classList.add('active');

    if (tabId === 'overview') await loadStudentOverview();
    else if (tabId === 'subjects') await loadStudentSubjects();
    else if (tabId === 'history') await loadStudentHistory();
    else if (tabId === 'profile') await loadStudentProfile();
}

async function initializeStudentDashboard() {
    await switchStudentTab('overview');
}

async function loadStudentOverview() {
    const student = await selectOne('SELECT * FROM students WHERE email = ?', [currentUserProfile.email]);
    const logs = await getAttendanceLogsFromDB();

    if (!student) {
        document.getElementById('student-metric-rate').textContent = '0%';
        return;
    }

    let total = 0, present = 0, absent = 0;
    const personalLogs = [];

    logs.forEach(log => {
        if (log.records && log.records[student.id]) {
            total++;
            const status = log.records[student.id];
            if (status === 'present') present++;
            else absent++;
            personalLogs.push({ ...log, myStatus: status });
        }
    });

    const rate = total > 0 ? Math.round((present / total) * 100) : 100;
    document.getElementById('student-metric-rate').textContent = `${rate}%`;
    document.getElementById('student-metric-present').textContent = present;
    document.getElementById('student-metric-absent').textContent = absent;
    document.getElementById('student-metric-total').textContent = total;

    // Banner status
    const banner = document.getElementById('student-status-banner');
    const heading = document.getElementById('student-status-heading');
    const desc = document.getElementById('student-status-desc');

    if (rate >= 75) {
        banner.style.background = 'rgba(16, 185, 129, 0.1)';
        banner.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        heading.style.color = '#34d399';
        heading.textContent = `Attendance in Good Standing (${rate}%)`;
        desc.textContent = 'Your attendance rate satisfies the required 75% threshold for university examination eligibility.';
    } else {
        banner.style.background = 'rgba(244, 63, 94, 0.1)';
        banner.style.borderColor = 'rgba(244, 63, 94, 0.3)';
        heading.style.color = '#fb7185';
        heading.textContent = `Attendance Alert: Below 75% (${rate}%)`;
        desc.textContent = 'Warning: Your attendance is below the institutional 75% threshold. Please attend upcoming lectures.';
    }

    // Recent Attendance
    const recentTbody = document.getElementById('student-recent-tbody');
    if (recentTbody) {
        personalLogs.sort((a,b) => b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || ''));
        const slice = personalLogs.slice(0, 5);
        if (slice.length === 0) {
            recentTbody.innerHTML = '<tr><td colspan="5" class="empty-state">No attendance records logged for you yet</td></tr>';
        } else {
            recentTbody.innerHTML = slice.map(l => `
                <tr>
                    <td>${l.date}</td>
                    <td style="font-weight:600;">${l.subject}</td>
                    <td>${l.topic}</td>
                    <td>${l.startTime} - ${l.endTime}</td>
                    <td>${l.myStatus === 'present' ? '<span class="badge-present">Present</span>' : '<span class="badge-absent">Absent</span>'}</td>
                </tr>
            `).join('');
        }
    }
}

async function loadStudentSubjects() {
    const student = await selectOne('SELECT * FROM students WHERE email = ?', [currentUserProfile.email]);
    const logs = await getAttendanceLogsFromDB();
    const grid = document.getElementById('student-subjects-grid');
    if (!grid || !student) return;

    const subjectsMap = {};
    logs.forEach(log => {
        if (log.records && log.records[student.id]) {
            const sub = log.subject || 'General Course';
            if (!subjectsMap[sub]) subjectsMap[sub] = { total: 0, present: 0 };
            subjectsMap[sub].total++;
            if (log.records[student.id] === 'present') subjectsMap[sub].present++;
        }
    });

    const entries = Object.entries(subjectsMap);
    if (entries.length === 0) {
        grid.innerHTML = '<p class="empty-state">No subject attendance records recorded yet.</p>';
        return;
    }

    grid.innerHTML = entries.map(([subName, data]) => {
        const rate = data.total > 0 ? Math.round((data.present / data.total) * 100) : 100;
        const colorClass = rate >= 75 ? 'high' : rate >= 60 ? 'medium' : 'low';
        const textColor = rate >= 75 ? '#34d399' : rate >= 60 ? '#fbbf24' : '#fb7185';

        return `
            <div class="subject-card">
                <div class="subject-card-header">
                    <span class="subject-name">${subName}</span>
                    <span class="subject-rate-badge" style="color: ${textColor};">${rate}%</span>
                </div>
                <div class="progress-container">
                    <div class="progress-fill ${colorClass}" style="width: ${rate}%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary);">
                    <span>${data.present} Present / ${data.total} Conducted</span>
                    <span>${data.total - data.present} Absent</span>
                </div>
            </div>
        `;
    }).join('');
}

async function loadStudentHistory() {
    const student = await selectOne('SELECT * FROM students WHERE email = ?', [currentUserProfile.email]);
    const logs = await getAttendanceLogsFromDB();
    const tbody = document.getElementById('student-all-history-tbody');
    if (!tbody || !student) return;

    const personalLogs = [];
    logs.forEach(log => {
        if (log.records && log.records[student.id]) {
            personalLogs.push({ ...log, myStatus: log.records[student.id] });
        }
    });

    if (personalLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No attendance records found</td></tr>';
        return;
    }

    personalLogs.sort((a,b) => b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || ''));

    tbody.innerHTML = personalLogs.map(l => `
        <tr>
            <td>${l.date}</td>
            <td style="font-weight:600;">${l.subject}</td>
            <td>${l.topic}</td>
            <td>${l.startTime} - ${l.endTime}</td>
            <td>${l.submittedBy}</td>
            <td>${l.myStatus === 'present' ? '<span class="badge-present">Present</span>' : '<span class="badge-absent">Absent</span>'}</td>
        </tr>
    `).join('');
}

async function loadStudentProfile() {
    const student = await selectOne('SELECT * FROM students WHERE email = ?', [currentUserProfile.email]);
    const classes = await select('academic_classes');
    const depts = await select('departments');

    const cls = student ? classes.find(c => c.id === student.class_id) : null;
    const dept = student ? depts.find(d => d.id === student.department_id) : null;

    document.getElementById('student-prof-name').textContent = currentUserProfile.full_name;
    document.getElementById('student-prof-id').textContent = student ? (student.student_id || student.roll_number || 'N/A') : 'N/A';
    document.getElementById('student-prof-dept').textContent = dept ? dept.name : 'Computer Applications';
    document.getElementById('student-prof-class').textContent = cls ? cls.name : 'Current Enrolled Class';
}


// ================= SUPER ADMIN DASHBOARD WORKFLOWS =================
let adminActiveTab = 'overview';

async function switchAdminTab(tabId) {
    adminActiveTab = tabId;

    const navItems = document.querySelectorAll('#admin-dashboard .nav-item');
    navItems.forEach(item => {
        const match = item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabId);
        item.classList.toggle('active', match);
    });

    const tabs = document.querySelectorAll('#admin-dashboard .tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const targetSection = document.getElementById(`tab-admin-${tabId}`);
    if (targetSection) targetSection.classList.add('active');

    if (tabId === 'overview') await loadAdminOverview();
    else if (tabId === 'departments') await loadAdminDepartments();
    else if (tabId === 'classes') await loadAdminClasses();
    else if (tabId === 'teachers') await loadAdminTeachers();
    else if (tabId === 'audit') await loadAdminAuditLogs();
}

async function initializeAdminDashboard() {
    await switchAdminTab('overview');
}

async function loadAdminOverview() {
    const depts = await select('departments');
    const classes = await select('academic_classes');
    const profiles = await select('profiles');
    const students = await select('students');

    const teachers = profiles.filter(p => p.role === 'teacher');

    document.getElementById('admin-metric-depts').textContent = depts.length;
    document.getElementById('admin-metric-classes').textContent = classes.length;
    document.getElementById('admin-metric-teachers').textContent = teachers.length;
    document.getElementById('admin-metric-students').textContent = students.length;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function loadAdminDepartments() {
    const depts = await select('departments');
    const tbody = document.getElementById('admin-departments-tbody');
    if (!tbody) return;

    if (depts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No departments registered.</td></tr>';
        return;
    }

    tbody.innerHTML = depts.map(d => {
        const isActive = (d.status || 'active') === 'active';
        return `
            <tr>
                <td><strong style="color: var(--color-admin);">${d.code}</strong></td>
                <td style="font-weight:600;">${d.name}</td>
                <td>${d.program_type || 'Undergraduate'}</td>
                <td><span class="${isActive ? 'badge-present' : 'badge-absent'}">${isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="action-icon-btn share-btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openEditDeptModal('${d.id}', '${d.code}', '${escapeHtml(d.name)}', '${d.program_type || 'Undergraduate'}', '${d.status || 'active'}')">Edit ✏️</button>
                        <button type="button" class="action-icon-btn call-btn" style="padding: 4px 10px; font-size: 0.75rem; background: ${isActive ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)'}; color: ${isActive ? '#fb7185' : '#34d399'}; border: 1px solid ${isActive ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'};" onclick="toggleDeptStatus('${d.id}', '${d.status || 'active'}')">
                            ${isActive ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddDepartmentModal() {
    const m = document.getElementById('add-dept-modal');
    if (m) m.classList.add('active');
}

function closeAddDeptModal() {
    const m = document.getElementById('add-dept-modal');
    if (m) m.classList.remove('active');
    document.getElementById('modal-add-dept-form').reset();
}

async function handleAddDeptModalSubmit(event) {
    event.preventDefault();
    const code = document.getElementById('modal-dept-code').value.trim().toUpperCase();
    const name = document.getElementById('modal-dept-name').value.trim();
    const progType = document.getElementById('modal-dept-type').value;

    try {
        await insert('departments', {
            code,
            name,
            program_type: progType,
            status: 'active'
        });

        await logAuditEvent('DEPARTMENT_CREATED', currentUserProfile ? currentUserProfile.email : 'admin', { code, name });
        showToast(`Department ${code} (${name}) created successfully!`, 'success');
        closeAddDeptModal();
        await loadAdminDepartments();
        await loadAdminOverview();
    } catch (e) {
        showToast('Failed to create department: ' + e.message, 'error');
    }
}

function openEditDeptModal(id, code, name, progType, status) {
    document.getElementById('edit-dept-id').value = id;
    document.getElementById('edit-dept-code').value = code;
    document.getElementById('edit-dept-name').value = name;
    document.getElementById('edit-dept-type').value = progType;
    document.getElementById('edit-dept-status').value = status;
    const m = document.getElementById('edit-dept-modal');
    if (m) m.classList.add('active');
}

function closeEditDeptModal() {
    const m = document.getElementById('edit-dept-modal');
    if (m) m.classList.remove('active');
}

async function handleEditDeptModalSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('edit-dept-id').value;
    const name = document.getElementById('edit-dept-name').value.trim();
    const progType = document.getElementById('edit-dept-type').value;
    const status = document.getElementById('edit-dept-status').value;

    try {
        if (!supabaseClient) initSupabase();
        const { error } = await supabaseClient.from('departments').update({
            name,
            program_type: progType,
            status
        }).eq('id', id);

        if (error) throw error;

        await logAuditEvent('DEPARTMENT_UPDATED', currentUserProfile ? currentUserProfile.email : 'admin', { id, name, status });
        showToast('Department updated successfully!', 'success');
        closeEditDeptModal();
        await loadAdminDepartments();
        await loadAdminOverview();
    } catch (e) {
        showToast('Failed to update department: ' + e.message, 'error');
    }
}

async function toggleDeptStatus(deptId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
        if (!supabaseClient) initSupabase();
        const { error } = await supabaseClient.from('departments').update({ status: newStatus }).eq('id', deptId);
        if (error) throw error;

        await logAuditEvent('DEPARTMENT_STATUS_TOGGLED', currentUserProfile ? currentUserProfile.email : 'admin', { deptId, newStatus });
        showToast(`Department status updated to ${newStatus.toUpperCase()}`, 'success');
        await loadAdminDepartments();
    } catch (e) {
        showToast('Failed to update status: ' + e.message, 'error');
    }
}

async function loadAdminClasses() {
    const classes = await select('academic_classes');
    const depts = await select('departments');
    const tbody = document.getElementById('admin-classes-tbody');
    if (!tbody) return;

    tbody.innerHTML = classes.map(c => {
        const d = depts.find(dept => dept.id === c.department_id);
        return `
            <tr>
                <td style="font-weight:600;">${c.name}</td>
                <td>${d ? d.name : 'General'}</td>
                <td>${c.year || '3rd Year'}</td>
                <td>${c.academic_year || '2026-2027'}</td>
                <td><span class="badge-present">${c.status || 'active'}</span></td>
            </tr>
        `;
    }).join('');
}

async function openAddClassModal() {
    const depts = await select('departments');
    const sel = document.getElementById('modal-class-dept');
    if (sel) sel.innerHTML = depts.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    const m = document.getElementById('add-class-modal');
    if (m) m.classList.add('active');
}

function closeAddClassModal() {
    const m = document.getElementById('add-class-modal');
    if (m) m.classList.remove('active');
    document.getElementById('modal-add-class-form').reset();
}

async function handleAddClassModalSubmit(event) {
    event.preventDefault();
    const deptId = document.getElementById('modal-class-dept').value;
    const name = document.getElementById('modal-class-name').value.trim();
    const year = document.getElementById('modal-class-year').value;
    const session = document.getElementById('modal-class-session').value.trim();

    await insert('academic_classes', {
        id: 'cls-' + Date.now(),
        department_id: deptId,
        name,
        year,
        academic_year: session,
        status: 'active'
    });

    await logAuditEvent('CLASS_CREATED', currentUserProfile ? currentUserProfile.email : 'admin', { name, deptId });
    showToast(`Class ${name} registered!`, 'success');
    closeAddClassModal();
    await loadAdminClasses();
}

async function loadAdminTeachers() {
    const profiles = await select('profiles');
    const depts = await select('departments');
    const teachers = profiles.filter(p => p.role === 'teacher' || p.role === 'super_admin');
    const tbody = document.getElementById('admin-teachers-tbody');
    if (!tbody) return;

    tbody.innerHTML = teachers.map(t => {
        const d = depts.find(dept => dept.id === t.department_id);
        return `
            <tr>
                <td style="font-weight:600;">${t.full_name}</td>
                <td>${t.email}</td>
                <td>${d ? d.name : 'Institution Wide'}</td>
                <td><span class="badge-present">${t.role.toUpperCase()}</span></td>
                <td><span class="badge-present">${t.status || 'active'}</span></td>
            </tr>
        `;
    }).join('');
}

async function loadAdminAuditLogs() {
    const audit = await select('audit_logs');
    const tbody = document.getElementById('admin-audit-tbody');
    if (!tbody) return;

    if (audit.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No audit events recorded</td></tr>';
        return;
    }

    audit.sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));

    tbody.innerHTML = audit.slice(0, 20).map(a => `
        <tr>
            <td style="font-size:0.8rem; color:var(--text-secondary);">${new Date(a.created_at || Date.now()).toLocaleString()}</td>
            <td><strong style="color:var(--color-admin);">${a.action}</strong></td>
            <td>${a.entity_type}</td>
            <td style="font-size:0.85rem;"><code>${JSON.stringify(a.metadata || {})}</code></td>
        </tr>
    `).join('');
}


// ================= CLASS MONITOR DASHBOARD =================
let monitorActiveTab = 'take-attendance';

async function switchMonitorTab(tabId) {
    monitorActiveTab = tabId;
    const navItems = document.querySelectorAll('#monitor-dashboard .nav-item');
    navItems.forEach(item => {
        const match = item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabId);
        item.classList.toggle('active', match);
    });

    const tabs = document.querySelectorAll('#monitor-dashboard .tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');

    if (tabId === 'take-attendance') await loadStudentsForAttendance();
    else if (tabId === 'add-student') await loadStudentDirectory();
    else if (tabId === 'share-records') await loadMonitorSharedLogs();
}

async function initializeMonitorDashboard() {
    await loadClassDropdowns();
    await switchMonitorTab('take-attendance');
}

async function loadClassDropdowns() {
    const classes = await select('academic_classes');
    const attClass = document.getElementById('att-class');
    const studClass = document.getElementById('stud-class');

    if (attClass) attClass.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (studClass) studClass.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function loadStudentsForAttendance() {
    const students = await select('students');
    const container = document.getElementById('attendance-checklist-container');
    const rosterCount = document.getElementById('roster-count');

    if (rosterCount) rosterCount.textContent = `${students.length} Students`;
    if (!container) return;

    if (students.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><p>No students enrolled.</p></div>';
        return;
    }

    container.innerHTML = students.map(s => `
        <div class="attendance-row" data-student-id="${s.id}">
            <div class="student-info-col">
                <span class="student-name-txt">${s.full_name || s.name}</span>
                <span class="student-phone-txt"><span>📞 ${s.phone}</span></span>
            </div>
            <div class="attendance-pills" role="radiogroup">
                <button type="button" class="pill-btn present-pill active" onclick="setAttendanceStatus('${s.id}', 'present')" id="pill-p-${s.id}">P</button>
                <button type="button" class="pill-btn absent-pill" onclick="setAttendanceStatus('${s.id}', 'absent')" id="pill-a-${s.id}">A</button>
            </div>
        </div>
    `).join('');
}

function setAttendanceStatus(studentId, status) {
    const p = document.getElementById(`pill-p-${studentId}`);
    const a = document.getElementById(`pill-a-${studentId}`);
    if (status === 'present') {
        if (p) p.classList.add('active');
        if (a) a.classList.remove('active');
    } else {
        if (a) a.classList.add('active');
        if (p) p.classList.remove('active');
    }
}

async function handleMonitorAttendanceSubmit(event) {
    event.preventDefault();
    const classId = document.getElementById('att-class').value;
    const attDate = document.getElementById('att-date').value;
    const startTime = document.getElementById('att-start-time').value;
    const endTime = document.getElementById('att-end-time').value;
    const subject = document.getElementById('att-subject').value.trim();
    const topic = document.getElementById('att-topic').value.trim();

    const students = await select('students');
    if (students.length === 0) return;

    const sessionId = 'sess-' + Date.now();
    await insert('attendance_sessions', {
        id: sessionId,
        class_id: classId,
        subject_name: subject,
        teacher_id: currentUserProfile ? currentUserProfile.id : null,
        date: attDate,
        start_time: startTime,
        end_time: endTime,
        topic,
        submitted_by_name: currentUserProfile ? currentUserProfile.full_name : 'Monitor'
    });

    for (const s of students) {
        const aPill = document.getElementById(`pill-a-${s.id}`);
        const status = aPill && aPill.classList.contains('active') ? 'absent' : 'present';
        await insert('attendance_records', {
            session_id: sessionId,
            student_id: s.id,
            status
        });
    }

    showToast('Attendance logged successfully!', 'success');
    document.getElementById('att-topic').value = '';
    await loadStudentsForAttendance();
}

async function addStudent(event) {
    event.preventDefault();
    const classId = document.getElementById('stud-class').value;
    const name = document.getElementById('stud-name').value.trim();
    const phone = document.getElementById('stud-phone').value.trim();
    const whatsapp = document.getElementById('stud-whatsapp').value.trim();

    const classes = await select('academic_classes');
    const cls = classes.find(c => c.id === classId);

    await insert('students', {
        id: 'stu-' + Date.now(),
        student_id: 'STU' + Date.now().toString().slice(-6),
        full_name: name,
        phone,
        whatsapp: whatsapp || phone,
        department_id: cls ? cls.department_id : null,
        class_id: classId,
        alerts_enabled: true,
        status: 'active'
    });

    showToast(`Added ${name} to class directory!`, 'success');
    document.getElementById('add-student-form').reset();
    await loadStudentDirectory();
}

async function loadStudentDirectory() {
    const students = await select('students');
    const tbody = document.getElementById('student-directory-tbody');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No students found in class directory</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr>
            <td style="font-weight:600;">${s.full_name || s.name}</td>
            <td>📞 ${s.phone}</td>
            <td>💬 ${s.whatsapp || s.phone}</td>
            <td><span class="badge-present">Active</span></td>
        </tr>
    `).join('');
}

async function loadMonitorSharedLogs() {
    const logs = await getAttendanceLogsFromDB();
    const classes = await select('academic_classes');
    const tbody = document.getElementById('monitor-logs-tbody');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No attendance records logged yet</td></tr>';
        return;
    }

    logs.sort((a,b) => b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || ''));

    tbody.innerHTML = logs.map(l => {
        const cls = classes.find(c => c.id === l.classId);
        let pres = 0, abs = 0;
        Object.values(l.records).forEach(st => {
            if (st === 'present') pres++;
            else abs++;
        });
        return `
            <tr>
                <td>${l.date}</td>
                <td style="font-weight:600;">${cls ? cls.name : 'Class'}</td>
                <td><strong>${l.subject}</strong><br><span style="font-size:0.85rem; color:var(--text-secondary);">${l.topic}</span></td>
                <td>${l.startTime} - ${l.endTime}</td>
                <td><span class="badge-present">${pres} P</span> <span class="badge-absent">${abs} A</span></td>
                <td>
                    <button class="action-icon-btn share-btn-secondary" onclick="shareRecordToTeacher('${l.id}')">Copy Report 📋</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function shareRecordToTeacher(logId) {
    const logs = await getAttendanceLogsFromDB();
    const log = logs.find(l => l.id === logId);
    if (!log) return;

    const classes = await select('academic_classes');
    const students = await select('students');
    const cls = classes.find(c => c.id === log.classId);

    const pres = [];
    const abs = [];

    Object.entries(log.records).forEach(([sId, st]) => {
        const s = students.find(stud => stud.id === sId);
        if (s) {
            if (st === 'present') pres.push(s.full_name || s.name);
            else abs.push(s.full_name || s.name);
        }
    });

    const report = `*AttendEase Attendance Report*
🏫 Class: ${cls ? cls.name : 'Class'}
📅 Date: ${log.date}
🕒 Time: ${log.startTime} to ${log.endTime}
📚 Subject: ${log.subject}
📖 Topic: ${log.topic}
--------------------------------
✅ Present (${pres.length}): ${pres.length > 0 ? pres.join(', ') : 'None'}
❌ Absent (${abs.length}): ${abs.length > 0 ? abs.join(', ') : 'None'}
--------------------------------
Submitted via AttendEase Cloud.`;

    navigator.clipboard.writeText(report).then(() => {
        showToast('Report copied to clipboard! Ready to send.', 'success');
    }).catch(() => {
        showToast('Clipboard permissions denied. Copy manually.', 'error');
    });
}

// ================= CLOUD CONFIGURATION MODAL HANDLERS =================
function openCloudConfigModal() {
    const urlInput = document.getElementById('cfg-supabase-url');
    const keyInput = document.getElementById('cfg-supabase-anon-key');
    const msgDiv = document.getElementById('cfg-status-message');

    if (urlInput && SUPABASE_CONFIG) urlInput.value = SUPABASE_CONFIG.url || '';
    if (keyInput && SUPABASE_CONFIG) keyInput.value = SUPABASE_CONFIG.anonKey || '';
    if (msgDiv) msgDiv.style.display = 'none';

    const m = document.getElementById('cloud-config-modal');
    if (m) m.classList.add('active');
}

function closeCloudConfigModal() {
    const m = document.getElementById('cloud-config-modal');
    if (m) m.classList.remove('active');
}

async function handleCloudConfigSubmit(event) {
    event.preventDefault();
    const url = document.getElementById('cfg-supabase-url').value.trim();
    const anonKey = document.getElementById('cfg-supabase-anon-key').value.trim();
    const msgDiv = document.getElementById('cfg-status-message');

    if (!url || !anonKey) {
        showToast('Please enter both Supabase Project URL and Anon API Key.', 'error');
        return;
    }

    try {
        const ok = saveCloudCredentials(url, anonKey);
        if (ok) {
            showToast('Connected to Supabase Project!', 'success');
            if (msgDiv) {
                msgDiv.style.display = 'block';
                msgDiv.style.background = 'rgba(16, 185, 129, 0.15)';
                msgDiv.style.color = '#34d399';
                msgDiv.textContent = '✅ Connected successfully to ' + url;
            }
            setTimeout(() => {
                closeCloudConfigModal();
                renderAppForSession();
            }, 800);
        } else {
            showToast('Connection failed. Please verify your Project URL and Anon Key.', 'error');
            if (msgDiv) {
                msgDiv.style.display = 'block';
                msgDiv.style.background = 'rgba(244, 63, 94, 0.15)';
                msgDiv.style.color = '#fb7185';
                msgDiv.textContent = '❌ Failed to initialize Supabase client. Check credentials.';
            }
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ================= SUPABASE PASSWORD RESET MODAL HANDLERS =================
function openPasswordResetModal() {
    const m = document.getElementById('reset-password-modal');
    if (m) m.classList.add('active');
}

function closePasswordResetModal() {
    const m = document.getElementById('reset-password-modal');
    if (m) m.classList.remove('active');
    const form = document.getElementById('modal-reset-password-form');
    if (form) form.reset();
}

function evaluatePasswordStrength(password, barId, labelId) {
    const bar = document.getElementById(barId);
    const label = document.getElementById(labelId);
    if (!bar || !label) return;

    if (!password) {
        bar.style.width = '0%';
        bar.style.background = 'transparent';
        label.textContent = 'Password strength';
        return;
    }

    let score = 0;
    if (password.length >= 6) score += 33;
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) score += 33;
    if (password.length >= 10 && /[^a-zA-Z0-9]/.test(password)) score += 34;

    bar.style.width = score + '%';
    if (score <= 33) {
        bar.style.background = '#f43f5e';
        label.textContent = 'Weak (min 6 characters)';
    } else if (score <= 66) {
        bar.style.background = '#f59e0b';
        label.textContent = 'Moderate (mix numbers & letters)';
    } else {
        bar.style.background = '#10b981';
        label.textContent = 'Strong ✓';
    }
}

async function handlePasswordResetSubmit(event) {
    event.preventDefault();
    const newPassword = document.getElementById('modal-new-password').value;
    const confirmPassword = document.getElementById('modal-confirm-new-password').value;

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
    }

    try {
        if (!supabaseClient) initSupabase();
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;

        await logAuditEvent('PASSWORD_RECOVERY_SUCCESS', 'user', { timestamp: new Date().toISOString() });
        showToast('Password successfully updated! You are now logged in.', 'success');
        closePasswordResetModal();
        await renderAppForSession();
    } catch (e) {
        console.error('Password reset error:', e);
        showToast('Password update failed: ' + e.message, 'error');
    }
}



// ================= INITIALIZATION AT DOM READY =================
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeDatabase();
        await renderAppForSession();
    } catch (e) {
        console.error('App initialization error:', e);
    }

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker active.'))
            .catch(err => console.log('SW registration note:', err.message));
    }
});
