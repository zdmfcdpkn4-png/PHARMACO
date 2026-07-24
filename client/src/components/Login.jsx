import { useState } from 'react';
import { LogIn, Mail, Lock, Loader2, KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../api/index.js';
import Logo from './Logo.jsx';

// Page de connexion. Au succès, appelle onAuth({ token, user }).
// Si le compte impose un changement de mot de passe (must_change_password),
// une seconde étape bloque l'accès tant qu'un nouveau mot de passe n'est
// pas enregistré.
export default function Login({ onAuth }) {
  const [step, setStep] = useState('login'); // 'login' | 'change'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.user?.must_change_password) {
        // Accès suspendu tant que le mot de passe initial n'est pas remplacé.
        setStep('change');
      } else {
        onAuth(res);
      }
    } catch (err) {
      setError(err.message || 'Échec de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const submitChange = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const res = await api.changePassword(email, password, newPassword);
      onAuth(res);
    } catch (err) {
      setError(err.message || 'Échec du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size={72} withRing />
          <h1 className="text-xl font-bold tracking-wide text-primary">PHARMACO</h1>
          <p className="text-sm text-gray-500">
            {step === 'change'
              ? 'Choisissez un nouveau mot de passe'
              : 'Connectez-vous à votre espace de travail'}
          </p>
        </div>

        {step === 'login' ? (
          <form
            onSubmit={submit}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            {/* Email */}
            <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-primary">
              <Mail size={16} className="text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="username"
                required
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>

            {/* Mot de passe */}
            <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-primary">
              <Lock size={16} className="text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-status-blocked">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              Se connecter
            </button>
          </form>
        ) : (
          <form
            onSubmit={submitChange}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-primary">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <span>
                Première connexion : pour sécuriser le compte{' '}
                <span className="font-semibold">{email}</span>, choisissez un nouveau
                mot de passe (8 caractères minimum).
              </span>
            </div>

            {/* Nouveau mot de passe */}
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nouveau mot de passe
            </label>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-primary">
              <KeyRound size={16} className="text-gray-400" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>

            {/* Confirmation */}
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Confirmer le mot de passe
            </label>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-primary">
              <Lock size={16} className="text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-status-blocked">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              Enregistrer et se connecter
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
