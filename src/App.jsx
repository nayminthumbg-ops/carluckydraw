import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithEmailAndPassword, 
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc 
} from 'firebase/firestore';
import { 
  Car, Ticket, User, Phone, MapPin, Image as ImageIcon, 
  CheckCircle, Clock, AlertTriangle, LogOut, Settings, 
  LayoutDashboard, ShieldCheck, Download, Key, Info
} from 'lucide-react';

// ==========================================
// Firebase Initialization
// ==========================================
const getFirebaseConfig = () => {
  // Canvas အတွင်း Preview ကြည့်ရန်
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }
  
  // အမှန်တကယ်အသုံးပြုမည့် Firebase Config များ
  return {
    apiKey: "AIzaSyBgCQIlUY43KLOw7W8h29WOgqdeEWy68fY",
    authDomain: "carluckydraw101.firebaseapp.com",
    projectId: "carluckydraw101",
    storageBucket: "carluckydraw101.firebasestorage.app",
    messagingSenderId: "790570899774",
    appId: "1:790570899774:web:cb3a737270da85c238f46f",
  };
};

const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lucky-draw-prod';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [ticketsData, setTicketsData] = useState({});
  const [systemSettings, setSystemSettings] = useState({
    ticketImage: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800',
    drawDate: '2026-12-31',
    customNote: 'Thank you for participating in our lucky draw.'
  });
  
  // UI/Modal States
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showVoucher, setShowVoucher] = useState(null);
  
  // Admin Login States
  const [clickCount, setClickCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const clickTimeoutRef = useRef(null);

  // Form State (User Booking)
  const [formData, setFormData] = useState({
    name: '', phone: '', address: '', txnId: '', screenshot: ''
  });

  // Admin Dashboard States
  const [adminTab, setAdminTab] = useState('dashboard');

  // 1. Auth Setup & Remember Me
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (!currentUser.isAnonymous) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anon Auth Error:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets'));
    const unsubTickets = onSnapshot(q, (snapshot) => {
      const data = {};
      snapshot.forEach(doc => { data[doc.id] = doc.data(); });
      setTicketsData(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'system_config', 'default');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings(docSnap.data());
      }
    });

    return () => {
      unsubTickets();
      unsubSettings();
    };
  }, [user]);

  // Generate Numbers
  const numbers = useMemo(() => Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0')), []);

  // Hidden Admin Trigger Logic
  const handleLogoClick = () => {
    setClickCount(prev => prev + 1);
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => setClickCount(0), 1000);

    if (clickCount === 2) { 
      if (!isAdmin) setShowLoginModal(true);
      setClickCount(0);
    }
  };

  // Admin Login Handler with Detailed Errors
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      setShowLoginModal(false);
      setLoginForm({ email: '', password: '' });
    } catch (error) {
      console.error("Firebase Login Error Details:", error);
      if (error.code === 'auth/invalid-credential') {
        setLoginError('အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။ သေချာစစ်ဆေးပါ။');
      } else if (error.code === 'auth/too-many-requests') {
        setLoginError('အကြိမ်ပေါင်းများစွာ မှားယွင်းရိုက်ထည့်ထားသဖြင့် ခေတ္တပိတ်ထားပါသည်။ ခဏစောင့်ပါ။');
      } else if (error.code === 'auth/user-not-found') {
        setLoginError('ဤအီးမေးလ်ဖြင့် အကောင့်မရှိပါ။');
      } else if (error.code === 'auth/wrong-password') {
        setLoginError('စကားဝှက် မှားယွင်းနေပါသည်။');
      } else {
        setLoginError(error.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
    await signInAnonymously(auth);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'system_config', 'default');
    await setDoc(settingsRef, systemSettings);
    alert('Settings updated successfully!');
  };

  const handleNumberClick = (num) => {
    if (isAdmin) return; 
    const status = ticketsData[num]?.status;

    if (status === 'success') return; 
    else if (status === 'pending') setShowAlert(true);
    else {
      setSelectedNumber(num);
      setShowForm(true);
    }
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!user) return;

    const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets', selectedNumber);
    await setDoc(ticketRef, {
      id: selectedNumber,
      status: 'pending',
      ...formData,
      userId: user.uid,
      timestamp: Date.now(),
      round: "Round-1"
    });

    setShowForm(false);
    setFormData({ name: '', phone: '', address: '', txnId: '', screenshot: '' });
  };

  const handleApprove = async (ticket) => {
    if (!isAdmin) return;
    const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets', ticket.id);
    const securityHash = `LD${new Date().getFullYear()}${ticket.id}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    await setDoc(ticketRef, { 
      ...ticket, 
      status: 'success', 
      approvedAt: Date.now(),
      securityCode: securityHash
    });
  };

  const handleReject = async (ticketId) => {
    if (!isAdmin) return;
    const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets', ticketId);
    await deleteDoc(ticketRef);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl md:text-2xl font-bold animate-pulse text-yellow-600">Loading System...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <nav className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center">
        <div 
          className="flex items-center space-x-2 cursor-pointer select-none"
          onClick={handleLogoClick}
          title="Click 3 times to access Admin Login"
        >
          <Car className="text-yellow-400 w-8 h-8" />
          <h1 className="text-xl md:text-2xl font-bold">VIP Car Lucky Draw</h1>
        </div>
        
        {isAdmin && (
          <div className="flex space-x-2">
             <button onClick={() => setAdminTab('dashboard')} className={`px-3 py-2 rounded-md flex items-center space-x-1 ${adminTab === 'dashboard' ? 'bg-yellow-500 text-slate-900 font-bold' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <LayoutDashboard className="w-4 h-4" /> <span className="hidden md:inline">Dashboard</span>
            </button>
            <button onClick={() => setAdminTab('settings')} className={`px-3 py-2 rounded-md flex items-center space-x-1 ${adminTab === 'settings' ? 'bg-yellow-500 text-slate-900 font-bold' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <Settings className="w-4 h-4" /> <span className="hidden md:inline">Settings</span>
            </button>
            <button onClick={handleLogout} className="px-3 py-2 bg-red-500 hover:bg-red-600 rounded-md flex items-center space-x-1 transition ml-4">
              <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        )}
      </nav>

      {/* ================= USER VIEW ================= */}
      {!isAdmin && (
        <div className="max-w-6xl mx-auto p-4 py-8">
          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500 flex flex-col md:flex-row md:justify-between items-center space-y-4 md:space-y-0">
            <div>
              <h2 className="text-xl font-bold text-slate-800">မဲလက်မှတ် ရွေးချယ်ရန်</h2>
              <p className="text-sm text-gray-500">000 မှ 999 အထိ မိမိနှစ်သက်ရာ ဂဏန်းကို ရွေးချယ်နိုင်ပါသည်</p>
            </div>
            <div className="flex space-x-4 text-sm font-medium">
              <div className="flex items-center"><div className="w-4 h-4 rounded bg-white border border-gray-300 mr-2"></div> ရနိုင်သည်</div>
              <div className="flex items-center"><div className="w-4 h-4 rounded bg-orange-400 mr-2 shadow-[0_0_8px_rgba(251,146,60,0.6)]"></div> စစ်ဆေးဆဲ</div>
              <div className="flex items-center"><div className="w-4 h-4 rounded bg-green-500 mr-2"></div> ရောင်းပြီး</div>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1 sm:gap-2 p-2 bg-white rounded-xl shadow-inner border border-gray-100">
            {numbers.map((num) => {
              const status = ticketsData[num]?.status;
              let bgClass = "bg-white border-gray-300 hover:bg-yellow-50 hover:border-yellow-400 text-gray-700";
              let cursorClass = "cursor-pointer";

              if (status === 'success') {
                bgClass = "bg-green-500 border-green-600 text-white opacity-40 cursor-not-allowed";
              } else if (status === 'pending') {
                bgClass = "bg-orange-400 border-orange-500 text-white shadow-[0_0_10px_rgba(251,146,60,0.8)] animate-pulse border-2";
              }

              return (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  disabled={status === 'success'}
                  className={`${bgClass} ${cursorClass} border py-2 sm:py-3 rounded-md sm:rounded-lg text-sm sm:text-base md:text-lg font-bold transition-all duration-200 flex items-center justify-center`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= ADMIN VIEW ================= */}
      {isAdmin && (
        <div className="max-w-6xl mx-auto p-4 py-8">
          
          {adminTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center"><ShieldCheck className="mr-2 text-yellow-500"/> User Bookings</h2>
              </div>

              <div className="bg-white rounded-xl shadow-md overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="p-4 border-b">Number</th>
                      <th className="p-4 border-b">User Info</th>
                      <th className="p-4 border-b">Payment Info</th>
                      <th className="p-4 border-b">Status</th>
                      <th className="p-4 border-b">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(ticketsData).sort((a,b) => b.timestamp - a.timestamp).map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50 transition border-b last:border-b-0">
                        <td className="p-4">
                          <span className="text-2xl font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-md">{ticket.id}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-gray-800">{ticket.name}</div>
                          <div className="text-sm text-gray-500">{ticket.phone}</div>
                          <div className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">{ticket.address}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-mono text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded inline-block mb-1">Txn: {ticket.txnId}</div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <ImageIcon className="w-3 h-3" /> <span>Screenshot attached</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {ticket.status === 'pending' ? (
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold flex items-center inline-flex">
                              <Clock className="w-4 h-4 mr-1" /> Pending
                            </span>
                          ) : (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center inline-flex">
                              <CheckCircle className="w-4 h-4 mr-1" /> Approved
                            </span>
                          )}
                        </td>
                        <td className="p-4 space-x-2 flex items-center mt-2">
                          {ticket.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(ticket)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md font-medium transition shadow-sm text-sm">
                                Allow
                              </button>
                              <button onClick={() => handleReject(ticket.id)} className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-md font-medium transition text-sm">
                                Reject
                              </button>
                            </>
                          )}
                          {ticket.status === 'success' && (
                            <button onClick={() => setShowVoucher(ticket)} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md font-medium transition shadow-sm flex items-center space-x-1 text-sm">
                              <Ticket className="w-4 h-4" /> <span>E-Ticket</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {Object.keys(ticketsData).length === 0 && (
                      <tr><td colSpan="5" className="p-8 text-center text-gray-500">No tickets found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-md animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold mb-6 border-b pb-2 flex items-center">
                <Settings className="mr-2 text-gray-500"/> E-Ticket Settings
              </h2>
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Car/Prize Image URL (E-Ticket ပေါ်တွင်ပြရန်)</label>
                  <input 
                    type="url" required value={systemSettings.ticketImage}
                    onChange={(e) => setSystemSettings({...systemSettings, ticketImage: e.target.value})}
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none"
                  />
                  {systemSettings.ticketImage && (
                     <img src={systemSettings.ticketImage} alt="Preview" className="mt-2 h-32 w-auto object-cover rounded border" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Draw Date (ပေါက်မဲဖွင့်မည့်ရက်)</label>
                  <input 
                    type="date" required value={systemSettings.drawDate}
                    onChange={(e) => setSystemSettings({...systemSettings, drawDate: e.target.value})}
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Custom Note / Terms (E-Ticket အောက်ခြေစာသား)</label>
                  <textarea 
                    rows="3" value={systemSettings.customNote}
                    onChange={(e) => setSystemSettings({...systemSettings, customNote: e.target.value})}
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none"
                  ></textarea>
                </div>
                <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition shadow-md">
                  Save Changes
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}
      
      {/* 0. Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center"><Key className="w-4 h-4 mr-2"/> Admin Access</h3>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              {loginError && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-sm font-medium border border-red-100 flex items-start">
                  <Info className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-bold text-gray-700">Email Address</label>
                <input 
                  type="email" required value={loginForm.email}
                  onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                  className="w-full border p-3 rounded-lg mt-1 focus:ring-2 focus:ring-slate-500 outline-none" 
                  placeholder="admin@carluckydraw.com" 
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700">Password</label>
                <input 
                  type="password" required value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full border p-3 rounded-lg mt-1 focus:ring-2 focus:ring-slate-500 outline-none" 
                  placeholder="••••••••" 
                />
              </div>
              <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition">Login (Remember Me)</button>
            </form>
          </div>
        </div>
      )}

      {/* 1. User Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">ဝယ်ယူရန် အချက်အလက်ဖြည့်ပါ</h3>
              <div className="text-2xl font-black text-yellow-400 bg-slate-800 px-3 py-1 rounded-lg"># {selectedNumber}</div>
            </div>
            
            <form onSubmit={handleSubmitBooking} className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-600 flex items-center"><User className="w-4 h-4 mr-1"/> အမည်</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="အမည် အပြည့်အစုံ" />
                
                <label className="text-sm font-semibold text-gray-600 flex items-center"><Phone className="w-4 h-4 mr-1"/> ဖုန်းနံပါတ်</label>
                <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="09xxxxxxxxx" />
                
                <label className="text-sm font-semibold text-gray-600 flex items-center"><MapPin className="w-4 h-4 mr-1"/> နေရပ်လိပ်စာ</label>
                <textarea required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="အိမ်အမှတ်၊ လမ်း၊ မြို့နယ်" rows="2"></textarea>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 space-y-3">
                <p className="text-sm font-bold text-yellow-800 mb-2">KPay သို့မဟုတ် Wave Money ဖြင့် ငွေပေးချေပါ</p>
                <input required type="text" maxLength="6" value={formData.txnId} onChange={e => setFormData({...formData, txnId: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none font-mono tracking-widest" placeholder="လုပ်ငန်းစဉ် နောက်ဆုံး ၆ လုံး" />
                <div className="relative">
                  <input required type="file" accept="image/*" onChange={(e) => { if(e.target.files[0]) setFormData({...formData, screenshot: "file_selected"}) }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-100 file:text-yellow-700 hover:file:bg-yellow-200" />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="w-1/2 py-3 border-2 border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition">မလုပ်တော့ပါ</button>
                <button type="submit" className="w-1/2 py-3 bg-yellow-500 text-slate-900 rounded-lg font-bold hover:bg-yellow-400 transition shadow-md">အတည်ပြုသည်</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Pending Alert Modal */}
      {showAlert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">စောင့်ဆိုင်းနေပါသည်</h3>
            <p className="text-gray-600 mb-6">
              ဤနံပါတ်ကို အခြားသူတစ်ဦးမှ ရွေးချယ်ထားပြီး ငွေသွင်းရန်စောင့်ဆိုင်းနေပါသည်။ <br/><br/>
              သတ်မှတ်ချိန်အတွင်း ငွေမသွင်းပါက မိမိမှ ပြန်လည်ရွေးချယ် ဝယ်ယူနိုင်မည်ဖြစ်ပါသည်။
            </p>
            <button onClick={() => setShowAlert(false)} className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition">နားလည်ပါပြီ</button>
          </div>
        </div>
      )}

      {/* 3. Secure E-Ticket Voucher Modal */}
      {showVoucher && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="relative my-8">
            <button onClick={() => setShowVoucher(null)} className="absolute -top-12 right-0 text-white font-bold bg-slate-800 px-4 py-2 rounded-full hover:bg-slate-700">အပိတ် (X)</button>
            <button className="absolute -top-12 left-0 text-slate-900 font-bold bg-yellow-400 px-4 py-2 rounded-full hover:bg-yellow-300 flex items-center space-x-2">
              <Download className="w-4 h-4"/> <span>Save Image</span>
            </button>

            <div id="voucher-capture" className="bg-[#1a1a1a] w-[90vw] max-w-md sm:min-w-[400px] rounded-2xl shadow-2xl overflow-hidden border border-yellow-500/30 relative mx-auto">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] overflow-hidden z-0">
                <div className="transform -rotate-45 text-[8rem] font-black text-white whitespace-nowrap leading-none">
                  OFFICIAL {showVoucher.id}
                </div>
              </div>
              
              <div className="p-6 text-center border-b border-yellow-500/20 relative z-10 bg-gradient-to-b from-yellow-500/10 to-transparent">
                <h2 className="text-yellow-500 font-black text-2xl tracking-widest uppercase">Official E-Ticket</h2>
                <div className="text-gray-400 text-xs mt-1 font-mono tracking-widest bg-black/30 inline-block px-3 py-1 rounded">SEC: {showVoucher.securityCode}</div>
              </div>

              <div className="relative h-56 w-full bg-slate-800 z-10 border-y border-yellow-500/10">
                <img 
                  src={systemSettings.ticketImage} 
                  alt="Prize" 
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent"></div>
                
                <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
                   <div className="bg-gradient-to-b from-yellow-400 to-yellow-600 text-slate-900 font-black text-5xl px-10 py-3 rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.5)] border-4 border-[#1a1a1a]">
                     {showVoucher.id}
                   </div>
                </div>
              </div>

              <div className="px-6 pt-12 pb-6 relative z-10">
                <div className="space-y-4">
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-y-3">
                      <div className="text-gray-400 text-xs uppercase font-bold">Name</div>
                      <div className="text-white font-bold text-right truncate">{showVoucher.name}</div>
                      
                      <div className="text-gray-400 text-xs uppercase font-bold">Phone</div>
                      <div className="text-white font-bold text-right">{showVoucher.phone}</div>
                      
                      <div className="text-gray-400 text-xs uppercase font-bold">Issued Date</div>
                      <div className="text-white font-medium text-right text-sm">{new Date(showVoucher.approvedAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex justify-between items-center">
                    <div className="flex items-center text-yellow-500">
                      <Clock className="w-5 h-5 mr-2" />
                      <span className="font-bold text-sm">ပေါက်မဲဖွင့်မည့်ရက်</span>
                    </div>
                    <div className="text-yellow-400 font-black">{new Date(systemSettings.drawDate).toLocaleDateString()}</div>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <p className="text-xs text-gray-500 italic mb-4 px-4">{systemSettings.customNote}</p>
                  <div className="flex justify-center items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <p className="text-xs text-green-500/80 font-bold tracking-widest uppercase">Verified & Approved</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}