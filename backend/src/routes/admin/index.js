import { Router } from 'express';
import { requireAuth, requireStaff, PERMISSIONS } from '../../middleware/auth.js';
import dashboard from './dashboard.js';
import products from './products.js';
import orders from './orders.js';
import manage from './manage.js';
import reports from './reports.js';

const r = Router();
r.use(requireAuth, requireStaff);
r.get('/me', (req, res) => res.json({ user: req.user.toSafeJSON(), permissions: PERMISSIONS[req.user.role] }));
r.use('/dashboard', dashboard);
r.use('/products', products);
r.use('/orders', orders);
r.use('/reports', reports);
r.use('/', manage);
export default r;
