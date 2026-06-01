import { useState } from 'react';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';
import { api } from '../api/index.js';

// Page de connexion. Au succès, appelle onAuth({ token, user }).
export default function Login({ onAuth }) {
  const [email, setEmail] = useState('erwin.raingeard@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      onAuth(res);
    } catch (err) {
      setError(err.message || 'Échec de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-white">
            P
          </div>
          <h1 className="text-xl font-bold text-gray-800">PHARMACO</h1>
          <p className="text-sm text-gray-500">Connectez-vous à votre espace de travail</p>
        </div>

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

          {/* Identifiants de démonstration */}
          <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <div className="font-semibold text-gray-600">Compte de démonstration</div>
            <div>Identifiant : <span className="font-mono">erwin.raingeard@gmail.com</span></div>
            <div>Mot de passe : <span className="font-mono">pharmaco123</span></div>
          </div>
        </form>
      </div>
    </div>
  );
}
