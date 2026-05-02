import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithEmailAndPassword, 
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, updateDoc 
} from 'firebase/firestore';
import { 
  Car, Ticket, User, Phone, MapPin, Image as ImageIcon, 
  CheckCircle, Clock, AlertTriangle, LogOut, Settings, 
  LayoutDashboard, ShieldCheck, Download, Key, Info,
  Copy, Trophy, Archive, PlayCircle, History, Trash2, Upload
} from 'lucide-react';

// ==========================================
// Firebase Initialization
// ==========================================
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }
  // Hardcoded for Local / Vercel Build (Removed import.meta to avoid esbuild errors)
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
  const [winnersData, setWinnersData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [systemSettings, setSystemSettings] = useState({
    shopName: 'VIP Car Lucky Draw',
    ticketImage: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800',
    drawDate: '2026-12-31',
    customNote: 'Thank you for participating in our lucky draw.',
    kpayNumber: '09123456789',
    waveNumber: '09912345678',
    isRoundActive: true,
    currentRound: 1,
    latestWinner: null
  });
  
  // UI States
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showAlert, setShowAlert] = useState('');
  const [showVoucher, setShowVoucher] = useState(null);
  const [userTab, setUserTab] = useState('home'); // 'home' or 'history'
  
  // Admin States
  const [adminTab, setAdminTab] = useState('dashboard'); // 'dashboard', 'settings', 'history'
  const [showEndRoundModal, setShowEndRoundModal] = useState(false);
  const [winNumberInput, setWinNumberInput] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const clickTimeoutRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', phone: '', address: '', txnId: '', screenshot: ''
  });

  // 1. Auth Setup
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAdmin(!currentUser.isAnonymous);
      } else {
        try { await signInAnonymously(auth); } catch (e) { console.error(e); }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    if (!user) return;
    
    // Fetch Active Tickets
    const unsubTickets = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets')), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => { data[doc.id] = doc.data(); });
      setTicketsData(data);
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });

    // Fetch System Settings (With NaN Fix)
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'system_config', 'default'), (docSnap) => {
      if (docSnap.exists()) { 
        const data = docSnap.data();
        let safeRound = parseInt(data.currentRound);
        if (isNaN(safeRound)) safeRound = 1; // Auto-fix NaN to 1

        setSystemSettings(prev => ({ 
          ...prev, 
          ...data,
          currentRound: safeRound,
          isRoundActive: data.isRoundActive !== undefined ? data.isRoundActive : prev.isRoundActive
        })); 
      }
    });

    // Fetch Winners (For Public History)
    const unsubWinners = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'lucky_winners')), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push(doc.data()));
      setWinnersData(data.sort((a, b) => b.round - a.round));
    });

    // Fetch Admin Full History
    const unsubHistory = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'lucky_history')), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push(doc.data()));
      setHistoryData(data.sort((a, b) => b.archivedAt - a.archivedAt));
    });

    return () => { unsubTickets(); unsubSettings(); unsubWinners(); unsubHistory(); };
  }, [user]);

  // Generators
  const numbers = useMemo(() => Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0')), []);

  // Group Tickets by Booking ID (For Admin View & Vouchers)
  const groupedBookings = useMemo(() => {
    const groups = {};
    Object.values(ticketsData).forEach(t => {
      if (!t.bookingId) return;
      if (!groups[t.bookingId]) {
        groups[t.bookingId] = { ...t, numbers: [] };
      }
      if (!groups[t.bookingId].numbers.includes(t.id)) {
        groups[t.bookingId].numbers.push(t.id);
      }
    });
    return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
  }, [ticketsData]);

  // Admin Login Triggers
  const handleLogoClick = () => {
    setClickCount(prev => prev + 1);
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => setClickCount(0), 1000);
    if (clickCount === 2) { 
      if (!isAdmin) setShowLoginModal(true);
      setClickCount(0);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      setShowLoginModal(false); setLoginForm({ email: '', password: '' });
    } catch (error) {
      setLoginError('Login Failed. Please check your credentials.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
    await signInAnonymously(auth);
  };

  // User Actions
  const handleNumberClick = (num) => {
    if (isAdmin) return;
    const status = ticketsData[num]?.status;
    
    if (status === 'success') return;
    if (status === 'pending') {
      setShowAlert(`နံပါတ် ${num} ကို အခြားသူရွေးချယ်ထားပြီး ငွေသွင်းရန်စောင့်ဆိုင်းနေပါသည်။`);
      return;
    }

    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    alert(text + " ကို Copy ကူးပြီးပါပြီ။");
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setSystemSettings({ ...systemSettings, ticketImage: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!user || selectedNumbers.length === 0) return;

    const bookingId = `${user.uid}-${Date.now()}`;
    const timestamp = Date.now();

    try {
      const promises = selectedNumbers.map(num => {
        return setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets', num), {
          id: num,
          bookingId: bookingId,
          status: 'pending',
          ...formData,
          userId: user.uid,
          timestamp: timestamp,
          round: parseInt(systemSettings.currentRound) || 1
        });
      });
      await Promise.all(promises);
      
      setShowForm(false);
      setSelectedNumbers([]);
      setFormData({ name: '', phone: '', address: '', txnId: '', screenshot: '' });
      alert("ဝယ်ယူမှု အောင်မြင်ပါသည်။ Admin မှ အတည်ပြုပေးပါမည်။");
    } catch (err) {
      console.error(err);
      alert("Error occurred. Please try again.");
    }
  };

  // Admin Actions
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'system_config', 'default'), {
      ...systemSettings,
      currentRound: parseInt(systemSettings.currentRound) || 1
    });
    alert('Settings updated successfully!');
  };

  const handleApproveBooking = async (booking) => {
    if (!isAdmin) return;
    const securityHash = `LD${new Date().getFullYear()}${booking.bookingId.substr(-4)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const approvedAt = Date.now();

    try {
      const promises = booking.numbers.map(num => {
        return updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets', num), {
          status: 'success',
          approvedAt: approvedAt,
          securityCode: securityHash
        });
      });
      await Promise.all(promises);
    } catch (err) { console.error(err); }
  };

  const handleDeleteBooking = async (booking) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to delete this booking?")) return;
    
    try {
      const promises = booking.numbers.map(num => {
        return deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets', num));
      });
      await Promise.all(promises);
    } catch (err) { console.error(err); }
  };

  const handleEndRound = async (e) => {
    e.preventDefault();
    if (!isAdmin || !winNumberInput) return;
    
    // Safety check for current round
    const activeRound = parseInt(systemSettings.currentRound) || 1;
    const paddedWinNumber = winNumberInput.padStart(3, '0');
    
    if (!window.confirm(`ARE YOU SURE?\n\nThis will end Round ${activeRound}, declare ${paddedWinNumber} as winner, archive all tickets, and RESET the board.`)) {
      return;
    }

    const winningTicket = ticketsData[paddedWinNumber];
    const winnerSummary = {
      round: activeRound,
      winNumber: paddedWinNumber,
      winnerName: winningTicket ? winningTicket.name : 'Unknown User',
      winnerPhone: winningTicket ? winningTicket.phone : 'No Phone',
      date: Date.now(),
      prizeImage: systemSettings.ticketImage,
      shopName: systemSettings.shopName
    };

    try {
      // 1. Save Winner Summary
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lucky_winners', `round_${activeRound}`), winnerSummary);

      // 2. Update Settings (Deactivate round)
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'system_config', 'default'), {
        ...systemSettings,
        isRoundActive: false,
        latestWinner: winnerSummary,
        currentRound: activeRound
      });

      // 3. Move all to history (Using Promise.all to bypass 500 batch limit)
      const historyPromises = Object.values(ticketsData).map(t => {
        return setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lucky_history', `${activeRound}_${t.id}`), {
          ...t,
          isWinner: t.id === paddedWinNumber,
          archivedAt: Date.now()
        });
      });
      await Promise.all(historyPromises);

      // 4. Delete active tickets
      const deletePromises = Object.keys(ticketsData).map(id => {
        return deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lucky_tickets', id));
      });
      await Promise.all(deletePromises);

      setShowEndRoundModal(false);
      setWinNumberInput('');
      alert("Round ended and saved to history successfully!");

    } catch (err) {
      console.error("End Round Error:", err);
      alert(`Error ending round: ${err.message}. Firebase Rules များကို သေချာစစ်ဆေးပါ။`);
    }
  };

  const handleStartNextRound = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Start new round? This will open the board for new users.")) return;

    const nextRound = (parseInt(systemSettings.currentRound) || 1) + 1;

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'system_config', 'default'), {
      ...systemSettings,
      isRoundActive: true,
      currentRound: nextRound
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold animate-pulse text-yellow-600">Loading System...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24">
      {/* Navigation */}
      <nav className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer select-none" onClick={handleLogoClick}>
          <Car className="text-yellow-400 w-8 h-8" />
          <h1 className="text-xl md:text-2xl font-bold">{systemSettings.shopName}</h1>
        </div>
        
        {isAdmin ? (
          <div className="flex space-x-2">
             <button onClick={() => setAdminTab('dashboard')} className={`px-3 py-2 rounded-md flex items-center ${adminTab === 'dashboard' ? 'bg-yellow-500 text-slate-900 font-bold' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <LayoutDashboard className="w-4 h-4 mr-1" /> <span className="hidden md:inline">Dashboard</span>
            </button>
            <button onClick={() => setAdminTab('history')} className={`px-3 py-2 rounded-md flex items-center ${adminTab === 'history' ? 'bg-yellow-500 text-slate-900 font-bold' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <Archive className="w-4 h-4 mr-1" /> <span className="hidden md:inline">History</span>
            </button>
            <button onClick={() => setAdminTab('settings')} className={`px-3 py-2 rounded-md flex items-center ${adminTab === 'settings' ? 'bg-yellow-500 text-slate-900 font-bold' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <Settings className="w-4 h-4 mr-1" /> <span className="hidden md:inline">Settings</span>
            </button>
            <button onClick={handleLogout} className="px-3 py-2 bg-red-500 hover:bg-red-600 rounded-md flex items-center ml-2">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <button onClick={() => setUserTab('home')} className={`px-4 py-2 rounded-md font-bold transition ${userTab === 'home' ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
              လက်ရှိမဲ
            </button>
            <button onClick={() => setUserTab('history')} className={`px-4 py-2 rounded-md font-bold transition flex items-center ${userTab === 'history' ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
              <History className="w-4 h-4 mr-1" /> မှတ်တမ်း
            </button>
          </div>
        )}
      </nav>

      {/* ================= USER VIEW ================= */}
      {!isAdmin && userTab === 'home' && (
        <div className="max-w-6xl mx-auto p-4 py-8">
          
          {/* Winner Announcement Screen (If Round is NOT active) */}
          {!systemSettings.isRoundActive && systemSettings.latestWinner ? (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-2xl mx-auto border-2 border-yellow-400 animate-in fade-in zoom-in duration-500">
              <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-transparent to-transparent"></div>
                <Trophy className="w-20 h-20 mx-auto text-yellow-400 mb-4 relative z-10 animate-bounce" />
                <h2 className="text-3xl font-black text-white relative z-10">CONGRATULATIONS!</h2>
                <p className="text-yellow-400 font-bold mt-2 relative z-10">Round {systemSettings.latestWinner.round} Winner</p>
              </div>
              <div className="p-8 text-center">
                <div className="mb-6">
                  <span className="block text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">Winning Number</span>
                  <span className="text-6xl font-black text-slate-800 bg-yellow-100 px-6 py-2 rounded-2xl inline-block shadow-inner border-2 border-yellow-300">{systemSettings.latestWinner.winNumber}</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-1">{systemSettings.latestWinner.winnerName}</h3>
                <p className="text-gray-500 font-mono mb-8">{systemSettings.latestWinner.winnerPhone}</p>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 font-medium">
                  မဲပေါက်သွားသော ကံထူးရှင်အား အထူးပင်ဂုဏ်ယူဝမ်းမြောက်မိပါသည်။<br/>
                  <span className="text-sm opacity-80">နောက်တစ်ကြိမ် အစီအစဉ်ကို မကြာမီ စတင်ပါမည်။</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Grid Screen */
            <>
              <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500 flex flex-col md:flex-row md:justify-between items-center space-y-4 md:space-y-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Round {parseInt(systemSettings.currentRound) || 1} - မဲလက်မှတ်များ</h2>
                  <p className="text-sm text-gray-500">မိမိနှစ်သက်ရာ ဂဏန်းများကို အများအပြား ရွေးချယ်နိုင်ပါသည်</p>
                </div>
                <div className="flex space-x-4 text-sm font-medium">
                  <div className="flex items-center"><div className="w-4 h-4 rounded bg-white border border-gray-300 mr-2"></div> ရနိုင်သည်</div>
                  <div className="flex items-center"><div className="w-4 h-4 rounded bg-orange-400 mr-2"></div> စစ်ဆေးဆဲ</div>
                  <div className="flex items-center"><div className="w-4 h-4 rounded bg-green-500 mr-2"></div> ရောင်းပြီး</div>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1 sm:gap-2 p-2 bg-white rounded-xl shadow-inner border border-gray-100">
                {numbers.map((num) => {
                  const status = ticketsData[num]?.status;
                  const isSelected = selectedNumbers.includes(num);
                  
                  let bgClass = "bg-white border-gray-300 hover:bg-yellow-50 text-gray-700";
                  let cursorClass = "cursor-pointer";

                  if (status === 'success') {
                    bgClass = "bg-green-500 border-green-600 text-white opacity-40 cursor-not-allowed";
                  } else if (status === 'pending') {
                    bgClass = "bg-orange-400 border-orange-500 text-white shadow-[0_0_10px_rgba(251,146,60,0.6)] border-2";
                  } else if (isSelected) {
                    bgClass = "bg-blue-600 border-blue-700 text-white shadow-md transform scale-105";
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
            </>
          )}
        </div>
      )}

      {/* Public History View */}
      {!isAdmin && userTab === 'history' && (
        <div className="max-w-4xl mx-auto p-4 py-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center"><Trophy className="text-yellow-500 mr-2" /> ယခင်ပေါက်မဲ ကံထူးရှင်များ</h2>
          {winnersData.length === 0 ? (
             <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">မှတ်တမ်း မရှိသေးပါ။</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {winnersData.map((winner, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-md overflow-hidden flex border border-gray-100">
                   <div className="w-1/3 bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
                      <span className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-1">Round {winner.round}</span>
                      <span className="text-3xl font-black">{winner.winNumber}</span>
                   </div>
                   <div className="w-2/3 p-4">
                      <h4 className="font-bold text-lg text-slate-800">{winner.winnerName}</h4>
                      <p className="text-sm text-gray-500 font-mono mt-1">{winner.winnerPhone.substring(0, 4)}XXXXX</p>
                      <p className="text-xs text-gray-400 mt-3">{new Date(winner.date).toLocaleDateString()}</p>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Buy Button (User View) */}
      {!isAdmin && selectedNumbers.length > 0 && userTab === 'home' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-10px_20px_rgba(0,0,0,0.1)] p-4 z-30 animate-in slide-in-from-bottom-full">
           <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center">
              <div className="mb-3 sm:mb-0 text-center sm:text-left">
                <p className="text-sm text-gray-500 font-bold">ရွေးချယ်ထားသော နံပါတ်များ ({selectedNumbers.length} စောင်)</p>
                <p className="font-black text-slate-800 text-lg flex flex-wrap gap-1 mt-1">
                  {selectedNumbers.map(n => <span key={n} className="bg-yellow-100 px-2 py-0.5 rounded text-yellow-800 text-sm border border-yellow-200">{n}</span>)}
                </p>
              </div>
              <button onClick={() => setShowForm(true)} className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition">
                ဝယ်ယူရန် ဆက်လုပ်ပါ
              </button>
           </div>
        </div>
      )}


      {/* ================= ADMIN VIEW ================= */}
      {isAdmin && (
        <div className="max-w-6xl mx-auto p-4 py-8">
          
          {/* Dashboard Tab */}
          {adminTab === 'dashboard' && (
            <div className="animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                  <ShieldCheck className="mr-2 text-yellow-500"/> Bookings (Round {parseInt(systemSettings.currentRound) || 1})
                </h2>
                
                <div className="flex space-x-2">
                  {!systemSettings.isRoundActive ? (
                    <button onClick={handleStartNextRound} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition flex items-center shadow-lg">
                      <PlayCircle className="w-5 h-5 mr-2" /> Start Next Round
                    </button>
                  ) : (
                    <button onClick={() => setShowEndRoundModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800 transition flex items-center shadow-lg">
                      <Trophy className="w-5 h-5 mr-2" /> Declare Winner (End Round)
                    </button>
                  )}
                </div>
              </div>

              {!systemSettings.isRoundActive && (
                 <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mb-6 text-yellow-800 flex items-center">
                    <Info className="w-5 h-5 mr-2 shrink-0" />
                    <span>Round is currently closed. Users see the winner announcement. Start the next round to accept new bookings.</span>
                 </div>
              )}

              <div className="bg-white rounded-xl shadow-md overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="p-4 border-b">Tickets</th>
                      <th className="p-4 border-b">User Info</th>
                      <th className="p-4 border-b">Payment Info</th>
                      <th className="p-4 border-b">Status</th>
                      <th className="p-4 border-b text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedBookings.map((booking) => (
                      <tr key={booking.bookingId} className="hover:bg-gray-50 transition border-b last:border-b-0">
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                             {booking.numbers.map(num => (
                               <span key={num} className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded text-sm">{num}</span>
                             ))}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">Total: {booking.numbers.length}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-gray-800">{booking.name}</div>
                          <div className="text-sm text-gray-500">{booking.phone}</div>
                          <div className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">{booking.address}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-mono text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded inline-block mb-1">Txn: {booking.txnId}</div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <ImageIcon className="w-3 h-3" /> <span>Screenshot attached</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {booking.status === 'pending' ? (
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold flex items-center inline-flex">
                              <Clock className="w-4 h-4 mr-1" /> Pending
                            </span>
                          ) : (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center inline-flex">
                              <CheckCircle className="w-4 h-4 mr-1" /> Approved
                            </span>
                          )}
                        </td>
                        <td className="p-4 flex flex-col items-end space-y-2">
                          {booking.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button onClick={() => handleApproveBooking(booking)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded font-medium shadow-sm text-sm">Approve</button>
                            </div>
                          )}
                          {booking.status === 'success' && (
                            <button onClick={() => setShowVoucher(booking)} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded font-medium shadow-sm flex items-center space-x-1 text-sm">
                              <Ticket className="w-4 h-4" /> <span>Voucher</span>
                            </button>
                          )}
                          <button onClick={() => handleDeleteBooking(booking)} className="text-red-500 hover:text-red-700 flex items-center text-xs font-bold bg-red-50 px-2 py-1 rounded transition">
                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {groupedBookings.length === 0 && (
                      <tr><td colSpan="5" className="p-8 text-center text-gray-500">No bookings found for this round.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin History Tab */}
          {adminTab === 'history' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl font-bold mb-6 flex items-center"><Archive className="mr-2 text-gray-500"/> Full Archive History</h2>
              <div className="bg-white rounded-xl shadow-md overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="p-3 border-b">Round</th>
                      <th className="p-3 border-b">Number</th>
                      <th className="p-3 border-b">User Info</th>
                      <th className="p-3 border-b">Txn / Status</th>
                      <th className="p-3 border-b">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                     {historyData.map((h, i) => (
                        <tr key={i} className={`border-b last:border-b-0 ${h.isWinner ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                           <td className="p-3 font-bold text-gray-500">R-{h.round}</td>
                           <td className="p-3 font-black text-lg">{h.id}</td>
                           <td className="p-3">
                              <div className="font-bold">{h.name}</div>
                              <div className="text-gray-500">{h.phone}</div>
                           </td>
                           <td className="p-3 font-mono text-gray-600">{h.txnId}</td>
                           <td className="p-3">
                             {h.isWinner ? <span className="text-yellow-600 font-bold flex items-center"><Trophy className="w-4 h-4 mr-1"/> WINNER</span> : <span className="text-gray-400">Lost</span>}
                           </td>
                        </tr>
                     ))}
                     {historyData.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500">No archived history.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin Settings Tab */}
          {adminTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-md animate-in fade-in">
              <h2 className="text-xl font-bold mb-6 border-b pb-2 flex items-center">
                <Settings className="mr-2 text-gray-500"/> System Settings
              </h2>
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Shop / Business Name (ဆိုင်အမည်)</label>
                  <input type="text" required value={systemSettings.shopName} onChange={(e) => setSystemSettings({...systemSettings, shopName: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-yellow-700 mb-1">KPay Number</label>
                    <input type="text" value={systemSettings.kpayNumber} onChange={(e) => setSystemSettings({...systemSettings, kpayNumber: e.target.value})} className="w-full border border-yellow-300 bg-yellow-50 p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-blue-700 mb-1">Wave Number</label>
                    <input type="text" value={systemSettings.waveNumber} onChange={(e) => setSystemSettings({...systemSettings, waveNumber: e.target.value})} className="w-full border border-blue-300 bg-blue-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Prize Image (E-Ticket ပေါ်တွင်ပြရန်)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition relative">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click or drag image to upload (Auto-resizes to fit)</p>
                  </div>
                  {systemSettings.ticketImage && (
                     <img src={systemSettings.ticketImage} alt="Preview" className="mt-3 h-40 w-auto object-cover rounded-lg border shadow-sm mx-auto" />
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Draw Date (ပေါက်မဲဖွင့်မည့်ရက်)</label>
                  <input type="date" required value={systemSettings.drawDate} onChange={(e) => setSystemSettings({...systemSettings, drawDate: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Voucher Footer Note (အောက်ခြေစာသား)</label>
                  <textarea rows="2" value={systemSettings.customNote} onChange={(e) => setSystemSettings({...systemSettings, customNote: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none"></textarea>
                </div>
                
                <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition shadow-md">
                  Save All Settings
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Admin End Round Modal */}
      {showEndRoundModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in">
            <div className="bg-red-600 p-4 text-white text-center">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-90" />
              <h3 className="font-black text-xl">DECLARE WINNER</h3>
              <p className="text-sm opacity-90">End Round {parseInt(systemSettings.currentRound) || 1}</p>
            </div>
            <form onSubmit={handleEndRound} className="p-6 space-y-4">
              <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm font-bold border border-red-200">
                သတိပြုရန်: မဲပေါက်ဂဏန်းရွေးချယ်ပြီးပါက ယခုလက်ရှိမဲအားလုံးကို History သို့ ရွှေ့မည်ဖြစ်ပြီး အကွက်များအားလုံး အလွတ် (Reset) ပြန်ဖြစ်သွားပါမည်။
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 block text-center mb-2">မဲပေါက်သော ဂဏန်း (Winning Number)</label>
                <input 
                  type="text" required maxLength="3" value={winNumberInput}
                  onChange={e => setWinNumberInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full border-2 border-slate-300 p-4 rounded-xl text-center text-3xl font-black focus:border-red-500 focus:ring-0 outline-none tracking-widest" 
                  placeholder="000" 
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowEndRoundModal(false)} className="w-1/2 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition">Cancel</button>
                <button type="submit" className="w-1/2 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition">Confirm End</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center"><Key className="w-4 h-4 mr-2"/> Admin Access</h3>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              {loginError && (<div className="bg-red-50 text-red-600 p-3 rounded text-sm font-medium border border-red-100 flex items-start"><Info className="w-5 h-5 mr-2 shrink-0 mt-0.5" /><span>{loginError}</span></div>)}
              <div>
                <label className="text-sm font-bold text-gray-700">Email</label>
                <input type="email" required value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full border p-3 rounded-lg mt-1 focus:ring-2 focus:ring-slate-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700">Password</label>
                <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full border p-3 rounded-lg mt-1 focus:ring-2 focus:ring-slate-500 outline-none" />
              </div>
              <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition">Login</button>
            </form>
          </div>
        </div>
      )}

      {/* User Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in my-8">
            <div className="bg-slate-900 p-4 text-white">
              <h3 className="text-lg font-bold">ဝယ်ယူရန် အချက်အလက်ဖြည့်ပါ</h3>
              <p className="text-yellow-400 text-sm mt-1">နံပါတ် {selectedNumbers.length} စောင် ရွေးချယ်ထားပါသည်</p>
            </div>
            
            <form onSubmit={handleSubmitBooking} className="p-5 space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-600 flex items-center"><User className="w-4 h-4 mr-1"/> အမည်</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="အမည် အပြည့်အစုံ" />
                
                <label className="text-sm font-semibold text-gray-600 flex items-center"><Phone className="w-4 h-4 mr-1"/> ဖုန်းနံပါတ်</label>
                <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="09xxxxxxxxx" />
                
                <label className="text-sm font-semibold text-gray-600 flex items-center"><MapPin className="w-4 h-4 mr-1"/> နေရပ်လိပ်စာ</label>
                <textarea required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" placeholder="အိမ်အမှတ်၊ လမ်း၊ မြို့နယ်" rows="2"></textarea>
              </div>

              {/* Payment Info Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div>
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ငွေလွှဲရန် အကောင့်များ</p>
                   <div className="grid grid-cols-2 gap-2">
                     <div className="bg-blue-100 p-2 rounded-lg text-center relative group cursor-pointer border border-blue-200" onClick={() => copyToClipboard(systemSettings.kpayNumber)}>
                        <div className="text-[10px] font-black text-blue-800 uppercase">KPay</div>
                        <div className="font-mono text-sm font-bold text-blue-900">{systemSettings.kpayNumber}</div>
                        <Copy className="w-3 h-3 text-blue-500 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" />
                     </div>
                     <div className="bg-yellow-100 p-2 rounded-lg text-center relative group cursor-pointer border border-yellow-400" onClick={() => copyToClipboard(systemSettings.waveNumber)}>
                        <div className="text-[10px] font-black text-yellow-800 uppercase">Wave</div>
                        <div className="font-mono text-sm font-bold text-yellow-900">{systemSettings.waveNumber}</div>
                        <Copy className="w-3 h-3 text-yellow-600 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" />
                     </div>
                   </div>
                </div>

                <div className="border-t pt-3">
                  <label className="text-sm font-semibold text-gray-700 block mb-1">လုပ်ငန်းစဉ် နောက်ဆုံး ၆ လုံး (Txn ID)</label>
                  <input required type="text" maxLength="6" value={formData.txnId} onChange={e => setFormData({...formData, txnId: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none font-mono tracking-widest bg-white" placeholder="ဥပမာ - 123456" />
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">ငွေလွှဲပြေစာ (Screenshot)</label>
                  <input required type="file" accept="image/*" onChange={(e) => { if(e.target.files[0]) setFormData({...formData, screenshot: "file_selected"}) }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300" />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="w-1/2 py-3 border-2 border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" className="w-1/2 py-3 bg-yellow-500 text-slate-900 rounded-lg font-bold hover:bg-yellow-400 transition shadow-md">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">အသိပေးချက်</h3>
            <p className="text-gray-600 mb-6">{showAlert}</p>
            <button onClick={() => setShowAlert('')} className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition">နားလည်ပါပြီ</button>
          </div>
        </div>
      )}

      {/* Secure E-Ticket Voucher Modal (Grouped) */}
      {showVoucher && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="relative my-8">
            <button onClick={() => setShowVoucher(null)} className="absolute -top-12 right-0 text-white font-bold bg-slate-800 px-4 py-2 rounded-full hover:bg-slate-700 z-10">အပိတ် (X)</button>
            <button className="absolute -top-12 left-0 text-slate-900 font-bold bg-yellow-400 px-4 py-2 rounded-full hover:bg-yellow-300 flex items-center space-x-2 z-10">
              <Download className="w-4 h-4"/> <span>Save Image</span>
            </button>

            <div id="voucher-capture" className="bg-[#1a1a1a] w-[90vw] max-w-md sm:min-w-[400px] rounded-2xl shadow-2xl overflow-hidden border border-yellow-500/30 relative mx-auto">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] overflow-hidden z-0">
                <div className="transform -rotate-45 text-[6rem] font-black text-white whitespace-nowrap leading-none">
                  {systemSettings.shopName.toUpperCase()}
                </div>
              </div>
              
              <div className="p-6 text-center border-b border-yellow-500/20 relative z-10 bg-gradient-to-b from-yellow-500/10 to-transparent pt-8">
                <h1 className="text-white font-bold text-xl mb-1">{systemSettings.shopName}</h1>
                <h2 className="text-yellow-500 font-black text-2xl tracking-widest uppercase">Official E-Ticket</h2>
                <div className="text-gray-400 text-xs mt-2 font-mono tracking-widest bg-black/40 inline-block px-3 py-1 rounded">SEC: {showVoucher.numbers[0] ? showVoucher.numbers[0] + 'X' + showVoucher.bookingId.substr(-4) : 'VALID'}</div>
              </div>

              <div className="relative h-48 w-full bg-slate-800 z-10 border-y border-yellow-500/10">
                <img src={systemSettings.ticketImage} alt="Prize" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent"></div>
                
                {/* Grouped Numbers Badge */}
                <div className="absolute -bottom-8 left-0 right-0 flex justify-center px-4">
                   <div className="bg-gradient-to-b from-yellow-400 to-yellow-600 text-slate-900 font-black px-6 py-3 rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.5)] border-4 border-[#1a1a1a] max-w-full text-center">
                     <div className="text-xs uppercase font-bold opacity-80 leading-none mb-1">Your Lucky Numbers</div>
                     <div className="text-3xl flex flex-wrap justify-center gap-x-2 leading-none">
                        {showVoucher.numbers.map((n, i) => <span key={n}>{n}{i < showVoucher.numbers.length -1 ? ',' : ''}</span>)}
                     </div>
                   </div>
                </div>
              </div>

              <div className="px-6 pt-12 pb-6 relative z-10 mt-2">
                <div className="space-y-4">
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-y-3">
                      <div className="text-gray-400 text-xs uppercase font-bold">Name</div>
                      <div className="text-white font-bold text-right truncate">{showVoucher.name}</div>
                      
                      <div className="text-gray-400 text-xs uppercase font-bold">Phone</div>
                      <div className="text-white font-bold text-right">{showVoucher.phone}</div>
                      
                      <div className="text-gray-400 text-xs uppercase font-bold">Total Tickets</div>
                      <div className="text-white font-bold text-right">{showVoucher.numbers.length}</div>
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
