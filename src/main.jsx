import React from 'react'
import ReactDOM from 'react-dom/client'

// Local (VS Code) တွင် အသုံးပြုရန် အောက်ပါ ၂ ကြောင်း၏ ရှေ့မှ // များကို ဖျက်၍ အသုံးပြုပါ။
import App from './App.jsx'
import './index.css'

// ဤသည်မှာ Canvas တွင် Error မပြစေရန် ရေးသားထားသော ယာယီကုဒ်ဖြစ်ပါသည်။
const App = () => (
  <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
    <h2 style={{ color: '#eab308', marginBottom: '20px' }}>VIP Car Lucky Draw System</h2>
    <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
      VS Code တွင် အထက်ပါ Comment ပိတ်ထားသော <code>import App from './App.jsx'</code> နှင့် <code>import './index.css'</code> များကို ဖွင့်၍ အသုံးပြုပါ။<br/>
      ထို့နောက် GitHub သို့ ဆက်လက် တင်နိုင်ပါပြီ။
    </p>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)