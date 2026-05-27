import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

app.use('/api', routes);

app.use(errorMiddleware);

export default app;
