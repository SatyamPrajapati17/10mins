// src/App.tsx
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './lib/types';
import { getCurrentUser, logoutUser, loginApi } from './lib/api';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Lab } from './pages/Lab';
import { Metrics } from './pages/Metrics';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'lab' | 'metrics'>('dashboard');

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  const handleSwitchUser = async (role: UserRole) => {
    const roleEmailMap: Record<UserRole, string> = {
      viewer: 'officer@demo.first10',
      duty_officer: 'officer@demo.first10',
      supervisor: 'supervisor@demo.first10',
      analyst: 'analyst@demo.first10',
      admin: 'admin@demo.first10'
    };
    const targetEmail = roleEmailMap[role];
    try {
      const res = await loginApi(targetEmail, 'password123');
      setCurrentUser(res.user);
    } catch (err) {
      console.error('Failed to switch demo role:', err);
    }
  };

  if (!currentUser) {
    return <Login onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-base text-cream flex flex-col font-sans selection:bg-accent selection:text-cream">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onQuickDemo={() => setCurrentTab('dashboard')}
      />

      <main className="flex-1 pb-10">
        {currentTab === 'dashboard' && <Dashboard currentUser={currentUser} />}
        {currentTab === 'lab' && <Lab onSelectEpisode={() => setCurrentTab('dashboard')} />}
        {currentTab === 'metrics' && <Metrics />}
      </main>
    </div>
  );
};

export default App;
