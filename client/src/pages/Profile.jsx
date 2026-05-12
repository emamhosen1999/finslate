import { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext.jsx';
import ActionButton from '../components/ActionButton.jsx';

export default function Profile() {
  const { user } = useFinance();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    timezone: 'Asia/Dhaka',
    date_format: 'DD/MM/YYYY',
    financial_year_start: 7,
    tin_number: '',
    nid_number: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        timezone: user.timezone || 'Asia/Dhaka',
        date_format: user.date_format || 'DD/MM/YYYY',
        financial_year_start: user.financial_year_start || 7,
        tin_number: user.tin_number || '',
        nid_number: user.nid_number || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-frame">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={user?.name || ''}
            disabled
            className="w-full p-3 border rounded-lg bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full p-3 border rounded-lg bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Timezone</label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full p-3 border rounded-lg"
          >
            <option value="Asia/Dhaka">Asia/Dhaka</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date Format</label>
          <select
            value={formData.date_format}
            onChange={(e) => setFormData({ ...formData, date_format: e.target.value })}
            className="w-full p-3 border rounded-lg"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Financial Year Start Month</label>
          <select
            value={formData.financial_year_start}
            onChange={(e) => setFormData({ ...formData, financial_year_start: parseInt(e.target.value) })}
            className="w-full p-3 border rounded-lg"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
              <option key={month} value={month}>
                {month} {month === 7 ? '(July - Bangladesh)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">TIN Number (Tax ID)</label>
          <input
            type="text"
            value={formData.tin_number}
            onChange={(e) => setFormData({ ...formData, tin_number: e.target.value })}
            className="w-full p-3 border rounded-lg"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">NID Number (National ID)</label>
          <input
            type="text"
            value={formData.nid_number}
            onChange={(e) => setFormData({ ...formData, nid_number: e.target.value })}
            className="w-full p-3 border rounded-lg"
            placeholder="Optional"
          />
        </div>

        <ActionButton type="submit" loading={loading} className="w-full">
          Save Profile
        </ActionButton>
      </form>
    </div>
  );
}
