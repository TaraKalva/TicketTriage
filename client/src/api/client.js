import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getMeta = () => api.get('/tickets/meta').then((r) => r.data);
export const listTickets = (params = {}) => api.get('/tickets', { params }).then((r) => r.data);
export const getTicket = (id) => api.get(`/tickets/${id}`).then((r) => r.data);
export const createTicket = (payload) => api.post('/tickets', payload).then((r) => r.data);
export const reviewTicket = (id, payload) => api.patch(`/tickets/${id}/review`, payload).then((r) => r.data);
export const resolveTicket = (id) => api.patch(`/tickets/${id}/resolve`).then((r) => r.data);
export const reopenTicket = (id) => api.patch(`/tickets/${id}/reopen`).then((r) => r.data);
export const deleteTicket = (id) => api.delete(`/tickets/${id}`).then((r) => r.data);

export const getDashboardSummary = () => api.get('/dashboard/summary').then((r) => r.data);
export const getRiskScores = () => api.get('/dashboard/risk-scores').then((r) => r.data);
export const recomputeRiskScores = () => api.post('/dashboard/risk-scores/recompute').then((r) => r.data);
export const getNextTicketPrediction = () => api.get('/dashboard/predict-next-ticket').then((r) => r.data);
export const recomputeNextTicketPrediction = () =>
  api.post('/dashboard/predict-next-ticket/recompute').then((r) => r.data);
export const recomputeAll = () => api.post('/dashboard/recompute').then((r) => r.data);

export default api;
