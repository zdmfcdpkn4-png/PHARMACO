import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import boardsRouter from './routes/boards.js';
import groupsRouter from './routes/groups.js';
import tasksRouter from './routes/tasks.js';
import usersRouter from './routes/users.js';
import workspacesRouter from './routes/workspaces.js';
import alertsRouter from './routes/alerts.js';
import { notFound, errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'pharmaco-api' }));

// Routes
app.use('/api/workspaces', workspacesRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/alerts', alertsRouter);

// Gestion des erreurs
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PHARMACO API en écoute sur http://localhost:${PORT}`);
});

export default app;
