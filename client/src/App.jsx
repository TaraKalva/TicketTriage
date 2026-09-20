import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SubmitTicket from './pages/SubmitTicket.jsx';
import ReviewQueue from './pages/ReviewQueue.jsx';
import AllTickets from './pages/AllTickets.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="submit" element={<SubmitTicket />} />
        <Route path="review" element={<ReviewQueue />} />
        <Route path="tickets" element={<AllTickets />} />
      </Route>
    </Routes>
  );
}
