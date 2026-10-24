import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import IntroScreen from './components/IntroScreen';
import Dashboard from './pages/Dashboard';
import NewInspection from './pages/NewInspection';
import History from './pages/History';
import InspectionDetail from './pages/InspectionDetail';
import About from './pages/About';
import { fetchHealth } from './api';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedInspectionId, setSelectedInspectionId] = useState(null);
  const [health, setHealth] = useState(null);

  // Check if intro has been seen this session
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !sessionStorage.getItem('sourcescan_intro_seen');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => console.warn('Could not fetch health status:', err));
  }, []);

  const handleStartInspectionFromIntro = () => {
    try {
      sessionStorage.setItem('sourcescan_intro_seen', 'true');
    } catch {}
    setShowIntro(false);
    setActivePage('new-inspection');
  };

  const handleSkipIntro = () => {
    try {
      sessionStorage.setItem('sourcescan_intro_seen', 'true');
    } catch {}
    setShowIntro(false);
    setActivePage('dashboard');
  };

  const handleSelectInspection = (id) => {
    setSelectedInspectionId(id);
    setActivePage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInspectionSaved = (newId) => {
    setSelectedInspectionId(newId);
    setActivePage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      {showIntro && (
        <IntroScreen
          onStartInspection={handleStartInspectionFromIntro}
          onSkipIntro={handleSkipIntro}
        />
      )}

      <Navbar
        activePage={activePage}
        setActivePage={(page) => {
          setActivePage(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        health={health}
      />

      <main className="main-content">
        {activePage === 'dashboard' && (
          <Dashboard
            setActivePage={setActivePage}
            onSelectInspection={handleSelectInspection}
          />
        )}

        {activePage === 'new-inspection' && (
          <NewInspection
            onInspectionSaved={handleInspectionSaved}
            setActivePage={setActivePage}
          />
        )}

        {activePage === 'history' && (
          <History
            onSelectInspection={handleSelectInspection}
            setActivePage={setActivePage}
          />
        )}

        {activePage === 'detail' && selectedInspectionId && (
          <InspectionDetail
            inspectionId={selectedInspectionId}
            onBack={() => setActivePage('history')}
            onDeleted={() => {
              setSelectedInspectionId(null);
              setActivePage('history');
            }}
          />
        )}

        {activePage === 'about' && <About />}
      </main>

      <Footer />
    </div>
  );
}
