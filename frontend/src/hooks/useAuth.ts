'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [employeeName, setEmployeeName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('employeeName');
    if (savedName) {
      setEmployeeName(savedName);
      setIsLoggedIn(true);
    }
  }, []);

  const login = (name: string) => {
    if (!name.trim()) return;
    setEmployeeName(name);
    localStorage.setItem('employeeName', name);
    setIsLoggedIn(true);
  };

  const logout = () => {
    if (!confirm('Logout?')) return;
    localStorage.removeItem('employeeName');
    setEmployeeName('');
    setIsLoggedIn(false);
  };

  return { employeeName, isLoggedIn, login, logout };
}
