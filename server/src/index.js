import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRouter from './routes/auth.js';
import boardsRouter from './routes/boards.js';
import groupsRouter from './routes/groups.js';
import tasksRouter from './routes/tasks.js';
import usersRouter from './routes/users.js';
import workspacesRouter from './routes/workspaces.js';
import alertsRouter from './routes/alerts.js';
import dependenciesRouter from './routes/dependencies.js';
import subtasksRouter from './routes/subtasks.js';
import teamsRouter from './routes/teams.js';
import shortcutsRouter from './routes/shortcuts.js';
import { notFound, errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Racine : petit message pour confirmer que l'API tourne (évite un 404 nu)
app.get('/', (_req, res) =>
  res.json({ service: 'pharmaco-api', health: '/api/health' })
);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'pharmaco-api' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/dependencies', dependenciesRouter);
app.use('/api/subtasks', subtasksRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/shortcuts', shortcutsRouter);

// Gestion des erreurs
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PHARMACO API en écoute sur http://localhost:${PORT}`);
});

export default app;
