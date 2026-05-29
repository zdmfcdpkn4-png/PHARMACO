// Sélectionne l'adaptateur selon VITE_USE_MOCK.
// Par défaut : mock (aucune base requise). Mettre VITE_USE_MOCK=false
// dans .env pour brancher le backend Express.
import { mockApi } from './mockApi.js';
import { httpApi } from './httpApi.js';

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export const api = useMock ? mockApi : httpApi;
export const IS_MOCK = useMock;
