// EmailProjectionsFormTailwind.js
import React, { useState } from 'react';

export default function EmailProjectionsFormTailwind({
  open,
  onClose,
  projectionsHtml,
  onSuccess,
}) {
  // Always call hooks at the top
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bookAppointment, setBookAppointment] = useState(false);

  // Then conditionally render based on the "open" prop
  if (!open) return null;

  const handleSubmit = async () => {
    if (!email) {
      alert('Please enter your email.');
      return;
    }

    const payload = {
      name,
      email,
      phone,
      bookAppointment,
      projectionsHtml,
    };

    try {
      // Replace with your Make.com webhook URL (or GHL endpoint)
      const res = await fetch('https://hook.us2.make.com/0njwmi8q4ki296pupsveg4bpv24a8u6q', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(bookAppointment);
        onClose();
      } else {
        alert('Error sending projections.');
      }
    } catch (error) {
      console.error('Email error:', error);
      alert('An error occurred while sending the email.');
    }
  };

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'>
      <div className='bg-white rounded-lg shadow-lg w-11/12 md:w-1/2 p-6'>
        <h2 className='text-2xl font-bold mb-4'>Email Me My Projections</h2>
        <div className='space-y-4'>
          <input
            type='text'
            placeholder='Name (First and Last)'
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='w-full border border-gray-300 p-2 rounded'
          />
          <input
            type='email'
            placeholder='Email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className='w-full border border-gray-300 p-2 rounded'
          />
          <input
            type='text'
            placeholder='Phone'
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className='w-full border border-gray-300 p-2 rounded'
          />
          <div className='flex items-center'>
            <input
              type='checkbox'
              id='appointment'
              checked={bookAppointment}
              onChange={(e) => setBookAppointment(e.target.checked)}
              className='mr-2'
            />
            <label htmlFor='appointment'>
              I would like to book an appointment with the licensing team.
            </label>
          </div>
        </div>
        <div className='mt-6 flex justify-end space-x-3'>
          <button
            onClick={onClose}
            className='px-4 py-2 bg-gray-300 rounded hover:bg-gray-400'
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
