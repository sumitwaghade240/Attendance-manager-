// ============================================================================
// AttendEase Supabase Client & Real Cloud Connection Layer
// ============================================================================

const SUPABASE_CONFIG = {
    url: (typeof window !== 'undefined' && window.ENV && window.ENV.SUPABASE_URL) ||
         (typeof localStorage !== 'undefined' && localStorage.getItem('ATTENDEASE_SUPABASE_URL')) ||
         '',
    anonKey: (typeof window !== 'undefined' && window.ENV && window.ENV.SUPABASE_ANON_KEY) ||
             (typeof localStorage !== 'undefined' && localStorage.getItem('ATTENDEASE_SUPABASE_ANON_KEY')) ||
             ''
};

let supabaseClient = null;
let isCloudConnected = false;

// Network & Cloud Status Tracking
const NetworkStatus = {
    state: 'not_configured', // 'online' | 'not_configured' | 'offline' | 'error'
    listeners: [],
    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.state);
    },
    setState(newState) {
        this.state = newState;
        this.listeners.forEach(cb => {
            try { cb(newState); } catch (e) { console.error(e); }
        });
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        if (isCloudConnected) NetworkStatus.setState('online');
    });
    window.addEventListener('offline', () => NetworkStatus.setState('offline'));
}

// Check if credentials are valid (non-empty and not placeholder)
function isConfigured(url, key) {
    if (!url || !key) return false;
    const cleanUrl = url.trim().toLowerCase();
    const cleanKey = key.trim();
    if (cleanUrl.includes('your-project-id') || cleanUrl.includes('demo-college.supabase.co')) return false;
    if (cleanKey.includes('your-anon-key') || cleanKey.includes('sample-anon-key')) return false;
    return cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');
}

// Initialize Real Supabase Client
function initSupabase(customUrl, customKey) {
    const url = customUrl || SUPABASE_CONFIG.url;
    const anonKey = customKey || SUPABASE_CONFIG.anonKey;

    if (!isConfigured(url, anonKey)) {
        supabaseClient = null;
        isCloudConnected = false;
        NetworkStatus.setState('not_configured');
        console.warn('AttendEase: Supabase Cloud is NOT configured. Please provide SUPABASE_URL and SUPABASE_ANON_KEY.');
        return false;
    }

    try {
        let createClientFn = null;
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            createClientFn = window.supabase.createClient;
        } else if (typeof require !== 'undefined') {
            try {
                const supa = require('@supabase/supabase-js');
                createClientFn = supa.createClient;
            } catch (e) {
                // Ignore in browser
            }
        }

        if (!createClientFn) {
            console.error('Supabase JS library is not loaded on page.');
            NetworkStatus.setState('error');
            return false;
        }

        supabaseClient = createClientFn(url, anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });

        if (typeof window !== 'undefined') window.supabaseClient = supabaseClient;
        if (typeof global !== 'undefined') global.supabaseClient = supabaseClient;

        isCloudConnected = true;
        NetworkStatus.setState('online');
        console.log('AttendEase: Real Supabase Cloud Client Initialized successfully with project:', url);

        // Setup Auth State Change Listener
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Supabase Auth State Change:', event);
            if (event === 'PASSWORD_RECOVERY') {
                // Open Reset Password dialog
                if (typeof openPasswordResetModal === 'function') {
                    openPasswordResetModal();
                }
            } else if (event === 'SIGNED_OUT') {
                if (typeof renderAppForSession === 'function') {
                    await renderAppForSession();
                }
            }
        });

        return true;
    } catch (e) {
        console.error('Failed to initialize Supabase client:', e.message);
        NetworkStatus.setState('error');
        return false;
    }
}

// Function to save and switch Supabase credentials from Settings Modal
function saveCloudCredentials(url, key) {
    if (!url || !key) {
        throw new Error('Please enter both Supabase Project URL and Anon API Key.');
    }
    const cleanUrl = url.trim();
    const cleanKey = key.trim();

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ATTENDEASE_SUPABASE_URL', cleanUrl);
        localStorage.setItem('ATTENDEASE_SUPABASE_ANON_KEY', cleanKey);
    }
    SUPABASE_CONFIG.url = cleanUrl;
    SUPABASE_CONFIG.anonKey = cleanKey;

    const ok = initSupabase(cleanUrl, cleanKey);
    return ok;
}

// Global initialization
if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
    window.NetworkStatus = NetworkStatus;
    window.initSupabase = initSupabase;
    window.saveCloudCredentials = saveCloudCredentials;
}
if (typeof global !== 'undefined') {
    global.SUPABASE_CONFIG = SUPABASE_CONFIG;
    global.NetworkStatus = NetworkStatus;
    global.initSupabase = initSupabase;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabase,
        getSupabaseClient: () => supabaseClient,
        SUPABASE_CONFIG,
        NetworkStatus,
        saveCloudCredentials
    };
}
